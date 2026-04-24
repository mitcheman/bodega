---
name: hosting
description: Sets up Vercel hosting for the project. Triggers vercel login via browser device auth, creates or links a Vercel project, provisions Vercel Blob storage, and stores project metadata in .bodega.md.
---

# Bodega: Hosting

Sets up where the site will live on the internet. We use Vercel —
free for stores at this scale, solid CLI, composes cleanly with
the vercel-plugin.

## Pre-checks

1. Read `.bodega.md`. If `state.hosting: done`, ask the user if they
   want to re-run (e.g., to re-link).
2. Check for Vercel CLI: `vercel --version`. Missing → install:
   `npm install -g vercel`.

## Step 1 — Sign the user in

### Pick the right login mode for your context

Bare `vercel login` drops into an interactive auth-method picker
(Google / GitHub / Email / SAML), which **hangs in non-TTY shells**
(every AI coding agent context). Pick one of these instead:

| Context | Command | Why |
|---|---|---|
| Agent / non-TTY | `vercel login --github` | Specifies the auth method up front, opens browser device-auth, no picker. The user still authorizes in browser, but the picker step is skipped. |
| Agent + headless CI | `VERCEL_TOKEN=<token> vercel whoami` | Skips login entirely. User pre-creates a token at vercel.com/account/tokens. |
| Real terminal | `vercel login` | Fine — picker works in a TTY. |

Auto-detect: if `process.stdout.isTTY` is false, never run bare
`vercel login`. Default to `vercel login --github` and ask the user
which method to use only if they push back.

### Simple voice:

> First, your site needs somewhere on the internet to live. I'll use
> Vercel — that's the company that will run your site day-to-day.
> Free for stores at your size, and the account is yours (I'm not
> in the middle).
>
> Here's what's about to happen:
>
>   1. I'll open the Vercel login in your browser. You'll see a short
>      code on the Vercel page — the same code will be shown here.
>      Click **Confirm** in the browser if the codes match.
>   2. If you don't have a Vercel account yet, the same flow creates
>      one — no separate signup. Use Google or GitHub for the fastest
>      path; tell me if you'd rather use email.
>   3. Come back here and say "done" when the browser tells you
>      "You are now logged in."

### Developer voice:

> `vercel login --github` (non-TTY-safe; bare `vercel login` hangs
> on the auth-method picker in agent shells). Browser device-auth.
> `vercel whoami` to verify.
>
> Headless alternative: set `VERCEL_TOKEN` env var; skip login entirely.

