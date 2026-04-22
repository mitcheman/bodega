# Changelog

All notable changes to Bodega are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning
is [SemVer](https://semver.org/).

## [Unreleased]

## [0.0.1] — 2026-04-22

### Added

- Initial plugin scaffold and build pipeline.
- 11 skills: `setup`, `greenfield-design`, `hosting`, `payments`,
  `deploy`, `admin`, `domain`, `backup`, `invite`, `status`,
  `reconfigure`.
- Multi-harness build pipeline generating per-IDE trees for: Claude Code,
  Cursor, Codex, Gemini, Agents (VS Code Copilot / Antigravity), Kiro,
  OpenCode, Windsurf.
- SDK package stubs: `@bodega/commerce` (product/cart/checkout) and
  `@bodega/studio` (merchant admin).
- Reference templates for merchant handoff: welcome email, how-your-store-works
  one-pager, announcement blurb.
- `.bodega.md` config schema (voice mode + beneficiary + business context +
  state machine).
- CI workflow enforcing source ↔ generated-outputs sync.
- Apache 2.0 license.

### Not yet implemented

- Actual SDK component implementations (React components, magic-link auth,
  Stripe Elements wiring).
- Per-skill scripts (`source/skills/*/scripts/*.mjs`) that invoke real
  Vercel CLI / Stripe API / Shippo calls.
- Secret scanner (`scripts/scan-secrets.mjs`) referenced by the `backup` skill.
- Golden-file tests for build output per provider.
- Publishing workflow for npm packages on release tags.

See `docs/roadmap.md` for what's next (when that file exists).
