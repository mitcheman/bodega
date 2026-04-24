#!/usr/bin/env node
// Bodega preflight check. Read-only. Exits 0 if all critical checks
// pass, 1 otherwise. Warnings don't block.
//
// Usage:
//   node source/skills/doctor/scripts/check.mjs

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MIN_NODE_MAJOR = 20;
// Version floors: warn (don't block) if a tool is present but older than these.
const MIN_VERCEL_MAJOR = 50; // current is 52.x; older versions miss commands
const MIN_GH_MAJOR = 2;
const MIN_GH_MINOR = 40; // older lacks `repo create --internal` and friends

// ─── Voice detection ──────────────────────────────────────────────────

function detectVoice() {
  try {
    const raw = fs.readFileSync('.bodega.md', 'utf8');
    const m = raw.match(/^mode:\s*(\w+)/m);
    return m?.[1] === 'simple' ? 'simple' : 'developer';
  } catch {
    return 'neutral'; // no .bodega.md → first run, neutral voice
  }
}

// ─── Check primitives ─────────────────────────────────────────────────

function tryCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

// Variant of tryCmd that surfaces stderr + exit code so the caller can
// diagnose failures instead of guessing. Use this when the failure
// mode matters more than just "did it work".
function tryCmdDetail(cmd) {
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { ok: true, stdout: stdout.trim(), stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      ok: false,
      stdout: (err.stdout?.toString?.() ?? '').trim(),
      stderr: (err.stderr?.toString?.() ?? '').trim(),
      exitCode: err.status ?? -1,
    };
  }
}

function parseSemver(v) {
  const m = v?.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null;
}

// Return immediate subdirectory names that contain a package.json.
// Used for workspace-parent detection in checkProject().
function listSubProjects(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    try {
      if (fs.existsSync(path.join(dir, e.name, 'package.json'))) {
        out.push(e.name);
      }
    } catch {
      // ignore unreadable subdir
    }
  }
  return out.sort();
}

// ─── Individual checks ────────────────────────────────────────────────

function checkNode() {
  const v = process.versions.node;
  const parsed = parseSemver('v' + v);
  const ok = parsed && parsed.major >= MIN_NODE_MAJOR;
  return {
    label: 'Node.js',
    value: v,
    ok,
    critical: true,
    fix: ok ? null : `Install Node ${MIN_NODE_MAJOR}+ from nodejs.org or via nvm.`,
  };
}

function checkPackageManager() {
  for (const mgr of ['pnpm', 'npm', 'yarn', 'bun']) {
    const v = tryCmd(`${mgr} --version`);
    if (v) {
      return {
        label: `Package manager (${mgr})`,
        value: v,
        ok: true,
        critical: true,
        fix: null,
      };
    }
  }
  return {
    label: 'Package manager',
    value: 'not found',
    ok: false,
    critical: true,
    fix: 'Install npm (ships with Node), pnpm, yarn, or bun.',
  };
}

function checkGit() {
  const v = tryCmd('git --version');
  return {
    label: 'git',
    value: v?.replace(/^git version\s+/, '') || 'not found',
    ok: !!v,
    critical: false,
    fix: v ? null : 'Install git (only needed for backup). macOS: `xcode-select --install`.',
  };
}

function checkVercel() {
  const v = tryCmd('vercel --version');
  if (!v) {
    return {
      label: 'Vercel CLI',
      value: 'not installed',
      ok: false,
      critical: false,
      fix: 'Run: npm i -g vercel  (or the hosting skill will install it for you)',
    };
  }
  const parsed = parseSemver(v);
  if (parsed && parsed.major < MIN_VERCEL_MAJOR) {
    return {
      label: 'Vercel CLI',
      value: `${v} (stale — current is ${MIN_VERCEL_MAJOR}+)`,
      ok: false,
      critical: false,
      fix: `Run: npm i -g vercel@latest  (your ${parsed.major}.x is missing commands bodega uses)`,
    };
  }
  return {
    label: 'Vercel CLI',
    value: v,
    ok: true,
    critical: false,
    fix: null,
  };
}

