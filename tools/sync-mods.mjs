// Copies locked mod jars into run/server/mods and run/client/mods by side.
// Usage: node tools/sync-mods.mjs [server|client|all]
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(path.join(root, 'manifest/locked-mods.json'), 'utf8'));
const modsDir = path.join(root, 'mods');
const target = process.argv[2] ?? 'all';

function sync(sideName, accepts) {
  const dest = path.join(root, 'run', sideName, 'mods');
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(dest)) rmSync(path.join(dest, f));
  let n = 0;
  for (const mod of lock.mods) {
    if (!mod.enabled) continue;
    if (!accepts.includes(mod.side)) continue;
    const src = path.join(modsDir, mod.filename);
    if (!existsSync(src)) throw new Error(`missing jar ${mod.filename} — run tools/fetch-mods.mjs`);
    copyFileSync(src, path.join(dest, mod.filename));
    n++;
  }
  console.log(`${sideName}: ${n} mods`);
}

if (target === 'server' || target === 'all') sync('server', ['both', 'server']);
if (target === 'client' || target === 'all') sync('client', ['both', 'client']);
