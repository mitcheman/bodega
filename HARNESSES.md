# Supported Harnesses

Bodega compiles its canonical skill sources (`source/skills/`) into per-IDE
trees. This document tracks which IDEs are supported and what frontmatter
fields each honours.

Last verified: 2026-04-22.

| IDE / Harness | Directory | Install Path | Command Prefix | Config File | Status |
|---|---|---|---|---|---|
| **Claude Code** (Anthropic) | `.claude/skills/` | `.claude-plugin/plugin.json` registered | `/` | `CLAUDE.md` | ✅ Supported |
| **Cursor** | `.cursor/skills/` | Copied on install | `/` | `.cursorrules` | ✅ Supported |
| **Codex** (OpenAI) | `.codex/skills/` | Copied on install | **`$`** ⚠️ | `AGENTS.md` | ✅ Supported |
| **Gemini** (Google) | `.gemini/skills/` | Copied on install | `/` | `GEMINI.md` | ⚠️ Limited frontmatter |
| **Agents** (VS Code Copilot / Antigravity) | `.agents/skills/` | Copied on install | `/` | `AGENTS.md` | ✅ Supported |
| **Kiro** | `.kiro/skills/` | Copied on install | `/` | `KIRO.md` | ✅ Supported |
| **OpenCode** | `.opencode/skills/` | Copied on install | `/` | `OPENCODE.md` | ✅ Supported |
| **Windsurf** | `.windsurf/skills/` | Copied on install | `/` | `.windsurfrules` | ✅ Supported |

## Frontmatter support matrix

Fields each harness preserves from our source frontmatter. Unsupported
fields are silently dropped in the generated output.

| Field | Claude | Cursor | Codex | Gemini | Agents | Kiro | OpenCode |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `name` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `description` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user-invocable` | ✓ | — | — | — | — | — | — |
| `argument-hint` | ✓ | — | ✓ | — | ✓ | — | — |
| `license` | ✓ | ✓ | ✓ | — | — | — | — |
| `compatibility` | ✓ | ✓ | — | — | — | — | — |
| `metadata` | ✓ | ✓ | — | — | — | — | — |
| `allowed-tools` | ✓ | — | — | — | — | — | — |

## The Codex trap

**Codex uses `$` as its command prefix, not `/`.** Writing `/bodega:setup`
in source becomes `$bodega:setup` in `.codex/skills/`. This is handled
automatically via the `{{command_prefix}}` placeholder — never hardcode
`/` in a SKILL.md.

## Scripts path differences

- **Claude Code**: `${CLAUDE_PLUGIN_ROOT}/scripts`
- **Everyone else**: `.<ide>/skills/<skill-name>/scripts`

Handled via the `{{scripts_path}}` placeholder.

## Adding a new harness

1. Append an entry to `PROVIDERS` in `scripts/lib/transformers/providers.js`:
   ```js
   'new-harness': {
     configDir: '.new-harness',
     displayName: 'New Harness',
     frontmatterFields: ['name', 'description'],
     scriptPathPrefix: '.new-harness/skills',
     commandPrefix: '/',
     modelName: 'the model',
     configFile: 'NEWHARNESS.md',
     askInstruction: 'Ask the user directly.',
   },
   ```
2. Run `pnpm build` — generated tree lands at `.new-harness/skills/`.
3. Add a row to this file and commit.

No other code changes required. The transformer is declarative.

## What we don't test

There are no automated tests for generated outputs yet. Adding
golden-file tests per provider is an open todo — see
`docs/roadmap.md`.