function checkGh() {
  const v = tryCmd('gh --version');
  const firstLine = v?.split('\n')[0] || null;
  if (!v) {
    return {
      label: 'gh CLI (for backup)',
      value: 'not installed',
      ok: false,
      critical: false,
      fix: 'Install if you want backup: https://cli.github.com',
    };
  }
  const parsed = parseSemver(firstLine);
  if (
    parsed &&
    (parsed.major < MIN_GH_MAJOR ||
      (parsed.major === MIN_GH_MAJOR && parsed.minor < MIN_GH_MINOR))
  ) {
    return {
      label: 'gh CLI (for backup)',
      value: `${firstLine} (stale — need ${MIN_GH_MAJOR}.${MIN_GH_MINOR}+)`,
      ok: false,
      critical: false,
      fix: 'Upgrade gh: brew upgrade gh  (or https://cli.github.com)',
    };
  }
  return {
    label: 'gh CLI (for backup)',
    value: firstLine,
    ok: true,
    critical: false,
    fix: null,
  };
}

function checkProject() {
  const hasPackageJson = fs.existsSync('package.json');
  if (!hasPackageJson) {
    // Workspace-parent detection: scan immediate subdirectories for
    // package.json files. If 2+, the cwd is almost certainly a workspace
    // parent (e.g. ~/Developer/) and "greenfield mode" is the wrong call.
    const subprojects = listSubProjects(process.cwd());
    if (subprojects.length >= 2) {
      const list = subprojects.slice(0, 5).join(', ');
      const more = subprojects.length > 5 ? `, +${subprojects.length - 5} more` : '';
      return {
        label: 'Project',
        value: `workspace parent — ${subprojects.length} subprojects (${list}${more})`,
        ok: false,
        critical: false,
        fix: `cd into the specific project before running setup. e.g.: cd ${subprojects[0]}`,
      };
    }
    return {
      label: 'Project',
      value: 'empty folder (greenfield mode)',
      ok: true,
      critical: false,
      fix: null,
    };
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  } catch {
    return {
      label: 'Project',
      value: 'package.json malformed',
      ok: false,
      critical: false,
      fix: 'Check package.json for syntax errors.',
    };
  }

  const nextVersion = pkg.dependencies?.next || pkg.devDependencies?.next;
  if (nextVersion) {
    const parsed = parseSemver(nextVersion);
    const major = parsed?.major;
    return {
      label: `Framework (Next.js ${nextVersion})`,
      value: major && major >= 16 ? 'supported' : `v${major} — best-effort`,
      ok: true,
      critical: false,
      fix:
        major && major >= 16
          ? null
          : 'Bodega is built for Next.js 16. Older versions may work but are not tested.',
    };
  }

  return {
    label: 'Framework',
    value: 'not Next.js',
    ok: false,
    critical: false,
    fix: 'Bodega currently supports Next.js projects. Others: best-effort or convert first.',
  };
}

// ─── Vercel-linked-project checks ─────────────────────────────────────
//
// Each one returns a "skip" sentinel (informational, ok:true) when the
// project isn't linked to Vercel yet. They only do real work after
// `vercel link` has run (i.e. .vercel/project.json exists).

function isVercelLinked() {
  return fs.existsSync('.vercel/project.json');
}

// Classify a Vercel-CLI failure from stderr text → human-meaningful
// label + retry hint. Returns an object the caller can return directly
// when downgrading to "skipped (with reason)".
function classifyVercelFailure(stderr) {
  const s = (stderr || '').toLowerCase();
  if (!s) {
    return {
      reason: 'no stderr (CLI exited non-zero silently)',
      fix: null,
    };
  }
  if (s.includes('not authenticated') || s.includes('please log in') || s.includes('credentials') || s.includes('not logged in')) {
    return {
      reason: 'auth expired',
      fix: 'Re-authenticate: `vercel login --github`. Then re-run doctor.',
    };
  }
  if (s.includes('not linked') || s.includes("isn't linked") || s.includes('no project found')) {
    return {
      reason: 'project not linked',
      fix: 'Re-link: `vercel link --yes --scope=<your-scope>`.',
    };
  }
  if (s.includes('unknown option') || s.includes('unrecognized') || s.includes("doesn't accept") || s.includes('invalid argument')) {
    return {
      reason: 'CLI flag unsupported on this command (CLI version drift?)',
      fix: 'Skip this probe — it requires a newer Vercel CLI subcommand shape.',
    };
  }
  // Default: surface the first meaningful stderr line so the user has a
  // breadcrumb instead of doctor guessing.
  const firstLine = stderr.split('\n').find((l) => l.trim()) ?? '';
  return {
    reason: firstLine.slice(0, 100),
    fix: null,
  };
}

