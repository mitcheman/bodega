// Detect whether outbound email is configured for this deployment.
//
// Bodega ships email-off by default — see deploy/SKILL.md Step 5. The
// merchant explicitly opts in by setting RESEND_API_KEY + BODEGA_FROM_EMAIL,
// because the only working defaults would require Bodega to operate a
// shared Resend account on behalf of every merchant (which we deliberately
// don't do — we're a plugin, not a SaaS).
//
// When email is off:
//   - The public /api/bodega/auth/login endpoint silently no-ops the
//     send (anti-enumeration: caller still gets the constant "check your
//     inbox" response). The verify URL is logged server-side so the
//     operator can find it in Vercel logs if they need to.
//   - The admin-protected /api/bodega/auth/magic-link endpoint returns
//     the verify URL in the response body so the calling skill can show
//     it to the operator. Safe because the endpoint is already gated by
//     BODEGA_ADMIN_SECRET — see security analysis in admin/SKILL.md.

export type EmailConfigStatus =
  | { ok: true }
  | { ok: false; reason: string };

export function isEmailConfigured(): EmailConfigStatus {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: 'RESEND_API_KEY not set' };
  }
  if (!process.env.BODEGA_FROM_EMAIL) {
    return { ok: false, reason: 'BODEGA_FROM_EMAIL not set' };
  }
  return { ok: true };
}
