# Changelog

All notable changes to Bodega are documented here. The plugin + both SDK
packages are versioned together — one git tag advances everything at once.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning:
[SemVer](https://semver.org/). Bodega is pre-1.0, so breaking changes can
land in a minor-version bump.

## [Unreleased]

---

## [0.1.0] — 2026-04-22

First public release. Functionally complete end-to-end for single-tenant
stores; tested by the author's own `muddmann` build.

### Plugin

- 12 skills across 8 harnesses (Claude Code, Cursor, Codex, Gemini, VS Code
  Copilot / Antigravity, Kiro, OpenCode, Windsurf).
- `setup`, `doctor`, `greenfield-design`, `hosting`, `payments`, `deploy`,
  `admin`, `domain`, `backup`, `invite`, `status`, `reconfigure`.
- Build pipeline compiles `source/skills/` → per-harness trees; enforced
  in CI.
- Working scripts: `doctor/check.mjs`, `hosting/link-vercel.mjs`,
  `backup/scan-secrets.mjs`.

### `@mitcheman/bodega`

Single SDK package containing everything the customer site needs.

- Domain types: `Product`, `Order`, `Cart`, `Address`, `BodegaConfig`.
- Theme resolver: parses `.impeccable.md` → `globals.css` → tailwind → defaults.
- Vercel Blob storage: products, orders, carts, magic-link records.
- Storefront components (server): `ProductGrid`, `ProductCard`, `ProductPage`.
- Storefront components (client): `Cart`, `Checkout` (Stripe Payment
  Element), `AddToCartButton`, `CartProvider`, `useCart`.
- Admin UI: `StudioLayout`, `StudioHome`, `LoginPage`, `ProductsPage`,
  `ProductEditor`, `OrdersPage`, `OrderDetail`, `MarkShippedButton`.
- Auth: HMAC-signed session cookies, magic-link auth with consume-once
  semantics, role-scoped session helpers.
- Next.js route handlers for every API surface: `cart`, `cart-items`,
  `checkout`, `stripe-webhook`, `auth-login`, `auth-verify`, `auth-logout`,
  `auth-magic-link`, `products`, `orders`.

### Known limitations

- **Not yet end-to-end tested** on a real deploy. Muddmann's live run is
  the Day-1 validation.
- **Customer-facing consumer sites** still require the customer's own Vercel
  account. Central hosting is a future consideration (see `ARCHITECTURE.md`).
- **No refunds UI** in `/studio` (use Stripe dashboard).
- **No Shippo integration** (merchants print USPS labels manually and paste
  tracking numbers).
- **No shipping-notification email** to customers on mark-shipped yet.

---

## Pinning and version policy

- **Every tagged release** updates all package versions in lockstep.
- **Plugin consumers** pin to a tag: `npx skills add mitcheman/bodega@v0.1.0`.
- **SDK consumers** pin via npm: `@mitcheman/bodega@0.1.0`.
- **Pre-1.0** minors may introduce breaking changes — upgrade one minor at a
  time and read this file.
- **Post-1.0** (future) will follow strict SemVer: only majors break.
