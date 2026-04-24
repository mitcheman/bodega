# Bodega — Agent operating notes

Context for any AI coding agent opening this repo. Applies equally to
Claude Code, Cursor, Codex, Gemini, Windsurf, and any other harness
reading project memory from `CLAUDE.md` / `AGENTS.md` / `.cursorrules` /
`GEMINI.md`.

This is a single-maintainer project. Anyone is welcome to fork under
Apache 2.0; there's no PR review process — if you want changes, fork it.

## What this repo is

Bodega is a **plugin** — it installs into a user's IDE (Claude Code,
Cursor, etc.) and gives them skills that turn a Claude-built Next.js
site into a working online store. It is NOT a store, NOT a SaaS, NOT a
hosted service. It's a layer of skills + SDK packages the end-user runs
on their own infrastructure (their Vercel, their Stripe, their domain).

## The single most important rule

**Edit only `source/skills/`.**

The per-harness trees (`.claude/`, `.cursor/`, `.codex/`, `.gemini/`,
`.agents/`, `.kiro/`, `.opencode/`, `.windsurf/`) are **generated** by
`pnpm build`. They look like authored files — they're committed to git
on purpose — but they get rewritten every build. Direct edits are
destroyed on the next build.

If you find a bug in a generated file, fix it in `source/skills/<name>/SKILL.md`,
then run `pnpm build`, then commit both the source change and the
regenerated outputs together.

## Project layout

```
source/skills/<name>/SKILL.md     ← canonical source (edit here only)
source/skills/<name>/reference/   ← markdown templates (copied verbatim)
source/skills/<name>/scripts/     ← node/bash scripts (copied verbatim)
scripts/build.js                  ← the build
scripts/lib/transformers/         ← per-harness adapters (declarative)
packages/bodega/                  ← single SDK: types, theme, storefront +
                                    admin components, auth, route handlers
                                    (published to npm as @mitcheman/bodega)
bin/cli.js                        ← thin wrapper over npx skills
HARNESSES.md                      ← capability matrix per IDE
ARCHITECTURE.md                   ← shape of the repo, one level deeper
```

## Placeholders

When writing skill bodies, **never hardcode** these — use the placeholder:

| Placeholder | Why |
|---|---|
| `{{command_prefix}}` | Codex uses `$`, everyone else `/`. Hardcoding `/` silently breaks Codex. |
| `{{model}}` | "Claude", "GPT", "Gemini", or "the model". |
| `{{config_file}}` | `CLAUDE.md` / `AGENTS.md` / `.cursorrules` / `GEMINI.md`. |
| `{{scripts_path}}` | `${CLAUDE_PLUGIN_ROOT}/scripts` for Claude, relative path elsewhere. |
| `{{ask_instruction}}` | Harness-specific question-asking convention. |

Placeholder resolution is centralized in `scripts/lib/utils.js` (`resolvePlaceholders`).
Per-harness values are in `scripts/lib/transformers/providers.js`.

## Voice split

Every user-facing message in a skill honours two voices:

- **developer** — tech terms, full logs, concise, brand names allowed
- **simple** — plain English, tell-me-what-to-click, no jargon, no
  developer brand names except Vercel and Stripe (which the user has
  to click into)

If a message is user-facing and the wording differs by voice, write both
variants explicitly. See `source/skills/payments/SKILL.md` for a good
worked example.

The build enforces this with a voice-lint
(`node scripts/lint-voice.mjs`, run automatically by `pnpm build`).
Forbidden tokens inside `### Simple voice:` blockquotes fail the
build with file:line:column. Brand allow-list (Vercel/Stripe/GitHub/
Resend) is documented in the lint script. Inline-code spans
(\`DNS\`, etc.) are exempt — wrap UI labels there when the user has
to find that exact word in a third-party dashboard.

### Stretch — golden-file voice tests (not yet implemented)

Renderer-level fixture tests per voice would be the next step:
fixtures of expected simple-voice and developer-voice rendering for a
representative step in each sub-skill, asserted against on every
build. Today the lint catches the failure mode that bit us in
production (jargon leakage); fixture tests would catch regressions
in the positive direction (a rephrase that drifts away from intended
plain-English wording without crossing into jargon).

## Pre-PMF scope (do not expand without discussion)

- Next.js only (other frameworks: Phase 2)
- US-only tax / shipping (international: Phase 2)
- E-commerce only (services, bookings, subscriptions: Phase 2)
- Bring-your-own Vercel + Stripe (hosted tier: Phase 2, post-PMF)
- Self-hosted on user's infra (multi-tenant hosted service: Phase 2)

If a PR tries to expand into Phase 2 without explicit discussion,
push back politely and ask for an issue first.

## Secrets

Never commit real values for any of these — tests and examples use
clearly fake values (e.g. `muddmann@example.com`, `pk_live_...<last4>`):

- Stripe keys (`sk_live_*`, `sk_test_*`, `pk_*`)
- Vercel tokens
- GitHub PATs
- Real merchant emails or bank info

The `backup` skill references a secret scanner at
`scripts/scan-secrets.mjs` — don't commit changes that push new secret
patterns through without updating the scanner.

## License

Apache 2.0. Fork freely.
