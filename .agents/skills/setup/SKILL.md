---
name: setup
description: First-time Bodega setup. Detects whether the folder has an existing project (adapt) or is empty (greenfield), asks about voice and beneficiary, writes .bodega.md, and orchestrates the full flow through hosting, payments, deploy, and admin.
argument-hint: (run with no args)
---

# Bodega: First-Time Setup

You are orchestrating a first-time store setup. Walk the user through a
series of steps, invoking other Bodega skills in order. Be calm, efficient,
and warm. Never condescending.

## Pre-checks

1. **Read the current working directory** and confirm it's the right
   target with the user before doing anything else. This is critical
   because Bodega will scaffold files into this directory.

   Look at the immediate subdirectories:
   - If 0–1 of them contain a `package.json`, the cwd is almost
     certainly the intended project — proceed.
   - If 2+ subdirectories contain `package.json` files, this is
     a **workspace parent** (e.g., `~/Developer/`). Stop and ask the
     user explicitly:

     > Looks like I'm sitting in a folder that contains multiple
     > projects (I see `<projectA>`, `<projectB>`, `<projectC>`).
     > Bodega scaffolds into the current directory, which would be
     > the wrong place. Which project do you want to set up? Or `cd`
     > into one and re-run.

     Wait for an answer. If they pick a subdirectory, treat that as
     the target — but if you cannot change cwd from inside the agent,
     tell the user to cd in themselves and re-run setup. Do not
     assume.
2. Check for `.bodega.md`. If it exists, this project is already set up.
   Do not continue. Say: *"This project already has Bodega set up. Run
   `/bodega:status` to see current state, or
   `/bodega:reconfigure` to change voice or beneficiary."* Exit.
3. **Run preflight (doctor)**: invoke `/bodega:doctor`.
   - If doctor exits non-zero (critical failures): halt. Show the doctor
     output to the user and tell them to fix those items before
     re-running `/bodega:setup`.
   - If doctor exits zero (clean or warnings only): continue.
4. Check for `package.json` in the (confirmed) target directory.
   - Present → **adapt mode**. An existing project; add commerce on top.
   - Absent → **greenfield mode**. Empty folder; scaffold the site first.
5. In adapt mode, inspect the project:
   - Framework? (We support Next.js 16. Others: best-effort.)
   - Is there a `.impeccable.md`?
     - **Present** → great. The commerce SDK reads design tokens (palette,
       fonts, spacing) from it.
     - **Absent** → no problem. The commerce SDK falls back to the built-in
       Bodega tokens (cream/navy/wood watercolor palette, Newsreader +
       Karla typography). The merchant can add `.impeccable.md` later via
       impeccable.style and the next deploy will pick up the custom tokens.
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

## Step 1.5 — Set expectations (simple voice only)

If voice is `simple`, tell the user what they're signing up for. Skip
this in developer voice — developers already know the shape.

### Simple voice:

> Here's what's coming, so you're not surprised:
>
>   1. A few quick questions about your store (2 min)
>   2. Signing you in to **Vercel** — that's where your site will live
>      on the internet (2 min)
>   3. Signing you in to **Stripe** — that's what lets you take credit
>      cards. This one can take 10 minutes to 2 days depending on
>      whether they need to verify your ID. We can keep going even if
>      it's not done.
>   4. Putting your site on the internet for real (2 min)
>   5. Setting up your admin page, where you'll add products (1 min)
>   6. Optional: connecting a custom domain like `muddmannstudio.com`
>      if you want one
>
> About 15–30 minutes of your active time. If anything gets stuck
> (waiting on Stripe, a domain, etc.) I'll tell you exactly what to
> do and you can come back when you're ready.
>
> Ready?

Wait for acknowledgement (or any non-"no" response). Don't block — if
they sound impatient, skip ahead.

## Step 2 — Business context

### 2a. Site mode

Ask first:

> **What kind of site are you building?**
>
>   a. **Just a website** — home, about, contact. No shop.
>   b. **Showcase** — display products so people can see what you make,
>      but no online purchasing (they contact you to buy).
>   c. **Digital store** — sell digital products (prints, zines, music,
>      patterns). No shipping needed.
>   d. **Full store** — sell physical products with shipping, an admin
>      for orders, the works.

