---
name: deploy
description: Installs the commerce SDK, scaffolds /shop /cart /checkout /studio routes themed to existing design tokens, registers Stripe webhooks, and pushes to Vercel. Supports preview mode if Stripe keys aren't ready yet. Invocable standalone to push updates.
user-invocable: true
---

# Bodega: Deploy

Puts the store on the internet. Runs standalone (to push updates) or
as part of `/bodega:setup`'s flow.

## Pre-checks

1. Read `.bodega.md`. Required:
   - `state.hosting: done`
   - `site_mode` present (one of: marketing, showcase, digital, commerce)
   - For `digital` or `commerce` modes: `state.payments: done` OR
     `state.payments: pending` (latter → preview mode)
2. Read `.impeccable.md` if present. Otherwise fall back to
   `app/globals.css` and `tailwind.config.*` for design tokens.

### Site mode scaffolding matrix

What gets scaffolded depends on `site_mode`:

| Piece | marketing | showcase | digital | commerce |
|---|:---:|:---:|:---:|:---:|
| `/shop` + `/shop/[slug]` | — | ✓ | ✓ | ✓ |
| `/cart` + `/checkout` | — | — | ✓ | ✓ |
| `/api/bodega/cart*`, `/api/bodega/checkout`, `/api/stripe/webhook` | — | — | ✓ | ✓ |
| `/studio` admin | — | ✓ (products only) | ✓ | ✓ |
| `/studio/orders*` + `/api/bodega/orders/*` | — | — | ✓ | ✓ |
| Stripe env vars | — | — | ✓ | ✓ |
| `BODEGA_SHIPPING_*` env vars | — | — | — | ✓ |

Pass `siteMode` prop to `<ProductGrid>` and `<ProductPage>` when
scaffolding so they render the right CTA (buy button vs "contact to buy").

## Step 1 — Install the Bodega SDK

If the project doesn't already have `@mitcheman/bodega`:

```
npm install @mitcheman/bodega
```

(Detect pnpm/yarn/bun from lockfile and match.)

**Note on dev installs**: if `@mitcheman/bodega` hasn't been published
to npm yet (pre-release), install from a locally-packed tarball:

```
pnpm --filter "@mitcheman/bodega" pack --pack-destination /tmp
npm install /tmp/mitcheman-bodega-<version>.tgz
```

(A plain `npm install file:<path>` creates a symlink, which can't
resolve the `next` peer dep. Use pnpm-packed tarballs for local testing.)

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

Create these files (if not present). Every server-component page that
reads from storage needs `export const dynamic = 'force-dynamic'` —
products, inventory, and orders change per-request, so SSG would lie.

```
app/shop/page.tsx                       # ProductGrid (dynamic)
app/shop/[slug]/page.tsx                # ProductPage (dynamic)
app/cart/page.tsx                       # Cart (client)
app/checkout/page.tsx                   # Checkout (client, Stripe Elements)
app/api/stripe/webhook/route.ts         # re-export from SDK
app/api/bodega/cart/route.ts            # re-export
app/api/bodega/cart/items/route.ts      # re-export
app/api/bodega/cart/items/[product_id]/route.ts
app/api/bodega/checkout/route.ts
app/api/bodega/auth/login/route.ts
app/api/bodega/auth/logout/route.ts
app/api/bodega/auth/magic-link/route.ts
app/api/bodega/products/route.ts
app/api/bodega/products/[id]/route.ts
app/api/bodega/orders/[id]/ship/route.ts
app/studio/layout.tsx                   # StudioLayout (auth-gated)
app/studio/page.tsx                     # StudioHome (dynamic)
app/studio/login/page.tsx               # LoginPage (client)
app/studio/verify/route.ts              # magic-link consume
app/studio/products/page.tsx            # ProductsPage (dynamic)
app/studio/products/new/page.tsx        # ProductEditor (client)
app/studio/products/[id]/page.tsx       # ProductEditor with product (dynamic)
app/studio/orders/page.tsx              # OrdersPage (dynamic)
app/studio/orders/[id]/page.tsx         # OrderDetail (dynamic)
```

Each is a thin wrapper importing `@mitcheman/bodega`.

