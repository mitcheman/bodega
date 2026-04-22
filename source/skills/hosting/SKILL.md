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

1. Read `.bodega.md`. If `state.hosting: done`, ask the user if they
   want to re-run (e.g., to re-link).
2. Check for Vercel CLI: `vercel --version`. Missing → install:
   `npm install -g vercel`.

## Step 1 — Sign the user in

### Simple voice:

> First, your site needs somewhere on the internet to live. I'll use
> Vercel (free for stores like yours). You'll sign in with Google,
> Apple, or email. Takes 30 seconds.
>
> I'll open the login now. Come back and tell me "done" when you see
> "Logged in" in your browser.

### Developer voice:

> `vercel login` — pick auth method, confirm in browser. Waiting.

Run `vercel login`. Wait for confirmation. Verify with `vercel whoami`.
Capture the Vercel account email as `operator.email` in `.bodega.md`.

## Step 2 — Create or link a project

Check if current folder is already linked (`.vercel/project.json` exists).

- Linked → skip creation.
- Not linked → create.

### Creating:

Slug from `business.name` in `.bodega.md`. Example:
`"Mudd Mann Studio"` → `mudd-mann-studio`.

```
vercel link --yes --project <slug>
```

If slug is taken by another user, append `-1`, `-2` and retry. In simple
voice, just say "Setting up your site...". In developer voice, surface.

## Step 3 — Provision storage

One blob store for products and images:

```
vercel storage create --type blob --name bodega-store
```

Attach to the project. Auto-creates `BLOB_READ_WRITE_TOKEN` env var.

### Simple voice:

> ✓ Hosting ready.
> ✓ Set up storage for your products and photos.

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
  local, not from git. Even after `{{command_prefix}}bodega:backup` sets
  up a GitHub repo, the deploy pipeline stays CLI-based.
