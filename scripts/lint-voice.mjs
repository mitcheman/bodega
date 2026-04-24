#!/usr/bin/env node
// Voice-lint: ensure "simple voice" blocks in source/skills/ stay
// jargon-free. Required by CLAUDE.md (the voice split):
//
//   "Never use jargon in simple voice." — setup/SKILL.md "Rules"
//
// Forbidden tokens are the developer-jargon equivalents the user
// shouldn't see when they picked the simple voice. The lint scans
// each SKILL.md for sections under `### Simple voice:` (and variants)
// and flags any forbidden tokens inside the immediately-following
// blockquote (`> ...`) lines.
//
// Run: node scripts/lint-voice.mjs
// Exit 0 = clean. Exit 1 = violations (printed file:line:col).
//
// Called from scripts/build.js before any transform — the build fails
// if simple-voice blocks contain dev jargon.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SOURCE_DIR = path.join(ROOT, 'source', 'skills');

// Heading patterns that open a simple-voice block. Case-insensitive.
// Matches "### Simple voice:" / "#### Simple voice:" / "##### Simple voice:".
const SIMPLE_HEADING_RE = /^#{2,6}\s+simple\s+voice\s*:?\s*$/i;
// A new heading at any level closes the simple-voice block.
const ANY_HEADING_RE = /^#{1,6}\s+/;
// A blockquote line.
const BLOCKQUOTE_RE = /^\s*>/;
// A fenced code block toggles us into "ignore — code" mode.
const FENCE_RE = /^\s*```/;

// Forbidden tokens. Each entry: { pattern, hint }
//
// Word-boundary regex (case-insensitive). Tokens here are the ones a
// non-technical user wouldn't recognize. The list mirrors CLAUDE.md's
// "Voice split" guidance: brand names Vercel/Stripe are explicitly
// ALLOWED in simple voice (the user has to click into them), but
// developer brand names like Next.js / Tailwind / GitHub-CLI are not.
const FORBIDDEN = [
  { pattern: /\benv\s+vars?\b/i, hint: 'say "settings" or "config"' },
  { pattern: /\benv\s+file\b/i, hint: 'say "settings file"' },
  { pattern: /\bwebhook\b/i, hint: 'say "the connection that tells your site about payments"' },
  { pattern: /\bproxy\b/i, hint: 'avoid; explain the actual concept' },
  { pattern: /\bCLI\b/, hint: 'say "command-line tool" or rephrase' },
  { pattern: /\bnpm\b/i, hint: 'avoid; rephrase the action' },
  { pattern: /\bnpx\b/i, hint: 'avoid; rephrase the action' },
  { pattern: /\bNext\.?\s*js\b/i, hint: 'never name the framework in simple voice' },
  { pattern: /\bTailwind\b/i, hint: 'never name the styling system in simple voice' },
  { pattern: /\bWorkers\b/i, hint: 'never name the runtime in simple voice' },
  { pattern: /\brepo\b/i, hint: 'say "backup folder" / "GitHub backup"' },
  { pattern: /\bcommit\b/i, hint: 'say "save"' },
  { pattern: /\bpush\b/i, hint: 'say "save online" / "back up"' },
  { pattern: /\bSDK\b/, hint: 'never name the SDK in simple voice' },
  { pattern: /\bAPI\s+key\b/i, hint: 'say "Stripe key" or "the special password Stripe gives you"' },
  { pattern: /\bdeploy\b/i, hint: 'say "put your site online" / "publish"' },
  { pattern: /\benvironment\s+variable\b/i, hint: 'say "setting"' },
  { pattern: /\bauth\b/i, hint: 'say "sign in"' },
  { pattern: /\bDNS\b/, hint: 'say "the address records for your domain"' },
];

// Brand allow-list — these are explicitly OK in simple voice because
// the user must recognize them (they click into them at signup).
// We do NOT lint for these.
//   - Vercel
//   - Stripe
//   - GitHub (the user will see GitHub in the URL when they click; OK)
//   - Resend (only mentioned when configuring email; user has to know)

function lintFile(absPath) {
  const text = fs.readFileSync(absPath, 'utf8');
  const lines = text.split('\n');

  const violations = [];
  let inSimple = false;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Toggle fence-mode regardless of voice context.
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Heading lines either open a simple block or close one.
    if (ANY_HEADING_RE.test(line)) {
      inSimple = SIMPLE_HEADING_RE.test(line);
      continue;
    }

    if (!inSimple) continue;

    // Inside a simple-voice section. We only lint blockquote lines
    // (the user-facing copy). Plain prose between heading and the
    // blockquote is meta-narration ("If voice is simple, say:") and
    // doesn't render to the user — skip it.
    //
    // A non-blockquote line that has CONTENT closes the lint zone for
    // this section (we've left the user-facing copy and gone back to
    // meta-narration / prose). Empty lines stay neutral.
    if (line.trim() === '') continue;
    if (!BLOCKQUOTE_RE.test(line)) {
      // Closed — go back to looking for the next blockquote in this
      // simple section. Don't reset inSimple; only a heading does that.
      continue;
    }

    // Blockquote line — scan for forbidden tokens.
    //
    // First strip inline-code spans (`...`) so literal UI-label
    // callouts (`DNS`, `Authorize`, etc.) and command names
    // (`bodega:deploy`) don't false-positive. The user reads code
    // spans as quoted/literal labels; the rule is about prose.
    const scanLine = line.replace(/`[^`\n]*`/g, '');

    for (const rule of FORBIDDEN) {
      const m = rule.pattern.exec(scanLine);
      if (m) {
        violations.push({
          file: absPath,
          line: i + 1,
          col: m.index + 1,
          token: m[0],
          hint: rule.hint,
          context: line.replace(/\s+/g, ' ').trim().slice(0, 100),
        });
      }
    }
  }

  return violations;
}

function walkSkills(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      out.push(...walkSkills(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`No source at ${SOURCE_DIR}`);
    process.exit(2);
  }
  const files = walkSkills(SOURCE_DIR);
  let total = 0;
  for (const f of files) {
    const violations = lintFile(f);
    if (violations.length === 0) continue;
    total += violations.length;
    const rel = path.relative(ROOT, f);
    console.error(`\n  ${rel}`);
    for (const v of violations) {
      console.error(
        `    ${rel}:${v.line}:${v.col}  forbidden in simple voice: "${v.token}"  → ${v.hint}`,
      );
      console.error(`      context: > ${v.context}`);
    }
  }
  if (total === 0) {
    console.log(`Voice lint: ${files.length} skill(s) clean.`);
    process.exit(0);
  }
  console.error(
    `\nVoice lint: ${total} violation(s) across ${files.length} skill(s).`,
  );
  console.error(
    `Each violation is text inside a "### Simple voice:" blockquote that uses developer jargon.`,
  );
  console.error(
    `Either rephrase in plain English, or move the line into a "### Developer voice:" block.`,
  );
  process.exit(1);
}

main();