**Server-component page example** (`app/shop/page.tsx`) — pass `siteMode`
from `.bodega.md` so the CTA matches:

```tsx
import { ProductGrid } from '@mitcheman/bodega';

export const dynamic = 'force-dynamic';

export default function ShopPage() {
  return <ProductGrid heading="Shop" siteMode="commerce" />;
}
```

(For `showcase` mode, pass `siteMode="showcase"` — the `<AddToCartButton>`
inside `<ProductPage>` becomes a "Contact to buy" link instead.)

**Image upload route** (`app/api/bodega/upload/route.ts`) — enables real
file uploads from `/studio` instead of pasting URLs:

```ts
export { POST } from '@mitcheman/bodega/routes/upload';
```

**Route handler example** (`app/api/bodega/cart/route.ts`):

```ts
export { GET } from '@mitcheman/bodega/routes/cart';
```

**Admin layout example** (`app/studio/layout.tsx`):

```tsx
import { StudioLayout } from '@mitcheman/bodega';
export default StudioLayout;
```

### Wrap the root layout with CartProvider

Cart state lives client-side and is shared across the consumer
experience. Edit `app/layout.tsx` to wrap `{children}`:

```tsx
import { CartProvider } from '@mitcheman/bodega';
import './bodega-theme.css';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
```

Without this, any page using `useCart()` (Cart, Checkout, AddToCartButton)
throws at render time.

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
# Generate two secrets — use Node, not openssl. openssl isn't
# guaranteed on locked-down Windows / corporate images; node is a
# bodega prereq so it's always present.
BODEGA_SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
BODEGA_ADMIN_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

vercel env add BODEGA_SESSION_SECRET production <<< "$BODEGA_SESSION_SECRET"
vercel env add BODEGA_ADMIN_SECRET production <<< "$BODEGA_ADMIN_SECRET"

# From .bodega.md — business name, merchant email
vercel env add BODEGA_STORE_NAME production <<< "<business.name>"
vercel env add BODEGA_MERCHANT_EMAIL production <<< "<merchant.email>"
```

### Email — opt-in, not auto-defaulted

Email setup is **deliberately not auto-configured**. The previous
default (`orders@bodega.my`) was a bug: the merchant pastes their
own Resend API key, the code tries to send `from: orders@bodega.my`,
and Resend rejects it because `bodega.my` isn't verified under the
merchant's Resend account. The merchant can't verify it either —
they don't own the domain. The first email always failed.

The fix is to leave `BODEGA_FROM_EMAIL` and `RESEND_API_KEY` unset
unless the merchant explicitly configures them. The SDK detects
their absence and runs `/studio/login` in "email disabled" mode:
the page shows a clear inline message ("Email login isn't
configured yet — set RESEND_API_KEY and BODEGA_FROM_EMAIL on
Vercel and redeploy"), and any code path that tries to send
returns `{ ok: false, reason: 'email_unconfigured' }` with an
explicit log line.

Ask the merchant:

#### Simple voice:

> One last thing before we deploy: do you want emails right now,
> or set them up later?
>
>   a. **Set up later** (recommended for now) — your store will
>      deploy and work for browsing, but the magic-link login for
>      `/studio` won't actually send emails until you're ready.
>      You can flip it on any time by adding two settings on
>      Vercel and redeploying.
>   b. **Set up now** — needs a Resend account
>      (free, ~3 minutes at resend.com) and a domain you own +
>      have verified in Resend. Use this if you've already done
>      the verification step.

#### Developer voice:

> Email config: skip (recommended) or set now?
>
>   - skip → /studio/login renders "email unconfigured" notice;
>     redeploy after adding RESEND_API_KEY + BODEGA_FROM_EMAIL
>   - set now → need Resend API key + a from-address on a Resend-
>     verified domain (typically `orders@<custom-domain>` once
>     the domain step is done)

If the user picks **skip**, write a marker to `.bodega.md` so the
deploy summary later mentions "email setup pending" and we don't
forget:

```yaml
state:
  email_setup: pending
