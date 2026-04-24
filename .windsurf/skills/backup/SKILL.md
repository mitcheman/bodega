---
name: backup
description: Sets up a GitHub repo as a backup of the site code. Framed as "backup" (not "version control") for non-technical users. Auto-pushes on every deploy when enabled.
---

# Bodega: Backup (GitHub)

Copies the project to a private GitHub repo. Framed for humans, not
developers. In developer voice, calls it what it is.

## Pre-checks

1. Read `.bodega.md`. Apply the **resume contract** from
   `setup/SKILL.md`. Substep labels (in order):
   `gh-authed` → `scope-chosen` → `git-initialized` →
   `repo-created-and-pushed` → `auto-push-configured`. Resume picks
   up at `backup.last_completed_step + 1`.
   Backup is always optional — `state.backup: skipped` is a valid
   terminal state, never resumed automatically.
2. Check for `gh` CLI: `gh --version`. Missing → install:
   - macOS: `brew install gh`
   - other: direct to https://cli.github.com/ and give a friendly message.
3. **Detect headless mode**. If `GH_TOKEN` is set in env, skip the
   browser auth flow (Step 2a) entirely — the CLI uses the token
   automatically. Verify with `gh auth status` and proceed to Step 3.
   Headless callers must also specify the target via env:
   `GH_REPO_OWNER` (user or org) and optionally `GH_REPO_NAME`
   (defaults to the project slug). No interactive picker.

## Step 1 — Ask and explain

### Simple voice:

> Want me to set up a backup of your site?
>
> What it does: copies the files your site is built from to a service
> called GitHub — it's where millions of people keep backups of their
> projects. If your laptop dies or gets stolen, your whole site is
> still safe and I can restore it on another computer.
>
> Free for what we need. Private — only you can see it. I'll also
> make a fresh backup every time we update your store, so you don't
> have to think about it.
>
>   a. yes, set up a backup
>   b. skip for now (you can do this anytime later)

### Developer voice:

> Set up a private GitHub repo with initial commit + auto-push on deploy?
>
>   a. yes
>   b. skip

## Step 2a — User said yes, authenticate with GitHub

### Pick the right login mode for your context

Bare `gh auth login` drops into an interactive picker (account host,
auth method, protocol). **It hangs in non-TTY shells.** Always pass
the flags up front:

| Context | Command | Why |
|---|---|---|
| Agent / non-TTY | `gh auth login --web --hostname github.com --git-protocol https` | All choices specified; only the browser device-auth code is interactive |
| Headless CI | `GH_TOKEN=<token> gh auth status` | Skips login. User pre-creates a token at github.com/settings/tokens (`repo` + `read:org` scopes). |
| Real terminal | `gh auth login` | Picker works fine in a TTY. |

If `process.stdout.isTTY` is false, never run bare `gh auth login`.
If `GH_TOKEN` is set in env, skip login entirely.

### Simple voice:

> Ok. This is your first time signing into GitHub (different from
> Vercel or Stripe, even if you used the same Google account).
>
> Here's the flow:
>
>   1. I'll open the GitHub login in your browser. There'll be a short
>      code on the GitHub page — the same code will be shown here.
>      Sign in (or create an account — pick a username, verify email,
>      ~2 minutes), then enter the code on the GitHub page.
>   2. GitHub will ask to authorize a small command-line tool; click
>      **Authorize**.
>   3. Come back here and say "done" when GitHub says you're signed in.

### Developer voice:

> `gh auth login --web --hostname github.com --git-protocol https`
> (non-TTY-safe; bare `gh auth login` hangs on the picker in agent
> shells). Browser device-auth. `gh auth status` to verify.
>
> Headless alternative: set `GH_TOKEN` (scopes: `repo`, `read:org`);
> skip login.

Run the full-flag form. Wait for confirmation. Verify with `gh auth status`.

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

## Step 4 — Initialize git + create the private repo

**Order matters.** `gh repo create --source=.` requires an existing
`.git` directory; if you call it on a fresh project (no `.git` yet) it
errors out. So `git init` always runs first.

### 4a. Initialize git if needed

If no `.git` directory exists yet:

```
git init
git checkout -b main      # avoid the legacy `master` default
git add .
git commit -m "Initial commit via Bodega"
```

If `.git` already exists (user had it), skip this — but verify there's
at least one commit on the current branch (`git rev-parse HEAD` must
succeed). If the working tree is dirty with uncommitted changes, ask
the user before continuing.

### 4b. Create the private repo on GitHub

Repo name from `business.name` slug. Example: `mudd-mann-studio`.

```
gh repo create <owner>/<slug> \
  --private \
  --source=. \
  --remote=origin \
  --push \
  --description "<business.name> — store"
```

Flags explained:
- `--source=.` — use the current dir's git repo (now safe because
  Step 4a ran)
- `--remote=origin` — auto-add the remote as `origin`
- `--push` — push the current branch immediately

If the repo name is taken under that owner, `gh` returns a clear
error. Append `-store` or ask the user for an alternative and retry.

## Step 5 — Confirm push (or push manually if Step 4b didn't auto-push)

After Step 4b, the current branch should already be on the remote.
Verify with:

```
git remote -v          # should show origin → github.com/<owner>/<slug>
git rev-parse @{upstream}  # should resolve cleanly
```

If for any reason `--push` was skipped (older `gh` versions, custom
flow), do the push manually:

```
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

### `/bodega:backup` (default)

Runs the full flow above. If the repo already exists, just does a push
(equivalent to "make a fresh backup now").

### `/bodega:backup update`

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
  patterns.** Bodega's secret-scanner lives at
  `.windsurf/skills/backup/scripts/scan-secrets.mjs`. Run it before every push:

  ```
  node .windsurf/skills/backup/scripts/scan-secrets.mjs
  ```

  Exit 0 = safe to push. Exit 1 = findings; stop and clean up first.
- **Don't push during an interactive rebase or merge conflict.** Detect
  and ask first.
