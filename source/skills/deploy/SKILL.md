---
name: deploy
description: Installs the commerce SDK, scaffolds /shop /cart /checkout /studio routes themed to existing design tokens, registers Stripe webhooks, and pushes to Vercel. Supports preview mode if Stripe keys aren't ready yet. Invocable standalone to push updates.
user-invocable: true
---

# Bodega: Deploy

Puts the store on the internet. Runs standalone (to push updates) or
as part of `{{command_prefix}}bodega:setup`'s flow.

## Pre-checks

1. Read `.bodega.md`. Apply the **resume contract** from
   `setup/SKILL.md`. Substep labels (in order):
   `sdk-installed` → `theme-resolved` → `marketing-isolated` →
   `routes-scaffolded` → `cart-provider-wrapped` →
   `env-vars-provisioned` → `webhook-registered` → `built` →
   `deployed` → `domain-bound`. Resume picks up at
   `deploy.last_completed_step + 1`.
   Standalone deploys (re-deploy after changes) start fresh from
   `built` if every prior substep is recorded as completed in this
   project's history (i.e., already in `done` once).
2. Required upstream state:
   - `state.hosting: done`
   - `site_mode` present (one of: marketing, showcase, digital, commerce)
   - For `digital` or `commerce` modes: `state.payments: done` OR
     `state.payments: pending` (latter → preview mode)
3. Read `.impeccable.md` if present. Otherwise fall back to
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

## Step 2.5 — Isolate the marketing layout (if it'd collide)

The merchant's existing `app/layout.tsx` typically wraps every page in
their site nav + footer. That's correct for the marketing pages — but
once we add `/shop`, `/cart`, `/checkout`, and `/studio`, they all
inherit the same chrome. Studio especially looks broken with the
marketing nav floating above it.

**Detect**: read `app/layout.tsx`. If it imports/renders anything that
looks like a site nav (`<Nav />`, `<Header />`, `<SiteHeader />`,
`<Footer />`, etc. — anything beyond `html`/`body`/providers), the
collision will happen.

**Fix** (small, mechanical refactor): use a route group.

1. Create `app/(site)/layout.tsx` — move the nav/footer/marketing
   chrome here. This layout wraps only the merchant's marketing pages.
2. Move the merchant's existing marketing pages into `app/(site)/`:
   `app/page.tsx` → `app/(site)/page.tsx`, `app/about/page.tsx` →
   `app/(site)/about/page.tsx`, etc. URLs stay identical (Next.js
   strips `(site)` from the path).
3. Strip the moved-down chrome out of `app/layout.tsx`. The root layout
   becomes minimal — just `<html><body>{children}</body></html>` plus
   global CSS imports, fonts, and (for digital/commerce modes)
   `<CartProvider>`. This is the layout that wraps everything,
   including studio + shop.

After: marketing nav appears on `/`, `/about`, `/contact`, etc., and
NOT on `/studio`, `/cart`, `/checkout`. Studio gets only the
`StudioLayout` chrome from its `(authed)` group; shop/cart/checkout get
no chrome by default (the SDK pages provide their own).

**Skip this step entirely** if the merchant's `app/layout.tsx` is
already minimal (just html/body/providers — no nav, no footer). In
that case there's nothing to isolate.

> **Why route groups not new top-level dirs?** Route groups (`(name)`)
> let layouts diverge without changing URLs. Putting marketing pages
> under `app/marketing/` would change `/about` to `/marketing/about`,
> which the merchant did not ask for.

## Step 3 — Scaffold commerce routes

Create these files (if not present). Every server-component page that
reads from storage needs `export const dynamic = 'force-dynamic'` —
products, inventory, and orders change per-request, so SSG would lie.

