# Changelog

All notable changes to Bodega are documented here. The plugin + both SDK
packages are versioned together — one git tag advances everything at once.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning:
[SemVer](https://semver.org/). Bodega is pre-1.0, so breaking changes can
land in a minor-version bump.

## [Unreleased]

### StudioLayout — site-mode-aware nav (real-test polish)

`StudioLayout` rendered the same three nav links — Home / Products /
Orders — regardless of `site_mode`. In showcase mode (no checkout,
no orders) the "Orders" link led to a 404 or a confused empty page.

Fix in `packages/bodega/src/components/StudioLayout.tsx`: read
`BODEGA_SITE_MODE` (already set by `deploy/SKILL.md` Step 5) and
hide "Orders" unless the mode is `digital` or `commerce`. Defaults
to showing Orders when the env var is unset, matching pre-mode-aware
behavior so existing 0.2.x deployments don't regress on upgrade.

(Filed as #47 in the validation pass.)

### Vercel CLI 52 blob-store subcommand drift (real-test)

`hosting/SKILL.md` Step 3 documented `vercel blob store add
bodega-store` + `vercel blob store connect bodega-store` (the CLI
50/51 shape from round 2). On CLI 52 the subcommand surface
re-shifted: `store add` and `store connect` no longer exist. The
real shape is `vercel blob create-store <name> --access=public --yes`,
and there is no separate `connect-store` subcommand at all — linking
happens during `create-store` via a "connect to environments?"
prompt that `--yes` accepts.

Real-test impact: a setup pass got past `link` and `vercel env add`,
hit Step 3 with the documented (stale) commands, watched
`store add` error out, fell into prompt-hang on `create-store`
without flags, eventually had to wire `BLOB_READ_WRITE_TOKEN`
manually via `vercel env add` — which then ran into the
stdin-newline footgun and stored an empty value. Cascading
breakage from one stale subcommand.

Fix in `hosting/SKILL.md` Step 3:

- Replaced the CLI 50/51 commands with the CLI 52 shape:
  `vercel blob create-store bodega-store --access=public --yes`.
- Added a 3-row CLI version compatibility table so future drift is
  obvious at a glance.
- Idempotency check via `vercel blob list-stores | grep` instead of
  re-running `create-store` (which errors on existing names).
- Documented why each flag is required: `--yes` is the only way to
  accept the auto-link-to-environments prompt in non-TTY shells (no
  separate `connect` exists), and `--access=public` is required
  both by the CLI and by Bodega's SDK code (which writes blobs with
  `access: 'public'`).
- Manual dashboard fallback for the case where CLI somehow can't
  link the store to the project (Storage → bodega-store → Connect
  Project).

### Validation findings — round 6

Two real issues surfaced during validation of the round-5 doc fix.

#### Regression — `vercel env pull` doesn't decrypt on CLI 52+

The Step 5b "verify-non-empty" check shipped earlier in [Unreleased]
used `vercel env pull` to fetch `.env.production.local` and grep for
empty values. This false-positive-fires on Vercel CLI 52+: the pull
writes the file but does **not** decrypt encrypted/sensitive values
to disk — the values exist only on the runtime. So the verify would
report all secrets as empty even when they were correctly set,
causing the deploy to bail unnecessarily.

Fixes:

- **deploy/SKILL.md Step 5b** — replaced pull-and-grep with a
  presence-only check via `vercel env ls production --json` that
  confirms each required env-var name appears in the project (catches
  the never-added case but, by design, can't catch the empty-value
  case — see Step 7.5 for the reliable verify).
- **payments/SKILL.md Step 4b** — same revert; uses
  `vercel env ls production` for name-presence only, with explicit
  doc that value-emptiness can't be checked from the CLI on 52+.
- **deploy/SKILL.md Step 7.5 (new)** — the actual reliable verify is
  a post-deploy smoke test that hits the live `/api/bodega/auth/
  magic-link` endpoint with the in-memory `BODEGA_ADMIN_SECRET`. The
  HTTP response classifies the failure precisely:
  - `200` → secret + storage both good
  - `401` → `BODEGA_ADMIN_SECRET` empty/wrong on Vercel (re-add via
    `<<<` here-string, redeploy)
  - `503` → infrastructure unconfigured (most often
    `BLOB_READ_WRITE_TOKEN` missing — connect blob store, redeploy)
  - other → check `vercel logs <deploy-url>`

#### SDK — opaque 500s when blob storage isn't configured

The admin endpoint (`POST /api/bodega/auth/magic-link`) was throwing
a generic 500 when `BLOB_READ_WRITE_TOKEN` was missing — the
underlying `blob-storage.ts` `token()` function throws "is not set"
inside `createMagicLink()`, which Next bubbled up as 500 with no
useful body. Hard for the operator to diagnose.

Fixes (in `packages/bodega/src/routes/`):

- **auth-magic-link.ts** — pre-flight check for
  `BLOB_READ_WRITE_TOKEN`. Missing → `503` with
  `{ message: "Storage is not configured (BLOB_READ_WRITE_TOKEN
  missing). Run \`vercel blob store connect <store-name>\` and
  redeploy.", reason: "storage_unconfigured" }`. Storage layer
  errors during `createMagicLink()` → `502` with the underlying
  message + `reason: "storage_error"`. Both surfaced by the new
  Step 7.5 smoke test for actionable operator output.
- **auth-login.ts** — same pre-flight, but on this public endpoint
  the failure is logged server-side (`vercel logs`) and the response
  stays the constant anti-enumeration message. The operator sees the
  problem in logs without leaking infrastructure state to the
  public.

### `vercel env add` stdin-newline footgun (real-test)

CLI 52+ silently writes empty-string values when stdin closes without
a trailing newline. The `printf "%s" "$VALUE" | vercel env add NAME`
pattern (no `\n`) records `NAME=""` on Vercel and prints "Added"
regardless. All six bodega secrets (`BODEGA_SESSION_SECRET`,
`BODEGA_ADMIN_SECRET`, `STRIPE_SECRET_KEY`, etc.) silently became
empty strings on a real-world setup pass; magic-link login then
401-ed every request because `BODEGA_ADMIN_SECRET=""` failed the
`!expected` check in the SDK auth route.

Fixes:

- **deploy/SKILL.md Step 5**: explicit footgun callout with safe-vs-
  unsafe stdin form table. Bodega scripts already use the safe
  `<<<` here-string form (which appends `\n`); the doc now warns
  agents and humans not to "improve" it to `printf "%s"` /
  `echo -n` (which both strip the newline).
- **deploy/SKILL.md Step 5b** (new): pull-and-verify-non-empty
  check after the env-vars block. Pulls `.env.production.local`,
  greps for empty values among the required secret names, fails
  loud and bails with re-add instructions if any landed empty.
  In-memory only; deletes the file before exit either way.
- **payments/SKILL.md Step 4b**: same pull-and-verify pattern for
  `STRIPE_SECRET_KEY`. The previous `vercel env ls | grep` check
  saw the name but couldn't tell if the value was empty.

The SDK is already defensive — `auth-magic-link.ts` returns 401 when
`BODEGA_ADMIN_SECRET` is empty (the existing `!expected` check
catches it). The bug was always going to be visible at first
magic-link request; the new verify-step catches it three minutes
earlier, before the deploy itself.

## [0.3.0] — 2026-04-24

### Round 5 — closes the deferred architectural items + validation issue

Closes the five items previously TODO'd in `CLAUDE.md` (#14, #47,
#48, #49, #50) plus a real-test issue found while validating round 4
(`checkVercelNodeMatch` misclassification) and a SDK version bump so
the round-3/4 SDK-side fixes can actually publish.

#### #48 — Version pinning in `.bodega.md`

`bodega.version`, `bodega.installed_at`, and `bodega.last_deploy_version`
are now first-class fields. `setup/SKILL.md` Step 3 records the
plugin version that scaffolded the project; `deploy/SKILL.md` Step 9
updates `last_deploy_version` on every deploy. Reproducibility
question — "which SDK shape is this `.bodega.md` from?" — has a single
field to answer it.

`doctor/scripts/check.mjs` gains `checkBodegaVersionDrift` which
reads `bodega.version`, resolves the locally-installed plugin version
via `bodega --version`, and warns on a major-version mismatch
(suggests skimming the CHANGELOG for breaking changes between the
two). Minor/patch drift is informational.

Also fixed a name collision in setup's example YAML — the field
`mode` was used for both voice (`developer | simple`) and project
detection (`adapt | greenfield`). The second `mode:` was overwriting
the first in YAML parsers. Renamed the project-detection field to
`mode_current` (was `mode_detected` originally; kept the
backwards-compat read in `greenfield-design`).

#### #47 — Headless / agent-only path

Each side-effecting skill now has a documented headless path that
skips the browser auth flow when an env-var credential is present:

- **hosting** — `VERCEL_TOKEN` (already shipped in round 1)
- **backup** — `GH_TOKEN` (skips `gh auth login`); also reads
  `GH_REPO_OWNER` + optional `GH_REPO_NAME` so there's no interactive
  picker
- **payments** — `STRIPE_API_KEY` (Stripe's own canonical name) or
  `STRIPE_SECRET_KEY` plus `STRIPE_PUBLISHABLE_KEY`. New "Headless
  path" section in payments/SKILL.md skips Steps 1–4 entirely

`setup/SKILL.md` Step 1.4 (new) detects headless context (`!isTTY`
AND at least one credential env var). When detected: skips the
"set expectations" Step 1.5, defaults voice to developer, and skips
the "ready?" confirmation gates throughout.

#### #50 — Resume-ability

New "Resume contract" section in `setup/SKILL.md` formalizes the
state machine every sub-skill follows:

```
state.<skill>: not-started | in-progress | partial | done | failed | skipped
<skill>.last_completed_step: <substep-label>
<skill>.last_attempted_step: <substep-label>
<skill>.failed_at, <skill>.failed_reason  (only on failed)
```

Each sub-skill writes `last_attempted_step` BEFORE any side-effecting
call, updates `last_completed_step` AFTER, and sets terminal
state (`done` / `failed` / `skipped`) at end-of-skill. Resume reads
the bookmark and starts at the next side-effect — no double-provisioning.

Substep labels documented per skill:
- **hosting**: `vercel-authed → scope-resolved → project-linked → blob-store-created → blob-store-connected → preview-url-recorded`
- **payments**: `mode-chosen → publishable-key-stored → secret-key-stored → payments-config-recorded`
- **deploy**: `sdk-installed → theme-resolved → marketing-isolated → routes-scaffolded → cart-provider-wrapped → env-vars-provisioned → webhook-registered → built → deployed → domain-bound`
- **admin**: `magic-link-generated → welcome-email-sent → walkthrough-enabled → handoff-package-written`
- **domain**: `domain-acquired → domain-bound-to-vercel → dns-configured → verification-confirmed`
- **backup**: `gh-authed → scope-chosen → git-initialized → repo-created-and-pushed → auto-push-configured`

(Golden-file resume tests deferred — listed in CLAUDE.md as
follow-up. The contract is in place; harness tests come next.)

#### #49 — `/bodega:uninstall` rollback skill

New user-invocable `uninstall/SKILL.md`. Walks the user through
removing each provisioned resource in the right order:

1. Stripe webhook (cheapest to recreate — do first so duplicate-events
   risk is gone before the URL disappears)
2. Custom domain unbinding (registrar untouched — user still owns it)
3. GitHub backup repo — DESTRUCTIVE, requires typed-`delete`
   confirmation, uses `gh repo delete --yes` for non-TTY safety
4. Vercel blob store
5. Vercel project itself (last — once gone, the URLs other resources
   point to are also gone)
6. `.bodega.md` itself (defaults to KEEP — the file becomes an audit
   trail of what was removed)

Each step asks first, defaults no, and is idempotent (already-gone
resources are noted, not errored on). The merchant's Stripe account /
bank / payouts / domain registrar are NEVER touched — only the
Bodega-provisioned linkage between them and the deployment.

#### #14 — Voice gating + build-time lint

New `scripts/lint-voice.mjs` scans every `SKILL.md` for forbidden
developer-jargon tokens inside `### Simple voice:` blockquotes. The
build (`scripts/build.js`) runs the lint before any transform and
aborts if violations are found. Forbidden tokens (~20 entries) cover
the canonical jargon from CLAUDE.md plus extensions surfaced during
the lint pass: `env vars`, `webhook`, `repo`, `commit`, `push`,
`deploy`, `Next.js`, `Tailwind`, `npm`, `npx`, `CLI`, `SDK`,
`API key`, `DNS`, `auth`, `environment variable`, etc.

Brand allow-list: **Vercel**, **Stripe**, **GitHub**, **Resend**
(the user has to recognize them at a click target). Inline-code
spans (`` `DNS` ``) are exempt — wrap UI labels when the merchant
has to find that exact word in a third-party dashboard.

Found and fixed 13 violations across `deploy`, `domain`, `status`,
and the new `uninstall` skill during the initial lint pass. Build is
now lint-clean across all 13 skills.

Bypass for iterative editing: `BODEGA_SKIP_VOICE_LINT=1 pnpm build`.
Don't ship that way.

New "Voice contract" section in `setup/SKILL.md` formalizes the
contract for sub-skills (resolve voice from `.bodega.md` at start,
default to developer if absent, render every user-facing block in
the resolved voice).

#### Validation — `checkVercelNodeMatch` misclassification (round 4 regression)

Doctor's Node-version cross-check from round 4 said "auth expired?"
on every failure mode — including the actual case, which was almost
certainly `vercel project inspect --json` not being a supported
combination on CLI 52 (different from top-level `vercel inspect
--json`).

Fix:
- New `tryCmdDetail()` helper captures stderr + exit code separately
  so probes can diagnose failures instead of guessing.
- `classifyVercelFailure()` maps stderr text to actual reason
  (auth-expired, project-not-linked, flag-unsupported, fall-back to
  first-stderr-line).
- `checkVercelNodeMatch` now tries `vercel inspect --json` first,
  falls back to `vercel project inspect --json`. On total failure,
  downgrades to informational (not warning) with the actual stderr
  reason — never claims "auth expired" without evidence.
- Best-effort `nodeVersion` lookup across the three known shapes
  (`nodeVersion`, `framework.nodeVersion`, `meta.nodeVersion`,
  `build.env.NODE_VERSION`).

#### SDK — bumped `@mitcheman/bodega` to 0.3.0

`packages/bodega/package.json` version → `0.3.0` so rounds 3+4
SDK-side fixes (LoginPage Suspense split, undici CVE bump,
email-bootstrap-link path) actually publish. To publish:

```
cd packages/bodega
pnpm publish --access public
```

Minor bump (not patch) because the `@vercel/blob` major bump is a
transitive dep change worth signalling, and the magic-link response
shape gained `email_sent` / `email_unconfigured_reason` fields
(additive — non-breaking, but new public surface).

### Real-test fixes — round 4: deploy bundle, doctor depth, backup/status polish

Closes the 10 P0/P1/P2 items still open after rounds 1–3.

#### P0 — `vercel deploy` 413 on >10MB projects (#29)

Real-test discovery: muddmannstudio's ~20 MB photo library hit Vercel's
10 MB request body limit on plain `vercel deploy --prod`. Deploy
silently failed (CLI showed an error but the user couldn't tell what
to do).

Fix: `deploy/SKILL.md` Step 7 split into 7a/7b/7c. Step 7a writes a
`.vercelignore` baseline (excludes `node_modules`, `.next`, `.git`,
common large-media dirs like `public/raw`, `public/originals`,
`drafts`, `*.psd`, `.env*.local`). Step 7b sizes the upload via
`du -sh` and routes ≥50 MB or post-413-failure projects through
`vercel build --prod && vercel deploy --prebuilt --prod`, which
uploads only the build output. Step 7c adds a `413` row to the
error-translation table.

#### P1 — undici CVEs in `@vercel/blob@^1.0.0` (#46)

`@vercel/blob` 1.x pinned `undici ^5.28.4`, which `npm audit` flagged
as high-severity (no-fix-available on the v1 branch). Bumped
`packages/bodega/package.json` to `@vercel/blob: ^2.3.3`, which uses
`undici ^6.23.0` → resolves to ≥6.25.0 at install time, past the CVE.
API surface (`put`, `del`, `list`) unchanged across the major bump;
typecheck passes without any source changes. `pnpm audit --prod` now
returns clean.

#### P1 — Deploy SKILL gaps (#27, #28, #30, #35, #36)

- **#27** Products route methods enumerated. New `Multi-method routes
  — exact exports` table in deploy/SKILL.md Step 3 spells out the
  exact `export { POST }` / `export { PATCH, DELETE }` lines for every
  SDK route file. Removes the "agent must introspect SDK" footgun.
- **#28** `CartProvider` wrap is now gated on
  `site_mode in {digital, commerce}`. Marketing and showcase modes
  skip the wrap (no cart → no provider needed → don't pull a client
  component into root layout for nothing).
- **#30** `.vercelignore` baseline is now part of Step 7a (paired with
  the `--prebuilt` fallback above).
- **#35** New Step 2.5 — "Isolate the marketing layout (if it'd
  collide)." Detects nav/footer in the merchant's existing
  `app/layout.tsx`, walks them through moving the marketing chrome
  into `app/(site)/layout.tsx` so studio + shop don't inherit the
  marketing nav. Skip-if-already-minimal short-circuit.
- **#36** Documents StudioLayout's default-vs-named export
  ambiguity — the SDK exports both, scaffolds standardize on the
  named import.

#### P1 — Doctor checks gain three project-linked probes (#6, #8, #9)

When `.vercel/project.json` exists, doctor now runs (skipped silently
otherwise — pre-link state stays clean):

- **#6** `checkVercelNodeMatch` — runs `vercel project inspect --json`,
  parses `nodeVersion`, compares to `process.versions.node`. Warns on
  major-version mismatch with both remediations (nvm-install or
  Vercel-side change). Catches the "local Node 24, project Node 20"
  silent-divergence pattern.
- **#8** `checkBlobToken` — runs `vercel env ls production`, looks for
  `BLOB_READ_WRITE_TOKEN`. Warns if absent ("/studio image upload + product storage will 500"). Names-only, never reads values.
- **#9** `checkResendConfig` — same approach for `RESEND_API_KEY` +
  `BODEGA_FROM_EMAIL`. Treats neither-set as opt-in (matches the
  email-opt-in default; reminds user the bootstrap-link path is
  active). Warns on half-configured states. Doesn't try to verify the
  Resend domain server-side (would require pulling the API key into
  doctor) — surfaces a manual-check reminder instead.

A shared `vercelEnvNames()` helper memoizes the `vercel env ls` call
so the three probes share one subprocess.

#### P2 — Polish (#3, #40, #42)

- **#3** `bodega.my/public/llm-setup.txt`: added a top-of-file
  "DO NOT SUMMARIZE" preamble for fetch proxies / summarizing
  middlemen, listing the load-bearing flags (`--yes`, `--global`,
  `--prod`, `--prebuilt`, `--scope=`) and pointing at the lossless
  json/txt alternates.
- **#40** Per-deploy auto-push opt-out documented in deploy/SKILL.md
  Step 10. Two paths: `BODEGA_NO_PUSH=1` env var (CI / one-shot
  override) and `--no-push` invocation flag for standalone runs.
  Project-wide `auto_push: true` stays untouched.
- **#42** status/SKILL.md gains a "handle remote-call failures
  gracefully" sub-section under Step 1, with a translation table
  mapping common Vercel/GitHub auth/connectivity failures to
  user-visible reports + remediation commands. Previously, a stale
  Vercel auth blanked out the whole status table.

### Real-test fixes — round 3: studio auth flow

Two studio-login bugs surfaced during a real first-deploy run, plus the
follow-on for the email opt-in shipped in `00c4eaf`.

#### P0 — `/studio/login` infinite redirect loop

`StudioLayout` is auth-gated: no session cookie → `redirect('/studio/login')`.
The deploy/SKILL.md scaffold mounted it at `app/studio/layout.tsx`, which
in App Router wraps every descendant — including `app/studio/login/page.tsx`
itself. So the unauth'd visitor hit the layout, got redirected to
`/studio/login`, hit the same layout, redirected again. Forever.

Fix: route groups. Authed pages move under `app/studio/(authed)/`, with
the layout mounted at `app/studio/(authed)/layout.tsx`. `/studio/login`
and `/studio/verify` stay outside the group, so the auth-gating layout
never wraps them. URLs are unchanged — Next.js strips the `(group)`
segment from the routed path. `StudioLayout`'s docstring now spells out
the correct mount point with a redirect-loop warning.

#### P0 — `LoginPage` `useSearchParams()` without `<Suspense>`

Next.js 15+ requires `useSearchParams()`-using components to be wrapped
in a Suspense boundary, otherwise prerender fails with
"useSearchParams() should be wrapped in a suspense boundary." The
SDK's `LoginPage` read `params.get('error')` at the top level. Consumers
following the SKILL's one-line `export default LoginPage` couldn't have
known they needed to wrap.

Fix: split into `LoginPage` (Suspense wrapper + skeleton fallback) and
`LoginForm` (search-params-reading inner). The boundary lives inside
the SDK so consumer page.tsx files stay one-liner re-exports.

#### Email opt-in: bootstrap link path (Option A, secure)

`00c4eaf` made email opt-in. That fix had a hole: with email off, the
merchant couldn't actually log in to `/studio` — `auth-login` would 500
on the missing `RESEND_API_KEY`, and even fixing that left the merchant
locked out (the link had nowhere to go).

Fix: when `RESEND_API_KEY` or `BODEGA_FROM_EMAIL` is unset, the
admin-protected `/api/bodega/auth/magic-link` endpoint returns the
verify URL in the response body (`email_sent: false`, `verify_url`)
instead of attempting to send. The `bodega:admin` and `bodega:invite`
skills branch on the flag and surface the URL to the operator with
explicit "this grants owner access, don't paste in chat" warnings.

Security analysis (full version in admin/SKILL.md Step 1):
- Endpoint stays gated by `BODEGA_ADMIN_SECRET`. No public path returns
  a link.
- The endpoint already echoed `verify_url` in the success-path response
  body, so the bootstrap path is the same shape — no new privilege.
- Anyone holding `BODEGA_ADMIN_SECRET` already controls the deployment
  and can read `BODEGA_SESSION_SECRET` to forge sessions directly.
  We're not opening a new path, just making an existing one usable
  when Resend isn't configured.
- Public `/api/bodega/auth/login` still returns the constant
  anti-enumeration message and never exposes a link in the body. When
  email is off it logs the URL server-side (`vercel logs` access only).
- Token entropy (32 bytes), TTL (24h), single-use consumption — all
  unchanged.

Also dropped the dead `'orders@bodega.my'` fallback in `auth-login.ts`
and `auth-magic-link.ts` (would have caused Resend 403s if ever hit;
the explicit `isEmailConfigured()` check makes the fallback impossible
to reach).

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
