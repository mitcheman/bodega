// Core transformer: take the canonical source skills, render for a given
// provider, and write the output tree.
//
// Per-provider variations happen in two places:
//   1. Frontmatter field allowlist (from providers.js)
//   2. Placeholder resolution (from utils.js)
//
// Everything else is provider-agnostic.

import fs from 'node:fs';
import path from 'node:path';
import {
  parseSkillFile,
  serializeFrontmatter,
  resolvePlaceholders,
  copyDirSync,
  listSkills,
} from '../utils.js';

export function createTransformer(provider) {
  return function transform(sourceDir, outputRoot, options = {}) {
    const providerOutputRoot = path.join(outputRoot, provider.configDir, 'skills');
    fs.mkdirSync(providerOutputRoot, { recursive: true });

    const skills = listSkills(sourceDir);
    const processed = [];

    for (const skillName of skills) {
      const skillSourceDir = path.join(sourceDir, skillName);
      const skillFile = path.join(skillSourceDir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;

      // Parse the canonical source.
      const raw = fs.readFileSync(skillFile, 'utf8');
      const { frontmatter, body } = parseSkillFile(raw);

      // Optional prefix rename (e.g., audit → b-audit to avoid collisions).
      const effectiveName = options.prefix
        ? `${options.prefix}${frontmatter.name}`
        : frontmatter.name;
      const renamedFrontmatter = { ...frontmatter, name: effectiveName };

      // Render the body for this provider.
      const renderedBody = resolvePlaceholders(body, provider, skillName);

      // Serialize only the fields this provider supports.
      const renderedFrontmatter = serializeFrontmatter(
        renamedFrontmatter,
        provider.frontmatterFields,
      );

      // Write SKILL.md to output.
      const skillOutputDir = path.join(providerOutputRoot, skillName);
      fs.mkdirSync(skillOutputDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillOutputDir, 'SKILL.md'),
        `${renderedFrontmatter}\n${renderedBody}`,
      );

      // Copy sibling directories (reference/, scripts/) verbatim.
      for (const sibling of ['reference', 'scripts']) {
        const src = path.join(skillSourceDir, sibling);
        if (fs.existsSync(src)) {
          copyDirSync(src, path.join(skillOutputDir, sibling));
        }
      }

      processed.push(skillName);
    }

    return { provider: provider.displayName, skills: processed };
  };
}
