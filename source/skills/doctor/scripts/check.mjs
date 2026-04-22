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
  return {
    label: 'Vercel CLI',
    value: v || 'not installed',
    ok: !!v,
    critical: false,
    fix: v ? null : 'Run: npm i -g vercel  (or the hosting skill will install it for you)',
  };
}

function checkGh() {
  const v = tryCmd('gh --version');
  const parsed = v?.split('\n')[0] || null;
  return {
    label: 'gh CLI (for backup)',
    value: parsed || 'not installed',
    ok: !!v,
    critical: false,
    fix: v ? null : 'Install if you want backup: https://cli.github.com',
  };
}

function checkProject() {
  const hasPackageJson = fs.existsSync('package.json');
  if (!hasPackageJson) {
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
  ];

  const { text, criticalFails } = render(results, voice);
  console.log(text);
  process.exit(criticalFails > 0 ? 1 : 0);
}

main();
