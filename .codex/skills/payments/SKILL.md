---
name: payments
description: Walks the merchant through Stripe onboarding, captures their API keys, and writes them to Vercel env vars. Handles the common case where KYC takes days by supporting a preview-mode deploy path.
---

# Bodega: Payments

Sets up Stripe so the store can take money. Most likely to pause for
hours or days — Stripe KYC requires legal name, tax ID, bank info, and
sometimes ID documents.

## Pre-checks

1. Read `.bodega.md`.
2. If `state.payments: done`, verify keys still work. Ask if the user
   wants to rotate or re-enter.
3. If `handoff: true`, note that the merchant (not the operator) is
   the one doing Stripe KYC.

## Step 1 — Generate the onboarding link

Phase 1 does not use Stripe Connect. Each merchant sets up their own
vanilla Stripe account. The link is:

```
https://dashboard.stripe.com/register?email=<merchant.email>
```

## Step 2 — Deliver the link

### Simple voice, self (no handoff):

> Next, we need to set up payments through Stripe. They handle the
> cards so you don't have to worry about that part.
>
> You'll need about 10 minutes and:
> - Your bank account number + routing number
> - Your SSN (sole proprietor) or EIN (if you have a business)
>
> This is federally required — every online store does this, from
> Etsy to Shopify. Not something we can skip.
>
> Open this in your browser:
> → https://dashboard.stripe.com/register?email=<email>
>
> Tell me "done" when finished. Take your time; you can do this on
> your phone.

### Simple voice, handoff:

> Next, Stripe — for payments. Your [partner/friend/client] needs to
> do this part because it's attached to their bank account and legal
> name.
>
> I'll email them instructions. They'll need ~10 minutes and their
> bank info. Takes 10 min to 2 days depending on whether Stripe asks
> for ID docs.
>
> [Send email to merchant.email with the registration link]
>
> We can keep going without waiting — I can deploy your site in
> **preview mode** (customers see it, checkout is disabled with
> "Store opening soon") and flip it on when their Stripe is live.
>
> Want to wait or deploy in preview mode?

### Developer voice:

> Stripe onboarding: https://dashboard.stripe.com/register?email=<email>
> [Handoff: emailed to merchant.email]
>
> Keys needed: pk_live_... and sk_live_...
> Can proceed in preview mode if KYC isn't done. Your call.

## Step 3 — Capture the keys

Merchant grabs two values from Stripe Dashboard → Developers → API keys:

- **Publishable key** (`pk_live_...`)
- **Secret key** (`sk_live_...`)

### How keys come to us:

**Option A (default, Phase 1):** Merchant sends both keys to the
operator (email, text, 1Password share). Operator pastes into the chat.

**Option B (Phase 2):** Merchant self-enters in `/studio/setup` via
a one-time link.

### ⚠️ Security warning (show exactly):

> **Heads up:** the secret key will land in this chat transcript. Stripe
> secret keys can charge cards, issue refunds, and read customer data.
> After we wire this up, rotate the secret key in Stripe's dashboard
> (Developers → API keys → Roll key). I'll write the new value to your
> environment and delete my reference to the old one.

Ask:

> Paste the two keys, one per line:

Capture. Validate format (`pk_` / `sk_` prefix, correct length). If
malformed, say so and ask again.

## Step 4 — Store keys in Vercel environment

```
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
# paste pk_live_...
vercel env add STRIPE_SECRET_KEY production
# paste sk_live_...
vercel env add BODEGA_MERCHANT_EMAIL production
```

**Why the `NEXT_PUBLIC_` prefix on the publishable key:** Next.js only
exposes env vars to client-side code if the name starts with
`NEXT_PUBLIC_`. Our `<Checkout>` component reads the publishable key
in the browser to initialize Stripe Elements. The secret key stays
server-only (no prefix), so it's never shipped to the client.

Never commit these to any file in the repo. They live in Vercel only.

## Step 5 — Webhook registration

Stripe webhooks need the live URL. Defer registration to the `deploy`
skill's post-deploy step. Note in `.bodega.md`:

```yaml
state:
  payments: done            # or "pending"
  webhook_configured: false # deploy will set true
```

## Step 6 — Return

Update `.bodega.md`:

```yaml
state:
  payments: done            # or "pending"
stripe:
  account_email: merchant@example.com
  keys_stored: vercel-env
  publishable_key_preview: "pk_live_...<last4>"
  # secret key never recorded, ever
```

Return to setup.

## Preview mode branching

If the merchant can't complete KYC in this session:

```yaml
state:
  payments: pending
  preview_mode: true
```

The `deploy` skill reads `preview_mode: true` and:
- Deploys storefront pages normally
- Replaces `/checkout` with "Store opening soon — drop your email"
- Disables "Add to cart" buttons (or converts to "Notify me")

When Stripe keys arrive later, user runs `$bodega:payments`
again. We detect `preview_mode: true`, capture keys, trigger redeploy.

## Rules

- **Never persist the secret key to a file in the repo.** Only
  `vercel env` or a direct Vercel API call.
- **Always warn about the chat transcript** when capturing keys.
  Non-negotiable for user trust.
- **If Stripe flags the account** (restricted industry, etc.), don't
  try to work around it. Surface the Stripe message; direct them to
  Stripe support.
