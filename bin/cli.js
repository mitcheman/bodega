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

Most users don't need this CLI. Install via:
  npx skills add <publisher>/bodega

Then run \`/bodega:setup\` from your IDE.
`);
}

function install() {
  // Thin wrapper around the upstream `skills` CLI from vercel-labs.
  const target = args.find((a) => a.startsWith('--ide='))?.split('=')[1];
  const spec = target ? `<publisher>/bodega --ide=${target}` : '<publisher>/bodega';
  execSync(`npx skills add ${spec}`, { stdio: 'inherit' });
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