Run `vercel login --github` (or `--email <addr>`, `--gitlab`,
`--bitbucket`, `--saml` per the user's preference). Wait for browser
confirmation. Verify with `vercel whoami`. Capture the Vercel account
email as `operator.email` in `.bodega.md`.

If `VERCEL_TOKEN` is already set in env, skip the login step entirely
and proceed straight to verification.

## Step 2 — Create or link a project

Check if current folder is already linked (`.vercel/project.json` exists).

- Linked → read `projectId` + `orgId` from the file, skip the rest.
- Not linked → resolve the scope, then create.

### 2a. Resolve the scope (required — hangs without it)

`vercel link` prompts for the **team/scope** when an account has more
than one. The `--yes` flag handles the project-creation confirmation
but not the scope picker — without `--scope=<slug>` the command hangs
in non-TTY/agent shells, exits cleanly, and writes nothing to
`.vercel/`. Result: every subsequent `vercel env`, `vercel deploy`,
`vercel blob` etc. errors with **"Your codebase isn't linked to a
project on Vercel."**

This is the most common silent-failure mode of the entire setup. Always
resolve scope before running `vercel link`.

```
vercel teams ls --json
```

Parse the response:

- **One team in the list** (the personal account) → use its `slug`.
- **Multiple teams** → ask the user which one owns this project. Map
  each team to a friendly label (e.g., `mitcheman (personal)`,
  `acme-agency`) and let them pick by number.
- **Zero teams** → impossible (the personal account always exists);
  treat as auth failure and re-run `vercel login --github`.

Cache the chosen scope for the rest of the session and write it to
`.bodega.md` so reconfigure / standalone re-runs of hosting reuse the
same scope.

### 2b. Creating

Slug from `business.name` in `.bodega.md`. Example:
`"Mudd Mann Studio"` → `mudd-mann-studio`.

```
vercel link --yes --project <slug> --scope=<scope-slug>
```

If the slug is taken under that scope, append `-1`, `-2` and retry.

### 2c. Verify the link landed

`vercel link` is the most-likely silent-failure step in the whole
flow. Verify before continuing:

```
test -f .vercel/project.json || (echo "vercel link failed silently — bail" >&2; exit 1)
vercel project inspect --json
```

If `.vercel/project.json` is missing, do not proceed to Step 3 — the
storage-provision and env-var-add commands will all fail with
"isn't linked to a project." Re-run Step 2a/2b with explicit `--scope`
or surface the error to the user.

### Simple voice:

> Setting up your store on Vercel — picking which account it lives
> under, then reserving the name. Give me a second.

(If multi-account, ask which one to use, by number.)

### Developer voice:

> `vercel teams ls` → resolve scope. `vercel link --yes --project
> <slug> --scope=<scope>`. If slug taken, suffix `-1`. Verify
> `.vercel/project.json` exists before continuing.

## Step 3 — Provision storage

One Vercel Blob store for products and images. The CLI surface for
storage shifted in CLI 50+; old `vercel storage create --type blob`
syntax is gone. Use the current Blob-specific commands:

```
# Create the blob store (idempotent — checks for existing first)
vercel blob store add bodega-store
```

Attach the store to the linked project so `BLOB_READ_WRITE_TOKEN`
auto-provisions on the project's env:

```
vercel blob store connect bodega-store
```

Verify the env var landed:

```
vercel env ls | grep BLOB_READ_WRITE_TOKEN
```

If for any reason the auto-attach failed, the user can manually link
in the Vercel dashboard (Storage → bodega-store → Connect Project).
Don't proceed to deploy without the token in env or `app/api/bodega/upload`
will 500.

> **Verify against `vercel --version` first.** This SKILL.md targets
> Vercel CLI 50+. If the user's CLI is older (doctor warns about this)
> upgrade them with `npm i -g vercel@latest` before running storage
> commands — the older CLIs accept different subcommand shapes and
> will fail or worse, succeed with the wrong defaults.

### Simple voice:

> ✓ Your site has a home on the internet.
> ✓ Set up storage for your product photos — the images live on your
>   Vercel account, not mine. You own them.

### Developer voice:

> ✓ Vercel project linked: <slug>
> ✓ Blob store created: bodega-store
> ✓ BLOB_READ_WRITE_TOKEN provisioned

## Step 4 — Record the preview URL

No deploy yet. Just record the default URL. Read project info:

```
vercel project inspect --json
```

Record as `vercel.preview_url` in `.bodega.md`.

## Step 5 — Update `.bodega.md`

```yaml
operator:
  email: mitchell@example.com
vercel:
  project_id: prj_abc123
  slug: mudd-mann-studio
  preview_url: mudd-mann-studio.vercel.app
  blob_store: bodega-store
state:
  hosting: done
```

Return control to the calling skill (usually `setup`).

## Failure modes

- **User declines browser auth** → save `state.hosting: skipped`, tell
  them honestly that setup can't continue without it. Exit politely.
- **Vercel CLI install fails** → surface error in developer voice; in
  simple voice offer the Vercel website sign-up as fallback.
- **Blob store creation fails** → continue anyway. Mark
  `state.hosting: partial` and note the missing piece.

## Rules

- **Never paste the user's Vercel token.** `vercel login` handles tokens
  in `~/.vercel/auth.json`; we don't touch them.
- **Never use GitHub integration on Vercel.** This project deploys from
  local, not from git. Even after `$bodega:backup` sets
  up a GitHub repo, the deploy pipeline stays CLI-based.