```
app/shop/page.tsx                                 # ProductGrid (dynamic)
app/shop/[slug]/page.tsx                          # ProductPage (dynamic)
app/cart/page.tsx                                 # Cart (client)
app/checkout/page.tsx                             # Checkout (client, Stripe Elements)
app/api/stripe/webhook/route.ts                   # re-export from SDK
app/api/bodega/cart/route.ts                      # re-export
app/api/bodega/cart/items/route.ts                # re-export
app/api/bodega/cart/items/[product_id]/route.ts
app/api/bodega/checkout/route.ts
app/api/bodega/auth/login/route.ts
app/api/bodega/auth/logout/route.ts
app/api/bodega/auth/magic-link/route.ts
app/api/bodega/products/route.ts
app/api/bodega/products/[id]/route.ts
app/api/bodega/orders/[id]/ship/route.ts

# /studio uses a (authed) route group so the auth-gating layout doesn't
# wrap /studio/login and /studio/verify. If StudioLayout wraps the login
# page, the redirect to /studio/login bounces forever. See "Studio route
# group" note below.
app/studio/login/page.tsx                         # LoginPage (client) — outside (authed)
app/studio/verify/route.ts                        # magic-link consume — outside (authed)
app/studio/(authed)/layout.tsx                    # StudioLayout (auth-gated)
app/studio/(authed)/page.tsx                      # StudioHome (dynamic)
app/studio/(authed)/products/page.tsx             # ProductsPage (dynamic)
app/studio/(authed)/products/new/page.tsx         # ProductEditor (client)
app/studio/(authed)/products/[id]/page.tsx        # ProductEditor with product (dynamic)
app/studio/(authed)/orders/page.tsx               # OrdersPage (dynamic)
app/studio/(authed)/orders/[id]/page.tsx          # OrderDetail (dynamic)
```

### Studio route group

Three routes need to render WITHOUT the auth-gating chrome:

- `/studio/login` — the unauth'd entry point. If StudioLayout wraps it,
  the layout's `redirect('/studio/login')` re-enters the layout and
  bounces forever.
- `/studio/verify` — a route handler that consumes a magic-link token
  and sets the session cookie. Layouts don't apply to route handlers,
  so technically it's fine either way — but keeping it parallel to
  /studio/login keeps the structure obvious.
- (no shared `app/studio/layout.tsx` is created — Next.js doesn't
  require one, and the (authed) group provides its own.)

The pattern:

```
app/studio/
├── login/
│   └── page.tsx              # no layout chrome, no auth gate
├── verify/
│   └── route.ts              # route handler, no layout
└── (authed)/                 # route group — URLs do NOT include "(authed)"
    ├── layout.tsx            # StudioLayout — auth gate + chrome
    ├── page.tsx              # /studio
    ├── products/...          # /studio/products/...
    └── orders/...            # /studio/orders/...
```

URLs stay `/studio/products`, `/studio`, etc. — Next.js strips the
`(group)` segment from the URL. The grouping only affects which layout
files apply.

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

**Multi-method routes — exact exports.** A few SDK route modules
expose more than one HTTP method. Each Next.js route file has to
export the methods it serves; "just `export *`" works but the table
below makes the intent explicit:

| Route file | Exports |
|---|---|
| `app/api/bodega/products/route.ts` | `export { POST } from '@mitcheman/bodega/routes/products';` |
| `app/api/bodega/products/[id]/route.ts` | `export { PATCH, DELETE } from '@mitcheman/bodega/routes/products';` |
| `app/api/bodega/cart/route.ts` | `export { GET } from '@mitcheman/bodega/routes/cart';` |
| `app/api/bodega/cart/items/route.ts` | `export { POST } from '@mitcheman/bodega/routes/cart-items';` |
| `app/api/bodega/cart/items/[product_id]/route.ts` | `export { PATCH, DELETE } from '@mitcheman/bodega/routes/cart-items';` |
| `app/api/bodega/checkout/route.ts` | `export { POST } from '@mitcheman/bodega/routes/checkout';` |
| `app/api/bodega/orders/[id]/ship/route.ts` | `export { POST } from '@mitcheman/bodega/routes/orders';` |
| `app/api/bodega/auth/login/route.ts` | `export { POST } from '@mitcheman/bodega/routes/auth-login';` |
| `app/api/bodega/auth/logout/route.ts` | `export { POST } from '@mitcheman/bodega/routes/auth-logout';` |
| `app/api/bodega/auth/magic-link/route.ts` | `export { POST } from '@mitcheman/bodega/routes/auth-magic-link';` |
| `app/api/bodega/upload/route.ts` | `export { POST } from '@mitcheman/bodega/routes/upload';` |
| `app/api/stripe/webhook/route.ts` | `export { POST } from '@mitcheman/bodega/routes/stripe-webhook';` |
| `app/studio/verify/route.ts` | `export { GET } from '@mitcheman/bodega/routes/auth-verify';` |

**Authed studio layout example** (`app/studio/(authed)/layout.tsx` — note
the route group):

```tsx
import { StudioLayout } from '@mitcheman/bodega';
export default StudioLayout;
```

