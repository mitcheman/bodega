---
name: uninstall
description: Roll back a Bodega-provisioned project. Walks the user through removing the Vercel project, blob store, GitHub repo, Stripe webhook, and (optionally) `.bodega.md` itself. The merchant's Stripe account stays — that's their data.
---

# Bodega: Uninstall

Reverse what setup put in place. Use this when:

- A setup half-finished and left orphan resources (Vercel project,
  blob store, GitHub repo) that need cleaning up before retry.
- The merchant decided not to keep the store and wants the
  external-service residue removed.
- The project is moving to a different stack and the Bodega-provisioned
  pieces aren't needed anymore.

This skill is **destructive** by design. It asks before each step and
defaults to "no" — accidentally deleting a Vercel project on the day
of a launch would be a very bad day.

## Pre-checks

1. Read `.bodega.md`. If absent, there's nothing to uninstall — say so
   and exit.
2. Show a one-paragraph summary of what was provisioned (read from
   `.bodega.md` `vercel`, `backup`, `stripe`, `domain` sections), so
   the user knows exactly what's about to come down.

### Simple voice:

> Here's what I'd undo:
>
>   • Your hosting on Vercel (`muddmannstudio` project + your photo
>     storage)
>   • Your backup folder on GitHub (the private one)
>   • The Stripe connection (just the link — your Stripe account and
>     your money stay safe, only the line between Stripe and your site
>     comes down)
>   • Your custom domain `muddmannstudio.com` won't be deleted (you
>     still own it), but I'll unlink it from this site.
>   • This project's `.bodega.md` settings file
>
> Want to keep going? I'll ask before each piece.

### Developer voice:

> Provisioned resources to remove:
>   - Vercel project: `prj_abc123` (`muddmannstudio`) + blob store `bodega-store`
>   - GitHub: `mitchellsmith/mudd-mann-studio` (PRIVATE)
>   - Stripe webhook: <endpoint_id> at https://muddmannstudio.com/api/stripe/webhook
>   - Vercel domain binding: muddmannstudio.com (DNS / registrar untouched)
>   - .bodega.md
>
> Each step asks first, defaults no. Stripe account/balance/payouts NOT
> touched.

## Step 1 — Remove the Stripe webhook

Stripe webhooks are the cheapest to recreate, so do them first. If the
user bails partway through uninstall, at least the duplicate-events
risk is gone before the URL the webhook points to disappears.

### Ask first

#### Simple voice:

> Remove the Stripe connection? (Your Stripe account stays. This just
> turns off the line that tells your site when an order is paid for.
> Safe to remove if you're tearing this site down — re-running setup
> adds it back.)
>
>   y / n  (default: n)

#### Developer voice:

> Delete Stripe webhook `<endpoint_id>` (URL: `<webhook_url>`)? Account/
> balance untouched. y/n (default n).

### If yes

Pull `STRIPE_SECRET_KEY` from Vercel env (in-memory only):

```
vercel env pull .env.production.local --environment=production --yes
```

Delete the webhook by ID:

```
DELETE https://api.stripe.com/v1/webhook_endpoints/<endpoint_id>
Authorization: Bearer <STRIPE_SECRET_KEY>
```

Then `rm .env.production.local`.

Mark in `.bodega.md`:

```yaml
state:
  webhook_configured: false
uninstall:
  webhook_removed_at: <iso>
```

## Step 2 — Unbind the custom domain (if `state.domain: done`)

The domain itself isn't deleted (the merchant still owns it at the
registrar). We only remove the Vercel binding so subsequent deploys
don't auto-bind.

### Ask first

#### Simple voice:

> Unlink your custom domain `<domain>` from this site? (You still own
> the domain — this only disconnects it from your store. Safe.)

#### Developer voice:

> `vercel domains rm <domain> --yes` — removes the binding only.
> Registrar / DNS records untouched. y/n (default n).

### If yes

```
vercel domains rm <domain> --yes
```

Mark `.bodega.md`:

```yaml
state:
  domain: skipped
uninstall:
  domain_unbound_at: <iso>
```

## Step 3 — Remove GitHub backup repo (DESTRUCTIVE)

The most destructive step — deleting a git repo means losing any
history that wasn't pulled locally. Make the prompt unmistakable.

### Ask first

#### Simple voice:

> ⚠️ Delete your backup folder on GitHub? (`<owner>/<repo>`)
>
> This is **permanent**. If you have files on GitHub that aren't on
> this computer anymore, they'll be gone. You can still pull a copy
> down RIGHT NOW (before saying yes) if you want to keep one.
>
> Type the word **delete** to confirm, or anything else to skip.

