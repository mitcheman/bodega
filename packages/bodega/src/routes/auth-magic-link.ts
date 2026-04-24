// POST /api/bodega/auth/magic-link
//
// Admin-facing endpoint. Called by the bodega:admin and bodega:invite
// skills (from scripts, not from the browser) to create a magic link for
// a specific merchant or staff member and either email it or return it
// in the response (when email isn't configured yet).
//
// Protected by BODEGA_ADMIN_SECRET — the skill scripts include this
// header when calling. Reject requests without it.
//
// Mount at app/api/bodega/auth/magic-link/route.ts:
//   export { POST } from '@mitcheman/bodega/routes/auth-magic-link';

import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';
import { createMagicLink, type StudioRole } from '../auth/magic-link.js';
import { getMagicLinkStorage } from '../auth/blob-storage.js';
import { isEmailConfigured } from '../auth/email-config.js';

let resendClient: Resend | null = null;
function resend(): Resend {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set.');
  resendClient = new Resend(key);
  return resendClient;
}

interface AdminMagicLinkBody {
  email?: string;
  role?: StudioRole;
  /** Customize the subject line for welcome vs. re-invite. */
  subject?: string;
  /** Optional: override the email body with a pre-composed template
   *  (e.g., the rendered welcome-email.md from the admin skill). */
  html?: string;
}

export async function POST(req: NextRequest) {
  // AuthZ check.
  const provided = req.headers.get('x-bodega-admin-secret');
  const expected = process.env.BODEGA_ADMIN_SECRET;
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as AdminMagicLinkBody | null;
  const email = body?.email?.trim().toLowerCase();
  const role = body?.role ?? 'owner';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { message: 'A valid email is required.' },
      { status: 400 },
    );
  }

  const storage = getMagicLinkStorage();
  const record = await createMagicLink({ email, role }, storage);

  const origin = new URL(req.url).origin;
  const verifyUrl = `${origin}/studio/verify?token=${record.token}`;
  const storeName = process.env.BODEGA_STORE_NAME ?? 'your store';

  // Email-off bootstrap path. The merchant deployed without configuring
  // Resend (the recommended default — see deploy/SKILL.md Step 5). Hand
  // the link back to the calling skill so the operator can show it to
  // the merchant manually. Safe because:
  //   1. This endpoint is admin-secret-gated; only the operator's
  //      skill scripts can reach it.
  //   2. Anyone holding BODEGA_ADMIN_SECRET could already mint a link
  //      AND read it from the response (we already echo verify_url
  //      below in the success path), so this path doesn't expand
  //      privilege — it just removes the email side-channel.
  //   3. The link is still a 24h, one-time-use, 32-byte token.
  // The corresponding security note lives in source/skills/admin/SKILL.md.
  const emailStatus = isEmailConfigured();
  if (!emailStatus.ok) {
    return NextResponse.json({
      message: 'Magic link generated. Email is not configured — show this URL to the user manually.',
      email_sent: false,
      email_unconfigured_reason: emailStatus.reason,
      verify_url: verifyUrl,
      expires_at: record.expires_at,
    });
  }

  // Email-on path. From here, both RESEND_API_KEY and BODEGA_FROM_EMAIL
  // are guaranteed present (isEmailConfigured() short-circuits otherwise).
  const fromAddress = process.env.BODEGA_FROM_EMAIL!;

  const html =
    body?.html ??
    `
<!DOCTYPE html>
<html><body style="font-family: system-ui, sans-serif; max-width: 520px; margin: 2rem auto; padding: 1rem; color: #2b231c;">
  <p>Hi,</p>
  <p>Here's your sign-in link for <strong>${escapeHtml(storeName)}</strong>:</p>
  <p style="margin: 2rem 0;">
    <a href="${verifyUrl}" style="background: #b4552e; color: #f5eedf; padding: 0.75rem 1.5rem; text-decoration: none; display: inline-block;">
      Open your studio
    </a>
  </p>
  <p style="color: #666; font-size: 0.9rem;">
    The link expires in 24 hours.
  </p>
  <p style="color: #666; font-size: 0.85rem; word-break: break-all;">
    Or copy this URL: ${verifyUrl}
  </p>
</body></html>
    `.trim();

  try {
    await resend().emails.send({
      from: `${storeName} <${fromAddress}>`,
      to: email,
      subject: body?.subject ?? `Your ${storeName} studio access`,
      html,
      text: `Click to sign in: ${verifyUrl}`,
    });
  } catch (err) {
    console.error('[bodega admin] failed to send magic link:', err);
    return NextResponse.json(
      { message: 'Failed to send email. Check Resend logs.' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    message: 'Magic link sent.',
    email_sent: true,
    // We echo the URL only to the authenticated admin caller — useful
    // for scripts that want to log or cache it. Never expose this
    // endpoint publicly.
    verify_url: verifyUrl,
    expires_at: record.expires_at,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
