<!--
Thanks for the PR. A few quick checkboxes before review.
-->

## What this does

<!-- One or two sentences. -->

## Why

<!-- What problem does this solve, who benefits? -->

## Scope check

- [ ] I only edited `source/skills/` (not the generated `.claude/`, `.cursor/`, etc. trees directly)
- [ ] I ran `pnpm build` and committed the regenerated outputs
- [ ] `git status` is clean after build (no stray diff)
- [ ] If I added a new skill, its frontmatter has `name` and `description`
- [ ] If I added a new harness, I updated `HARNESSES.md` and the `PROVIDERS` registry
- [ ] Voice guidelines respected (developer / simple split where user-facing)

## Sensitive content check

- [ ] No real emails, Stripe keys, Vercel tokens, or merchant data in any
  file (examples use clearly fake values like `muddmann@example.com`)
- [ ] No hardcoded `/` command prefix — uses `{{command_prefix}}` placeholder
- [ ] No hardcoded model name — uses `{{model}}` placeholder

## Testing

<!-- How did you verify this works? Manual reproduction, muddmann test run,
etc. Golden-file tests don't exist yet; manual is fine for now. -->

## Related issues

<!-- Closes #123, relates to #456 -->
