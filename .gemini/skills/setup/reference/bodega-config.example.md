---
# Bodega config file — example
#
# This file lives at the project root as `.bodega.md`. It's the source
# of truth for the store's configuration. Every Bodega skill reads it
# at the start of each invocation.
#
# The YAML frontmatter (between --- markers) is structured data we read
# programmatically. Below the frontmatter is free-form notes any agent
# can read for context.

version: 1                        # SCHEMA version of this file. Bump
                                  # when fields change incompatibly.

# Bodega plugin metadata — written by setup, updated by deploy. Recorded
# so future agents can tell which version scaffolded the project, and
# warn if the installed plugin has drifted significantly.
bodega:
  version: 0.2.0                  # plugin version that ran setup
  installed_at: 2026-04-22T14:00:00Z
  last_deploy_version: 0.2.0      # plugin version of the most recent deploy

# Voice and beneficiary — captured in setup, used everywhere.
mode: developer                   # developer | simple
handoff: true                     # true if the person running the store
                                  # is different from the operator

merchant:
  email: partner@muddmann.studio  # only if handoff: true
  first_name: Amelia              # used in email/message templates

operator:
  email: mitchell@example.com     # whoever ran the plugin
  first_name: Mitchell

# Business context — captured in setup.
business:
  name: "Mudd Mann Studio"
  slug: mudd-mann-studio          # used for Vercel project + subdomain
  kind: physical-goods            # physical-goods | digital | service
  shipping_from: "Washington DC"
  locale: en-US
  currency: USD

  # Domain preference — one of three.
  domain:
    preference: custom            # subdomain | custom | custom-later
    value: muddmannstudio.com     # only if preference is 'custom'
    already_owned: false
    verified_at: null             # set by the domain skill on verification

  # Free-form voice and vibe notes.
  vibe: |
    Handmade ceramics. 1970s Moroccan feel — zellige, tadelakt,
    sun-bleached pastels. Frog series, jazz cats. Warm, not brown.
    Light mode only. Playful voice.

# State machine — setup writes, other skills read/update.
state:
  hosting: not-started            # not-started | done | skipped | partial
  payments: not-started           # not-started | done | pending | skipped
  deploy: not-started             # not-started | done | preview | failed
  admin: not-started
  domain: not-started
  backup: not-started

  # Computed flags read by downstream skills.
  preview_mode: false             # true if deploy ran while payments pending
  webhook_configured: false

initial_mode: adapt               # immutable — first-run detection
mode_current: adapt               # mutable — flips to 'adapt' after greenfield

# Vercel project metadata — written by hosting skill.
vercel:
  project_id: null
  slug: null
  preview_url: null
  blob_store: null

# Stripe metadata — written by payments skill.
# Note: secret keys live in Vercel env vars only, never here.
stripe:
  account_email: null
  keys_stored: null               # 'vercel-env' when done
  publishable_key_preview: null   # pk_live_...<last4> for display

# Deploy metadata — written by deploy skill.
deploy:
  last_deployed_at: null
  url: null
  preview_url: null

# Admin metadata — written by admin skill.
admin:
  welcome_email_sent_at: null
  magic_link_expires_at: null
  first_run_walkthrough: true
  handoff_package_path: null
  staff: []                       # [{email, role, invited_at}]

# Backup metadata — written by backup skill.
backup:
  owner: null                     # GitHub username or org
  repo: null
  url: null
  auto_push: true
  last_pushed_at: null

---

# Free-form notes

Anything below the YAML is human-readable notes. Agents can read this
for context. Examples of things worth keeping here:

- Design decisions from impeccable (if greenfield)
- Unusual requirements specific to this store
- Seasonal operations notes (e.g., "closed for the studio move Aug 5-15")
- Past decisions we want to remember ("we tried a cart drawer, partner
  preferred the full cart page")

Design scaffolded by impeccable on 2026-04-20.
Tokens captured in .impeccable.md.
