// POST /api/bodega/auth/logout
//
// Ends the studio session and redirects to the login page.
//
// Mount at app/api/bodega/auth/logout/route.ts:
//   export { POST } from '@bodega/studio/routes/auth-logout';

import { NextResponse, type NextRequest } from 'next/server';
import { endSession } from '../auth/session.js';

export async function POST(req: NextRequest) {
  await endSession();
  const origin = new URL(req.url).origin;
  return NextResponse.redirect(`${origin}/studio/login`, { status: 303 });
}
