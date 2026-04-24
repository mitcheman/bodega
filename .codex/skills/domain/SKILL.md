---
name: domain
description: Walks through buying or connecting a custom domain, binds it to the Vercel project, configures DNS, and handles the async verification loop.
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

### A note on DNS notation

The "Name" field for the apex record varies by registrar — there is
no universal convention. Tell the merchant which form their provider
expects:

| Provider | Apex "Name" field accepts | What to type |
|---|---|---|
| GoDaddy, Namecheap, IONOS, Hover | `@` | `@` |
| Cloudflare | bare domain or empty | `muddmannstudio.com` (Cloudflare auto-truncates) |
| Squarespace / Google Domains | empty or `@` | leave empty |
| Bluehost, HostGator | `@` or domain | either works |
| Porkbun | `@` | `@` |
| AWS Route 53 | bare domain | `muddmannstudio.com` |

When in doubt, the bare domain form (`muddmannstudio.com`) is the
most universally accepted; `@` is shorthand that most but not all
registrars expand to the apex.

### Simple voice:

> To connect your domain, you'll add two small records at wherever you
> originally bought it (GoDaddy, Namecheap, Google/Squarespace Domains,
> etc.). These records tell the internet: "when someone types this
> domain, send them to this store."
>
> Log in at your domain provider and find the section labeled **DNS**,
> **DNS settings**, or **Manage DNS**. Add these two rows. The
> "Name" field varies by provider — use whichever form yours accepts:
>
>     Type: A
>     Name: @          (or your bare domain like muddmannstudio.com,
>                       or leave empty — depends on the provider)
>     Value: 76.76.21.21
>
>     Type: CNAME
>     Name: www
>     Value: cname.vercel-dns.com
>
> Then come back and run `$bodega:domain` again. The
> domain usually connects within 10 minutes, but sometimes takes up to
> 24 hours — that's normal waiting time, nothing you or I can speed up.
> If it's not ready when you check, just try again in an hour.

### Developer voice:

> DNS records (Name field varies by registrar — `@`, bare domain, or
> empty depending on provider):
>   A     @ | <domain> | (empty)     76.76.21.21
>   CNAME www                         cname.vercel-dns.com
>
> Re-run `$bodega:domain` to verify after propagation.

## Step 2b — Buying through us

We don't resell domains. Route to Cloudflare Registrar at wholesale:

### Simple voice:

> Cloudflare is a big internet company — they sell domain names at
> their actual wholesale cost, no markup. Most common endings
> (`.com`, `.co`, `.net`) run about $10–$15/year. Fancier ones like
> `.shop` or `.store` can be more.
>
> Here's the flow:
>
>   1. Open this link in your browser:
>      https://dash.cloudflare.com/sign-up?to=/registrar
>   2. Create a Cloudflare account (Google or email).
>   3. Search for the domain you want. If it's taken, try variations —
>      adding "studio", "shop", or your city often works.
>   4. Buy it with a credit card. They'll email you a receipt.
>
> The domain is in your name, on your Cloudflare account — I can't
> touch it. Come back and tell me the domain you bought, and I'll
> connect it to your store.

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
`$bodega:domain` again.

## Step 3 — Verification (async)

Since DNS can take up to 24 hours, `$bodega:domain` is
run twice:

1. **First run**: shows the records, exits
2. **Second run**: verifies with `vercel domains inspect --json` — checks
   `isApex` and `verified: true`

### If NOT yet verified on the second run:

#### Simple voice:

> Not live yet — the internet is still catching up. This is normal; it
> can take anywhere from a few minutes to 24 hours depending on your
> domain provider. Some things to double-check:
>
>   - The two records are saved at your domain provider (some sites
>     require hitting "Save" a second time)
>   - The values are exactly `76.76.21.21` and `cname.vercel-dns.com`,
>     with no extra spaces
>
> Try again in an hour. If it's still not working tomorrow, tell me
> and we'll dig in.

#### Developer voice:

> ✗ Not verified yet. DNS still propagating. Records look correct at
> the registrar? Retry in ~1 hour.

### When verified:

#### Simple voice:

> ✓ Your domain is live! Your store is now at https://muddmannstudio.com

#### Developer voice:

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
