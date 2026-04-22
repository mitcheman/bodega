<p align="center">
  <img src="./assets/bodega.jpg" alt="Bodega — a small hand-painted storefront with 'Bodega' on the sign, shelves of jars and produce inside, a paper lantern and potted plants out front" width="420" />
</p>

<h1 align="center">Bodega</h1>

<p align="center">
  <em>Turn any Claude-built Next.js site into a working store.</em>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="Apache 2.0" src="https://img.shields.io/badge/license-Apache%202.0-8a847d?style=flat-square" /></a>
  <a href="./HARNESSES.md"><img alt="Works with 8 AI IDEs" src="https://img.shields.io/badge/works%20with-8%20AI%20IDEs-b4552e?style=flat-square" /></a>
</p>

---

```
claude › /bodega:setup
```

Fifteen minutes later, your store is live on the internet. Customers can buy.
Your partner — or you — can add products from a phone.

No GitHub. No template picker. No dashboards to bookmark.

---

## What it does

Bodega is a small plugin for AI coding tools (Claude Code, Cursor, Codex,
Gemini, and five more). It adds the parts Claude hasn't finished yet:

- **A real storefront.** `/shop`, `/cart`, `/checkout` — themed to match
  your existing design, not a generic template.
- **A phone-first admin at `/studio`.** Add products. See orders. Print
  shipping labels. No code in sight.
- **Payments via Stripe.** Your customers pay, your bank gets the money,
  you never touch a card number.
- **Deploy to Vercel.** Optional custom domain. Optional backup to
  GitHub, framed for humans.

## What it isn't

- **Not a hosted service.** Everything runs on *your* Vercel, *your*
  Stripe, *your* domain. Your customers, your data, your money.
- **Not a page-builder.** Your site stays yours. We don't replace design
  with boilerplate.
- **Not Shopify.** If you're running a large e-commerce operation
  already, Bodega is too small for you.

## Who it's for

Makers, artists, creators — anyone selling things they made with their
hands. Solo small-business owners who want a real site, not a Squarespace.
Technical partners setting up a store for a spouse, client, or friend
who will never touch the code.

## Requirements

Before running `/bodega:setup`, your machine needs:

- **Node.js 20+**
- **A package manager** — npm, pnpm, yarn, or bun

You'll sign in to (but not pre-create) a **Vercel account** (free) and
a **Stripe account** (free; takes ~10 min during setup — KYC required).
Optionally a **domain** (or start on a free `<name>.bodega.store`).

**Not required:** GitHub account, Next.js knowledge, any code editing.

Run `/bodega:doctor` any time to verify your environment is ready.

## Install

```
/plugin install bodega
```

Or from source, while we're pre-release:

```
npx skills add mitcheman/bodega
```

Bodega pairs with [impeccable](https://impeccable.style) for design.
If you're starting from an empty folder, Bodega will offer to install
impeccable for you.

## How it feels

From an existing Claude-built site:

```
cd your-project
claude
› /bodega:setup
```

Answer a few questions, click two links (Vercel + Stripe), and your
store is live.

From an empty folder, add a design pass first:

```
mkdir my-shop && cd my-shop
claude
› /bodega:setup
```

Expect ~45 minutes the first time — most of it Claude doing the design
work via impeccable.

## The four promises

1. **The site is yours.** Uninstall Bodega tomorrow and your site still
   works. The repo stays on your laptop. Your domain stays yours.
2. **No vendor lock-in.** Stripe is Stripe. Vercel is Vercel. We don't
   wrap them in proprietary layers.
3. **Non-technical first, developer second.** The default voice is plain
   English. Pick "developer mode" on first run and we switch.
4. **Composable, not competing.** We do commerce. Impeccable does design.
   Vercel does infrastructure. We sit on top, not against.

## License

Apache 2.0. Fork freely. See [LICENSE](./LICENSE).

## Status

Pre-alpha. Open a fork and build your own if you want something
specific — this is one person's project and PRs aren't being reviewed
right now.
