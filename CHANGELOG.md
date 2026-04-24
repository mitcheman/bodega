# Changelog

All notable changes to Bodega are documented here. The plugin + both SDK
packages are versioned together — one git tag advances everything at once.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning:
[SemVer](https://semver.org/). Bodega is pre-1.0, so breaking changes can
land in a minor-version bump.

## [Unreleased]

### Real-test fixes — round 2: sub-skill audit (P0/P1/P2 batch)

Static review across all sub-skills surfaced more breakage points
beyond the install path. This round addresses every P0 and the
cheap-to-medium-cost P1/P2s. Three architectural items (headless
agent path, version pinning, rollback) deferred and TODO'd in
CLAUDE.md.

#### P0 — sub-skills with non-TTY hangs

- **hosting/SKILL.md Step 1**: bare `vercel login` hangs on auth-method
  picker in agent shells. Step now documents `vercel login --github`
  / `--email <addr>` / etc. as the agent-safe form, plus the
  `VERCEL_TOKEN` env-var path for fully-headless contexts. Added a
  decision table + rule: never run bare `vercel login` when
  `!process.stdout.isTTY`.
- **backup/SKILL.md Step 2a**: bare `gh auth login` same problem. Now
  documents `gh auth login --web --hostname github.com --git-protocol https`
  as the agent-safe form, plus `GH_TOKEN` env var for headless.
- **greenfield-design/SKILL.md Step 1**: nested `npx skills add
  pbakaus/impeccable` had the same hang (we'd already fixed bodega's
  install path but missed impeccable). Now uses `--yes --global`.

#### P0 — backup repo-creation ordering bug

- **backup/SKILL.md Steps 4 + 5 reordered**: previously called
  `gh repo create --source=.` BEFORE `git init`, which errors on
  fresh projects (`--source=.` requires an existing `.git` dir).
  Now: `git init` + `git checkout -b main` + initial commit happen
  first, then `gh repo create --source=. --remote=origin --push` does
  creation + remote-add + initial push in one command. Single
  combined Step 4. Step 5 verifies the push landed.

#### P0 — Vercel storage CLI syntax stale

- **hosting/SKILL.md Step 3**: old `vercel storage create --type blob`
  syntax dropped (CLI 50+ uses different storage subcommands). Now
  documents `vercel blob store add bodega-store` +
  `vercel blob store connect bodega-store` and a
  verify-via-`vercel env ls` check. Added a callout to upgrade Vercel
  CLI to 50+ before running (doctor warns about stale CLIs after the
  previous round's version-floor fix).

#### P0 — payments secret-key handling leaks to agent transcripts

- **payments/SKILL.md Step 4 rewritten**: previously asked the user
  to paste both `pk_*` and `sk_*` keys into chat. The secret key
  ended up in Claude Code's session JSONL on disk indefinitely.
  New flow:
  - Step 4a: publishable key (`pk_*`) is paste-in-chat (it's public
    anyway — ships in client JS).
  - Step 4b: secret key (`sk_*`) is entered by the user **directly
    into their own terminal** (separate window, agent never reads
    it) via `vercel env add STRIPE_SECRET_KEY production`. Agent
    verifies via `vercel env ls | grep STRIPE_SECRET_KEY` without
    seeing the value.
  - Fallback path (phone, sandboxed env, no separate terminal):
    capture in chat with explicit warning + immediate rotate.

#### P1 — payments missing test-mode branch

- **payments/SKILL.md new Step 3**: explicitly asks "test mode or
  live mode?" before key capture. Previously hardcoded `pk_live_` /
  `sk_live_`, leaving merchants with `pk_test_` keys (pre-KYC) with
  no path forward. Now writes `stripe.mode: test|live` to `.bodega.md`
  so deploy + downstream skills know which environment they're in.
  Distinguishes test mode (sandbox checkout works) from preview mode
  (checkout disabled) — they solve different things.

#### P1 — payments email URL-encoding

- **payments/SKILL.md Step 1**: Stripe register URL now requires
  URL-encoded email. Without it, `+`-tagged emails decode to spaces.
  One-line callout to use `encodeURIComponent()`.

#### P1 — admin / invite magic-link missing auth header

- **admin/SKILL.md Step 1 + invite/SKILL.md all magic-link calls**:
  the `/api/bodega/auth/magic-link` endpoint requires
  `x-bodega-admin-secret: <BODEGA_ADMIN_SECRET>` (provisioned by deploy
  Step 5). Without it, anyone could spam magic links to arbitrary
  emails. Both skills now document the header explicitly + the pattern
  for in-memory secret pull (`vercel env pull` → use → `rm`).

#### P1 — deploy webhook double-registration

- **deploy/SKILL.md Step 6 rewritten as idempotent upsert**: previously
  POST'd a new Stripe webhook on every redeploy → duplicate event
  deliveries → duplicate fulfilment. Now lists existing webhooks via
  Stripe API, matches by URL, updates events in place if needed, only
  creates if no match exists. Cleans up `.env.production.local` after
  use.

#### P1 — domain DNS notation not universal

- **domain/SKILL.md Step 2a**: added a per-registrar table for the
  apex DNS "Name" field. `@` is widely accepted but Cloudflare uses
  bare domain, Squarespace uses empty, Route 53 uses bare domain.
  Both voices now show the variants explicitly so users don't bounce
  at provider-specific UI.

#### P2 — openssl rand fallback to node

- **deploy/SKILL.md Step 5**: replaced `openssl rand -base64 32` with
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
  openssl isn't guaranteed on locked-down Windows / corporate images;
  node is a bodega prereq.

#### P2 — `mode_detected` mutation loses history

- **setup/SKILL.md Step 3 + Step 4**: split into two fields:
  `initial_mode` (immutable record of what was true at first run) and
  `mode` (mutable; flips to `adapt` after greenfield-design completes).
  Previously the single `mode_detected` field was overwritten,
  destroying the original detection.

#### P2 — invite missing staff-removal branch

- **invite/SKILL.md new Step 2c**: `c. Remove a staff member` option
  added to the mode picker. Lists existing staff from
  `.bodega.md` → `admin.staff[]`, calls
  `DELETE /api/bodega/auth/staff/<email>` with the admin header,
  records the removal under `admin.removed[]`. Owners are protected
  (refused with a polite message). Previously the skill claimed
  removal was supported but had no remove branch.

#### CLAUDE.md — architectural TODOs documented (deferred)

These are larger lifts that need their own focused passes:

- **Headless agent path**: env-var-based credential paths
  (`VERCEL_TOKEN`, `STRIPE_API_KEY`, `GH_TOKEN`) need consistent
  treatment across all sub-skills. Hosting documents `VERCEL_TOKEN`
  as part of this round; backup + payments need matching coverage.
- **Version pinning in `.bodega.md`**: `bodega.version` field +
  doctor schema-mismatch warning.
- **Rollback / `/bodega:uninstall`**: new skill for backing out a
  half-completed setup; each sub-skill needs to record provisioned
  resource IDs.
- **Resume-ability gaps**: `state.<skill>: in-progress | partial`
  markers need to land in every sub-skill; golden-file resume tests.

---

### Real-test fixes — install + doctor + setup hardening

Triaged from a real install run that surfaced concrete blockers and
silent footguns. All seven landed in source/skills/ + bin/cli.js +
README. Voice-gating-downstream (#8) is intentionally deferred and
explicitly TODO'd in CLAUDE.md.

#### Install path

- **bin/cli.js: TTY auto-detect.** `bodega install` now sniffs
  `!process.stdout.isTTY` and the usual agent env vars (`CLAUDECODE`,
  `CURSOR_AGENT`, `CODEX_CLI`, `GEMINI_CLI`, `WINDSURF_AGENT`,
  `AGENTS_CLI`) and auto-injects `--yes --global` when running in an
  agent context. Fixes the upstream installer's interactive
  multi-select picker hanging forever in non-TTY shells.
- **bin/cli.js: post-install restart warning.** When invoked from an
  agent, `bodega install` prints a 4-line restart reminder explaining
  the agent's skill registry is cached at startup and will not see
  `/bodega:setup` until restart (or `/plugins reload` on builds that
  support it).
- **README.md: install instructions** now use `--yes --global` by
  default with a one-line explainer + dedicated "After install: reload
  your AI" subsection.

#### Doctor

- **Workspace-parent detection.** `checkProject()` now scans immediate
  subdirectories for `package.json`. If 2+ are present, reports the
  cwd as a workspace parent ("workspace parent — 9 subprojects
  (ContainerCatalog, ai-assistant-app, bodega, bodega.my, dcmarket,
  +4 more)") with an actionable fix ("cd into the specific project
  before running setup. e.g.: cd ContainerCatalog"). Previously
  greenfield-misclassified parent dirs.
- **Version floors for vercel + gh CLIs.** Vercel CLI < 50 and gh CLI
  < 2.40 now warn (don't block) with the upgrade command. Previously
  green-checked anything that was merely present.

#### Setup

- **Pre-check 1 explicitly asks about target dir.** If the orchestrator
  detects 2+ subprojects in cwd, it prompts the user for the intended
  project before scaffolding (was: silently treated as greenfield).
- **`.impeccable.md` fallback now spelled out.** Setup explicitly says
  what happens when `.impeccable.md` is absent (built-in cream/navy/
  wood watercolor tokens; merchant can add later).
- **Example YAML uses `<UPPERCASE>` placeholders** instead of real
  values like `Mudd Mann Studio` / `muddmannstudio.com`. An agent
  reading the SKILL.md can no longer mistake them for defaults.

#### Documentation

- **README.md: heads-up about cwd footgun** added to the "Running it"
  section.
- **CLAUDE.md: voice gating TODO** documented as the next architectural
  fix, with concrete steps (read `.bodega.md` mode at start of every
  sub-skill, both voices written explicitly, voice-lint in build).
  This is the only one of the seven test-surfaced issues that needs
  multi-skill restructuring.

---

## [0.2.0] — 2026-04-23

Second release. Three big themes: **optional components**, **real image
uploads**, **shipping + tax**.

### Site modes

`.bodega.md` now has a `site_mode` field. Four options:

- **`marketing`** — just home/about/contact. No shop, no admin, no
  Stripe. For makers who want a beautiful site without selling online.
- **`showcase`** — display products with "Contact to buy" CTAs. No
  cart, no checkout. Admin has product management only (no orders).
- **`digital`** — full cart + checkout + admin. No shipping UI.
- **`commerce`** — the v0.1.0 default. Everything.

Setup skill now asks the site-mode question up front. Deploy skill
scaffolds conditionally based on mode — marketing sites don't get
useless route handlers, showcase sites don't get Stripe env vars, etc.

The `<ProductGrid>`, `<ProductPage>`, and `<AddToCartButton>` components
accept a `siteMode` prop. In showcase / marketing mode, the buy button
becomes a "Contact to buy" link pointing at `/contact?subject=...`.

### Real image uploads in `/studio`

Previous: merchant pastes URLs into a textarea (bad UX).
Now: drag-or-click file upload, preview thumbnails, drag to reorder,
click to mark primary. Uploads to Vercel Blob via a new
`@mitcheman/bodega/routes/upload` route handler.

- 10 MB per image max
- JPEG, PNG, WebP, GIF, AVIF supported
- Owner-gated (uses the same `requireOwner` session check)
- Random path prefix so URLs aren't guessable across merchants

### Shipping + tax

`BodegaConfig.business.shipping` field. Three modes:

- `{ mode: 'free' }` — you absorb shipping costs
- `{ mode: 'flat', cents: 500 }` — one flat rate per order
- `{ mode: 'per_item', cents: 300 }` — per-item charge

Checkout route reads from env vars (`BODEGA_SHIPPING_MODE`,
`BODEGA_SHIPPING_CENTS`) and adds shipping to the PaymentIntent amount.

Stripe Tax is also now opt-in. Set `BODEGA_STRIPE_TAX=true` to enable
automatic tax calculation — the merchant is then responsible for
configuring tax registrations in their Stripe dashboard.

### Breaking changes

- `BodegaConfig.site_mode` is now required for `deploy` to run — but
  for back-compat, the plugin defaults to `commerce` when absent.
- `checkout` route reads shipping + tax from env vars that didn't
  exist in v0.1. Re-run `deploy` to set them.
- `ProductEditor` no longer accepts `imagesCsv` — replaced with the new
  file upload UI. If you were passing image URLs programmatically,
  upload them via POST `/api/bodega/upload` first.

### Upgrade path from 0.1.0

```
npm install @mitcheman/bodega@0.2.0
# Re-run `/bodega:deploy` from Claude Code — it handles env var updates
# and will re-scaffold the upload route.
```

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