function checkVercelNodeMatch() {
  if (!isVercelLinked()) {
    return {
      label: 'Vercel project Node version',
      value: 'skipped (not linked yet)',
      ok: true,
      critical: false,
      fix: null,
      informational: true,
    };
  }

  // Three-stage fallback for getting the project's Node version:
  //   1. `vercel inspect --json` (top-level inspect against the linked
  //      project) — most reliable on CLI 50+.
  //   2. `vercel project inspect --json` — works on some CLI versions,
  //      not all. This is what doctor used to call exclusively, which
  //      surfaced "auth expired?" for unrelated CLI flag-shape errors.
  //   3. None of the above worked → downgrade to informational with
  //      the actual stderr reason, never claim "auth expired" without
  //      evidence.

  const candidates = [
    'vercel inspect --json',
    'vercel project inspect --json',
  ];

  let project = null;
  let lastFailure = null;

  for (const cmd of candidates) {
    const r = tryCmdDetail(cmd);
    if (!r.ok) {
      lastFailure = r;
      continue;
    }
    if (!r.stdout) {
      lastFailure = { ...r, stderr: 'empty stdout' };
      continue;
    }
    try {
      project = JSON.parse(r.stdout);
      break;
    } catch {
      lastFailure = { ...r, stderr: 'inspect output not JSON' };
      continue;
    }
  }

  if (!project) {
    const cls = classifyVercelFailure(lastFailure?.stderr);
    // Auth-expired is the one case where it IS a warning (because it
    // blocks downstream skills). Everything else downgrades to
    // informational so we don't cry wolf.
    const isAuthIssue = /auth expired/.test(cls.reason);
    return {
      label: 'Vercel project Node version',
      value: `skipped — ${cls.reason}`,
      ok: !isAuthIssue,
      critical: false,
      fix: cls.fix,
      informational: !isAuthIssue,
    };
  }

  // Vercel returns nodeVersion variously by command + version:
  //   - top-level `vercel inspect --json` puts it on the deployment
  //     metadata (often `meta.nodeVersion` or `build.env.NODE_VERSION`)
  //   - `vercel project inspect --json` puts it at top level as
  //     `nodeVersion` or under `framework.nodeVersion`
  // Best-effort lookup across known shapes.
  const projectNode =
    project?.nodeVersion ??
    project?.framework?.nodeVersion ??
    project?.meta?.nodeVersion ??
    project?.build?.env?.NODE_VERSION ??
    null;

  if (!projectNode) {
    return {
      label: 'Vercel project Node version',
      value: 'unknown (no nodeVersion field in inspect output)',
      ok: true,
      critical: false,
      fix: null,
      informational: true,
    };
  }
  const projectMajor = parseInt(String(projectNode).match(/(\d+)/)?.[1] ?? '', 10);
  const localMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (!projectMajor) {
    return {
      label: 'Vercel project Node version',
      value: `${projectNode} (cannot parse)`,
      ok: true,
      critical: false,
      fix: null,
      informational: true,
    };
  }
  if (projectMajor !== localMajor) {
    return {
      label: 'Vercel project Node version',
      value: `project ${projectNode} vs local ${process.versions.node}`,
      ok: false,
      critical: false,
      fix:
        `Build behavior may diverge. Match locally: install Node ${projectMajor}.x ` +
        `(via nvm) OR change the project's Node version on Vercel ` +
        `(Project → Settings → General → Node.js Version).`,
    };
  }
  return {
    label: 'Vercel project Node version',
    value: `${projectNode} (matches local ${process.versions.node})`,
    ok: true,
    critical: false,
    fix: null,
  };
}

// Lazy: cache `vercel env ls` output across the env-presence checks so we
// only spawn the subprocess once.
let _envCache = undefined;
function vercelEnvNames() {
  if (_envCache !== undefined) return _envCache;
  if (!isVercelLinked()) {
    _envCache = null;
    return _envCache;
  }
  // Production env var NAMES only — values never read.
  const out = tryCmd('vercel env ls production 2>/dev/null');
  if (!out) {
    _envCache = null;
    return _envCache;
  }
  // Crude but good enough — match leading-token names (uppercase + underscore).
  const names = new Set();
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]+)\b/);
    if (m) names.add(m[1]);
  }
  _envCache = names;
  return _envCache;
}

