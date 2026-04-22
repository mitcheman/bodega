// POST /api/bodega/auth/login
//
// Body: { email }
// Behavior: if the email matches the configured store owner/staff, create
// a magic-link record and email the URL. Response is always 200 with
// "check your inbox" — we don't leak whether the email is registered.
//
// Mount at app/api/bodega/auth/login/route.ts:
//   export { POST } from '@bodega/studio/routes/auth-login';

import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';
import { createMagicLink } from '../auth/magic-link.js';
import { getMagicLinkStorage } from '../auth/blob-storage.js';

const MERCHANT_EMAIL = () => process.env.BODEGA_MERCHANT_EMAIL?.toLowerCase();
const FROM_ADDRESS = () =>
  process.env.BODEGA_FROM_EMAIL ?? 'orders@bodega.email';
const STORE_NAME = () => process.env.BODEGA_STORE_NAME ?? 'your store';

let resendClient: Resend | null = null;
function resend(): Resend {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set.');
  resendClient = new Resend(key);
  return resendClient;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { message: 'A valid email is required.' },
      { status: 400 },
    );
  }

  // Constant response whether or not the email is registered — prevents
  // enumeration.
  const ok = NextResponse.json({
    message: "If that email belongs to this store, a login link is on its way.",
  });

  if (email !== MERCHANT_EMAIL()) {
    // Not a known owner. Don't create a magic link. Don't send email.
    // Caller receives the same "check inbox" response.
    return ok;
  }

  const storage = getMagicLinkStorage();
  const record = await createMagicLink(
    { email, role: 'owner' },
    storage,
  );

  const origin = new URL(req.url).origin;
  const verifyUrl = `${origin}/studio/verify?token=${record.token}`;

  try {
    await resend().emails.send({
      from: `${STORE_NAME()} <${FROM_ADDRESS()}>`,
      to: email,
      subject: `Your ${STORE_NAME()} studio login link`,
      html: renderLoginEmail(STORE_NAME(), verifyUrl),
      text: `Click to sign in to your studio: ${verifyUrl}\n\nThe link expires in 24 hours.`,
    });
  } catch (err) {
    // If email sending fails, we still don't reveal that to the caller
    // (to avoid enumeration). Log for operators.
    console.error('[bodega auth] failed to send magic link:', err);
  }

  return ok;
}

function renderLoginEmail(storeName: string, url: string): string {
  return `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; max-width: 520px; margin: 2rem auto; padding: 1rem; color: #2b231c;">
  <p>Hi,</p>
  <p>Here's your one-time sign-in link for <strong>${escapeHtml(storeName)}</strong>:</p>
  <p style="margin: 2rem 0;">
    <a href="${url}" style="background: #b4552e; color: #f5eedf; padding: 0.75rem 1.5rem; text-decoration: none; display: inline-block;">
      Open your studio
    </a>
  </p>
  <p style="color: #666; font-size: 0.9rem;">
    The link expires in 24 hours. If you didn't ask for this, ignore the email — the link is one-time-use.
  </p>
  <p style="color: #666; font-size: 0.85rem; word-break: break-all;">
    Or copy this URL: ${url}
  </p>
</body></html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
