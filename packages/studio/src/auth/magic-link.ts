// Magic-link auth for /studio. Server-only.
//
// Flow:
//   1. Merchant enters email on /studio/login → POST /api/bodega/auth/login
//   2. Handler calls createMagicLink(email) → record stored, url emailed
//   3. Merchant clicks the emailed link → GET /studio/verify?token=...
//   4. Handler calls verifyMagicLink(token) → returns session payload
//   5. Session cookie issued (see session.ts); merchant lands in /studio
//
// One-time use: verify atomically consumes the record before returning.

import { randomBytes } from 'node:crypto';

export type StudioRole = 'owner' | 'manager' | 'product-editor' | 'packer';

export interface MagicLinkOptions {
  email: string;
  role: StudioRole;
  /** TTL in milliseconds. Defaults to 24 hours. */
  ttl_ms?: number;
}

export interface MagicLinkRecord {
  /** URL-safe token, 32 bytes of entropy. */
  token: string;
  email: string;
  role: StudioRole;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface Session {
  email: string;
  role: StudioRole;
  issued_at: string;
}

/** Storage interface — implementation in blob-storage.ts. */
export interface MagicLinkStorage {
  put(record: MagicLinkRecord): Promise<void>;
  /** Consume-or-fail: returns the record iff it existed and was unused. */
  consume(token: string): Promise<MagicLinkRecord>;
  /** Cleanup: delete expired records. */
  purgeExpired(): Promise<number>;
}

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Create a new magic-link record. Returns the token — caller emails the
 * URL containing it. Store it first (via storage.put) so verify works.
 *
 * The URL the user receives looks like:
 *   https://<store>/studio/verify?token=<record.token>
 */
export async function createMagicLink(
  opts: MagicLinkOptions,
  storage: MagicLinkStorage,
): Promise<MagicLinkRecord> {
  const email = opts.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email is required.');
  }

  const now = Date.now();
  const ttl = opts.ttl_ms ?? DEFAULT_TTL_MS;

  const record: MagicLinkRecord = {
    token: randomBytes(32).toString('base64url'),
    email,
    role: opts.role,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttl).toISOString(),
    consumed_at: null,
  };

  await storage.put(record);
  return record;
}

/**
 * Verify a token. Returns the session payload if valid; throws on any
 * failure (unknown, expired, already consumed). Atomically consumes.
 */
export async function verifyMagicLink(
  token: string,
  storage: MagicLinkStorage,
): Promise<Session> {
  const record = await storage.consume(token);
  return {
    email: record.email,
    role: record.role,
    issued_at: record.consumed_at ?? new Date().toISOString(),
  };
}
