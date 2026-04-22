---
name: setup
description: First-time Bodega setup. Detects whether the folder has an existing project (adapt) or is empty (greenfield), asks about voice and beneficiary, writes .bodega.md, and orchestrates the full flow through hosting, payments, deploy, and admin.
---

# Bodega: First-Time Setup

You are orchestrating a first-time store setup. Walk the user through a
series of steps, invoking other Bodega skills in order. Be calm, efficient,
and warm. Never condescending.

## Pre-checks

1. Read the current working directory.
2. Check for `.bodega.md`. If it exists, this project is already set up.
   Do not continue. Say: *"This project already has Bodega set up. Run
   `/bodega:status` to see current state, or
   `/bodega:reconfigure` to change voice or beneficiary."* Exit.
3. Check for `package.json`.
   - Present → **adapt mode**. An existing project; add commerce on top.
   - Absent → **greenfield mode**. Empty folder; scaffold the site first.
4. In adapt mode, inspect the project:
   - Framework? (We support Next.js 16. Others: best-effort.)
   - Is there a `.impeccable.md`? (Great — the commerce SDK reads tokens from it.)
   - Existing commerce routes (`/shop`, `/cart`, `/checkout`)? If yes, ask
     before overwriting.

## Step 1 — Voice and beneficiary

Ask the user this exact two-part question:

> **Quick — two questions before I touch anything.**
>
> **1. How should I talk while I work?**
>   - *developer* — tech terms, full logs, concise
>   - *simple* — plain English, tell me what to click
>
> **2. Who's running the store day-to-day?**
>   - *me* — I'm the business owner
>   - *someone else* — I'm setting this up for them (partner, friend, client)

Wait for both answers. Re-ask only the unclear part if ambiguous.

### If answer 2 was "someone else":

> What's their email? I'll prepare a welcome package and send them a
> login link when we're live.

Validate email format. Store.

## Step 2 — Business context

Ask these five questions in the chosen voice:

1. **What are you selling?** (pottery, prints, sailing lessons — free text)
2. **Shipping from?** (city, "digital only", or "I deliver in person")
3. **Domain preference** — three paths:
   - Free for now: `<slug>.bodega.store` (pick a slug from their business name)
   - Custom domain they already own (ask which)
   - Custom domain not-yet-owned (`~$12/year`, we walk through it later)
4. **Business name to show publicly** (for titles, SEO, receipts)
5. **Anything I should know about the vibe?** (free text)

## Step 3 — Write `.bodega.md`

Write the config to project root. Schema at
`.windsurf/skills/setup/scripts/../reference/bodega-config.example.md`.

Core shape:

```yaml
---
version: 1
mode: developer              # or "simple"
handoff: true                # if beneficiary is "someone else"
merchant:
  email: partner@example.com # only if handoff
operator:
  email: null                # filled in at hosting step
business:
  name: "Mudd Mann Studio"
  kind: physical-goods       # physical-goods | digital | service
  shipping_from: "Washington DC"
  domain:
    preference: custom       # subdomain | custom | custom-later
    value: muddmannstudio.com
    already_owned: false
  vibe: |
    Handmade ceramics. 1970s Moroccan feel.
state:
  hosting: not-started
  payments: not-started
  deploy: not-started
  admin: not-started
  domain: not-started
  backup: not-started
mode_detected: adapt         # or "greenfield"
---
```

Confirm in chosen voice:
- **developer**: `✓ Config written to .bodega.md`
- **simple**: `Got it. Setting up your store now.`

## Step 4 — Branch on mode

### Greenfield mode:

Invoke `/bodega:greenfield-design`. Wait for completion.
On return, update `.bodega.md` → `mode_detected: adapt` (a project now
exists). Continue to Step 5.

### Adapt mode:

Continue directly to Step 5.

## Step 5 — Hosting

Invoke `/bodega:hosting`. Wait for completion.
`.bodega.md` → `state.hosting: done`.

If this step fails (user declines Vercel login, network issue, etc.), write
state and exit cleanly. User can resume with `/bodega:setup`
later.

## Step 6 — Payments

Invoke `/bodega:payments`. Stripe KYC can take 10 min to
3 days. Handle both:

- Keys ready → `state.payments: done`
- Still waiting → `state.payments: pending`; warn that the site can still
  go live in **preview mode** (checkout disabled) and come back to this
  step later.

## Step 7 — Deploy

Invoke `/bodega:deploy`. Scaffolds storefront routes,
themes commerce SDK to design tokens, pushes to Vercel.

- `state.payments: done` → full production deploy with checkout live.
- `state.payments: pending` → **preview mode**: site live, storefront
  visible, checkout shows "Store opening soon".

## Step 8 — Admin + handoff

Invoke `/bodega:admin`. Provisions `/studio`, wires
magic-link auth, generates the handoff package if `handoff: true`, sends
the welcome email.

## Step 9 — Optional: custom domain

Only if `business.domain.preference` is `custom`:

Ask: *"Ready to set up your custom domain now, or later?"*
- Now → invoke `/bodega:domain`.
- Later → skip; user runs `/bodega:domain` whenever.

## Step 10 — Optional: backup

Ask in chosen voice:

- **developer**: *"Set up a GitHub repo for version control + backup?
  I'll auto-push on every deploy."*
- **simple**: *"Last optional thing — want me to set up a backup of
  your site? Free, private, automatic. If your laptop dies, your store
  is still safe."*

Yes → invoke `/bodega:backup`. No → skip.

## Step 11 — Summary

End with a clear summary in the chosen voice.

### Developer summary:

```
✓ Bodega setup complete.

  Hosting:   https://<store>.vercel.app → <custom-domain>
  Payments:  Stripe (live | preview)
  Admin:     https://<store>/studio
  Backup:    github.com/<user>/<repo> | (none)

Next: merchant check inbox for studio invite. First product takes ~2 min.
```

### Simple summary:

```
🎉 Your store is live!

  Visit it: https://muddmannstudio.com
  Add products: https://muddmannstudio.com/studio
    (login link in your email)

Next step: add your first bowl. Takes about 2 minutes.
```

In handoff mode, add:

> A welcome package is saved at `.bodega/handoff/` for you to forward.
> I already emailed your [partner/friend/client] their login link.

## Rules you must follow

- **Never use jargon in simple voice.** No "env vars", "deploy", "repo",
  "build", "webhook", "proxy", "CLI", "env file". If you can't say it
  in the language of a newspaper article, rephrase.
- **Brand names only when the user clicks a link.** Vercel and Stripe
  appear because they authenticate there. Never mention Next.js, Tailwind,
  Workers, or similar in user-facing output.
- **Resume-ability**: if any step fails or the user exits, write state
  to `.bodega.md` so `/bodega:setup` resumes where it
  stopped.
- **No side effects before Step 3.** Don't run commands or write files
  other than `.bodega.md` until the user has answered the first questions.
- **Preview mode is acceptable.** Better to ship a live site with
  checkout disabled than block for days waiting on Stripe KYC.
