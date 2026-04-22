// Shared utilities for the build pipeline: frontmatter parsing,
// placeholder resolution, and file IO helpers.

import fs from 'node:fs';
import path from 'node:path';

/**
 * Parse a Markdown file with YAML frontmatter into { frontmatter, body }.
 * Frontmatter is parsed as a simple string-only map — we don't pull in
 * a full YAML parser for the ~5 keys we use.
 */
export function parseSkillFile(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Missing YAML frontmatter');
  }
  const [, fmRaw, body] = match;
  const frontmatter = {};
  for (const line of fmRaw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    // Strip quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Coerce booleans.
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    frontmatter[key] = value;
  }
  return { frontmatter, body };
}

/**
 * Serialize frontmatter back to YAML, emitting only the fields in
 * `allowedFields`. Order matches the original field order in `allowedFields`.
 */
export function serializeFrontmatter(frontmatter, allowedFields) {
  const lines = ['---'];
  for (const field of allowedFields) {
    if (!(field in frontmatter)) continue;
    const value = frontmatter[field];
    if (typeof value === 'boolean') {
      lines.push(`${field}: ${value}`);
    } else if (typeof value === 'string') {
      // Quote if the string contains : or leading/trailing whitespace.
      const needsQuote = /[:#&*!|<>]/.test(value) || value !== value.trim();
      lines.push(`${field}: ${needsQuote ? JSON.stringify(value) : value}`);
    } else {
      lines.push(`${field}: ${value}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * Resolve {{placeholder}} tokens in a skill body against the given provider.
 *
 * Supported tokens:
 *   {{command_prefix}}  - '/' for most, '$' for Codex
 *   {{model}}           - 'Claude' / 'GPT' / 'Gemini' / 'the model'
 *   {{config_file}}     - 'CLAUDE.md' / 'AGENTS.md' / etc
 *   {{scripts_path}}    - '${CLAUDE_PLUGIN_ROOT}/scripts' or '.<ide>/skills/<name>/scripts'
 *   {{ask_instruction}} - harness-specific question-asking convention
 */
export function resolvePlaceholders(body, provider, skillName) {
  const scriptsPath = provider.scriptPathPrefix.includes('${CLAUDE_PLUGIN_ROOT}')
    ? provider.scriptPathPrefix
    : `${provider.scriptPathPrefix}/${skillName}/scripts`;

  return body
    .replaceAll('{{command_prefix}}', provider.commandPrefix)
    .replaceAll('{{model}}', provider.modelName)
    .replaceAll('{{config_file}}', provider.configFile)
    .replaceAll('{{scripts_path}}', scriptsPath)
    .replaceAll('{{ask_instruction}}', provider.askInstruction);
}

export function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

export function rmDirSync(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function listSkills(sourceDir) {
  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}
