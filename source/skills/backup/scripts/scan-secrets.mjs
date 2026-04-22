#!/usr/bin/env node
// Secret scanner. Invoked by the backup skill before pushing to GitHub.
// Aborts the push if it finds patterns that shouldn't be in source.
//
// Usage:
//   node {{scripts_path}}/scan-secrets.mjs [path]
//
// Conservative on purpose — false positives are better than committing
// a real Stripe key.

import fs from 'node:fs';
import path from 'node:path';

const patterns = [
  { name: 'Stripe secret (live)',     re: /\bsk_live_[a-zA-Z0-9]{24,}\b/,   severity: 'critical' },
  { name: 'Stripe secret (test)',     re: /\bsk_test_[a-zA-Z0-9]{24,}\b/,   severity: 'high' },
  { name: 'Stripe restricted key',    re: /\brk_(live|test)_[a-zA-Z0-9]{24,}\b/, severity: 'critical' },
  { name: 'Stripe webhook secret',    re: /\bwhsec_[a-zA-Z0-9]{24,}\b/,     severity: 'high' },
  { name: 'AWS access key',           re: /\bAKIA[0-9A-Z]{16}\b/,           severity: 'critical' },
  { name: 'GitHub PAT',               re: /\bghp_[a-zA-Z0-9]{36,}\b/,       severity: 'critical' },
  { name: 'GitHub OAuth token',       re: /\bgho_[a-zA-Z0-9]{36,}\b/,       severity: 'critical' },
  { name: 'Vercel token',             re: /\bvercel[_-]?token["'\s:=]+[a-zA-Z0-9]{24,}/i, severity: 'high' },
  { name: 'OpenAI API key',           re: /\bsk-[a-zA-Z0-9]{48,}\b/,        severity: 'critical' },
  { name: 'Anthropic API key',        re: /\bsk-ant-[a-zA-Z0-9-]{80,}\b/,   severity: 'critical' },
  { name: 'PEM private key',          re: /-----BEGIN (RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/, severity: 'critical' },
];

const ignoreDirs = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.pnpm-store', '.vercel',
]);

const allowlistedFiles = new Set([
  'source/skills/backup/scripts/scan-secrets.mjs',
]);

const textExtensions = new Set([
  '.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.env', '.sh', '.html', '.css',
]);

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, results);
    else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (textExtensions.has(ext) || entry.name === '.env') results.push(p);
    }
  }
  return results;
}

function scanFile(filePath) {
  const rel = path.relative(process.cwd(), filePath);
  if (allowlistedFiles.has(rel)) return [];

  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch { return []; }

  const findings = [];
  for (const pattern of patterns) {
    const match = content.match(pattern.re);
    if (match) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      findings.push({
        file: rel,
        line: lineNum,
        name: pattern.name,
        severity: pattern.severity,
        preview: match[0].slice(0, 20) + '...',
      });
    }
  }
  return findings;
}

function main() {
  const root = process.argv[2] || process.cwd();
  const files = walk(root);
  const findings = files.flatMap(scanFile);

  if (findings.length === 0) {
    console.log(`✓ No secrets found across ${files.length} files.`);
    process.exit(0);
  }

  console.error('❌ Secret patterns found:\n');
  for (const f of findings) {
    console.error(`  ${f.severity.toUpperCase().padEnd(8)} ${f.name}`);
    console.error(`           ${f.file}:${f.line} — ${f.preview}\n`);
  }
  console.error(
    `${findings.length} finding(s). Fix before pushing.`,
  );
  process.exit(1);
}

main();