#### Developer voice:

> ⚠️ `gh repo delete <owner>/<repo> --yes` — IRREVERSIBLE. Local clone
> is your only copy if you proceed. Type `delete` to confirm.

### If user typed "delete"

```
gh repo delete <owner>/<repo> --yes
```

(`gh repo delete --yes` is the non-interactive form — without `--yes`
the CLI prompts for the repo name as a typed-confirmation, which hangs
in non-TTY shells.)

Mark `.bodega.md`:

```yaml
state:
  backup: skipped
uninstall:
  github_repo_deleted_at: <iso>
  github_repo_was: <owner>/<repo>
```

## Step 4 — Remove Vercel blob store

### Ask first

#### Simple voice:

> Delete your photo storage on Vercel? (`<blob_store_name>`)
>
> Photos uploaded through your studio live here. If you put your site
> back online later, you'll need to re-upload them. The originals on
> your computer are unaffected.

#### Developer voice:

> `vercel blob store remove <name> --yes`. All blobs deleted. y/n
> (default n).

### If yes

```
vercel blob store remove <blob_store_name> --yes
```

Mark `.bodega.md`:

```yaml
uninstall:
  blob_store_removed_at: <iso>
  blob_store_was: <name>
```

## Step 5 — Remove the Vercel project itself

Last — once the project is gone, the URLs that webhooks point to are
also gone. Ordering matters: webhook removed in Step 1, domain unbound
in Step 2, blob store gone in Step 4, project last.

### Ask first

#### Simple voice:

> Delete the Vercel project itself? (`<project_slug>`)
>
> ⚠️ **Permanent.** Your store will stop responding at the URL right
> after I do this. The custom domain stays in your name (Step 2 just
> unlinked it).
>
> Type the project name to confirm.

#### Developer voice:

> `vercel project rm <slug> --yes`. URL goes 404 immediately. Type
> the slug to confirm.

### If user typed the slug correctly

```
vercel project rm <slug> --yes
```

If the project doesn't exist (already deleted manually, or never
created), surface the message but don't error — keep going.

Mark `.bodega.md`:

```yaml
state:
  hosting: skipped
uninstall:
  vercel_project_removed_at: <iso>
  vercel_project_was: <slug>
```

## Step 6 — Remove `.bodega.md` itself

### Ask first

#### Simple voice:

> Last step: delete the `.bodega.md` config file in this project
> folder?
>
>   y → fully fresh slate; running setup again starts from scratch
>   n → keep the file (useful as a record of what was uninstalled)
>
> Default: keep.

#### Developer voice:

> `rm .bodega.md`? Keep is fine — the `uninstall.*` markers above
> document what came down. Default n.

### If yes

```
rm .bodega.md
```

(If user said no, the file stays with all the `uninstall.*` markers
written through Steps 1–5 — that's an audit trail.)

## Step 7 — Summary

Show what was actually removed (some steps may have been skipped):

### Simple voice:

> ✓ Done. Removed:
>   - The Stripe connection
>   - Your backup folder on GitHub
>   - Your hosting on Vercel + your photo storage
>
> Kept (because you said skip):
>   - Custom domain (still in your name)
>   - `.bodega.md` (in case you want a record)
>
> Your Stripe account, your bank account, and your domain registrar
> are untouched. If you want to start over, just run
> `$bodega:setup` in this folder again.

### Developer voice:

> ✓ Uninstall complete.
>   removed: stripe-webhook, github-repo, vercel-project, blob-store
>   skipped: domain-unbind, .bodega.md
>
> Re-run setup any time. Resume contract treats removed `state.*`
> as `skipped`, not `not-started` — re-setup will ask before
> recreating each.

## Rules

- **Default to no on every prompt.** Each step is destructive at
  some scale. The user says yes per step; never bundle.
- **Never touch the merchant's Stripe account, bank, or money.** Only
  the webhook (the connection), never the account itself. Stripe
  account deletion happens at dashboard.stripe.com, by the merchant.
- **Never auto-delete `.bodega.md`.** Default keep. The audit trail
  matters more than the cleanliness.
- **Never run `gh repo delete` without `--yes`.** Without the flag,
  the CLI prompts for typed confirmation, which hangs in non-TTY
  shells.
- **Domain registrar is out of scope.** Telling the user "you still
  own the domain" is correct — Vercel's record of the binding is
  what we remove. The user's $12/year DNS registration with Namecheap
  / Squarespace / Cloudflare stays where it is.
- **Idempotent.** Each step checks "is the resource still there?"
  before attempting removal. Already-gone resources are noted, not
  errored on. Lets the skill be re-run safely after a partial
  uninstall.
