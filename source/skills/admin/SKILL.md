---
name: admin
description: Provisions the merchant-facing /studio admin UI, generates a magic-link login for the merchant, sends a welcome email, and (in handoff mode) assembles a handoff package the operator can forward.
user-invocable: true
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

The `/api/bodega/auth/magic-link` endpoint is **admin-protected**:
it requires the `BODEGA_ADMIN_SECRET` value (provisioned during
`{{command_prefix}}bodega:deploy` Step 5) in the
`x-bodega-admin-secret` header. Without the header, the endpoint
returns `401`. This prevents anyone from spamming magic links to
arbitrary emails.

Read the secret from Vercel env (don't print the value):

```
vercel env pull .env.production.local --environment=production --yes
# `--yes` skips the overwrite-confirmation prompt (would hang in
# non-TTY/agent shells if the file already exists).
# Use BODEGA_ADMIN_SECRET in-memory only; don't echo.
```

Then call the endpoint:

```
POST https://<url>/api/bodega/auth/magic-link
Headers:
  Content-Type: application/json
  x-bodega-admin-secret: <BODEGA_ADMIN_SECRET>
Body:
  { "email": "<merchant.email>", "role": "owner" }
```

Delete `.env.production.local` immediately after the call so the
secret doesn't sit on disk:

```
rm .env.production.local
```

> **If you call the endpoint without the header**, you'll get
> `401 unauthorized`. That's the intended behaviour — the magic-link
> endpoint is not meant to be public, and merchants would be vulnerable
> to spam if it were.

### Branch on the response: did email actually send?

The endpoint returns `email_sent: true | false`. Two paths:

**`email_sent: true`** — Resend delivered. Tell the user to check
their inbox. Don't show the URL anywhere.

**`email_sent: false`** — The deploy was set up with `state.email_setup:
pending` (the recommended default — see `deploy/SKILL.md` Step 5). The
response body includes `verify_url`. Surface it directly:

#### Simple voice:

> Email isn't set up yet for this store, so I'll show you the login
> link here. Open this in your browser to log in for the first time:
>
>   <verify_url>
>
> Heads up — this link is one-time use, expires in 24 hours, and
> grants full owner access. Anyone who sees it can log in as you, so
> don't paste it in chat or share it. Once you're in, you can set up
> Resend later if you want emailed login links going forward.

#### Developer voice:

> Email unconfigured (RESEND_API_KEY / BODEGA_FROM_EMAIL unset).
> Bootstrap link (24h TTL, single-use, owner role):
>
>   <verify_url>

Either way, record the bootstrap event in `.bodega.md` so we know
whether the operator has handed over the URL out-of-band:

```yaml
admin:
  bootstrap_link_shown_at: 2026-04-22T14:35:00Z
  bootstrap_link_reason: email_unconfigured
```

### Why showing the link to the operator is acceptable

The endpoint is gated by `BODEGA_ADMIN_SECRET`. Anyone who can call it
already has full owner equivalent on the deployment — they could read
`BODEGA_SESSION_SECRET` from the same `vercel env` and forge a session
directly without needing a magic link at all. So returning the URL in
the response body when email is off doesn't expand attack surface; it
just removes the email side-channel.

The public `/api/bodega/auth/login` endpoint (the form on /studio/login)
does NOT return the link — it logs it server-side and responds with
the same constant anti-enumeration message either way. Bootstrap links
only flow through this admin path.

## Step 2 — Send the welcome email

Use the `welcome-email.md` template at
`{{scripts_path}}/../reference/welcome-email.md`. Substitute:

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

From `{{scripts_path}}/../reference/how-your-store-works.md`. One-pager
in the merchant's voice. Covers:
- Logging into studio
- Adding a product
- Seeing orders
- Shipping an order
- Getting paid (Stripe payouts)
- Asking for help

### c) `announcement-blurb.md`

From `{{scripts_path}}/../reference/announcement-blurb.md`. Short
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
package — just a login link. Phrasing depends on whether email actually
sent (Step 1's `email_sent` flag).

### Email sent (`email_sent: true`)

#### Developer voice:

> ✓ Magic link sent to `<operator.email>`. Expires in 24h.
> `/studio` is live at https://<url>/studio.

#### Simple voice:

> ✓ Your admin is set up. I just emailed you a login link — check your
> inbox in a minute (and peek at your spam folder if it's not there).
>
> Click the link and you'll land in your store's admin, where you can
> add products, see orders, and manage shipping. The link expires in
> 24 hours; if you miss it, run `{{command_prefix}}bodega:admin` again
> and I'll send a fresh one.

### Email not sent (`email_sent: false`)

You already showed the bootstrap URL in Step 1. Here, just remind them
what they got and what to do later:

#### Developer voice:

> ✓ Bootstrap link printed above (email_setup: pending).
> Configure RESEND_API_KEY + BODEGA_FROM_EMAIL on Vercel and redeploy
> when you want emailed login links. Until then, re-run
> `{{command_prefix}}bodega:admin` to mint fresh links.

#### Simple voice:

> ✓ Your admin is set up. The login link is the URL I just showed you
> above — open it in your browser to get in.
>
> Once you're in `/studio`, you can add products and see orders. If
> you ever lose the link or it expires (after 24 hours), come back here
> and run `{{command_prefix}}bodega:admin` and I'll print a fresh one.
>
> When you're ready for emailed login links instead, you'll need a
> Resend account (free at resend.com) and a domain you own. We can
> set that up any time.

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
- Invite staff → use `{{command_prefix}}bodega:invite` instead

## Rules

- **Never show the magic link in output** unless explicitly asked.
  One-time-use links in transcripts risk accidental use or sharing.
- **Send welcome email from our shared domain by default.** Custom-domain
  sending requires DNS verification; that's a later step if the merchant
  wants mail from `orders@muddmannstudio.com`.
- **Handoff package is local-only.** Don't upload anywhere. Operator
  forwards manually — their choice what to send.