function checkBlobToken() {
  const env = vercelEnvNames();
  if (env === null) {
    return {
      label: 'BLOB_READ_WRITE_TOKEN (Vercel)',
      value: 'skipped (not linked / not authed)',
      ok: true,
      critical: false,
      fix: null,
      informational: true,
    };
  }
  if (env.has('BLOB_READ_WRITE_TOKEN')) {
    return {
      label: 'BLOB_READ_WRITE_TOKEN (Vercel)',
      value: 'present',
      ok: true,
      critical: false,
      fix: null,
    };
  }
  return {
    label: 'BLOB_READ_WRITE_TOKEN (Vercel)',
    value: 'missing — image uploads + product storage will 500',
    ok: false,
    critical: false,
    fix:
      'Connect your blob store: `vercel blob store connect bodega-store` ' +
      '(or whichever store name you used). Re-run doctor.',
  };
}

function checkResendConfig() {
  const env = vercelEnvNames();
  if (env === null) {
    return {
      label: 'Email (Resend)',
      value: 'skipped (not linked / not authed)',
      ok: true,
      critical: false,
      fix: null,
      informational: true,
    };
  }
  const hasKey = env.has('RESEND_API_KEY');
  const hasFrom = env.has('BODEGA_FROM_EMAIL');
  if (!hasKey && !hasFrom) {
    // Email opt-in is the recommended default — see deploy/SKILL.md Step 5.
    // Bootstrap-link path covers the studio-login case meanwhile.
    return {
      label: 'Email (Resend)',
      value: 'opt-in: not configured (bootstrap link path active)',
      ok: true,
      critical: false,
      fix: null,
      informational: true,
    };
  }
  if (hasKey && !hasFrom) {
    return {
      label: 'Email (Resend)',
      value: 'RESEND_API_KEY set, BODEGA_FROM_EMAIL missing',
      ok: false,
      critical: false,
      fix:
        'Set BODEGA_FROM_EMAIL to a verified-on-Resend address ' +
        '(e.g. orders@yourshop.com). Verify the domain at ' +
        'https://resend.com/domains first.',
    };
  }
  if (!hasKey && hasFrom) {
    return {
      label: 'Email (Resend)',
      value: 'BODEGA_FROM_EMAIL set, RESEND_API_KEY missing',
      ok: false,
      critical: false,
      fix:
        'Add the API key: `vercel env add RESEND_API_KEY production` ' +
        '(get one at https://resend.com/api-keys).',
    };
  }
  // Both set. Doctor can't verify Resend domain status without revealing
  // the key — surface the manual check instead.
  return {
    label: 'Email (Resend)',
    value: 'configured (verify domain at resend.com/domains if mail bounces)',
    ok: true,
    critical: false,
    fix: null,
    informational: true,
  };
}

function checkImpeccable() {
  const has = fs.existsSync('.impeccable.md');
  return {
    label: '.impeccable.md',
    value: has ? 'present (design context available)' : 'absent',
    ok: true, // never a blocker
    critical: false,
    fix: null,
    informational: true,
  };
}

