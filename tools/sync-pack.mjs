// Syncs the committed pack/ overlay into run/server (and run/client).
// pack/ is the single source of truth for configs, kubejs, datapacks, resourcepacks.
// Usage: node tools/sync-pack.mjs [server|client|all]
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const packDir = path.join(root, 'pack');
const target = process.argv[2] ?? 'all';

// Entries that are client-only (render/UI); skipped on dedicated server.
const CLIENT_ONLY = new Set([
  'kubejs/client_scripts',
]);

function copyTree(src, dest, skipPrefixes) {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const rel = path.relative(packDir, path.join(src, entry.name));
    if (skipPrefixes.has(rel.replace(/\\/g, '/'))) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) { mkdirSync(d, { recursive: true }); copyTree(s, d, skipPrefixes); }
    else cpSync(s, d);
  }
}

// Directories the pack fully owns — wipe stale contents before copying
// (e.g. ProgressiveStages auto-generates showcase stages we must remove).
const OWNED_DIRS = ['config/progressivestages/stages'];

function sync(side) {
  const dest = path.join(root, 'run', side);
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const owned of OWNED_DIRS) {
    const p = path.join(dest, ...owned.split('/'));
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
  const skip = side === 'server' ? CLIENT_ONLY : new Set();
  copyTree(packDir, dest, skip);
  console.log(`synced pack/ -> run/${side}`);
}

if (!existsSync(packDir)) { console.log('pack/ does not exist yet'); process.exit(0); }
if (target === 'server' || target === 'all') sync('server');
if (target === 'client' || target === 'all') sync('client');
