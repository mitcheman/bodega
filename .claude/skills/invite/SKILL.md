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

## Step 2a — Resend magic link

Identify the target email from `.bodega.md` (`merchant.email` if handoff,
else `operator.email`). Offer to override:

> Send to [email]? (yes / no — different email)

Generate a fresh magic link via the SDK:

```
POST https://<url>/api/bodega/auth/magic-link
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

Generate a staff magic link with the right role scope:

```
POST https://<url>/api/bodega/auth/magic-link
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

## Step 3 — Confirm

### Simple voice:

> ✓ Invited [name/email] as [role]. They'll get an email in a minute.
>
> If you want to remove someone later, run `/bodega:invite`
> again and I'll walk through it.

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