> **Export style**: `StudioLayout` is exported from the SDK both as a
> default (from the file) and as a re-export named export (from the
> package index). Use the named import (`import { StudioLayout }`) in
> the consumer's layout — that style works in both cases and matches
> the rest of the scaffold. `import StudioLayout from '@mitcheman/bodega'`
> would NOT work (the package's default export is the index module
> itself, not StudioLayout).

**Login page example** (`app/studio/login/page.tsx` — outside (authed),
so it renders without the auth-gating chrome):

```tsx
import { LoginPage } from '@mitcheman/bodega';
export default LoginPage;
```

`LoginPage` wraps `useSearchParams()` in `<Suspense>` internally; no
extra `force-dynamic` required.

### Wrap the root layout with CartProvider — only if the site has a cart

Cart state lives client-side. Wrap the root layout **only when
`site_mode in {digital, commerce}`** — those are the modes that
actually have `/cart`, `/checkout`, and `<AddToCartButton>`.

For `site_mode in {marketing, showcase}`, skip this — there's no cart,
and wrapping pulls a client component into the root layout for nothing
(forces the whole tree client-rendered, hurts performance, no benefit).

If `site_mode in {digital, commerce}`, edit `app/layout.tsx` to wrap
`{children}`:

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

Without `CartProvider`, any page using `useCart()` (Cart, Checkout,
AddToCartButton) throws at render time. So if you're scaffolding a
showcase that later upgrades to commerce, the deploy run for the
commerce upgrade adds the wrap then.

Either way, `import './bodega-theme.css'` should still happen at the
root layout — that one's mode-independent (every site_mode renders SDK
components that read the theme vars).

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

> **`vercel env add` stdin footgun (CLI 52+).** The CLI reads stdin
> until it sees a newline; **without a trailing newline, the value
> is recorded as an empty string and the CLI still prints "Added"**.
> Use one of the safe forms — never `printf "%s"` (no newline) and
> never `echo -n`:
>
> | Form | Newline? | Verdict |
> |---|---|---|
> | `vercel env add NAME production <<< "$VALUE"` | yes (bash here-string adds one) | ✅ safe — what we use everywhere in this SKILL |
> | `printf '%s\n' "$VALUE" \| vercel env add NAME production` | yes | ✅ safe alternative for non-bash shells |
> | `echo "$VALUE" \| vercel env add NAME production` | yes (`echo` adds `\n`) | ✅ safe but mangles values containing backslashes |
> | `printf '%s' "$VALUE" \| vercel env add NAME production` | NO | ❌ silently writes empty value |
> | `echo -n "$VALUE" \| vercel env add NAME production` | NO | ❌ silently writes empty value |
>
> Bug filed against Vercel CLI; fix landing here is doc + a
> verify-non-empty step (5b below) so even if a future CLI regresses,
> the deploy bails loud instead of going to production with
> empty-string secrets that 401 every magic-link request.

### 5b. Verify secrets are at least named on the project

Quick check that each required env var name appears in the project's
production env. This catches the case where `vercel env add` wasn't
run at all — but it does NOT catch the empty-value case (a `NAME=""`
value still appears as a name in `vercel env ls`).

```
NAMES_PRESENT=$(vercel env ls production --json 2>/dev/null | jq -r '.[].key' 2>/dev/null || vercel env ls production 2>/dev/null | awk '{print $1}')
REQUIRED="BODEGA_SESSION_SECRET BODEGA_ADMIN_SECRET BODEGA_STORE_NAME BODEGA_MERCHANT_EMAIL"
[ -n "$RESEND_OPT_IN" ] && REQUIRED="$REQUIRED RESEND_API_KEY BODEGA_FROM_EMAIL"

missing=""
for name in $REQUIRED; do
  echo "$NAMES_PRESENT" | grep -qx "$name" || missing="$missing $name"
done

if [ -n "$missing" ]; then
  echo "❌ Missing env vars on Vercel:$missing" >&2
  echo "   Run the matching \`vercel env add\` from Step 5 above." >&2
  exit 1
fi
```

> **Why no value-emptiness check here?** On Vercel CLI 52+,
> `vercel env pull` writes the file but does **not** decrypt
> "Encrypted" or "Sensitive" values to disk — they only exist on
> the runtime. So `grep '^NAME=$'` on the pulled file would false-
> positive even when the value is correctly set. A previous version
> of this SKILL pulled-and-grepped here; that check was removed
> because it falsely reported real values as empty. The correct
> place to verify the secrets actually function is the post-deploy
> smoke test in Step 7.5 (live request against the magic-link
> endpoint — 200/503 = secret good, 401 = secret empty).

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

