---
name: backup
description: Sets up a GitHub repo as a backup of the site code. Framed as "backup" (not "version control") for non-technical users. Auto-pushes on every deploy when enabled.
user-invocable: true
---

# Bodega: Backup (GitHub)

Copies the project to a private GitHub repo. Framed for humans, not
developers. In developer voice, calls it what it is.

## Pre-checks

1. Read `.bodega.md`. Backup is always optional — it can be skipped or
   added later.
2. Check for `gh` CLI: `gh --version`. Missing → install:
   - macOS: `brew install gh`
   - other: direct to https://cli.github.com/ and give a friendly message.

## Step 1 — Ask and explain

### Simple voice:

> Want me to set up a backup of your site?
>
> What it does: copies your code to a service called GitHub, where it's
> kept safely. If your laptop dies or gets stolen, your whole site is
> still safe.
>
> Free. Private — only you can see it. I'll also make a fresh backup
> every time we update your store, so you don't have to think about it.
>
>   a. yes, set up a backup
>   b. skip for now (you can do this anytime later)

### Developer voice:

> Set up a private GitHub repo with initial commit + auto-push on deploy?
>
>   a. yes
>   b. skip

## Step 2a — User said yes, authenticate with GitHub

### Simple voice:

> Ok. Click this to sign in to GitHub — same as before, Google works:
>
> [Command: `gh auth login`]
>
> Come back and tell me "done".

### Developer voice:

> `gh auth login --web --git-protocol https`. Waiting.

Run `gh auth login`. Wait for confirmation. Verify with `gh auth status`.

## Step 3 — Ask about GitHub account or org

If the user belongs to any GitHub orgs (agency / client accounts), ask
which one:

### Developer voice:

> Your GitHub accounts:
>   1. mitchellsmith (personal)
>   2. acme-agency
>   3. mudd-mann-studio-llc
>
> Which one owns the repo?

### Simple voice:

> Which of your GitHub accounts should this be under?
>   1. Your personal account: @mitchellsmith
>   2. [org 2]
>   3. [org 3]

## Step 4 — Create the private repo

Repo name from `business.name` slug. Example: `mudd-mann-studio`.

```
gh repo create <owner>/<slug> --private --source=. --description "Mudd Mann Studio — handmade ceramics store"
```

If the repo name is taken under that owner, append `-store` or ask the
user for an alternative.

## Step 5 — Initial commit + push

If no `.git` directory exists yet:

```
git init
git add .
git commit -m "Initial commit via Bodega"
git branch -M main
git remote add origin https://github.com/<owner>/<slug>.git
git push -u origin main
```

If `.git` already exists (user had it), just add remote + push:

```
git remote add origin https://github.com/<owner>/<slug>.git
git push -u origin main
```

## Step 6 — Enable auto-push on deploy

Default to `true` in simple voice, `true` in developer voice but make
it visible:

```yaml
state:
  backup: done
backup:
  owner: mitchellsmith
  repo: mud-mann-studio
  url: https://github.com/mitchellsmith/mud-mann-studio
  auto_push: true
  last_pushed_at: 2026-04-22T15:10:00Z
```

The `deploy` skill reads `auto_push: true` and pushes changes after
each deploy.

## Step 7 — Confirm

### Simple voice:

> ✓ Backup is set up. Every time I update your store, I'll make a
> fresh backup automatically.
>
> Your backup is at: https://github.com/<owner>/<slug>
> (Private — nobody but you can see it.)

### Developer voice:

> ✓ Repo created: github.com/<owner>/<slug> (private)
> ✓ Initial push complete
> ✓ Auto-push enabled on deploy

## Standalone invocation modes

### `{{command_prefix}}bodega:backup` (default)

Runs the full flow above. If the repo already exists, just does a push
(equivalent to "make a fresh backup now").

### `{{command_prefix}}bodega:backup update`

Silent fast-path called by the deploy skill. Just:

```
git add .
git commit -m "Deploy at $(date -Iseconds)" || true
git push origin main
```

No user-facing output unless it fails.

## Failure modes

- **User declines `gh auth`** → save `state.backup: skipped`. Exit.
- **Push rejected (non-fast-forward)** → rare since we're the only
  writer. If it happens, pull rebase and retry once.
- **Repo name collision** → ask user for alternative or append suffix.
- **User commits a secret accidentally** → we scan the diff before push
  for common secret patterns (`sk_live_`, `pk_live_`, AWS keys, Stripe
  webhook secrets). If found: abort push, tell user in plain terms,
  help clean up.

## Rules

- **Never create a public repo by default.** Always `--private`.
- **Never push without warning if the working tree contains secret
  patterns.** Bodega's secret-scanner lives in scripts/scan-secrets.mjs.
- **Don't push during an interactive rebase or merge conflict.** Detect
  and ask first.
