---
name: invite
description: Resend the merchant's magic-link login, or invite a staff member with scoped permissions (pack orders, edit products, etc.).
user-invocable: true
---

# Bodega: Invite

Two modes: resend the merchant's login link (forgotten password case)
or invite a staff member (partner-hires-a-packer case).

## Pre-checks

Read `.bodega.md`. Require `state.admin: done`.

## Step 1 — Pick mode

> What do you want to do?
>
>   a. Resend my [partner's] login link (they forgot it)
>   b. Invite someone new (staff: packer, product-editor, etc.)
>   c. Remove a staff member (revoke their access)

## All paths use the admin-protected magic-link endpoint

The SDK's `/api/bodega/auth/magic-link` endpoint is admin-protected —
it requires the `BODEGA_ADMIN_SECRET` value (provisioned during deploy)
in the `x-bodega-admin-secret` header. Without it, the endpoint
returns `403`.

Pull the secret in-memory at the start of the skill, use it for any
calls in this run, and `rm` the env file at the end:

```
vercel env pull .env.production.local --environment=production
# Use BODEGA_ADMIN_SECRET in-memory; never echo
# ... (all magic-link / staff calls below) ...
rm .env.production.local
```

## Step 2a — Resend magic link

Identify the target email from `.bodega.md` (`merchant.email` if handoff,
else `operator.email`). Offer to override:

> Send to [email]? (yes / no — different email)

Generate a fresh magic link via the SDK:

```
POST https://<url>/api/bodega/auth/magic-link
Headers:
  Content-Type: application/json
  x-bodega-admin-secret: <BODEGA_ADMIN_SECRET>
Body:
  { "email": "<target>", "role": "owner" }
```

Send the email. Confirm:

### Simple voice:

> ✓ Sent. They should see it in about a minute. Check spam if not.

### Developer voice:

> ✓ Magic link sent to <email>. Expires in 24h.

## Step 2b — Invite staff

Ask what role:

> What should this person be able to do?
>
>   a. Pack orders (see orders, mark shipped, print labels — no refunds, no product edits)
>   b. Edit products (add/edit/publish products — no order or money access)
>   c. Full manager (everything except destroying the store)

Ask for their email:

> Their email?

Generate a staff magic link with the right role scope (same admin
header as Step 2a):

```
POST https://<url>/api/bodega/auth/magic-link
Headers:
  Content-Type: application/json
  x-bodega-admin-secret: <BODEGA_ADMIN_SECRET>
Body:
  { "email": "<staff-email>", "role": "packer" | "product-editor" | "manager" }
```

Send a different email template (welcome-staff, not welcome-owner).

Record in `.bodega.md`:

```yaml
admin:
  staff:
    - email: packer@example.com
      role: packer
      invited_at: 2026-04-22T15:00:00Z
```

## Step 2c — Remove a staff member

List existing staff from `.bodega.md` → `admin.staff[]`:

> Who do you want to remove?
>
>   1. packer@example.com (packer)
>   2. friend@example.com (product-editor)
>   3. ... (none if no staff yet)

Pick by number or email. Owners cannot be removed via this skill —
that's a settings-page operation in `/studio`. Refuse politely if the
user picks the owner.

Revoke via the SDK:

```
DELETE https://<url>/api/bodega/auth/staff/<staff-email>
Headers:
  x-bodega-admin-secret: <BODEGA_ADMIN_SECRET>
```

Update `.bodega.md`:

```yaml
admin:
  staff:
    # remove the matching entry
  removed:
    - email: packer@example.com
      role: packer
      removed_at: 2026-04-23T10:00:00Z
```

Confirm:

### Simple voice:

> ✓ Removed [email]. Their login link no longer works. If they're in
> /studio right now, they'll be kicked to the login page on their next
> click.

### Developer voice:

> ✓ Revoked <email>. Existing session invalidated server-side.

## Step 3 — Confirm

### Simple voice:

> ✓ Invited [name/email] as [role]. They'll get an email in a minute.

### Developer voice:

> ✓ <email> invited as <role>. Magic link sent.

## Rules

- **Role scoping is enforced by the SDK**, not by the plugin. We just
  set the role claim on the magic link; the SDK's `/studio` middleware
  enforces.
- **Owners cannot be demoted or removed via invite skill.** That's a
  settings-page operation in `/studio`. Prevents accidental lockout.
- **Maximum 10 staff per store in Phase 1.** If hit, tell the user and
  point to Phase 2 features.