> One last thing before we put your site online: do you want emails
> working right now, or set them up later?
>
>   a. **Set up later** (recommended for now) — your store will
>      go live and work for browsing, but the magic-link login for
>      your studio won't actually send emails until you're ready.
>      You can flip it on any time by adding two settings on
>      Vercel and updating your site.
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

> **First-login still works without email.** When `email_setup: pending`,
> the admin endpoint (`POST /api/bodega/auth/magic-link`) returns the
> verify URL in the response body instead of trying to send it. The
> `bodega:admin` and `bodega:invite` skills detect that response shape
> and surface the URL directly to the operator, who hands it to the
> merchant out-of-band (text/Signal/in person). Public `/studio/login`
> still no-ops on `email_setup: pending` — bootstrap links only flow
> through the admin path. Full security analysis lives in
> `admin/SKILL.md` Step 1.

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
re-run on every `{{command_prefix}}bodega:deploy`** (deploys can be
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

### 7a. Write `.vercelignore` first

Even though `.gitignore` excludes some paths, the Vercel CLI uploads
the working tree (not git's view) and applies `.vercelignore`
separately. Without it, large media folders can choke the upload —
especially on commerce projects where merchants drop full-resolution
photos into `public/raw/` or similar.

If `.vercelignore` doesn't exist, write this baseline:

```
# .vercelignore — keep the upload bundle small.
# Vercel uploads the working tree (not git's view) when not using
# --prebuilt; this file controls what's excluded from that upload.

node_modules
.next
.git
.DS_Store
*.log

# Common large-media drops merchants make:
public/raw
public/originals
drafts
exports
*.psd
*.ai
*.sketch

# Local-only env (env vars are pulled from Vercel project, not files):
.env*.local
.env.production.local
```

If a `.vercelignore` already exists, leave it alone — the merchant or
their dotfiles set it up intentionally.

### 7b. Choose deploy mode based on project size

Two paths, picked by inspecting the on-disk size of paths that would
actually upload (skip the `.vercelignore`d entries):

```
# Quick sizing — count anything we'd actually ship (rough, but enough)
du -sh --exclude=node_modules --exclude=.next --exclude=.git \
       --exclude=public/raw --exclude=public/originals .
```

- **Under ~50 MB** → standard upload:

  ```
  vercel deploy --prod
  ```

- **Over ~50 MB**, OR a previous attempt returned 413 / "request entity
  too large" → prebuilt path. Build locally first; CLI uploads only
  `.vercel/output/` (build artefacts), not the source tree:

  ```
  vercel build --prod
  vercel deploy --prebuilt --prod
  ```

  Real-test floor: muddmannstudio (~20 MB photos + source) hit Vercel's
  10 MB body limit on plain `vercel deploy`. Prebuilt sidesteps it
  entirely. We bias toward prebuilt anyway when project size is
  uncertain — the build runs the same as Vercel would do server-side,
  so behavior is identical.

### 7c. Watch the build

On failure, surface the error in chosen voice.

- **developer**: show the actual build log excerpt.
- **simple**: translated error. Common translations:

| Error | Simple voice |
|---|---|
| `Module not found` | "Some code is missing. Let me try again." |
| `Build failed — out of memory` | "Your site is bigger than Vercel's free tier allows. I'll trim it." |
| `Invalid Stripe key` | "The Stripe key isn't working. Let me ask for a fresh one." |
| `Blob store not attached` | "Storage isn't connected. Fixing now." |
| `413 / Request Entity Too Large` | "Your project is too big to upload directly. Switching to a smaller bundle and trying again." (then retry with `vercel build --prod && vercel deploy --prebuilt --prod`) |

Retry once with the fix. Second failure → stop and ask for help.

## Step 7.5 — Post-deploy smoke test

This is the reliable verify. After the deploy lands, hit the live
admin endpoint with the in-memory `BODEGA_ADMIN_SECRET` from Step 5
(don't try to pull it back from Vercel — see the Step 5b note about
CLI 52 not decrypting). The endpoint's response tells us whether
each piece of infrastructure is wired correctly:

```
URL="https://<deploy-url>/api/bodega/auth/magic-link"

response=$(curl -sS -o /tmp/bodega-smoke.json -w "%{http_code}" \
  -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-bodega-admin-secret: $BODEGA_ADMIN_SECRET" \
  -d "{\"email\":\"<merchant.email>\",\"role\":\"owner\"}")

case "$response" in
  200)
    # Success — magic link minted (and emailed if Resend configured).
    # Discard the response; don't print the verify_url to chat.
    rm -f /tmp/bodega-smoke.json
    echo "✓ smoke test: magic-link endpoint OK"
    ;;
  401)
    echo "❌ 401 — BODEGA_ADMIN_SECRET on Vercel doesn't match the value Step 5 generated." >&2
    echo "   Most likely cause: stdin without trailing newline (printf %s / echo -n)." >&2
    echo "   Fix: vercel env rm BODEGA_ADMIN_SECRET production --yes" >&2
    echo "        vercel env add BODEGA_ADMIN_SECRET production <<< \"\$BODEGA_ADMIN_SECRET\"" >&2
    echo "        vercel deploy --prod  (redeploy so runtime picks up the new value)" >&2
    exit 1
    ;;
  503)
    msg=$(jq -r '.message // "no message"' /tmp/bodega-smoke.json 2>/dev/null)
    echo "❌ 503 — infrastructure not configured. Server says: $msg" >&2
    echo "   Common causes:" >&2
    echo "     - BLOB_READ_WRITE_TOKEN missing (run \`vercel blob store connect bodega-store\` and redeploy)" >&2
    echo "     - Other env var unset; check \`vercel logs\` for the deployment" >&2
    rm -f /tmp/bodega-smoke.json
    exit 1
    ;;
  *)
    msg=$(cat /tmp/bodega-smoke.json 2>/dev/null | head -c 200)
    echo "❌ Unexpected $response from magic-link endpoint." >&2
    echo "   Body: $msg" >&2
    echo "   Check: vercel logs <deploy-url>" >&2
    rm -f /tmp/bodega-smoke.json
    exit 1
    ;;
esac
```

This catches:
- empty `BODEGA_ADMIN_SECRET` (the stdin-newline bug) → 401 with a
  precise re-add command
- missing `BLOB_READ_WRITE_TOKEN` → 503 with the connect-store
  command
- empty `BODEGA_SESSION_SECRET` (would not 401 on this endpoint, but
  would break the eventual session-issue step in `/studio/verify`)

If 200, do NOT log the response body — it includes a `verify_url`
that's a one-time-use admin link. Discard it.

If anything fails: don't proceed. The `bodega:admin` skill assumes
the magic-link endpoint works, and so does `bodega:invite`. Bail
loud here so the failure is attributable to deploy, not to
downstream skills.

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
bodega:
  # Existing bodega.version (scaffold-time pin) is preserved untouched.
  # last_deploy_version updates every deploy so doctor / status can
  # answer "which SDK shape is on Vercel right now?".
  last_deploy_version: <CURRENT_BODEGA_VERSION>
```

To resolve `<CURRENT_BODEGA_VERSION>`, read from
`node_modules/@mitcheman/bodega/package.json`:

```
node -e "console.log(require('@mitcheman/bodega/package.json').version)"
```

If the SDK isn't installed yet (preview-only deploy paths), skip the
field — don't fabricate a value.

## Step 10 — Auto-backup if enabled

If `state.backup: done` and `backup.auto_push: true`, invoke
`{{command_prefix}}bodega:backup` with mode=`update` to push the latest
changes to GitHub.

### Per-deploy opt-out

Two ways to skip the auto-push for a single deploy without flipping
`auto_push: true` off project-wide:

1. **Env var**: `BODEGA_NO_PUSH=1` in the shell that runs deploy.
   Useful in CI ("deploy preview, don't pollute git history") or when
   the user explicitly says "don't push this one." Doctor + status
   surface this if it's set in the active shell.
2. **Per-invocation flag**: when `{{command_prefix}}bodega:deploy` is
   invoked standalone with the `--no-push` argument (or the user types
   "deploy without pushing"), record `_session.skip_push: true`
   in-memory and skip Step 10 once. Don't write this to `.bodega.md`
   (it's per-invocation, not project policy).

If either is in effect, log it in chosen voice so the user knows we
respected the override:

#### Developer voice:

> ✓ Deployed. Auto-push skipped (BODEGA_NO_PUSH set / --no-push).

#### Simple voice:

> ✓ Your store is live. I didn't save a backup this time, like you
> asked.

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
