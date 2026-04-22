# Bodega — Architecture

*What's in the repo right now. Short by design.*

---

## The shape

Three things:

1. **Plugin** (`source/skills/` + `scripts/` + `bin/`) — your internal bootstrap tool. Installs into Claude Code locally. Walks through `setup → hosting → payments → deploy → admin → domain → backup`. Scaffolds a full working Next.js app into a customer's project.
2. **`@bodega/commerce`** (`packages/commerce/`) — SDK with types, theme resolver, Vercel Blob storage, storefront components (`ProductGrid`, `ProductPage`, `Cart`, `Checkout`, `AddToCartButton`), and route handlers (`cart`, `cart-items`, `checkout`, `stripe-webhook`).
3. **`@bodega/studio`** (`packages/studio/`) — SDK with magic-link auth, session cookies, admin components (`StudioLayout`, `StudioHome`, `ProductsPage`, `ProductEditor`, `OrdersPage`, `OrderDetail`, `MarkShippedButton`, `LoginPage`), and route handlers (`auth-login`, `auth-verify`, `auth-logout`, `auth-magic-link`, `products`, `orders`).

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
│   │   └── stripe/webhook/              # stripe-webhook
│   └── bodega-theme.css                 # generated from .impeccable.md tokens
├── .bodega.md                           # tenant config (YAML frontmatter)
└── package.json                         # includes @bodega/commerce + @bodega/studio
```

Customer storage = Vercel Blob on the customer's Vercel project. Stripe = customer's own Stripe account (vanilla, no Connect platform). Domain, SSL = customer's Vercel.

---

## Where the pieces live

| Thing | Lives on | Who owns |
|---|---|---|
| Customer site + admin + API + data | Customer's Vercel | Customer |
| Customer's Stripe account + keys | Stripe + customer's Vercel env | Customer |
| Customer's domain | Customer's registrar | Customer |
| `bodega.studio` landing page (future) | Your Vercel | You |
| Plugin + scripts | Your laptop (via Claude Code) | You |

---

## What's NOT in the architecture right now (deliberately)

- **Central bodega.studio rendering of customer sites.** If/when customer juggling becomes painful (trigger: form hits from ads + 3+ customer Vercels hurting), a focused weekend adds hostname middleware + shared hosting. Not now.
- **Central tenant admin on bodega.studio.** Each customer's admin lives at their own `/studio`. Future concern, same trigger.
- **Stripe Connect platform.** Customers are direct merchants on Stripe. You're not holding money. Keeps legal/compliance simple.
- **Self-service signup.** You onboard customers manually. Concierge only.

---

## Cost per customer at this model

- Customer's Vercel: free (Hobby tier covers small stores)
- Customer's Stripe: transaction fees only (their business)
- Customer's domain: ~$12/yr (they pay)
- Your cost to onboard: ~6-10 hrs for customer 1-3, trending down
- Your cost to maintain monthly: near-zero (the SDK updates land via plugin, they redeploy once)

---

## Key design decisions (each one-liner)

- **Auth**: HMAC-signed session cookies (no JWT library). 30-day TTL. Magic-link only, no passwords.
- **Storage**: Vercel Blob. Products + orders + carts stored as JSON keyed by id. Customers' Stripe secret keys in Vercel env, not in storage.
- **Stripe flow**: deferred PaymentIntent — client `elements.submit()` → server creates PI from current cart → confirmPayment. Webhook creates Order.
- **Email**: Resend, sent from the customer's domain (with DNS TXT) or our shared `orders@bodega.email` (default).
- **Multi-IDE**: plugin source in `source/skills/`, builds to `.claude/`, `.cursor/`, `.codex/`, and 5 others via `scripts/build.js`.

---

*Detailed business plan in [PLAN.md](./PLAN.md).*
