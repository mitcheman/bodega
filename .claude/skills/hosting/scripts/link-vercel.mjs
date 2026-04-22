#!/usr/bin/env node
// Example script invoked from source/skills/hosting/SKILL.md.
//
// Links the current directory to a Vercel project. Used after
// `vercel login` has already been done.
//
// Other skill scripts follow this shape:
//   - ESM (.mjs)
//   - zero runtime deps (stdlib only)
//   - read config from .bodega.md, write state back
//   - exit 0 on success, non-zero on expected failure
//   - never swallow errors silently; always log actionable output
//
// Usage (from the skill):
//   node {{scripts_path}}/link-vercel.mjs
//
// Usage (directly, for testing):
//   node source/skills/hosting/scripts/link-vercel.mjs

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BODEGA_CONFIG = '.bodega.md';

function readBodegaConfig() {
  if (!fs.existsSync(BODEGA_CONFIG)) {
    fail(
      `No .bodega.md in ${process.cwd()}. Run /bodega:setup first.`,
    );
  }
  const raw = fs.readFileSync(BODEGA_CONFIG, 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) fail('.bodega.md has no YAML frontmatter.');
  return fm[1];
}

function extractField(yaml, key) {
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const m = yaml.match(re);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

function runVercel(args) {
  try {
    return execSync(`vercel ${args}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    fail(
      `vercel ${args} failed:\n${err.stderr || err.stdout || err.message}`,
    );
  }
}

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function main() {
  // 1. Verify vercel CLI is present.
  try {
    execSync('vercel --version', { stdio: 'pipe' });
  } catch {
    fail('Vercel CLI not found. Install with: npm i -g vercel');
  }

  // 2. Verify the user is logged in.
  let whoami;
  try {
    whoami = execSync('vercel whoami', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    fail(
      'Not logged in to Vercel. Run `vercel login` first, then re-invoke this skill.',
    );
  }
  ok(`Authenticated as ${whoami}`);

  // 3. Read .bodega.md for the project slug.
  const yaml = readBodegaConfig();
  const slug =
    extractField(yaml, 'slug') ||
    deriveSlug(extractField(yaml, 'name') || 'bodega-store');

  // 4. If already linked, bail early.
  if (fs.existsSync('.vercel/project.json')) {
    ok('Project already linked. Skipping.');
    process.exit(0);
  }

  // 5. Link.
  const out = runVercel(`link --yes --project ${slug}`);
  ok(`Linked: ${slug}`);

  // 6. Print the preview URL so the orchestrator can capture it.
  const inspect = runVercel('project inspect --json');
  try {
    const info = JSON.parse(inspect);
    ok(`Preview URL: ${info.preview_url || info.name + '.vercel.app'}`);
  } catch {
    // project inspect output shape isn't guaranteed; soft-fail.
  }
}

function deriveSlug(businessName) {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

main();
