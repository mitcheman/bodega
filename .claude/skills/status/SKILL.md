---
name: status
description: Reports the current state of the store — what's set up, what's pending, what the URLs are, and what to do next.
user-invocable: true
---

# Bodega: Status

One-command health check for the store. Answers "where am I?" without
requiring the user to read `.bodega.md` themselves.

## Pre-checks

Read `.bodega.md`. If absent, say (in neutral voice — we don't know the
user's preference yet):

> This project doesn't have Bodega set up yet. Run
> `/bodega:setup` to start.

## Step 1 — Gather state

Read `.bodega.md`. Also verify:
- Vercel project still linked (`vercel project inspect --json`)
- Site responds (HEAD request to deploy URL)
- `/studio` responds
- GitHub repo exists (if `state.backup: done`)

### Handle remote-call failures gracefully

Each remote check can fail for reasons unrelated to the store
("Vercel auth expired", "DNS hiccup", "GitHub rate-limit"). Status is
read-only, so a failure here is **not** an error to bail on — it's a
data point to report.

Wrap every remote call. On failure, mark the row `[?]` and surface a
one-line reason + the exact remediation command. Don't crash and don't
print stack traces. Translation table:

| Symptom | Report (developer voice) | Report (simple voice) |
|---|---|---|
| `vercel project inspect` non-zero exit, stderr contains "not authenticated" / "credentials" | `vercel: auth expired — run \`vercel login --github\`` | "I can't talk to Vercel right now — your login expired. Want me to walk you through signing back in?" |
| `vercel project inspect` non-zero exit, stderr contains "not linked" | `vercel: project unlinked — re-run \`/bodega:hosting\`` | "Your project isn't connected to Vercel anymore. Want me to reconnect it?" |
| `vercel project inspect` non-zero exit, any other reason | `vercel: query failed (<short stderr line>)` | "Something went wrong checking your hosting. Try again in a minute." |
| HEAD request to deploy URL timeouts / connection refused | `site: unreachable (will retry once)` | "Your site didn't answer. I'll try one more time." |
| HEAD request returns 5xx | `site: returns <status>` | "Your store is responding with an error code (`<status>`)." |
| `gh repo view <owner>/<repo>` 401 | `github: auth expired — run \`gh auth login --web\`` | "I can't see GitHub right now — your login expired." |
| `gh repo view` 404 | `github: repo missing (was it renamed or deleted?)` | "Your backup repo isn't there anymore. Check your GitHub account." |

Surface the failed checks alongside the working ones — never let one
broken probe blank out the rest of the status table.

## Step 2 — Report

### Simple voice:

```
Your store: https://muddmannstudio.com  [✓ live]
Studio:     https://muddmannstudio.com/studio  [✓ working]

Set up:
  ✓ Hosting
  ✓ Payments (Stripe live)
  ✓ Studio (your partner is signed in: last activity 2h ago)
  ✓ Custom domain (muddmannstudio.com)
  ✓ Backup (last saved 15 min ago)

Nothing needs your attention right now.
```

If anything is pending or broken, highlight:

```
Your store: https://muddmannstudio.com  [✓ live]
Studio:     https://muddmannstudio.com/studio  [✓ working]

⚠️ Payments are in preview mode.
   Your partner hasn't finished Stripe yet. Customers can see the site
   but checkout is disabled.
   → Run `/bodega:payments` when their keys are ready.
```

### Developer voice:

```
Store: https://muddmannstudio.com  [200 OK]
Studio: https://muddmannstudio.com/studio  [200 OK]

state:
  hosting: done       vercel.app: mudd-mann-studio
  payments: done      mode: live   webhook: ✓
  deploy: done        last: 2h ago
  admin: done         merchant: partner@muddmann.studio   last_seen: 2h ago
  domain: done        custom: muddmannstudio.com   verified: ✓
  backup: done        repo: github.com/mitchellsmith/mudd-mann-studio   last_push: 15m

No action needed.
```

## Step 3 — Suggest next actions (if applicable)

Based on state:

- `payments: pending` → "Your partner hasn't finished Stripe. Nudge them
  or run `/bodega:payments` when ready."
- `domain: skipped` and `state.deploy: done` for 2+ weeks → "Still happy
  with the free subdomain? Getting your own domain takes 2 minutes and
  ~$12/year."
- `backup: skipped` → "Consider setting up a backup to protect your work."
- `admin` last_seen > 30 days → "Your merchant hasn't logged in recently.
  Send them a fresh link with `/bodega:invite`."

## Rules

- **Read-only.** Status never writes, never deploys, never changes state.
- **Don't make assumptions about time zones.** Use the user's local time
  or relative ("2h ago", "15 min ago").
- **If a check fails** (e.g., site returns 500), report it honestly and
  suggest the fix:

### Simple voice:

> ⚠️ Your store seems to be down. I got an error when I checked it.
>
> Want me to try deploying again? Run `/bodega:deploy`.
