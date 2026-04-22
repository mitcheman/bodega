// Declarative per-IDE provider registry. Adding a new IDE is one object
// here plus (if needed) a placeholder-override entry in utils.js.
//
// Pattern borrowed from pbakaus/impeccable (Apache-2.0). See HARNESSES.md
// for which IDEs support what.

export const PROVIDERS = {
  'claude-code': {
    configDir: '.claude',
    displayName: 'Claude Code',
    frontmatterFields: [
      'name',
      'description',
      'user-invocable',
      'argument-hint',
      'license',
      'compatibility',
      'metadata',
      'allowed-tools',
    ],
    scriptPathPrefix: '${CLAUDE_PLUGIN_ROOT}/scripts',
    commandPrefix: '/',
    modelName: 'Claude',
    configFile: 'CLAUDE.md',
    askInstruction:
      'Use the AskUserQuestion tool when available; otherwise ask directly.',
  },
  cursor: {
    configDir: '.cursor',
    displayName: 'Cursor',
    frontmatterFields: ['name', 'description', 'license', 'compatibility', 'metadata'],
    scriptPathPrefix: '.cursor/skills',
    commandPrefix: '/',
    modelName: 'the model',
    configFile: '.cursorrules',
    askInstruction: 'Ask the user directly.',
  },
  codex: {
    configDir: '.codex',
    displayName: 'Codex',
    frontmatterFields: ['name', 'description', 'argument-hint', 'license'],
    scriptPathPrefix: '.codex/skills',
    // KEY GOTCHA: Codex uses $ not /.
    commandPrefix: '$',
    modelName: 'GPT',
    configFile: 'AGENTS.md',
    askInstruction: 'Use the question tool when available; otherwise ask directly.',
  },
  gemini: {
    configDir: '.gemini',
    displayName: 'Gemini',
    // Gemini only reads name + description from frontmatter.
    frontmatterFields: ['name', 'description'],
    scriptPathPrefix: '.gemini/skills',
    commandPrefix: '/',
    modelName: 'Gemini',
    configFile: 'GEMINI.md',
    askInstruction: 'Ask the user directly.',
  },
  agents: {
    // VS Code Copilot + Google Antigravity
    configDir: '.agents',
    displayName: 'Agents (VS Code Copilot / Antigravity)',
    frontmatterFields: ['name', 'description', 'argument-hint'],
    scriptPathPrefix: '.agents/skills',
    commandPrefix: '/',
    modelName: 'the model',
    configFile: 'AGENTS.md',
    askInstruction: 'Ask the user directly.',
  },
  kiro: {
    configDir: '.kiro',
    displayName: 'Kiro',
    frontmatterFields: ['name', 'description'],
    scriptPathPrefix: '.kiro/skills',
    commandPrefix: '/',
    modelName: 'the model',
    configFile: 'KIRO.md',
    askInstruction: 'Ask the user directly.',
  },
  opencode: {
    configDir: '.opencode',
    displayName: 'OpenCode',
    frontmatterFields: ['name', 'description'],
    scriptPathPrefix: '.opencode/skills',
    commandPrefix: '/',
    modelName: 'the model',
    configFile: 'OPENCODE.md',
    askInstruction: 'Ask the user directly.',
  },
  windsurf: {
    configDir: '.windsurf',
    displayName: 'Windsurf',
    frontmatterFields: ['name', 'description'],
    scriptPathPrefix: '.windsurf/skills',
    commandPrefix: '/',
    modelName: 'the model',
    configFile: '.windsurfrules',
    askInstruction: 'Ask the user directly.',
  },
};

export function listProviderIds() {
  return Object.keys(PROVIDERS);
}
