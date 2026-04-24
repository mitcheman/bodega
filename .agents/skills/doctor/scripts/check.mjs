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
  const raw = tryCmd('vercel project inspect --json 2>/dev/null');
  if (!raw) {
    return {
      label: 'Vercel project Node version',
      value: 'could not query (auth expired? try `vercel login --github`)',
      ok: false,
      critical: false,
      fix: 'Re-authenticate: `vercel login --github`. Then re-run doctor.',
    };
  }
  let project;
  try {
    project = JSON.parse(raw);
  } catch {
    return {
      label: 'Vercel project Node version',
      value: 'inspect output not JSON',
      ok: false,
      critical: false,
      fix: 'Verify your Vercel CLI is 50+ (`vercel --version`).',
    };
  }
  // Vercel returns nodeVersion as e.g. "20.x" or "22.x".
  const projectNode = project?.nodeVersion ?? project?.framework?.nodeVersion;
  if (!projectNode) {
    return {
      label: 'Vercel project Node version',
      value: 'unknown (no nodeVersion field on project)',
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
  return {
    label: '.bodega.md',
    value: has
      ? 'present (project is already set up)'
      : 'absent (fresh project — run /bodega:setup)',
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

  const results = [
    checkNode(),
    checkPackageManager(),
    checkGit(),
    checkVercel(),
    checkGh(),
    checkProject(),
    checkImpeccable(),
    checkBodegaConfig(),
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
