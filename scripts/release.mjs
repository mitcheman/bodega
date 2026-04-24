#!/usr/bin/env node
// One-shot release: bump version, update CHANGELOG, build, tag, push,
// publish to npm, create GitHub release. Designed so the next release
// can't accidentally diverge across the four places version lives:
//   1. root package.json version
//   2. packages/bodega/package.json version
//   3. git tag (v<version>)
//   4. npm registry (@mitcheman/bodega@<version>)
//   5. GitHub release page
//
// Usage:
//   node scripts/release.mjs <version>      # explicit version, e.g. 0.3.1
//   node scripts/release.mjs patch          # auto-bump patch
//   node scripts/release.mjs minor          # auto-bump minor
//   node scripts/release.mjs major          # auto-bump major
//   node scripts/release.mjs --dry-run patch  # show what would happen
//
// Flags:
//   --dry-run  → run all checks + show planned changes, don't mutate
//   --yes      → skip the "publish?" confirmation prompt
//   --skip-publish  → bump+tag+push but don't npm publish or create release
//
// Defensive checks before any side effect:
//   - clean working tree (no uncommitted / unstaged changes)
//   - on `main` branch
//   - up-to-date with origin/main
//   - `gh auth status` succeeds
//   - `npm whoami` succeeds
//   - `pnpm audit --prod` clean (warns if not, doesn't block)

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const ROOT_PKG = path.join(ROOT, 'package.json');
const SDK_PKG = path.join(ROOT, 'packages', 'bodega', 'package.json');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const versionArg = positional[0];
const isDryRun = flags.has('--dry-run');
const isYes = flags.has('--yes');
const skipPublish = flags.has('--skip-publish');

if (!versionArg) {
  fail(
    'Usage: node scripts/release.mjs <version|patch|minor|major> [--dry-run] [--yes] [--skip-publish]',
  );
}

