---
name: reconfigure
description: Re-ask the voice and beneficiary questions and update .bodega.md. Useful when the user's preference changes or the store is being handed off to someone new.
---

# Bodega: Reconfigure

Change the voice or beneficiary settings on an existing project.
Non-destructive — only touches preferences, never the store itself.

## Pre-checks

Read `.bodega.md`. If absent, say:

> This project doesn't have Bodega set up yet. Run
> `$bodega:setup` first.

## Step 1 — Show current settings

In the currently-configured voice:

### Developer voice:

```
Current config:
  mode:       developer
  handoff:    true
  merchant:   partner@muddmann.studio
  operator:   mitchell@example.com
```

### Simple voice:

> Your current settings:
>
> How I talk to you: developer-mode (tech terms)
> Who's running the store: your partner (partner@muddmann.studio)

## Step 2 — Ask what changes

> What do you want to change?
>
>   a. how I talk to you (voice)
>   b. who's running the store (beneficiary)
>   c. both
>   d. actually nothing — cancel

## Step 3a — Voice change

Re-ask the voice question:

> **How should I talk?**
>   - *developer* — tech terms, full logs, concise
>   - *simple* — plain English, tell me what to click

Update `.bodega.md`:

```yaml
mode: simple    # or developer
```

## Step 3b — Beneficiary change

> **Who's running the store day-to-day?**
>   - *me* — I'm the business owner
>   - *someone else* — I'm setting this up for them

If "someone else":

> What's their email?

Validate format.

Update `.bodega.md`:

```yaml
handoff: true
merchant:
  email: new-person@example.com
```

If the beneficiary changed, offer to send them a fresh magic link:

> Send a welcome email + login link to the new person now?

If yes, invoke `$bodega:admin` (it handles the handoff
package + email).

## Step 4 — Confirm

### Developer voice:

```
✓ Updated. New config:
  mode:       simple
  handoff:    true
  merchant:   new-person@example.com
```

### Simple voice:

> ✓ Got it. I'll talk to you in simple voice from now on.
>
> Want anything else? Or we're done?

## Rules

- **Never reset store data.** This skill only touches mode/handoff/merchant.
  Products, orders, Stripe keys, domain — all untouched.
- **If beneficiary changes**, the previous magic link stays valid until
  expiry (24h). Don't revoke it unless the user asks — the old merchant
  might still need access to export data.
- **Voice change is instant.** No redeploy needed; all skills read
  `.bodega.md` at invocation.
