---
name: deploy
description: Installs the commerce SDK, scaffolds /shop /cart /checkout /studio routes themed to existing design tokens, registers Stripe webhooks, and pushes to Vercel. Supports preview mode if Stripe keys aren't ready yet. Invocable standalone to push updates.
---

# Bodega: Deploy

Puts the store on the internet. Runs standalone (to push updates) or
as part of `/bodega:setup`'s flow.

## Pre-checks

1. Read `.bodega.md`. Required:
   - `state.hosting: done`
   - `state.payments: done` OR `state.payments: pending` (latter → preview mode)
2. Read `.impeccable.md` if present. Otherwise fall back to
   `app/globals.css` and `tailwind.config.*` for design tokens.

## Step 1 — Install the Bodega SDK

If the project doesn't already have `@bodega/commerce` and `@bodega/studio`:

```
npm install @bodega/commerce @bodega/studio
```

(Detect pnpm/yarn/bun from lockfile and match.)

**Note on dev installs**: if the packages haven't been published to npm
yet (pre-release), install from the local workspace instead:

```
npm install file:<path-to-bodega>/packages/commerce file:<path-to-bodega>/packages/studio
```

The plugin reads `.bodega.md` → `plugin_repo_path` for the path. Falls
back to the npm registry when that field is absent.

## Step 2 — Resolve design tokens

The commerce SDK themes via CSS custom properties. Token resolution order:

1. `.impeccable.md` (parsed for palette, type, voice notes)
2. `app/globals.css` (look for `--paper`, `--ink`, primary/accent vars)
3. `tailwind.config.*` `theme.extend.colors`
4. Defaults (neutral warm palette)

Write `app/bodega-theme.css` mapping what we find to the SDK's expected
vars (`--bodega-bg`, `--bodega-fg`, `--bodega-accent`, `--bodega-muted`,
`--bodega-font-display`, `--bodega-font-body`).

Import from `app/layout.tsx`.

## Step 3 — Scaffold commerce routes

Create these files (if not present):

```
app/shop/page.tsx              # product grid
app/shop/[slug]/page.tsx       # product detail
app/cart/page.tsx              # cart
app/checkout/page.tsx          # checkout (Stripe Elements)
app/api/stripe/webhook/route.ts
app/api/bodega/[...path]/route.ts  # SDK's internal API
app/studio/layout.tsx          # admin shell
app/studio/page.tsx            # /studio root
app/studio/products/new/page.tsx
app/studio/products/[id]/page.tsx
app/studio/orders/page.tsx
app/studio/orders/[id]/page.tsx
app/studio/settings/page.tsx
```

Each is a thin wrapper importing `@bodega/commerce` or `@bodega/studio`
components, passing props from `.bodega.md`.

Example `app/shop/page.tsx`:

```tsx
import { ProductGrid } from '@bodega/commerce';
import config from '@/.bodega.md';

export default function ShopPage() {
  return <ProductGrid config={config} />;
}
```

## Step 4 — Preview mode vs. full commerce

Read `state.preview_mode` from `.bodega.md`.

### `preview_mode: true`:

Replace `app/checkout/page.tsx` with a "Store opening soon" placeholder
that collects emails (writes to Vercel Blob). Disable "Add to cart"
by passing `mode="preview"` in the layout.

### `preview_mode: false`:

Full commerce. Checkout works. Cart works. Stripe webhook listens.

## Step 5 — Provision required environment variables

Before deploying, the SDK needs these env vars on Vercel. Provision
them all in one pass:

```
# Generate two secrets (auto — don't ask the user)
BODEGA_SESSION_SECRET=$(openssl rand -base64 32)
BODEGA_ADMIN_SECRET=$(openssl rand -base64 32)

vercel env add BODEGA_SESSION_SECRET production <<< "$BODEGA_SESSION_SECRET"
vercel env add BODEGA_ADMIN_SECRET production <<< "$BODEGA_ADMIN_SECRET"

# From .bodega.md — business name, merchant email
vercel env add BODEGA_STORE_NAME production <<< "<business.name>"
vercel env add BODEGA_MERCHANT_EMAIL production <<< "<merchant.email>"

# Sending domain — defaults to our shared one until the merchant
# verifies their own domain with Resend
vercel env add BODEGA_FROM_EMAIL production <<< "orders@bodega.email"
```

For `RESEND_API_KEY`, ask the user:

> Paste your Resend API key (get one at resend.com/api-keys).
> Free tier covers your first 100 emails/day.

Write it to Vercel:

```
vercel env add RESEND_API_KEY production
```

Record in `.bodega.md`:

```yaml
state:
  env_vars_provisioned: true
```

## Step 6 — Register the Stripe webhook

With the production URL known, register with Stripe:

```
vercel env pull .env.production.local
# Use STRIPE_SECRET_KEY to call Stripe's webhooks API
```

Create a webhook at Stripe pointing to:
`https://<production-url>/api/stripe/webhook`

Subscribe to:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `account.updated`

Store webhook signing secret as `STRIPE_WEBHOOK_SECRET`:

```
vercel env add STRIPE_WEBHOOK_SECRET production
```

## Step 7 — Deploy

```
vercel deploy --prod
```

Watch the build. On failure, surface the error in chosen voice.

- **developer**: show the actual build log excerpt.
- **simple**: translated error. Common translations:

| Error | Simple voice |
|---|---|
| `Module not found` | "Some code is missing. Let me try again." |
| `Build failed — out of memory` | "Your site is bigger than Vercel's free tier allows. I'll trim it." |
| `Invalid Stripe key` | "The Stripe key isn't working. Let me ask for a fresh one." |
| `Blob store not attached` | "Storage isn't connected. Fixing now." |

Retry once with the fix. Second failure → stop and ask for help.

## Step 8 — Bind domain if custom

If `business.domain.preference: custom` and `state.domain: done`, the
production URL should be the custom domain. Otherwise, the site is at
`<slug>.vercel.app`.

## Step 9 — Update `.bodega.md`

```yaml
state:
  deploy: done               # or "preview"
deploy:
  last_deployed_at: 2026-04-22T14:30:00Z
  url: https://muddmannstudio.com
  preview_url: https://mudd-mann-studio.vercel.app
  webhook_configured: true
```

## Step 10 — Auto-backup if enabled

If `state.backup: done` and `backup.auto_push: true`, invoke
`/bodega:backup` with mode=`update` to push the latest
changes to GitHub.

## Step 11 — Summary

### Developer voice:

```
✓ Deployed to https://<url>
  Mode: production | preview
  Build time: 47s

Webhook: https://<url>/api/stripe/webhook  [registered]
Studio:  https://<url>/studio
```

### Simple voice:

```
🎉 Your store is live at https://<url>
   Your studio: https://<url>/studio
```

## Standalone invocation

Run directly (not from setup), skip Steps 1-2 if already present. Go
straight to Step 6 (deploy) + Step 9 (auto-backup).

### Simple voice:

> Pushing your latest changes live. About a minute.
>
> ✓ Done. Live at https://<url>.

### Developer voice:

> Deploying...
> ✓ Live at https://<url> (47s)

## Rules

- **Don't deploy if `state.hosting` or `state.payments` are blockers**
  and preview mode isn't explicitly enabled.
- **Don't overwrite user-written files** in `app/` without warning.
  Our routes are `app/shop/`, `app/cart/`, etc. — if occupied, ask.
- **SDK import paths are stable.** Always `@bodega/commerce` and
  `@bodega/studio`.
- **Stripe webhook endpoint is always** `/api/stripe/webhook`. Don't
  change it.
