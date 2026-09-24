// Builds a distributable Alpha source/config archive into dist/. Third-party
// mod jars are NOT included (license-safe): recipients run
// tools/setup-server.mjs, which downloads every jar from its official source
// per manifest/locked-mods.json. The lockfile is audited first — duplicated
// entries, missing licenses or unknown sources abort the build. A generated
// THIRD_PARTY_MODS.md provenance manifest rides at the zip root.
// Uses the in-repo zip writer so the output is a real ZIP on every platform
// (a bare `tar -acf` under Git Bash produces a tar file with a .zip name).
// Usage: node tools/package.mjs [name]
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createZip } from './lib/zip.mjs';
import { checkLock } from './lib/lockcheck.mjs';
import { thirdPartyModsMd } from './lib/license.mjs';
import { loadVersion, packVersionId, enabledMods, EXPECTED } from './lib/manifest.mjs';
import { enabledResources } from './lib/resources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(path.join(root, 'manifest/locked-mods.json'), 'utf8'));
const name = process.argv[2] ?? `starforge-alpha-mc${lock.minecraft}-nf${lock.neoforge_version}`;
const dist = path.join(root, 'dist');
mkdirSync(dist, { recursive: true });
const out = path.join(dist, `${name}.zip`);
if (existsSync(out)) rmSync(out);

const { fatal: lockFatal, warn: lockWarn } = checkLock(lock);
for (const w of lockWarn) console.warn(`WARN ${w}`);
if (lockFatal.length) {
  for (const e of lockFatal) console.error(`FATAL ${e}`);
  process.exit(1);
}

const include = ['manifest', 'pack', 'tools', 'docs', 'design', 'localization',
  'registry-export', 'compat', 'README.md', 'LICENSE'];

const SKIP_DIRS = new Set(['build', 'node_modules']); // gitignored build outputs

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(full);
    } else yield full;
  }
}

const entries = [];
for (const item of include) {
  const abs = path.join(root, item);
  if (!existsSync(abs)) continue;
  if (statSync(abs).isDirectory()) {
    for (const f of walk(abs)) {
      if (f.endsWith('.jar')) continue; // never embed third-party jars
      entries.push({ name: path.relative(root, f).replace(/\\/g, '/'), data: readFileSync(f) });
    }
  } else {
    entries.push({ name: item, data: readFileSync(abs) });
  }
}

// Provenance manifest for every locked third-party file (no jars embedded —
// dispositions intentionally omitted; sources stay canonical).
const version = loadVersion();
const provRows = [
  ...enabledMods(lock).map((m) => ({ entry: m, type: 'mod' })),
  ...enabledResources(lock).map((r) => ({ entry: r, type: r.type ?? 'resource' })),
];
entries.push({ name: 'THIRD_PARTY_MODS.md', data: Buffer.from(thirdPartyModsMd({
  packName: `${EXPECTED.name} / ${EXPECTED.nameZh}`,
  versionId: packVersionId(version), minecraft: EXPECTED.minecraft, neoforge: EXPECTED.neoforge,
  variants: [], rows: provRows,
}), 'utf8') });

writeFileSync(out, createZip(entries));
console.log(`wrote ${out} (${entries.length} entries)`);
