# Bodega — Architecture

*What's in the repo right now. Short by design.*

---

## The shape

Two things:

1. **Plugin** (`source/skills/` + `scripts/` + `bin/`) — your internal bootstrap tool. Installs into Claude Code locally. Walks through `setup → hosting → payments → deploy → admin → domain → backup`. Scaffolds a full working Next.js app into a customer's project.
2. **`@mitcheman/bodega`** (`packages/bodega/`) — single SDK with everything: types, theme resolver, Vercel Blob storage, storefront components (`ProductGrid`, `ProductCard`, `ProductPage`, `Cart`, `Checkout`, `AddToCartButton`), admin components (`StudioLayout`, `StudioHome`, `ProductsPage`, `ProductEditor`, `OrdersPage`, `OrderDetail`, `MarkShippedButton`, `LoginPage`), magic-link auth + session cookies, and Next.js route handlers (`cart`, `cart-items`, `checkout`, `stripe-webhook`, `auth-login`, `auth-verify`, `auth-logout`, `auth-magic-link`, `products`, `orders`, `upload`).

---

## How a customer site is deployed

One Next.js app per customer, on the customer's own Vercel. Inside it:

```
customer-app/
├── app/
│   ├── (their existing pages)           # home, about, contact — unchanged
│   ├── shop/
│   │   ├── page.tsx                     # re-exports ProductGrid
│   │   └── [slug]/page.tsx              # re-exports ProductPage
│   ├── cart/page.tsx                    # re-exports Cart
│   ├── checkout/page.tsx                # re-exports Checkout
│   ├── studio/
│   │   ├── layout.tsx                   # StudioLayout (auth gate)
│   │   ├── page.tsx                     # StudioHome
│   │   ├── login/page.tsx               # LoginPage
│   │   ├── verify/route.ts              # auth-verify
│   │   ├── products/                    # ProductsPage + ProductEditor
│   │   └── orders/                      # OrdersPage + OrderDetail
│   ├── api/
│   │   ├── bodega/cart/                 # cart route handlers
│   │   ├── bodega/cart/items/           # cart-items route handlers
│   │   ├── bodega/checkout/             # checkout route handler
│   │   ├── bodega/auth/login/           # auth-login
│   │   ├── bodega/auth/logout/          # auth-logout
│   │   ├── bodega/auth/magic-link/      # auth-magic-link (admin-only)
│   │   ├── bodega/products/             # products route handlers
│   │   ├── bodega/orders/[id]/ship/     # orders route handler
│   │   ├── bodega/upload/               # owner-gated image upload → Vercel Blob
│   │   └── stripe/webhook/              # stripe-webhook
│   └── bodega-theme.css                 # generated from .impeccable.md tokens
├── .bodega.md                           # tenant config (YAML frontmatter)
└── package.json                         # includes @mitcheman/bodega
```

Customer storage = Vercel Blob on the customer's Vercel project. Stripe = customer's own Stripe account (vanilla, no Connect platform). Domain, SSL = customer's Vercel.

---

## Where the pieces live

| Thing | Lives on | Who owns |
|---|---|---|
| Customer site + admin + API + data | Customer's Vercel | Customer |
| Customer's Stripe account + keys | Stripe + customer's Vercel env | Customer |
| Customer's domain | Customer's registrar | Customer |
| `bodega.my` landing page (future) | Your Vercel | You |
| Plugin + scripts | Your laptop (via Claude Code) | You |

---

## What's NOT in the architecture right now (deliberately)

- **Central bodega.my rendering of customer sites.** If/when customer juggling becomes painful (trigger: form hits from ads + 3+ customer Vercels hurting), a focused weekend adds hostname middleware + shared hosting. Not now.
- **Central tenant admin on bodega.my.** Each customer's admin lives at their own `/studio`. Future concern, same trigger.
- **Stripe Connect platform.** Customers are direct merchants on Stripe. You're not holding money. Keeps legal/compliance simple.
- **Self-service signup.** You onboard customers manually. Concierge only.

---

## Cost per customer at this model

- Customer's Vercel: $20/mo (Pro is required for commercial use per Vercel's Fair Use Guidelines). Hobby is fine during setup + Stripe-test-mode, upgrade at go-live.
- Customer's Stripe: transaction fees only (their business)
- Customer's domain: ~$12/yr (they pay)
- Your cost to onboard: ~6-10 hrs for customer 1-3, trending down
- Your cost to maintain monthly: near-zero (the SDK updates land via npm, they redeploy once)

---

## Key design decisions (each one-liner)

- **Auth**: HMAC-signed session cookies (no JWT library). 30-day TTL. Magic-link only, no passwords.
- **Storage**: Vercel Blob. Products + orders + carts stored as JSON keyed by id. Customers' Stripe secret keys in Vercel env, not in storage.
- **Stripe flow**: deferred PaymentIntent — client `elements.submit()` → server creates PI from current cart → confirmPayment. Webhook creates Order.
- **Email**: Resend, sent from the customer's domain (with DNS TXT) or our shared `orders@bodega.my` (default).
- **Site modes**: one config switch (`site_mode`) — `marketing` (no shop), `showcase` (browse, contact-to-buy), `digital` (sell, no shipping), `commerce` (full default). Checkout route, `AddToCartButton`, and scaffolding all branch on this.
- **Shipping**: simple policy in config (`free` | `flat` | `per_item`). Commerce-mode only. `/checkout` reads it via env vars at request time. International + zones are Phase 2.
- **Tax**: Stripe Tax opt-in via `BODEGA_STRIPE_TAX=true`. Off by default.
- **Image upload**: owner-gated multipart `POST /api/bodega/upload` → Vercel Blob (public URL, unguessable path). Enforces 10 MB / allow-listed MIME types server-side.
- **Multi-IDE**: plugin source in `source/skills/`, builds to `.claude/`, `.cursor/`, `.codex/`, and 5 others via `scripts/build.js`.
