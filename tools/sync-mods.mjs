// Copies locked mod jars into run/server/mods and run/client/mods by side.
// Locked non-mod resources land at their declared instance path per side:
//   side=client -> run/client only, side=server -> run/server only,
//   side=both   -> both (e.g. TaCZ gun packs in tacz/ — the dedicated server
//   needs the gun data just as much as the client needs the assets).
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

function syncResources(sideName, accepts) {
  const list = (lock.resources ?? []).filter((r) => r.enabled !== false && accepts.includes(r.side));
  const keepByTopDir = new Map(); // e.g. 'tacz' -> Set(filenames)
  for (const res of list) {
    const src = path.join(resDir, res.filename);
    if (!existsSync(src)) throw new Error(`missing resource ${res.filename} — run tools/fetch-mods.mjs`);
    const dest = path.join(root, 'run', sideName, ...res.path.split('/'));
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    const top = res.path.split('/')[0];
    if (!keepByTopDir.has(top)) keepByTopDir.set(top, new Set());
    keepByTopDir.get(top).add(res.filename);
  }
  // Drop stale archives no longer locked (only *.zip we could have placed —
  // extracted pack dirs like tacz/tacz_default_gun are the game's own).
  for (const [top, keep] of keepByTopDir) {
    const dir = path.join(root, 'run', sideName, top);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.zip') || keep.has(f)) continue;
      // TaCZ Pack Upgrader rewrites packs in place as <stem>+1.21.1.zip — keep it.
      const upgraded = [...keep].some((k) => f.startsWith(k.replace(/\.zip$/i, '') + '+'));
      if (!upgraded) rmSync(path.join(dir, f));
    }
  }
  if (list.length) console.log(`${sideName}: ${list.length} locked resources synced`);
}

if (target === 'server' || target === 'all') { sync('server', ['both', 'server']); syncResources('server', ['both', 'server']); }
if (target === 'client' || target === 'all') { sync('client', ['both', 'client']); syncResources('client', ['both', 'client']); }
