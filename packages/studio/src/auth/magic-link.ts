// Magic-link auth for /studio. Server-only functions.
//
// Flow:
//   1. Operator runs bodega-admin → we call createMagicLink(email, role)
//   2. We return a one-time token; caller emails a URL containing it
//   3. Merchant clicks the link → GET /studio/login?token=...
//   4. Server calls verifyMagicLink(token) → returns the session payload
//   5. Session cookie set; token is invalidated
//
// The token is stored alongside the expiry and role in storage (Vercel
// Blob in Phase 1). One-time-use: first verify wins; subsequent calls fail.

export type StudioRole = 'owner' | 'manager' | 'product-editor' | 'packer';

export interface MagicLinkOptions {
  email: string;
  role: StudioRole;
  /** TTL in milliseconds. Defaults to 24 hours. */
  ttl_ms?: number;
}

export interface MagicLinkRecord {
  token: string; // 32-byte random, base64url
  email: string;
  role: StudioRole;
  created_at: string; // ISO 8601
  expires_at: string; // ISO 8601
  consumed_at: string | null;
}

export interface Session {
  email: string;
  role: StudioRole;
  issued_at: string;
}

/**
 * Create a new magic-link record. Caller is responsible for emailing
 * the URL (our `admin` skill uses Resend via the shared sending domain).
 *
 * @returns The record, including the token. Store this server-side;
 *   the email body embeds only the token (in a URL).
 */
export async function createMagicLink(
  _opts: MagicLinkOptions,
  _storage: MagicLinkStorage,
): Promise<MagicLinkRecord> {
  // Implementation lands in the components pass.
  throw new Error('createMagicLink not implemented yet');
}

/**
 * Verify a token. Returns the session payload if valid; throws if
 * expired, consumed, or unknown.
 *
 * This function MUST mark the record as consumed atomically to prevent
 * replay. The storage layer's consume-or-fail semantics are assumed.
 */
export async function verifyMagicLink(
  _token: string,
  _storage: MagicLinkStorage,
): Promise<Session> {
  throw new Error('verifyMagicLink not implemented yet');
}

/** Storage interface for magic-link records. Implemented by Vercel Blob. */
export interface MagicLinkStorage {
  put(record: MagicLinkRecord): Promise<void>;
  /** Consume-or-fail: returns the record iff it existed and was unused. */
  consume(token: string): Promise<MagicLinkRecord>;
  /** For cleanup: delete expired records. */
  purgeExpired(): Promise<number>;
}
