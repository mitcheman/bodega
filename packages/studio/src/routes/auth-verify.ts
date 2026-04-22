// GET /studio/verify?token=...
//
// Called when the merchant clicks the emailed magic link. Consumes the
// token, issues a session cookie, redirects to /studio.
//
// Mount at app/studio/verify/route.ts:
//   export { GET } from '@bodega/studio/routes/auth-verify';

import { NextResponse, type NextRequest } from 'next/server';
import { verifyMagicLink } from '../auth/magic-link.js';
import { getMagicLinkStorage } from '../auth/blob-storage.js';
import { issueSession } from '../auth/session.js';

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  const origin = new URL(req.url).origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/studio/login?error=missing-token`);
  }

  try {
    const session = await verifyMagicLink(token, getMagicLinkStorage());
    await issueSession(session.email, session.role);
    return NextResponse.redirect(`${origin}/studio`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in failed.';
    const params = new URLSearchParams({ error: message });
    return NextResponse.redirect(`${origin}/studio/login?${params.toString()}`);
  }
}