```

Don't write either env var. Move on to the next env-var section.

If the user picks **set now**:

1. Confirm the from-address belongs to a domain they've verified in
   Resend. If not, point them at https://resend.com/domains and pause
   until they say done.
2. Ask for the API key:

   > Paste your Resend API key (get one at resend.com/api-keys).
   > Free tier covers ~3,000 emails/month.

3. Ask for the from-address:

   > What's the from-address? Must be on a domain you've verified
   > in Resend (e.g., `orders@yourshop.com`).

4. Write both to Vercel:

   ```
   vercel env add RESEND_API_KEY production
   vercel env add BODEGA_FROM_EMAIL production <<< "<from-address>"
   ```

5. Mark in `.bodega.md`:

   ```yaml
   state:
     email_setup: done
   email:
     from: orders@yourshop.com
     resend_domain_verified: true
   ```

> **Why we don't ship a working default**: the only way to provide
> a default that actually sends is for Bodega to operate the Resend
> account and route every merchant's mail through it. That makes
> Bodega a hosted service, which it explicitly is not. So the
> trade-off is: opt-in email setup with a clear deferred path, vs.
> a default that silently breaks. Opt-in wins.

### Site mode + shipping env vars

Set `BODEGA_SITE_MODE` so the checkout route knows whether to charge
shipping + which policy:

```
vercel env add BODEGA_SITE_MODE production <<< "<site_mode>"
```

For `commerce` mode, also set the shipping policy from `.bodega.md`:

```
vercel env add BODEGA_SHIPPING_MODE production <<< "<shipping.mode>"
vercel env add BODEGA_SHIPPING_CENTS production <<< "<shipping.cents>"
```

If Stripe Tax is enabled (opt-in, default off):

```
vercel env add BODEGA_STRIPE_TAX production <<< "true"
```

Note to the merchant if Stripe Tax is on: they need to configure tax
jurisdictions in their Stripe dashboard (Stripe → Tax → Registrations)
for tax to actually be collected.

Record in `.bodega.md`:

```yaml
state:
  env_vars_provisioned: true
```

## Step 6 — Register the Stripe webhook (idempotent)

With the production URL known, register with Stripe. **This step is
re-run on every `/bodega:deploy`** (deploys can be
invoked standalone for updates), so it MUST be idempotent — otherwise
each redeploy creates a duplicate webhook and Stripe fires every event
N times to the same endpoint.

```
vercel env pull .env.production.local --environment=production --yes
# `--yes` skips the overwrite-confirmation prompt — without it,
# vercel env pull hangs in non-TTY/agent shells if the file already
# exists. In-memory only; rm .env.production.local at end of step.
```

The intended endpoint URL:
`https://<production-url>/api/stripe/webhook`

The intended event subscription:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `account.updated`

### Idempotent upsert pattern

1. **List existing webhooks**:

   ```
   GET https://api.stripe.com/v1/webhook_endpoints
   Authorization: Bearer <STRIPE_SECRET_KEY>
   ```

2. **Look for one whose `url` matches the intended endpoint URL** (full
   exact match — both URL and the host the webhook was registered for).

3. **If a match exists**:
   - Compare `enabled_events` against the intended list.
   - If they match exactly → done. Skip create.
   - If they differ → `POST /v1/webhook_endpoints/<id>` with the new
     `enabled_events` to update in place. Reuse the existing
     `STRIPE_WEBHOOK_SECRET` from Vercel env (the secret is bound to
     the webhook ID, not regenerated on update).

4. **If no match exists** → create a new one:

   ```
   POST https://api.stripe.com/v1/webhook_endpoints
   { "url": "<endpoint>", "enabled_events": [...] }
   ```

   The response includes a one-time `secret` value — write it to
   Vercel env:

   ```
   vercel env add STRIPE_WEBHOOK_SECRET production <<< "<secret>"
   ```

5. **Clean up**: `rm .env.production.local` at end of step.

### Why this matters

Without the upsert: each `bodega:deploy` POSTs a new webhook. After
3 redeploys, the merchant gets 3 `payment_intent.succeeded` events
per real payment → 3 fulfilment attempts → duplicate orders or
Stripe-side double-counting in reports. Customers notice when their
order confirmation email arrives 3 times.

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
- **SDK import paths are stable.** Always `@mitcheman/bodega` and
  `@mitcheman/bodega`.
- **Stripe webhook endpoint is always** `/api/stripe/webhook`. Don't
  change it.
