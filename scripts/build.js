#!/usr/bin/env node
// Build: generate per-IDE skill trees from source/skills/.
// Output directories (.claude/skills, .cursor/skills, .codex/skills, etc.)
// are committed to git so consumers don't need to run this script.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS } from './lib/transformers/providers.js';
import { createTransformer } from './lib/transformers/factory.js';
import { rmDirSync } from './lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SOURCE_DIR = path.join(ROOT, 'source', 'skills');

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`No source at ${SOURCE_DIR}`);
    process.exit(1);
  }

  console.log(`Building from ${SOURCE_DIR}\n`);

  const results = [];

  for (const [id, provider] of Object.entries(PROVIDERS)) {
    const providerRoot = path.join(ROOT, provider.configDir);
    rmDirSync(providerRoot);
    const transform = createTransformer(provider);
    const result = transform(SOURCE_DIR, ROOT);
    results.push({ id, ...result });
    console.log(
      `  ${provider.displayName.padEnd(38)} ${result.skills.length} skills → ${provider.configDir}/skills/`,
    );
  }

  console.log(
    `\nDone. ${results.length} providers × ${results[0].skills.length} skills = ${
      results.length * results[0].skills.length
    } files.`,
  );
}

main();
