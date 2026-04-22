# Bodega

Turn any Claude-built Next.js site into a working store.

```
claude › /bodega setup
```

Fifteen minutes later, your store is live on the internet. Customers can buy.
Your partner (or you) can add products from a phone.

No GitHub. No template picker. No dashboards to bookmark.

## What it does

Bodega is a Claude Code plugin that adds the parts Claude hasn't finished yet:

- **A real storefront.** `/shop`, `/cart`, `/checkout` — themed to match your
  existing design, not a generic template.
- **A merchant admin at `/studio`.** Phone-first. Add products. See orders.
  Print shipping labels. No code in sight.
- **Payments via Stripe.** Your customers pay, your bank gets the money, you
  never touch a card number.
- **Deploy to Vercel** (free tier for most stores). Optional custom domain.
- **A backup of your work** to GitHub (framed for humans, not developers).

## What it is not

- Not a hosted service. Everything runs on *your* Vercel, *your* Stripe,
  *your* domain. Your customers, your data, your money.
- Not a template or page-builder. Your site stays yours. We don't replace
  design with boilerplate.
- Not free-forever infrastructure. Stripe takes their ~3%, Vercel's free
  tier has limits if you blow up. That's the world.

## Who it's for

- **Makers, artists, creators** who sell things they made with their hands.
- **Solo small-business owners** who want a real site, not a Squarespace.
- **Technical partners** setting up a store for a spouse, client, or friend
  who will never touch the code.

If you use Shopify at scale already, this isn't for you.

## Requirements

Before running `/bodega:setup`, your machine needs:

**Critical:**
- **Node.js 20+**
- **A package manager** — npm, pnpm, yarn, or bun

**Needed for full setup:**
- **Vercel CLI** — we'll install it for you during the hosting step if
  missing (or: `npm i -g vercel`)

**Optional:**
- **`gh` CLI** — only if you want backup to GitHub (install: https://cli.github.com)
- **git** — only for backup (bundled on most systems)

You'll also need to sign in to (but not pre-create):
- A **Vercel account** (free; takes 30 seconds during setup)
- A **Stripe account** (free; takes ~10 min during setup — KYC required)
- Optionally a **domain** (or start on a free `<name>.bodega.store`)

**Not required:** GitHub account, Next.js knowledge, any code editing
beyond what Claude does for you.

Run `/bodega:doctor` any time to verify your environment is ready.

## Install

Bodega is distributed as a Claude Code plugin:

```
/plugin install bodega
```

Or from source, while we're pre-release:

```
npx skills add <you>/bodega
```

You'll also want [impeccable](https://impeccable.style) installed if you're
starting from an empty folder. Bodega will offer to install it for you.

## The 15-minute tour

From an existing project (like a Next.js site Claude already built for you):

```
cd your-project
claude
› /bodega setup
```

Answer a few questions, click two links (Vercel + Stripe), and your store is
live. See [`docs/first-run.md`](docs/first-run.md) for the full walk-through.

From an empty folder:

```
mkdir my-shop && cd my-shop
claude
› /bodega setup
```

Same flow, plus a design step where impeccable scaffolds the site itself.
Expect ~45 min total (most of it Claude doing the design work).

## Philosophy

Four commitments we don't break:

1. **The site is yours.** You can uninstall Bodega tomorrow and your site
   still works. The repo stays on your laptop. Your domain stays yours.
2. **No vendor lock-in.** Stripe is Stripe. Vercel is Vercel. We don't wrap
   them in proprietary layers. Everything you set up can be managed without
   us.
3. **Non-technical-first, developer-second.** The default voice is plain
   English. If you pick "developer mode" on first run, we switch.
4. **Composable with impeccable, not competing.** We do commerce. Impeccable
   does design. Vercel does infrastructure. We sit on top, not against.

## License

Apache 2.0. See [LICENSE](./LICENSE).

## Status

Pre-alpha. See [ROADMAP.md](docs/roadmap.md) for what's shipped and what's next.
