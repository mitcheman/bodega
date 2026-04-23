---
name: admin
description: Provisions the merchant-facing /studio admin UI, generates a magic-link login for the merchant, sends a welcome email, and (in handoff mode) assembles a handoff package the operator can forward.
---

# Bodega: Admin + Handoff

Sets up `/studio` and, in handoff mode, prepares the materials to
hand off.

## Pre-checks

1. Read `.bodega.md`. Require:
   - `state.deploy: done` (or `preview`)
   - `merchant.email` set (either `operator.email` if self, or
     `merchant.email` if handoff)
2. Verify `/studio` route is live (HEAD request to
   `https://<url>/studio/login`).

## Step 1 — Generate the magic link

Use the SDK's `createMagicLink` server function. Link TTL: 24 hours.

```
POST https://<url>/api/bodega/auth/magic-link
{ "email": "<merchant.email>", "role": "owner" }
```

## Step 2 — Send the welcome email

Use the `welcome-email.md` template at
`.cursor/skills/admin/scripts/../reference/welcome-email.md`. Substitute:

- `{store_name}` → `business.name`
- `{store_url}` → deployed URL
- `{studio_url}` → `<url>/studio`
- `{magic_link}` → from Step 1
- `{operator_name}` → if handoff, the operator's display name (git
  config or Vercel account)
- `{operator_support}` → default bodega support email; agency users
  (e.g., freelancers) can override with their own.

Send via our shared Resend sending domain (`orders@bodega.my`).
Record in `.bodega.md`:

```yaml
admin:
  welcome_email_sent_at: 2026-04-22T14:35:00Z
  magic_link_expires_at: 2026-04-23T14:35:00Z
```

## Step 3 — Seed the first-run walkthrough

On first login, `/studio` shows a guided walkthrough, not an empty
dashboard. The SDK handles this via a client-side check.

Enable via `.bodega.md`:

```yaml
admin:
  first_run_walkthrough: true
```

Walkthrough covers:
1. Add your first product (photo, title, price, publish — 4 taps)
2. Set shipping options (flat rate, zones)
3. Set return/refund policy (template, she edits)
4. Share your store (IG caption, link-in-bio QR)

## Step 4 — Handoff package (if `handoff: true`)

Create `.bodega/handoff/` with three files:

### a) `welcome-email-preview.md`

Copy of the email as sent. Operator reads it to know what was delivered.

### b) `how-your-store-works.md`

From `.cursor/skills/admin/scripts/../reference/how-your-store-works.md`. One-pager
in the merchant's voice. Covers:
- Logging into studio
- Adding a product
- Seeing orders
- Shipping an order
- Getting paid (Stripe payouts)
- Asking for help

### c) `announcement-blurb.md`

From `.cursor/skills/admin/scripts/../reference/announcement-blurb.md`. Short
message for DM/text/Slack:

> *"Hey — your store is live at muddmannstudio.com. Login link I just
> sent you is in your email. Let me know if anything's weird."*

Tell the operator in chosen voice:

### Developer voice:

> Handoff package at `.bodega/handoff/`. Review and forward.
> Welcome email sent to `partner@muddmann.studio` at [time].

### Simple voice:

> I prepared a welcome package for you — it's in a folder called
> `.bodega/handoff` in your project. Three files:
>
> 1. A copy of the email I sent your partner
> 2. A how-to guide you can print or text her
> 3. A short message you can text her right now
>
> I already emailed her the login link — you don't have to do anything
> unless you want to tweak the copy first.

## Step 4b — Self-operator confirmation (if `handoff: false`)

When the store owner is running this themselves, there's no handoff
package — just a login link in their inbox. Tell them what to expect.

### Developer voice:

> ✓ Magic link sent to `<operator.email>`. Expires in 24h.
> `/studio` is live at https://<url>/studio.

### Simple voice:

> ✓ Your admin is set up. I just emailed you a login link — check your
> inbox in a minute (and peek at your spam folder if it's not there).
>
> Click the link and you'll land in your store's admin, where you can
> add products, see orders, and manage shipping. The link expires in
> 24 hours; if you miss it, run `/bodega:admin` again
> and I'll send a fresh one.

## Step 5 — Update `.bodega.md`

```yaml
state:
  admin: done
admin:
  welcome_email_sent_at: <timestamp>
  magic_link_expires_at: <timestamp>
  first_run_walkthrough: true
  handoff_package_path: .bodega/handoff/  # if handoff: true
```

## Standalone invocation

When run directly, skip handoff regeneration unless asked. Use cases:

- Merchant forgot magic link → regenerate + resend
- Operator wants to update welcome copy → regenerate + resend
- Invite staff → use `/bodega:invite` instead

## Rules

- **Never show the magic link in output** unless explicitly asked.
  One-time-use links in transcripts risk accidental use or sharing.
- **Send welcome email from our shared domain by default.** Custom-domain
  sending requires DNS verification; that's a later step if the merchant
  wants mail from `orders@muddmannstudio.com`.
- **Handoff package is local-only.** Don't upload anywhere. Operator
  forwards manually — their choice what to send.
