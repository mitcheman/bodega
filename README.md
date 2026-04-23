<p align="center">
  <img src="./assets/bodega.jpg" alt="Bodega — a small hand-painted storefront with 'Bodega' on the sign, shelves of jars and produce inside, a paper lantern and potted plants out front" width="420" />
</p>

<h1 align="center">Bodega</h1>

<p align="center">
  <em>A Claude Code plugin that builds online stores for makers who won't touch the code.</em>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="Apache 2.0" src="https://img.shields.io/badge/license-Apache%202.0-8a847d?style=flat-square" /></a>
  <a href="./HARNESSES.md"><img alt="Works with 8 AI IDEs" src="https://img.shields.io/badge/works%20with-8%20AI%20IDEs-b4552e?style=flat-square" /></a>
</p>

---

## What it is

A Claude Code plugin that layers commerce into your Next.js app —
cart, checkout, admin, Stripe, shipping, backups. One command,
~15 minutes.

Built because my partner wanted a site for her pottery and I wanted
to build it with Claude Code. For anyone setting up a real store for
a maker using an AI coding tool — for yourself, a partner, a friend,
a client.

## Who it's for

You're the one with the terminal open. They're the one with the bowls,
prints, necklaces, zines, or whatever they make. They want a real
shop — their own URL, their own Stripe, something that looks like
theirs — not an Etsy listing and not a Squarespace template. You want
to build it without spending a weekend wiring up Stripe, shipping, and
an admin UI from scratch.

Not a fit if you're running a big e-commerce operation (Shopify handles
that better) or if you want a point-and-click site builder (Squarespace,
Wix). Bodega is a plugin — you're driving.

## What you get

```
claude › /bodega:setup
```

Fifteen minutes later:

- `/shop`, `/cart`, `/checkout` — themed to the existing design, not a template.
- `/studio` admin — phone-first. Add products, see orders, print shipping labels, mark shipped.
- Stripe payments — merchant's own account. Their bank gets the money.
- Deployed to Vercel.
- Optional: custom domain, GitHub backup.

## The tech stack

A standard Next.js app. Nothing proprietary.

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Payments | [Stripe](https://stripe.com) Payment Element (merchant's account) |
| Product + order storage | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) |
| Transactional email | [Resend](https://resend.com) |
| Merchant auth | HMAC-signed cookies + magic links |
| Hosting | [Vercel](https://vercel.com) (merchant's account) |
| Domain (optional) | [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) |
| Backup (optional) | GitHub |
| Greenfield design | [impeccable](https://impeccable.style) |

Uninstall Bodega tomorrow and the site keeps running. Details in
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Who handles what

| What | Who |
|---|---|
| Scaffolding routes, wiring Stripe, magic-link auth, Vercel Blob, webhooks | Bodega |
| Running `/bodega:setup`, pasting Stripe keys, clicking sign-ins | You (~15 min) |
| Stripe KYC, logging into `/studio` to add products and ship orders | The merchant |

## Requirements

- Node.js 20+
- A package manager (npm, pnpm, yarn, bun)
- A Vercel account (free to open)
- A Stripe account (free to open, ~10 min KYC)
- Optional: a domain, a GitHub account for backup

Run `/bodega:doctor` to check.

## Costs

Bodega itself is free. The services it uses cost what they cost.

**Required for a real commercial store:**

| Service | Cost |
|---|---|
| Vercel Pro | $20/mo per user — Vercel's free Hobby tier is non-commercial use only, per their Fair Use Guidelines |
| Stripe | 2.9% + 30¢ per US card, no monthly fee |

**Optional:**

| Service | Cost |
|---|---|
| Custom domain | ~$12/yr |
| Resend email | Free for 3k emails/mo |
| Shippo labels | Pay per label, no monthly fee |
| Stripe Tax | 0.4% per transaction |
| GitHub backup | Free |

At ~20 orders/mo and ~$1k GMV: roughly **$53/mo all-in**. Shopify Basic
at the same volume is ~$71. Big Cartel is ~$15–30 but template-locked.

During setup and testing (Stripe test mode, no real money): Hobby is
fine. Upgrade to Pro when you go live.

## Install

```
npx skills add mitcheman/bodega
```

Pin a version:

```
npx skills add mitcheman/bodega@v0.1.0
```

Pairs with [impeccable](https://impeccable.style) for design — Bodega
offers to install it when you start from an empty folder.

## Running it

From an existing Claude-built site:

```
cd your-project
claude
› /bodega:setup
```

From an empty folder (scaffolds the site first via impeccable):

```
mkdir my-shop && cd my-shop
claude
› /bodega:setup
```

`/bodega:setup` asks one question up front: do you want it to talk to
you like a developer, or plain English. Default is plain English.
Expect ~15 min on an existing project, ~45 min on a greenfield one
(most of that is design).

## Versioning

Pre-1.0, so minor versions may break things. Pin a tag if you care:
`npx skills add mitcheman/bodega@v0.1.0`. Tagged releases publish
`@mitcheman/bodega` to npm at the matching version.
See [CHANGELOG.md](./CHANGELOG.md).

## License

Apache 2.0. Fork freely.

## Status

Solo-maintainer, pre-alpha. Not actively reviewing PRs. If you ship a
live store with this, I'd love to see it — open an issue.
