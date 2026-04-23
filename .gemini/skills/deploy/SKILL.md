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
vercel env add BODEGA_FROM_EMAIL production <<< "orders@bodega.my"
```

For `RESEND_API_KEY`, ask the user:

> Paste your Resend API key (get one at resend.com/api-keys).
> Free tier covers your first 100 emails/day.

Write it to Vercel:

```
vercel env add RESEND_API_KEY production
```

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
- **SDK import paths are stable.** Always `@mitcheman/bodega` and
  `@mitcheman/bodega`.
- **Stripe webhook endpoint is always** `/api/stripe/webhook`. Don't
  change it.
