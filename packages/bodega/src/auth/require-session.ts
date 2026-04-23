// Server helper for API routes that require an authenticated session.
// Throws a NextResponse-compatible error if absent, so routes can early-return.

import { NextResponse } from 'next/server';
import { getSession } from './session.js';
import type { Session } from './magic-link.js';

/**
 * Require a session in a route handler. Returns either the session or a
 * 401 response to return directly.
 *
 *   const sessionOrRes = await requireSession();
 *   if (sessionOrRes instanceof NextResponse) return sessionOrRes;
 *   const session = sessionOrRes;
 */
export async function requireSession(): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { message: 'Not signed in.' },
      { status: 401 },
    );
  }
  return session;
}

/**
 * Stricter: require owner role specifically. Returns 403 if wrong role.
 */
export async function requireOwner(): Promise<Session | NextResponse> {
  const check = await requireSession();
  if (check instanceof NextResponse) return check;
  if (check.role !== 'owner' && check.role !== 'manager') {
    return NextResponse.json(
      { message: 'Not allowed.' },
      { status: 403 },
    );
  }
  return check;
}
