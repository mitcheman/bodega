# Contributing to Bodega

Thanks for taking a look. Bodega is young and opinionated, but PRs are
welcome on the things below. For anything bigger, please open an issue
first so we can talk shape.

## Where to edit

**Only edit `source/skills/`.** The per-harness trees (`.claude/`,
`.cursor/`, `.codex/`, `.gemini/`, `.agents/`, `.kiro/`, `.opencode/`,
`.windsurf/`) are **generated** — they look human-edited and they're
committed to git, but they're rewritten by `pnpm build` every time.

If you edit them by hand, CI will fail and your changes will disappear
on the next build.

## Dev setup

```bash
git clone <repo-url>
cd bodega
pnpm install
pnpm build          # regenerates all .<harness>/ trees
```

Before opening a PR:

```bash
pnpm build          # must have run
git status          # should show no extra dirty files
pnpm typecheck      # optional but good
```

CI runs the same checks — if your PR builds cleanly locally, it should
pass in CI.

## Adding a new harness

One object in `scripts/lib/transformers/providers.js`:

```js
'new-harness': {
  configDir: '.new-harness',
  displayName: 'New Harness',
  frontmatterFields: ['name', 'description'],
  scriptPathPrefix: '.new-harness/skills',
  commandPrefix: '/',            // or '$' if it's a Codex-like oddball
  modelName: 'the model',
  configFile: 'NEW_HARNESS.md',
  askInstruction: 'Ask the user directly.',
},
```

Then `pnpm build`, add a row to [HARNESSES.md](./HARNESSES.md), commit
both the source change and the generated `.new-harness/skills/` tree.

## Adding a new skill

1. Create `source/skills/<your-skill>/SKILL.md` with YAML frontmatter:
   ```yaml
   ---
   name: your-skill
   description: One sentence describing what the skill does, aimed at
     the model — not the user.
   user-invocable: true         # false if only called by other skills
   ---
   ```
2. Body uses `{{command_prefix}}`, `{{model}}`, `{{config_file}}`,
   `{{scripts_path}}`, `{{ask_instruction}}` — never hardcode the `/`
   prefix (Codex uses `$`).
3. Optional sibling dirs: `scripts/` (node/bash scripts invoked from
   the skill) and `reference/` (markdown templates, examples).
4. `pnpm build`, commit both source and generated outputs.

## Voice guidelines

When writing user-facing messages in skills, keep the two-voice split
from `source/skills/setup/SKILL.md`:

- **developer voice** — tech terms, full logs, concise
- **simple voice** — plain English, tell-me-what-to-click, no jargon

If a skill's user-facing message differs between voices, draft both.
If it's truly voice-neutral, draft once.

## Before you PR

- [ ] `pnpm build` ran and no stray diff
- [ ] New frontmatter fields added to the right `frontmatterFields`
      allowlists (or intentionally left off for harnesses that can't use them)
- [ ] HARNESSES.md updated if you added a harness
- [ ] Changes honour the voice split (developer / simple)
- [ ] Sensitive values never land in output files or git (secrets,
      tokens, real merchant emails, real Stripe keys)

## What not to PR (for now)

- **Full commerce component implementations** — the SDK surface is
  still being designed. Ping first.
- **Hosted-tier infrastructure** — Phase 1 is strictly self-hosted on
  user's own Vercel/Stripe/etc. Hosted tier is post-PMF.
- **Cross-framework adapters** (SvelteKit, Remix, Astro commerce) —
  Phase 2, and needs a design discussion first.

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](./SECURITY.md). Report privately; don't file
security issues in public GitHub issues.

## License

By contributing, you agree that your contributions are licensed under
Apache 2.0 (see [LICENSE](./LICENSE)).
