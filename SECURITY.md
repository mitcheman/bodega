# Security Policy

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Bodega handles things that matter — payment key flows, merchant credentials,
cloud infrastructure provisioning. A well-reported issue protects real
small businesses. A public disclosure before we can patch puts them at risk.

To report a vulnerability:

1. Email the maintainers directly at `security@bodega.<TBD>` *(update
   once domain is registered)*, **or**
2. Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
   feature on this repo.

Include:

- A description of the issue
- Steps to reproduce (or a proof of concept)
- Which Bodega version / commit SHA you found it on
- Whether you've already disclosed it elsewhere

## What we consider in scope

- The skill sources in `source/skills/` and generated per-harness trees
- The build pipeline in `scripts/`
- The CLI in `bin/`
- The SDK packages in `packages/commerce/` and `packages/studio/`
- Any example scripts

## What we consider out of scope

- Issues in upstream dependencies (report those to the dependency directly)
- Issues in a merchant's own Vercel, Stripe, or GitHub account configuration
  that aren't caused by Bodega's setup skills
- Social engineering attacks against maintainers or users

## Our response

We'll acknowledge your report within 72 hours, typically sooner. We aim
to publish a fix within 14 days for high-severity issues, or to explain
honestly if we can't.

We'll credit reporters in the release notes and the CHANGELOG unless
you prefer anonymity.

## Secrets in Bodega

Bodega's skills handle Stripe keys, Vercel tokens, and GitHub auth. The
flows are designed so that:

- **Stripe secret keys** are stored only as Vercel environment variables,
  never in any file in the repo.
- **Vercel tokens** live in `~/.vercel/auth.json` (managed by the Vercel
  CLI); Bodega doesn't read or transmit them.
- **GitHub auth** is delegated to the `gh` CLI; Bodega doesn't store
  GitHub PATs.

If you find a code path where any of the above is violated, that's a
security issue — please report it.

## No bounty program yet

We don't have a paid bounty program. We will credit you publicly (or
anonymously, your choice) for valid reports. Once the hosted tier exists
and we have revenue, a real bounty program on HackerOne or similar is
on the roadmap.
