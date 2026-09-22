// Copies locked mod jars into run/server/mods and run/client/mods by side.
// Client runs also receive locked non-mod resources (shaderpacks/...) from
// build/resources/ at their declared instance path. Servers get neither.
// Usage: node tools/sync-mods.mjs [server|client|all]
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(path.join(root, 'manifest/locked-mods.json'), 'utf8'));
const modsDir = path.join(root, 'mods');
const resDir = path.join(root, 'build', 'resources');
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

function syncClientResources() {
  const list = (lock.resources ?? []).filter((r) => r.enabled !== false && r.side === 'client');
  for (const res of list) {
    const src = path.join(resDir, res.filename);
    if (!existsSync(src)) throw new Error(`missing resource ${res.filename} — run tools/fetch-mods.mjs`);
    const dest = path.join(root, 'run', 'client', ...res.path.split('/'));
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
  // drop stale resources no longer locked (wipe dirs we own)
  const shaderDir = path.join(root, 'run', 'client', 'shaderpacks');
  if (existsSync(shaderDir)) {
    const keep = new Set(list.filter((r) => r.path.startsWith('shaderpacks/')).map((r) => r.filename));
    for (const f of readdirSync(shaderDir)) {
      if (f.endsWith('.zip') && !keep.has(f)) rmSync(path.join(shaderDir, f));
    }
  }
  if (list.length) console.log(`client: ${list.length} locked resources synced`);
}

if (target === 'server' || target === 'all') sync('server', ['both', 'server']);
if (target === 'client' || target === 'all') { sync('client', ['both', 'client']); syncClientResources(); }