Map their answer to `site_mode` in `.bodega.md`:

| Answer | `site_mode` | Notes |
|---|---|---|
| a | `marketing` | Skip /shop, /cart, /checkout, /studio, Stripe. Done after hosting + domain. |
| b | `showcase` | Scaffold /shop + /studio (products-only). Skip /cart, /checkout, Stripe. |
| c | `digital` | Scaffold full storefront + admin + Stripe. Skip shipping UI in /studio. |
| d | `commerce` | Full default. Scaffold everything. |

### 2b. Remaining context

Ask in the chosen voice:

1. **What are you selling?** (pottery, prints, sailing lessons — free text)
2. **Shipping from?** (city, "digital only", or "I deliver in person") —
   skip if `site_mode` is `marketing` or `digital`.
3. **Domain preference** — three paths:
   - Use the default Vercel URL for now (`<slug>.vercel.app`, free) —
     pick a slug from their business name, but domain can be bound later
   - Custom domain they already own (ask which)
   - Custom domain not-yet-owned (`~$12/year`, we walk through it later)
4. **Business name to show publicly** (for titles, SEO, receipts)
5. **Anything I should know about the vibe?** (free text)

### 2c. Shipping policy (commerce mode only)

If `site_mode` is `commerce`, also ask:

> **How do you want to charge for shipping?**
>
>   a. **Free shipping** (you absorb the cost)
>   b. **Flat rate** — one price per order (e.g. $5 anywhere in the US)
>   c. **Per item** — each item adds the same amount (good for
>      same-sized items)

Store as `business.shipping: { mode, cents }` in `.bodega.md`.
Default to `{ mode: 'flat', cents: 500 }` if they're unsure.

## Step 3 — Write `.bodega.md`

Write the config to project root. Schema at
`.agents/skills/setup/scripts/../reference/bodega-config.example.md`.

Core shape (all `<UPPERCASE>` placeholders are illustrative — replace
with the values the user actually gave you):

```yaml
---
# EXAMPLE — every `<PLACEHOLDER>` value below comes from the user's
# answers in Step 1 and Step 2. Do not write these literal values.
version: 1
mode: <developer|simple>     # voice from Step 1, question 1
handoff: <true|false>        # true if beneficiary in Step 1, q2 was "someone else"
merchant:
  email: <MERCHANT_EMAIL>    # only present if handoff: true
operator:
  email: null                # filled in at hosting step
business:
  name: <BUSINESS_NAME>      # from Step 2b, question 4
  kind: <physical-goods|digital|service>
  shipping_from: <CITY_OR_DIGITAL>  # from Step 2b, question 2
  domain:
    preference: <subdomain|custom|custom-later>
    value: <DOMAIN_OR_SLUG>
    already_owned: <true|false>
  vibe: |
    <VIBE_FREE_TEXT>         # from Step 2b, question 5
state:
  hosting: not-started
  payments: not-started
  deploy: not-started
  admin: not-started
  domain: not-started
  backup: not-started
initial_mode: <adapt|greenfield>  # immutable record of what was true at first run
mode: <adapt|greenfield>          # mutable; flips to "adapt" after greenfield-design completes
---
```

**Why two fields**: `initial_mode` is set once at first setup and never
changes — it tells you forever whether the project started empty or
existed. `mode` is the live state and flips to `adapt` after
`greenfield-design` runs, so subsequent skills know there's a project
to work with. Don't conflate the two; debugging "why did this go
greenfield?" is much easier when the original detection is preserved.

Confirm in chosen voice:
- **developer**: `✓ Config written to .bodega.md`
- **simple**: `Got it. Setting up your store now.`

## Step 4 — Branch on mode

### Greenfield mode:

Invoke `/bodega:greenfield-design`. Wait for completion.
On return, update `.bodega.md` → `mode: adapt` (a project now
exists). **Do NOT touch `initial_mode`** — it stays `greenfield`
forever as the historical record. Continue to Step 5.

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