function checkBodegaConfig() {
  const has = fs.existsSync('.bodega.md');
  if (!has) {
    return {
      label: '.bodega.md',
      value: 'absent (fresh project — run /bodega:setup)',
      ok: true,
      critical: false,
      fix: null,
      informational: true,
    };
  }
  // Try to extract bodega.version from the YAML frontmatter so we can
  // tell whether the installed plugin matches what scaffolded this
  // project. Hand-rolled parse (no yaml dep) — we only need one nested
  // value, regex is fine.
  let scaffoldedVersion = null;
  try {
    const raw = fs.readFileSync('.bodega.md', 'utf8');
    const m = raw.match(/^bodega:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+version:\s*['"]?([\w.\-]+)['"]?/m);
    scaffoldedVersion = m?.[1] ?? null;
  } catch {
    // unreadable; treat as no version pin
  }
  if (!scaffoldedVersion) {
    return {
      label: '.bodega.md',
      value: 'present (legacy — no bodega.version pin)',
      ok: true,
      critical: false,
      fix: null,
      informational: true,
    };
  }
  return {
    label: '.bodega.md',
    value: `present (scaffolded against bodega ${scaffoldedVersion})`,
    ok: true,
    critical: false,
    fix: null,
    informational: true,
    scaffoldedVersion,
  };
}

// Compare the version that scaffolded .bodega.md against the version
// of the bodega plugin currently installed (resolved via the plugin
// CLI). Warns on a major-version mismatch — minor/patch drift is
// usually safe but worth noting.
function checkBodegaVersionDrift(configResult) {
  const scaffolded = configResult.scaffoldedVersion;
  if (!scaffolded) {
    // .bodega.md absent or pre-version-pinning — nothing to compare.
    return {
      label: 'Bodega version drift',
      value: 'skipped (no scaffold-time version recorded)',
      ok: true,
      critical: false,
      fix: null,
      informational: true,
    };
  }
  // Best-effort current-version resolution.  The plugin CLI prints its
  // version with --version; if the user is running doctor through `npx`
  // that goes through the on-disk install.
  const installedRaw = tryCmd('bodega --version 2>/dev/null') || tryCmd('npx bodega --version 2>/dev/null');
  const installed = installedRaw?.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null;
  if (!installed) {
    return {
      label: 'Bodega version drift',
      value: `scaffolded against ${scaffolded} (installed: unknown)`,
      ok: true,
      critical: false,
      fix: null,
      informational: true,
    };
  }
  if (installed === scaffolded) {
    return {
      label: 'Bodega version drift',
      value: `${installed} matches scaffold`,
      ok: true,
      critical: false,
      fix: null,
    };
  }
  const sMajor = parseInt(scaffolded.split('.')[0], 10);
  const iMajor = parseInt(installed.split('.')[0], 10);
  if (sMajor !== iMajor) {
    return {
      label: 'Bodega version drift',
      value: `installed ${installed} vs scaffolded ${scaffolded} (MAJOR drift)`,
      ok: false,
      critical: false,
      fix:
        `Schema may have changed across the major bump. Skim CHANGELOG ` +
        `for breaking changes between ${scaffolded} and ${installed}, then ` +
        `re-run setup if needed.`,
    };
  }
  return {
    label: 'Bodega version drift',
    value: `installed ${installed} vs scaffolded ${scaffolded}`,
    ok: true,
    critical: false,
    fix: null,
    informational: true,
  };
}

// ─── Render ───────────────────────────────────────────────────────────

function render(results, voice) {
  const lines = [];
  let criticalFails = 0;
  let warnings = 0;

  if (voice === 'simple') {
    lines.push('Looking at your computer to make sure everything is ready...\n');
  }

  for (const r of results) {
    const symbol = r.ok ? '✓' : r.critical ? '✗' : '⚠';
    const label = r.label.padEnd(32);
    const value = r.value;
    lines.push(`${symbol} ${label} ${value}`);
    if (!r.ok && r.critical) criticalFails++;
    else if (!r.ok) warnings++;
  }

  lines.push('');

  // Add fix hints for anything that wasn't ok.
  const fixes = results.filter((r) => r.fix);
  if (fixes.length > 0) {
    if (voice === 'simple') lines.push('What to do:');
    for (const r of fixes) {
      lines.push(`  • ${r.label}: ${r.fix}`);
    }
    lines.push('');
  }

  if (criticalFails > 0) {
    lines.push(
      voice === 'simple'
        ? `❌ ${criticalFails} thing(s) need your attention before we can continue.`
        : `❌ ${criticalFails} critical check(s) failed. Fix and re-run.`,
    );
  } else if (warnings > 0) {
    lines.push(
      voice === 'simple'
        ? `All critical things look good. ${warnings} optional thing(s) above — you can skip those or fix later.`
        : `✓ Critical checks pass. ${warnings} warning(s) above.`,
    );
  } else {
    lines.push(
      voice === 'simple'
        ? `🎉 Everything looks good! Run /bodega:setup when you're ready.`
        : `✓ All checks pass. Run /bodega:setup to proceed.`,
    );
  }

  return { text: lines.join('\n'), criticalFails };
}

// ─── Main ─────────────────────────────────────────────────────────────

function main() {
  const voice = detectVoice();

  const configResult = checkBodegaConfig();
  const results = [
    checkNode(),
    checkPackageManager(),
    checkGit(),
    checkVercel(),
    checkGh(),
    checkProject(),
    checkImpeccable(),
    configResult,
    checkBodegaVersionDrift(configResult),
    // Project-linked checks — quietly skip when .vercel/project.json absent.
    checkVercelNodeMatch(),
    checkBlobToken(),
    checkResendConfig(),
  ];

  const { text, criticalFails } = render(results, voice);
  console.log(text);
  process.exit(criticalFails > 0 ? 1 : 0);
}

main();
