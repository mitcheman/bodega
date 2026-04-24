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
https://dashboard.stripe.com/register?email=<URL-encoded merchant.email>
```

**URL-encode the email.** Stripe's register endpoint receives it via
query string; without encoding, `+`-tagged emails (`user+promo@gmail.com`)
decode to a literal space (`user promo@gmail.com`) and the form
prefills wrong. Use `encodeURIComponent()` (or shell `jq -rR @uri`)
before substitution.

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

## Step 3 — Choose live or test mode

Before capturing keys, ask the merchant which mode they're in:

| Mode | When to use | Keys look like |
|---|---|---|
| **Test** | KYC not complete yet, or local development against Stripe | `pk_test_...` / `sk_test_...` |
| **Live** | KYC complete, ready to take real money | `pk_live_...` / `sk_live_...` |

**Default to live** if the merchant says KYC is done. Default to test
otherwise — checkout works end-to-end against Stripe's test card
numbers, no real money moves, and you can flip to live by re-running
`/bodega:payments` once KYC clears.

> **Don't conflate test mode with preview mode.** Preview mode (Step
> below) ships a public site with checkout disabled. Test mode ships
> a fully working checkout that uses Stripe's sandbox. Both are valid
> while waiting on KYC; they solve different things.

Ask the merchant:

### Simple voice:

> Are you in **test mode** or **live mode**?
>
>   a. **Test mode** — Stripe hasn't verified my business yet (or I'm
>      just trying things out). Real cards won't charge.
>   b. **Live mode** — Stripe is verified, I'm ready to take money.
>
> If unsure, pick test — we can flip to live anytime.

### Developer voice:

> `mode = test | live`? Default test if KYC is `pending`.

Store the answer as `stripe.mode` in `.bodega.md`.

## Step 4 — Capture the keys (without leaking secret to the agent)

Merchant grabs two values from Stripe Dashboard → Developers → API
keys, matching the mode picked in Step 3:

- **Publishable key** (`pk_test_...` or `pk_live_...`)
- **Secret key** (`sk_test_...` or `sk_live_...`)

### How keys come to us — agent-safe path

**The agent must never see the secret key**, because Claude Code (and
similar agents) write entire session transcripts to local JSONL files
under `~/.claude/projects/.../*.jsonl`. Once a `sk_*` value lands in
a transcript, it lives on disk indefinitely.

The default flow inverts the previous design: the agent only handles
the public key; the secret key is entered by the user directly into
their own terminal, in a separate window the agent never reads.

### Step 4a — Publishable key (safe to paste in chat)

The publishable key is meant to be public — it ships in client JS to
every visitor's browser. Pasting it into chat is fine.

Ask:

> Paste your publishable key (starts with `pk_test_` or `pk_live_`):

Validate format (`pk_test_` or `pk_live_` prefix, ~107-char length).
Write to Vercel env:

```
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production <<< "<pk_value>"
```

(The `NEXT_PUBLIC_` prefix is required for Next.js to ship the value
to client-side code. The `<Checkout>` component reads it in the
browser to initialize Stripe Elements.)

### Step 4b — Secret key (user enters directly into their terminal)

Tell the user:

#### Simple voice:

> Now the secret key. This one's different — it can charge cards and
> read customer data, so I shouldn't see it. Here's what I want you
> to do:
>
> **1. Open a new terminal window** (Terminal app on Mac, Command
>    Prompt on Windows). Don't paste it in this chat.
> **2. Paste this command into the new window** (everything between
>    the lines, exactly):
>
>     ```
>     vercel env add STRIPE_SECRET_KEY production
>     ```
>
> **3. When it asks** "What's the value of STRIPE_SECRET_KEY?" —
>    paste your secret key there and hit Enter.
> **4. When it asks** which environments to apply to, accept the
>    default (production).
> **5. Come back here and tell me "done."**
>
> I'll verify the key landed without ever seeing the value myself.

#### Developer voice:

> In a separate terminal (out of agent context):
> `vercel env add STRIPE_SECRET_KEY production`, paste at prompt.
> Tell me "done"; I'll verify with `vercel env ls` (no value
> exposure).

When they say done, verify the env var exists without printing it:

```
vercel env ls | grep STRIPE_SECRET_KEY
```

If it shows up, you're good. If it doesn't, ask them to re-run the
`vercel env add` in their terminal window.

### Step 4c — Other env vars

The merchant email is fine to write from chat:

```
vercel env add BODEGA_MERCHANT_EMAIL production <<< "<merchant.email>"
```

Never commit any of these to a file in the repo. They live in Vercel only.

### Fallback if the user can't open a separate terminal

If the user is on a phone, in a sandbox without a separate terminal,
or otherwise can't follow the agent-safe path:

1. Warn them explicitly that the key will land in the chat transcript.
2. Capture as before (`vercel env add STRIPE_SECRET_KEY production <<< "<sk_value>"`).
3. After successful write, tell them to **rotate the key immediately**
   at Stripe Dashboard → Developers → API keys → Roll key, and re-run
   `/bodega:payments` with the rotated value via the
   agent-safe flow.

This fallback is intentionally inconvenient — the cost of the warning
+ rotation is approximately the cost of doing it right the first time,
which is the point.

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
  mode: live                # "live" or "test"; from Step 3
  account_email: merchant@example.com
  keys_stored: vercel-env
  publishable_key_preview: "pk_live_...<last4>"  # or pk_test_...
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

When Stripe keys arrive later, user runs `/bodega:payments`
again. We detect `preview_mode: true`, capture keys, trigger redeploy.

## Rules

- **Never persist the secret key to a file in the repo.** Only
  `vercel env` or a direct Vercel API call.
- **Always warn about the chat transcript** when capturing keys.
  Non-negotiable for user trust.
- **If Stripe flags the account** (restricted industry, etc.), don't
  try to work around it. Surface the Stripe message; direct them to
  Stripe support.
