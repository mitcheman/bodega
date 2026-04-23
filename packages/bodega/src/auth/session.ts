// Signed session cookies for /studio. Minimal JWT-style: base64 payload
// plus HMAC-SHA256 signature. Not a JWT library — we don't need the full
// spec, and avoiding another dep keeps the SDK slim.
//
// Cookie layout:
//   bodega_studio_session = <base64(payload)>.<base64(signature)>
//
// Where payload = JSON.stringify({ email, role, iat, exp }).

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { Session, StudioRole } from './magic-link.js';

const COOKIE_NAME = 'bodega_studio_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

interface Payload {
  email: string;
  role: StudioRole;
  iat: number;
  exp: number;
}

function secret(): Buffer {
  const value = process.env.BODEGA_SESSION_SECRET;
  if (!value) {
    throw new Error(
      'BODEGA_SESSION_SECRET is not set. Generate one with `openssl rand -base64 32` and add it to Vercel env.',
    );
  }
  return Buffer.from(value, 'utf8');
}

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

function sign(payload: Payload): string {
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

function verify(token: string): Payload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = base64url(createHmac('sha256', secret()).update(body).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64url(body).toString('utf8')) as Payload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────

/** Issue a new session cookie. Called after successful magic-link verify. */
export async function issueSession(
  email: string,
  role: StudioRole,
): Promise<void> {
  const now = Date.now();
  const payload: Payload = {
    email,
    role,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const token = sign(payload);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** Read the current session, or null if missing/invalid/expired. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  return {
    email: payload.email,
    role: payload.role,
    issued_at: new Date(payload.iat).toISOString(),
  };
}

/** Destroy the session. Called from /studio/logout. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
