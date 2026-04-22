<p align="center">
  <img src="./assets/bodega.jpg" alt="Bodega — a small hand-painted storefront with 'Bodega' on the sign, shelves of jars and produce inside, a paper lantern and potted plants out front" width="420" />
</p>

<h1 align="center">Bodega</h1>

<p align="center">
  <em>A Claude Code plugin for people building online stores for people who aren't going to touch the code.</em>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="Apache 2.0" src="https://img.shields.io/badge/license-Apache%202.0-8a847d?style=flat-square" /></a>
  <a href="./HARNESSES.md"><img alt="Works with 8 AI IDEs" src="https://img.shields.io/badge/works%20with-8%20AI%20IDEs-b4552e?style=flat-square" /></a>
</p>

---

## What it is

Bodega is a Claude Code plugin. Point it at a Next.js project (yours,
or one Claude just built) and it layers a real online store on top:
`/shop`, `/cart`, `/checkout`, a phone-first `/studio` admin, Stripe,
shipping, backups. One command, ~15 minutes.

No templates. No SaaS signup. The site stays yours — Bodega just wires
the commerce layer in.

## Who it's for

- **You know your way around a terminal.** Your partner/spouse/client/
  friend doesn't. You're the one opening Claude Code, not them.
- **They make something** — pottery, prints, jewelry, zines, digital art.
  Physical or digital goods. Not running a marketplace, not scaling to
  millions of SKUs.
- **You care how the site looks.** Bodega isn't a template. It layers
  commerce onto whatever Claude built for you — your colors, your
  fonts, your voice.
- **You want them to actually use it.** The `/studio` admin is
  phone-first: four taps to add a product, three taps to ship an order.

**NOT for you if:** you're running a large e-commerce operation
(Shopify fits better), you want a template library (Squarespace/Wix),
or you want a self-service SaaS signup flow (Bodega is a plugin — you're
the operator).

## What Bodega gives you

```
claude › /bodega:setup
```

Fifteen minutes later, the site is live on the internet:

- **Storefront** — `/shop`, `/cart`, `/checkout` — themed to the
  existing design, not a generic template.
- **Phone-first admin** at `/studio` — add products, see orders, print
  shipping labels, mark shipped. No code.
- **Payments** via Stripe — the merchant's own account, their bank
  gets the money, Bodega never touches a card number.
- **Deploy** to Vercel (their free Hobby tier for small stores).
- **Optional**: custom domain, private GitHub backup.

## The tech stack