// ─── helpers ──────────────────────────────────────────────────────────

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}
function shStream(cmd) {
  // Streams stdio so the user sees build output / network progress live.
  const result = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Command failed: ${cmd}`);
}
function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}
function info(msg) {
  console.log(`  ${msg}`);
}
function step(msg) {
  console.log(`\n▸ ${msg}`);
}
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(p, obj) {
  // Preserve trailing newline + 2-space indent (npm's default).
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}
function bumpSemver(current, type) {
  const m = current.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!m) throw new Error(`Cannot parse semver: ${current}`);
  let [, maj, min, pat] = m;
  maj = +maj; min = +min; pat = +pat;
  switch (type) {
    case 'patch': pat++; break;
    case 'minor': min++; pat = 0; break;
    case 'major': maj++; min = 0; pat = 0; break;
    default: throw new Error(`Unknown bump: ${type}`);
  }
  return `${maj}.${min}.${pat}`;
}

async function confirm(prompt) {
  if (isYes) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${prompt} (y/N) `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

// ─── pre-flight ───────────────────────────────────────────────────────

step('Pre-flight checks');

// 1. Working tree clean.
const dirty = sh('git status --porcelain');
if (dirty) {
  fail(`Working tree has uncommitted changes:\n\n${dirty}\n\nCommit or stash before releasing.`);
}
info('✓ working tree clean');

// 2. On main branch.
const branch = sh('git rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
  fail(`Not on main (currently on ${branch}). Releases ship from main.`);
}
info(`✓ on ${branch}`);

// 3. Up to date with origin/main.
sh('git fetch origin main --quiet');
const ahead = sh('git rev-list --count origin/main..HEAD');
const behind = sh('git rev-list --count HEAD..origin/main');
if (+behind > 0) {
  fail(`Local main is ${behind} commit(s) behind origin. Pull first.`);
}
if (+ahead > 0) {
  info(`(local is ${ahead} commit(s) ahead of origin — those will push as part of release)`);
}
info('✓ in sync with origin/main');

// 4. gh auth.
try {
  sh('gh auth status');
  info('✓ gh authenticated');
} catch {
  fail('gh CLI not authenticated. Run: gh auth login --web');
}

// 5. npm whoami.
let npmUser;
try {
  npmUser = sh('npm whoami');
  info(`✓ npm authed as ${npmUser}`);
} catch {
  fail('npm not logged in. Run: npm login');
}

// ─── version resolution ───────────────────────────────────────────────

step('Resolve version');

const rootPkg = readJson(ROOT_PKG);
const sdkPkg = readJson(SDK_PKG);
const currentRoot = rootPkg.version;
const currentSdk = sdkPkg.version;
if (currentRoot !== currentSdk) {
  fail(`Version drift: root=${currentRoot}, sdk=${currentSdk}. Reconcile manually first.`);
}
info(`current: ${currentRoot}`);

let nextVersion;
if (['patch', 'minor', 'major'].includes(versionArg)) {
  nextVersion = bumpSemver(currentRoot, versionArg);
} else if (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(versionArg)) {
  nextVersion = versionArg;
} else {
  fail(`Bad version arg: "${versionArg}". Use patch|minor|major or an explicit semver.`);
}
info(`next:    ${nextVersion}`);

// 6. Tag must not already exist.
const existingTag = sh(`git tag -l v${nextVersion}`);
if (existingTag) {
  fail(`Tag v${nextVersion} already exists locally. Pick a different version.`);
}
const remoteTagExists = sh(`git ls-remote --tags origin v${nextVersion}`);
if (remoteTagExists) {
  fail(`Tag v${nextVersion} already exists on origin. Pick a different version.`);
}
info(`✓ tag v${nextVersion} is free`);

// 7. CHANGELOG must have an [Unreleased] section.
const changelogText = fs.readFileSync(CHANGELOG, 'utf8');
if (!/^## \[Unreleased\]/m.test(changelogText)) {
  fail('CHANGELOG.md has no `## [Unreleased]` section. Add one before releasing.');
}
info('✓ CHANGELOG has [Unreleased]');

// 8. (Soft) audit.
try {
  sh('pnpm audit --prod');
  info('✓ pnpm audit --prod: clean');
} catch (err) {
  console.warn(`  ⚠ pnpm audit reported issues — review before continuing:\n${err.stdout || ''}`);
}

if (isDryRun) {
  console.log(`\n[dry-run] would now:`);
  console.log(`  1. bump root + sdk package.json: ${currentRoot} → ${nextVersion}`);
  console.log(`  2. CHANGELOG: rename [Unreleased] → [${nextVersion}] — ${today()}; add fresh empty [Unreleased]`);
  console.log(`  3. pnpm build:all (runs voice-lint + builds 8 harnesses + SDK)`);
  console.log(`  4. git commit -am "release v${nextVersion}"`);
  console.log(`  5. git tag -a v${nextVersion}`);
  console.log(`  6. git push origin main + tag`);
  if (!skipPublish) {
    console.log(`  7. cd packages/bodega && npm publish --access public`);
    console.log(`  8. gh release create v${nextVersion} from CHANGELOG section`);
  } else {
    console.log(`  7. (skipping npm publish + GH release per --skip-publish)`);
  }
  process.exit(0);
}

// ─── confirmation ─────────────────────────────────────────────────────

const ok = await confirm(`\nProceed with release v${nextVersion}?`);
if (!ok) fail('Cancelled by user.');

// ─── mutate ───────────────────────────────────────────────────────────

step('Bump versions');
rootPkg.version = nextVersion;
sdkPkg.version = nextVersion;
writeJson(ROOT_PKG, rootPkg);
writeJson(SDK_PKG, sdkPkg);
info(`✓ wrote ${nextVersion} to root + sdk package.json`);

step('Update CHANGELOG');
const dateStr = today();
const updated = changelogText.replace(
  /^## \[Unreleased\]\s*\n/m,
  `## [Unreleased]\n\n(no changes yet)\n\n## [${nextVersion}] — ${dateStr}\n`,
);
fs.writeFileSync(CHANGELOG, updated);
info(`✓ CHANGELOG: [Unreleased] → [${nextVersion}] — ${dateStr}`);

step('Build (voice-lint + 8 harnesses + SDK)');
shStream(`cd "${ROOT}" && pnpm build:all`);

step('Commit');
shStream(`cd "${ROOT}" && git add -A && git commit -m "release v${nextVersion}"`);

step('Tag');
const tagMsg = extractChangelogSection(updated, nextVersion).slice(0, 4000); // GH limit-friendly
const tagFile = path.join(ROOT, '.release-tag-msg.tmp');
fs.writeFileSync(tagFile, `v${nextVersion}\n\n${tagMsg}`);
shStream(`cd "${ROOT}" && git tag -a v${nextVersion} -F "${tagFile}"`);
fs.unlinkSync(tagFile);
info(`✓ tagged v${nextVersion}`);

step('Push');
shStream(`cd "${ROOT}" && git push origin main`);
shStream(`cd "${ROOT}" && git push origin v${nextVersion}`);

if (skipPublish) {
  console.log(`\n✓ Done — tag pushed, npm + GH release skipped per --skip-publish.`);
  console.log(`  To finish later: cd packages/bodega && npm publish --access public`);
  console.log(`  Then: gh release create v${nextVersion} --notes-file <(awk '/^## \\[${nextVersion}\\]/{flag=1;next} /^## \\[/{if(flag) exit} flag' CHANGELOG.md)`);
  process.exit(0);
}

step('Publish to npm');
shStream(`cd "${ROOT}/packages/bodega" && npm publish --access public`);

step('Create GitHub release');
const notesFile = path.join(ROOT, '.release-notes.tmp');
fs.writeFileSync(notesFile, extractChangelogSection(updated, nextVersion));
try {
  shStream(
    `cd "${ROOT}" && gh release create v${nextVersion} ` +
      `--title "v${nextVersion}" ` +
      `--notes-file "${notesFile}" ` +
      `--verify-tag`,
  );
} catch {
  // GitHub may auto-create a pre-release from the annotated tag push.
  // If `gh release create` failed because it already exists, edit it.
  console.log('  (release auto-existed from tag push; updating with notes)');
  shStream(
    `cd "${ROOT}" && gh release edit v${nextVersion} ` +
      `--title "v${nextVersion}" ` +
      `--notes-file "${notesFile}" ` +
      `--prerelease=false`,
  );
}
fs.unlinkSync(notesFile);

const releaseUrl = `https://github.com/mitcheman/bodega/releases/tag/v${nextVersion}`;
const npmUrl = `https://www.npmjs.com/package/@mitcheman/bodega/v/${nextVersion}`;
console.log(`\n✓ Released v${nextVersion}`);
console.log(`  GitHub: ${releaseUrl}`);
console.log(`  npm:    ${npmUrl}`);

// ─── helpers (post-script-body so they hoist cleanly) ─────────────────

function today() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function extractChangelogSection(text, version) {
  // Pull everything between `## [<version>]` and the next `## [`.
  const re = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[)`, 'm');
  const m = text.match(re);
  return m ? m[1].trim() + '\n' : '(no notes)\n';
}
