#!/usr/bin/env node
// Bodega CLI wrapper. Mostly a convenience over `npx skills add`, with
// versioning, prefix-rename, and updates served from a bundle URL.
//
// Thin by design: the real work lives in skills + scripts, and users
// typically don't need the CLI at all — they install via
// `npx skills add <you>/bodega` and run slash commands from their IDE.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const [, , command, ...args] = process.argv;

function help() {
  console.log(`
bodega v${pkg.version}

Usage:
  bodega install                Install skills into current project (all IDEs)
  bodega install --ide=claude   Install for a specific IDE
  bodega update                 Fetch the latest skills bundle
  bodega skills                 List available skills
  bodega --help                 Show this help

Most users install via npx skills directly:
  npx skills add mitcheman/bodega --yes --global

Then run \`/bodega:setup\` from your IDE (after restarting it so the
new commands register).
`);
}

// Detect "this looks like an AI coding agent shell" — used to decide
// whether to default to non-interactive flags and print the restart
// warning. Heuristics, not exhaustive — false negatives are fine,
// false positives just mean we add safe flags + a useful warning.
function isAgentContext() {
  if (!process.stdout.isTTY) return true;
  const env = process.env;
  return Boolean(
    env.CLAUDECODE ||
      env.CLAUDE_CODE ||
      env.CURSOR_AGENT ||
      env.CODEX_CLI ||
      env.GEMINI_CLI ||
      env.AGENTS_CLI ||
      env.WINDSURF_AGENT,
  );
}

function detectAgentLabel() {
  const env = process.env;
  if (env.CLAUDECODE || env.CLAUDE_CODE) return 'Claude Code';
  if (env.CURSOR_AGENT) return 'Cursor';
  if (env.CODEX_CLI) return 'Codex';
  if (env.GEMINI_CLI) return 'Gemini CLI';
  if (env.WINDSURF_AGENT) return 'Windsurf';
  if (env.AGENTS_CLI) return 'your AI coding agent';
  if (!process.stdout.isTTY) return 'your AI coding agent';
  return null;
}

function install() {
  // Thin wrapper around the upstream `skills` CLI.
  const target = args.find((a) => a.startsWith('--ide='))?.split('=')[1];
  const userPassedYes = args.includes('--yes') || args.includes('-y');
  const userPassedGlobal = args.includes('--global') || args.includes('-g');

  // In an agent / non-TTY context the upstream installer's interactive
  // multi-select picker hangs forever. Auto-add --yes --global unless
  // the user explicitly passed them.
  const agent = isAgentContext();
  const flags = [];
  if (agent && !userPassedYes) flags.push('--yes');
  if (agent && !userPassedGlobal) flags.push('--global');

  const ideFlag = target ? ` --ide=${target}` : '';
  const flagStr = flags.length ? ' ' + flags.join(' ') : '';
  const cmd = `npx skills add mitcheman/bodega${ideFlag}${flagStr}`;

  if (agent && flags.length) {
    console.error(
      `[bodega] Detected non-TTY / agent context — adding ${flags.join(' ')} to skip the interactive picker.`,
    );
  }
  execSync(cmd, { stdio: 'inherit' });

  // Restart warning — bodega is a standard Claude Code plugin and
  // doesn't implement live reload. Tell the user before they try
  // /bodega:setup and find it isn't registered.
  const agentLabel = detectAgentLabel();
  if (agentLabel) {
    console.error('');
    console.error(`[bodega] Install complete.`);
    console.error(
      `[bodega] ${agentLabel} caches its skill registry at startup. To pick up the`,
    );
    console.error(
      `[bodega] new /bodega:setup command, restart ${agentLabel} (or run`,
    );
    console.error(
      `[bodega] \`/plugins reload\` if your build supports it). Then run`,
    );
    console.error(`[bodega] /bodega:setup (or $bodega:setup in Codex).`);
  }
}

function listSkills() {
  const skills = [
    'setup        — First-time setup (the entry point)',
    'doctor       — Preflight check (verify your machine has what Bodega needs)',
    'hosting      — Sign in to Vercel and link a project',
    'payments     — Stripe onboarding + capture keys',
    'deploy       — Scaffold commerce routes and push live',
    'admin        — /studio provisioning + merchant invite',
    'domain       — Buy or connect a custom domain',
    'backup       — Create a private GitHub backup (auto-push)',
    'invite       — Resend a login link or add staff',
    'status       — Report current state of the store',
    'reconfigure  — Change voice or beneficiary',
    '(internal) greenfield-design — Scaffold design via impeccable',
  ];
  console.log('\nBodega skills:\n');
  for (const s of skills) console.log('  ' + s);
  console.log();
}

switch (command) {
  case 'install':
    install();
    break;
  case 'update':
    execSync('npx skills update', { stdio: 'inherit' });
    break;
  case 'skills':
    listSkills();
    break;
  case '--help':
  case '-h':
  case undefined:
    help();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    help();
    process.exit(1);
}
