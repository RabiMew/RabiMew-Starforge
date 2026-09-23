// Bootstraps the Starforge dev client staging dir (run/client):
//   1. verify Node >= 20 and locate Java 21
//   2. validate design + rebuild pack/ outputs
//   3. fetch locked mod jars (lockfile-pinned, hash-verified)
//   4. sync mods by side into run/client/mods — both+client only, NEVER server
//   5. sync the pack overlay (configs, kubejs, generated assets)
// run/client is a dev staging area: the shippable client is the .mrpack built
// by tools/package-client.mjs and imported into Prism/HMCL/PCL, which install
// NeoForge themselves.
// Usage: node tools/setup-client.mjs
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { checkNode, findJava21 } from './lib/env.mjs';
import { runNode } from './lib/run.mjs';
import { loadLock, sideMods, CLIENT_ACCEPTS } from './lib/manifest.mjs';
import { DIRS } from './lib/paths.mjs';

const node = checkNode();
const javaExe = findJava21();
console.log(`node ${node} / java 21 ok`);

runNode('tools/validate-design.mjs');
runNode('tools/build-pack.mjs');
runNode('tools/fetch-mods.mjs', ['--locked']);
runNode('tools/sync-mods.mjs', ['client']);
runNode('tools/sync-pack.mjs', ['client']);

// Hard guard: no side=server jar may land in the client dir.
const lock = loadLock();
const serverFiles = new Set(
  lock.mods.filter((m) => m.enabled !== false && m.side === 'server').map((m) => m.filename));
const installed = readdirSync(path.join(DIRS.runClient, 'mods')).filter((f) => f.endsWith('.jar'));
const leaked = installed.filter((f) => serverFiles.has(f));
if (leaked.length) {
  console.error(`server-only mods leaked into run/client/mods: ${leaked.join(', ')}`);
  process.exit(1);
}
const expected = sideMods(lock, CLIENT_ACCEPTS).length;
if (installed.length !== expected) {
  console.error(`run/client/mods: expected ${expected} jars, found ${installed.length}`);
  process.exit(1);
}
// Locked client resources (shaderpacks etc.) must have landed at their
// declared instance path — synced by sync-mods.mjs from build/resources/.
for (const res of (lock.resources ?? []).filter((r) => r.enabled !== false && (r.side === 'client' || r.side === 'both'))) {
  if (!existsSync(path.join(DIRS.runClient, ...res.path.split('/')))) {
    console.error(`missing client resource: ${res.path} (run fetch-mods --locked then sync-mods client)`);
    process.exit(1);
  }
}
console.log(`\nrun/client ready: ${installed.length} mods (both+client, no server-only).`);
console.log('Shippable pack: node tools/package-client.mjs -> dist/*.mrpack');
