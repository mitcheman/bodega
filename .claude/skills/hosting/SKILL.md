---
name: hosting
description: Sets up Vercel hosting for the project. Triggers vercel login via browser device auth, creates or links a Vercel project, provisions Vercel Blob storage, and stores project metadata in .bodega.md.
user-invocable: true
---

# Bodega: Hosting

Sets up where the site will live on the internet. We use Vercel —
free for stores at this scale, solid CLI, composes cleanly with
the vercel-plugin.

## Pre-checks

1. Read `.bodega.md`. Apply the **resume contract** from
   `setup/SKILL.md` ("Resume contract — every sub-skill follows this"):
   - `state.hosting: done` → ask if user wants to re-run.
   - `state.hosting: in-progress` / `partial` → resume from
     `hosting.last_completed_step + 1` (substep labels below).
   - `state.hosting: failed` → show `failed_reason`, ask retry-or-restart.
   - Anything else → fresh run.
2. Check for Vercel CLI: `vercel --version`. Missing → install:
   `npm install -g vercel`.

### Substep labels (for resume)

In order:
- `vercel-authed` (after Step 1)
- `scope-resolved` (after Step 2a)
- `project-linked` (after Step 2b/2c)
- `blob-store-created` (after `vercel blob store add`)
- `blob-store-connected` (after `vercel blob store connect`)
- `preview-url-recorded` (after Step 4)

Write `hosting.last_attempted_step: <next>` BEFORE each substep, then
update `hosting.last_completed_step: <substep>` AFTER. On full
success, set `state.hosting: done` and clear both substep fields.

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
storage has shifted **twice** — verify with `vercel blob --help`
before assuming any specific subcommand shape:

| Vercel CLI | Subcommand shape | Notes |
|---|---|---|
| 49 and earlier | `vercel storage create --type blob <name>` | top-level `storage`; gone |
| 50–51 | `vercel blob store add <name>` + `vercel blob store connect <name>` | nested `store add`/`store connect`; gone |
| 52+ (current) | `vercel blob create-store <name> --access=public --yes` | flat verbs; one shot, no separate connect step |

This SKILL targets CLI 52+. Doctor warns + bails if the user's CLI
is older than 50 (`MIN_VERCEL_MAJOR` in `doctor/scripts/check.mjs`),
so you can assume 52+ here. If you're somehow on 50/51, upgrade:
`npm i -g vercel@latest`.

### CLI 52 shape — what we use

```
# Create the blob store + connect it to all environments in one
# command. --yes accepts the "connect to environments?" prompt
# (which would otherwise hang in non-TTY shells). --access=public
# is required: bodega stores both product images AND magic-link
# records as public blobs (the magic-link records rely on
# unguessable 32-byte token paths instead of access control).
#
# Idempotent — list-stores returns project-linked stores; if
# bodega-store already shows up, skip create.
if ! vercel blob list-stores 2>/dev/null | grep -q '^\s*bodega-store\b'; then
  vercel blob create-store bodega-store --access=public --yes
fi

# Verify the token landed on the production env
vercel env ls production | grep -q '^BLOB_READ_WRITE_TOKEN\b' \
  || { echo "❌ BLOB_READ_WRITE_TOKEN not provisioned"; exit 1; }
```

> **No separate `connect` step on CLI 52.** There used to be a
> `vercel blob store connect` subcommand on CLI 50/51 — it's gone.
> Linking happens during `create-store` via the prompt that `--yes`
> accepts, or never. If a previous setup created a store without
> linking it, the only way to link it after the fact is the Vercel
> dashboard (Storage → bodega-store → Connect Project) — there's
> no CLI path. So always run `create-store` with `--yes` so the
> link happens atomically with creation.

> **`--access=public` is required.** The flag isn't optional on CLI
> 52 — `vercel blob create-store bodega-store` (no flag) errors with
> "access is required". And bodega specifically needs `public`: the
> SDK's `auth/blob-storage.ts` and `routes/upload.ts` both call
> `put(..., { access: 'public', ... })`, which requires a
> public-capable store. A `--access=private` store would refuse
> public puts.

### Manual fallback (only if CLI path failed)

If `create-store` errored or the token didn't land, the dashboard
path:

1. https://vercel.com/dashboard → Storage tab
2. Either click the existing `bodega-store` and "Connect Project"
   to the muddmann project, or "Create" a new Blob store, name it
   `bodega-store`, set Access to Public, link to the muddmann
   project on creation.
3. Re-run the verify: `vercel env ls production | grep BLOB_READ_WRITE_TOKEN`.

Don't proceed to `bodega:deploy` without the token in env — every
magic-link request, every image upload, every product write will
500 (or 503 with a clearer message after SDK ≥ 0.3.1).

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
  local, not from git. Even after `/bodega:backup` sets
  up a GitHub repo, the deploy pipeline stays CLI-based.