Bodega's output is a standard Next.js app. Nothing proprietary,
nothing locked in:

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Payments | [Stripe](https://stripe.com) Payment Element (merchant's own account) |
| Product + order storage | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) |
| Transactional email | [Resend](https://resend.com) for magic links + receipts |
| Merchant auth | HMAC-signed session cookies + magic links (no passwords) |
| Hosting | [Vercel](https://vercel.com) (merchant's own account) |
| Domain (optional) | [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) at wholesale |
| Backup (optional) | GitHub (private repo) |
| Design scaffolding (greenfield) | [impeccable](https://impeccable.style) |

Everything here is industry-standard. You can uninstall Bodega and keep
the site running forever. See [ARCHITECTURE.md](./ARCHITECTURE.md) for
the full layout.

## What Bodega handles vs what you (or the merchant) handle

Clear split so nothing's ambiguous:

| **Bodega handles (automatically, via the plugin)** | **You handle** | **The merchant handles** |
|---|---|---|
| Scaffolding `/shop`, `/cart`, `/checkout`, `/studio` routes | Running `/bodega:setup` | — |
| Wiring Stripe Elements into `/checkout` | Pasting their Stripe API keys | Stripe KYC (legal name, bank, tax ID) |
| Magic-link auth implementation | Telling it who the merchant is | Clicking the login link in their email |
| Provisioning Vercel Blob storage | Clicking the Vercel login link | — |
| Registering the Stripe webhook | — | — |
| Buying a custom domain via Cloudflare | Optional: answering "yes I want a custom domain" | Optional: paying ~$12/yr |
| Sending the welcome email | — | Checking their inbox |
| Setting up a GitHub backup (optional) | Optional: clicking the GitHub login | — |
| Auto-pushing backup on every deploy | — | — |

**Your setup effort**: ~15 minutes of questions and two sign-in clicks.
**The merchant's one-time effort**: ~10 minutes of Stripe KYC. After
that, they only touch `/studio` when they want to add a product or ship
an order.

## Requirements

Before `/bodega:setup`, the machine needs:

- **Node.js 20+**
- **A package manager** — npm, pnpm, yarn, or bun

You'll sign in to (but not pre-create) a **Vercel account** and a
**Stripe account** (free to open; merchant-side KYC required).

**Not required:** GitHub account (only for optional backup), Next.js
knowledge, or code editing.

Run `/bodega:doctor` any time to check your environment.

## Costs (honest breakdown)

Bodega itself is free (Apache 2.0). The real monthly costs are the
services it uses on the merchant's behalf. Not hidden, not subsidized.

**Required to run a real commercial store:**

| Service | Cost | Why |
|---|---|---|
| **Vercel Pro** | **$20/mo per user** | Vercel's free Hobby tier is explicitly *non-commercial use only* (per their Fair Use Guidelines). A live store that takes real money needs Pro. This covers hosting, SSL, Blob storage, and analytics. |
| **Stripe transaction fees** | 2.9% + $0.30 per US card | No monthly fee. Paid out of each sale. International / cross-border slightly higher. |

**Optional:**

| Service | Cost | Why |
|---|---|---|
| Custom domain (Cloudflare Registrar at wholesale) | ~$12/yr | If you skip, the site stays at `<slug>.vercel.app` — ugly but free. |
| Resend transactional email | Free for 3k emails/mo, $20/mo above | Magic-link logins, order receipts, shipping confirmations. Free tier covers most small stores. |
| Shippo for shipping labels | Pay-per-label (~carrier cost + $0.05-0.10) | No monthly fee. Skip it entirely and merchants print via USPS Click-N-Ship. |
| Stripe Tax (auto sales-tax) | 0.4% of applicable transactions | Optional. Small stores can handle tax manually until they cross state nexus thresholds. |
| GitHub (private repo for code backup) | Free | Optional, enabled via `/bodega:backup`. |

**Small-store example** (muddmann-scale: ~20 orders/mo, ~$1k GMV):
- Vercel Pro: $20/mo
- Stripe: ~$32/mo (2.9% + 30¢ × 20)
- Resend: $0 (free tier)
- Domain: ~$1/mo amortized
- **Total: ~$53/mo + 3% of revenue**

For comparison at that volume: **Shopify Basic** ($39/mo + 2.9% + $0.30) = ~$71/mo. **Squarespace Commerce** ($27-49/mo + 0% fees) = ~$27-49/mo. **Big Cartel** ($15-30/mo + 0% fees) = ~$15-30/mo (but capped product counts + template-only).

Bodega sits mid-pack on *cost*. The value is the custom design — the
merchant's site looks like *their* shop, not a template.

**During setup / development** (before real commerce): Hobby tier is
fine. You can scaffold, deploy, and test in Stripe's test mode on
Vercel Hobby without violating their terms. The commercial restriction
only kicks in when real money starts flowing.

## Install

```
npx skills add mitcheman/bodega
```

Pin to a specific version:

```
npx skills add mitcheman/bodega@v0.1.0
```

Pairs with [impeccable](https://impeccable.style) for design. If you're
starting from an empty folder, Bodega will offer to install impeccable
for you.

*(Once Bodega lands in Anthropic's official plugin registry,
`/plugin install bodega` will also work. Not there yet.)*

## The ~15-minute run

From an existing Claude-built site:

```
cd your-project
claude
› /bodega:setup
```

Answer a few questions, click the Vercel sign-in link, forward the
Stripe signup link to the merchant (if that's a different person), and
the store is live.

From an empty folder, add a design pass first:

```
mkdir my-shop && cd my-shop
claude
› /bodega:setup
```

Expect ~45 min the first time — most of it Claude + impeccable doing
the design work. Subsequent stores go faster.

## The four promises

1. **The site is theirs.** Uninstall Bodega tomorrow and it still works.
   Their code, their domain, their Stripe, their money.
2. **No vendor lock-in.** Stripe is Stripe. Vercel is Vercel. We don't
   wrap them in proprietary layers.
3. **Non-technical-first, developer-second.** Default voice is plain
   English. Pick "developer mode" on first run and we switch.
4. **Composable, not competing.** We do commerce. Impeccable does
   design. Vercel does infrastructure. Bodega sits on top, not against.

## Versioning

- **Pre-1.0**: minor versions may introduce breaking changes. Read
  [CHANGELOG.md](./CHANGELOG.md) before upgrading.
- **Pin a version**: `npx skills add mitcheman/bodega@v0.1.0`.
- **Tagged releases** publish `@bodega/commerce` and `@bodega/studio`
  to npm at the same version.

## License

Apache 2.0. See [LICENSE](./LICENSE). Fork freely.

## Status

Solo-maintainer project, pre-alpha. I'm not actively reviewing PRs —
fork it if you want something different. If you ship a live store with
this, I'd love to see it — open an issue.
