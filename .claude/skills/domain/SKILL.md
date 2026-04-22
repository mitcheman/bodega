---
name: domain
description: Walks through buying or connecting a custom domain, binds it to the Vercel project, configures DNS, and handles the async verification loop.
user-invocable: true
---

# Bodega: Custom Domain

Sets up a custom domain (e.g., `muddmannstudio.com`) on the store. Can
run during setup or standalone later.

## Pre-checks

1. Read `.bodega.md`. Require `state.hosting: done` (the Vercel project
   must exist).
2. If `state.domain: done`, ask if the user wants to change domain.

## Step 1 — Ask the branch

> Do you already own the domain you want?
>
>   a. yes — I own it
>   b. no — I need to buy one (~$12/year)
>   c. stay on the free subdomain for now

## Step 2a — Domain already owned

Ask which domain:

> What's the domain? (e.g., `muddmannstudio.com`)

Validate syntax (RFC 1034/1035). Bind to Vercel:

```
vercel domains add <domain>
vercel domains inspect <domain>
```

Show the user the DNS records they need to add at their registrar:

### Simple voice:

> To connect your domain, add these records at [wherever you bought it]:
>
>     Type: A
>     Name: @
>     Value: 76.76.21.21
>
>     Type: CNAME
>     Name: www
>     Value: cname.vercel-dns.com
>
> This takes 10 min to 24 hours to go live after you add them. Run
> `/bodega:domain` again when you've added them — I'll
> check if it's ready.

### Developer voice:

> DNS records:
>   A     @     76.76.21.21
>   CNAME www   cname.vercel-dns.com
>
> Re-run `/bodega:domain` to verify after propagation.

## Step 2b — Buying through us

We don't resell domains. Route to Cloudflare Registrar at wholesale:

### Simple voice:

> I'll send you to Cloudflare, which sells domains at cost (no markup).
> You'll need to sign in (Google or email) and pay for the domain with
> a card.
>
> Click here: https://dash.cloudflare.com/sign-up?to=/registrar
>
> Come back and tell me the domain name once you've bought it. I'll
> connect it to your site.

### Developer voice:

> Cloudflare Registrar (wholesale): https://dash.cloudflare.com/sign-up?to=/registrar
> Return with the domain; I'll set DNS + bind to Vercel.

Once the user returns with the domain, proceed as in Step 2a.

## Step 2c — Stay on free subdomain

```
yaml state: domain: skipped
```

Exit. The site remains at the default Vercel URL (`<slug>.vercel.app`).
Merchant can buy a custom domain later by running
`/bodega:domain` again.

## Step 3 — Verification (async)

Since DNS can take up to 24 hours, `/bodega:domain` is
run twice:

1. **First run**: shows the records, exits
2. **Second run**: verifies with `vercel domains inspect --json` — checks
   `isApex` and `verified: true`

When verified:

### Simple voice:

> ✓ Your domain is live! Your store is now at https://muddmannstudio.com

### Developer voice:

> ✓ Domain verified and bound. https://<domain> → prj_abc123

Trigger a redeploy so the site uses the custom domain as the primary URL:

```
vercel deploy --prod
```

## Step 4 — Update `.bodega.md`

```yaml
state:
  domain: done
business:
  domain:
    value: muddmannstudio.com
    already_owned: true      # true if they had it, false if bought
    verified_at: 2026-04-22T15:00:00Z
```

## Rules

- **Don't block on DNS propagation.** Exit after showing records; let
  the user re-run to verify.
- **Don't claim domain ownership on behalf of the user.** The registrant
  name/email is theirs, not ours. If we're helping them buy, it's on
  their Cloudflare account.
- **Wildcard subdomains (Phase 2).** If the user asks for `shop.muddmannstudio.com`
  or similar, we can bind it, but don't auto-offer. Keep Phase 1 simple.
