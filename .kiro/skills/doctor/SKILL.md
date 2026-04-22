---
name: doctor
description: Preflight check — verifies the user's environment has everything Bodega needs (Node, package manager, Vercel CLI, gh CLI, Next.js if adapting). Reports clearly what's missing and how to fix it. Auto-invoked at the start of setup; can also be run standalone.
---

# Bodega: Doctor

A single-command environment check. Run before starting setup to know
what's missing, or standalone any time you want to verify the machine
is still good.

## What it checks

**Critical** (Bodega can't run at all without these):
- Node.js ≥ 20
- A package manager (npm, pnpm, yarn, or bun)

**Needed for deploy** (warn but don't block here — the `hosting` skill
will install Vercel CLI if missing):
- Vercel CLI (`vercel`)

**Optional** (depending on features the user wants):
- `gh` CLI (only for `/bodega:backup`)
- `git` (bundled on most systems; required for backup)
- Stripe CLI (nice for webhook testing; not required)

**Project-specific** (only if a project is already present):
- `package.json` — is this a Node project at all?
- Framework → Next.js 16 preferred. Others: best-effort.
- `.impeccable.md` — design context available?
- `.bodega.md` — already set up? (setup won't clobber; reconfigure will.)

## How to run

```
node .kiro/skills/doctor/scripts/check.mjs
```

(Or just invoke this skill — `/bodega:doctor` — and the
runtime handles the dispatch.)

## Output

The check script prints a table and exits 0 if all critical checks pass,
exits 1 otherwise. Example output:

```
✓ Node 22.1.0              (>= 20 required)
✓ pnpm 9.12.0              (package manager)
✓ git 2.45.0
✗ Vercel CLI not installed → Run: npm i -g vercel
✓ gh CLI 2.60.0            (optional — for backup)
✓ Next.js 16.2.4 detected
✓ .impeccable.md present   (design context available)

1 issue. Install missing tools and re-run /bodega:doctor.
```

## Voice adaptation

If `.bodega.md` exists and sets `mode: simple`, soften the output:

```
Looking at your computer to make sure everything is ready...

✓ Node is installed (version 22.1, good)
✓ You have a package manager (pnpm 9.12)
✗ Vercel is not installed yet — I'll install it for you when we get to
  the hosting step, or you can install it now with:
  npm i -g vercel

Otherwise you're good to go. Run /bodega:setup when ready.
```

If `.bodega.md` is absent (first run), default to a neutral voice.

## Auto-invocation

The `/bodega:setup` skill invokes doctor as its very
first step. If doctor reports any critical failures, setup halts and
tells the user to fix them first. Non-critical warnings are shown but
don't block.

The doctor script must always exit 0 on "warnings only" (e.g., Vercel
CLI missing is a warning, not a failure) so setup can continue and let
the hosting skill handle the install.

## What counts as critical vs. warning

| Check | Critical if missing? |
|---|---|
| Node >= 20 | ✅ critical — halt |
| Any package manager | ✅ critical — halt |
| `package.json` in adapt mode | ⚠️ warning — mode may shift to greenfield |
| `package.json` in greenfield mode | — expected absent |
| Vercel CLI | ⚠️ warning — hosting skill installs |
| `gh` CLI | ⚠️ warning — only needed for backup |
| `git` | ⚠️ warning — only needed for backup |
| Stripe CLI | informational — never blocks |

## Rules

- **Never auto-install anything from `doctor`.** It's read-only. Install
  happens in the skill that actually uses the tool.
- **Don't cache results.** Every invocation re-checks. Environments change.
- **Respect `.bodega.md` voice if present.** Default to neutral if absent.
- **Keep the output under 15 lines** in typical (healthy) case. If
  everything passes, the entire output fits on a phone screen.
