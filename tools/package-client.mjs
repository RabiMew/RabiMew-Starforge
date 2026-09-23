// Builds the player-facing client package.
//   (default)  dist/starforge-<channel>-<version>.mrpack
//              Standard Modrinth pack format: modrinth.index.json declares
//              every client-side jar (both|client) with downloads+hashes; the
//              pack/ overlay ships under overrides/. Importable by
//              Prism Launcher, HMCL and PCL — no launcher-private formats.
//   --local    dist/starforge-<channel>-<version>-local.zip
//              Dev-only instance overlay containing the actual jars. Marked
//              LOCAL TEST ONLY; never a release artifact, never committed.
// Any required mod that cannot be expressed in modrinth.index.json fails the
// build — we never silently drop or substitute a locked mod.
// Usage: node tools/package-client.mjs [--local]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DIRS, ROOT, p } from './lib/paths.mjs';
import { checkNode } from './lib/env.mjs';
import {
  loadLock, saveLock, loadVersion, artifactStem, packVersionId,
  sideMods, sideCounts, CLIENT_ACCEPTS, EXPECTED,
} from './lib/manifest.mjs';
import { ensureLockedJars, backfillSha1 } from './lib/jars.mjs';
import { ensureLockedResources, backfillResourceSha1, enabledResources } from './lib/resources.mjs';
import { hashes } from './lib/hash.mjs';
import { createZip } from './lib/zip.mjs';
import { resolveDownloads, hostKind } from './lib/mrpack-sources.mjs';

checkNode();
const localOnly = process.argv.includes('--local');
const lock = loadLock();
const version = loadVersion();
const stem = artifactStem(version);
mkdirSync(DIRS.dist, { recursive: true });

// ---- 1. jars: present + hash-verified against the lockfile -----------------
const { jars, errors } = await ensureLockedJars(lock);
const { files: resFiles, errors: resErrors } = await ensureLockedResources(lock);
const fetchErrors = [...errors, ...resErrors];
if (fetchErrors.length) {
  for (const e of fetchErrors) console.error(`FAIL ${e}`);
  process.exit(1);
}
backfillSha1(lock); // persists real sha1s so future builds are reproducible
backfillResourceSha1(lock, resFiles);
// Client-side resource set: side=client plus side=both (gun packs are needed
// client-side for assets AND server-side for data/recipes).
const clientResources = enabledResources(lock).filter((r) => r.side === 'client' || r.side === 'both');

const clientMods = sideMods(lock, CLIENT_ACCEPTS);
const serverMods = sideMods(lock, ['server']);
const counts = sideCounts(lock);

// ---- 2. gather override entries from pack/ (our own files only) ------------
function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}
const packFiles = existsSync(DIRS.pack) ? [...walk(DIRS.pack)] : [];

// ---- 3. local dev zip -------------------------------------------------------
if (localOnly) {
  const entries = [];
  for (const f of packFiles) {
    entries.push({ name: path.relative(DIRS.pack, f).replace(/\\/g, '/'), data: readFileSync(f) });
  }
  for (const mod of clientMods) {
    entries.push({ name: `mods/${mod.filename}`, data: jars.get(mod.key).buf, compress: false });
  }
  for (const res of clientResources) {
    entries.push({ name: res.path, data: resFiles.get(res.key).buf, compress: false });
  }
  const marker =
`RabiMew's Starforge / 星铸 — LOCAL TEST ONLY
=============================================
This archive is for project developers' local testing. It CONTAINS third-party
mod jars copied from this machine's mods/ directory. That does NOT grant any
redistribution rights — every jar remains under its own license.

DO NOT upload this file to GitHub Releases or share it publicly.
The official player package is the .mrpack built by the same tool without
--local, which downloads mods from their official sources on import.

Pack version: ${packVersionId(version)}  (Minecraft ${lock.minecraft}, NeoForge ${lock.neoforge_version})
`;
  entries.push({ name: 'LOCAL_TEST_ONLY.txt', data: Buffer.from(marker, 'utf8'), compress: false });
  entries.push({ name: 'LOCAL_README.txt', data: Buffer.from(
`How to use (developers only):
1. Create a Minecraft ${lock.minecraft} + NeoForge ${lock.neoforge_version} instance
   in Prism Launcher / HMCL / PCL.
2. Unzip this archive into the instance's .minecraft directory (mods/, config/,
   kubejs/ merge into place).
3. Launch.

This zip contains third-party jars for local testing only — see LOCAL_TEST_ONLY.txt.
`, 'utf8'), compress: false });

  const out = p('dist', `${stem}-local.zip`);
  writeFileSync(out, createZip(entries));
  console.log(`wrote ${out} (${clientMods.length} jars + ${clientResources.length} resources embedded — LOCAL TEST ONLY)`);
  process.exit(0);
}

// ---- 4. modrinth.index.json files[] ----------------------------------------
const ENV = {
  both: { client: 'required', server: 'required' },
  client: { client: 'required', server: 'unsupported' },
};

const files = [];
const reportRows = [];
const needsAttention = [];
const fatal = [];
const embeddedMods = [];

for (const mod of clientMods) {
  const jar = jars.get(mod.key);
  const h = hashes(jar.buf);
  if (mod.download_url?.startsWith('local:')) {
    // Self-built addon (our own source): no download URL exists. Embed the jar
    // under overrides/mods/ — mrpack allows files there, and our own mod has no
    // third-party redistribution constraint.
    embeddedMods.push({ mod, buf: jar.buf });
    reportRows.push({ mod, res: { downloads: [], primary: mod.download_url, kind: 'local_build', modrinthMirror: null, note: 'self-built jar embedded under overrides/mods/' } });
    continue;
  }
  const res = await resolveDownloads(mod, h);
  if (!res.downloads.length) {
    fatal.push(mod);
    continue;
  }
  files.push({
    path: `mods/${mod.filename}`,
    hashes: { sha1: h.sha1, sha512: h.sha512 },
    env: ENV[mod.side],
    downloads: res.downloads,
    fileSize: h.size,
  });
  reportRows.push({ mod, res });
  if (res.kind === 'curseforge_cdn' && !res.modrinthMirror) needsAttention.push({ mod, res });
  if (res.kind === 'other') needsAttention.push({ mod, res });
}

// Non-mod resources (shaderpacks, gun packs) — declared at their real instance
// path so launchers download them from the official URL instead of us embedding
// the archive. env marks server=required for side=both (tacz/ gun packs belong
// on the dedicated server too), unsupported for client-only shaderpacks.
for (const res of clientResources) {
  const buf = resFiles.get(res.key).buf;
  const h = hashes(buf);
  files.push({
    path: res.path,
    hashes: { sha1: h.sha1, sha512: h.sha512 },
    env: { client: 'required', server: res.side === 'both' ? 'required' : 'unsupported' },
    downloads: [res.download_url],
    fileSize: h.size,
  });
  reportRows.push({ mod: res, res: { downloads: [res.download_url], primary: res.download_url, kind: res.distribution ?? hostKind(res.download_url), modrinthMirror: null, note: null } });
}

// server-only mods are never declared in the client index.
const index = {
  formatVersion: 1,
  game: 'minecraft',
  versionId: packVersionId(version),
  name: EXPECTED.name,
  summary: EXPECTED.summary,
  files,
  dependencies: {
    minecraft: EXPECTED.minecraft,
    neoforge: EXPECTED.neoforge,
  },
};

// ---- 5. client package report ----------------------------------------------
const srcStats = {};
for (const { res } of reportRows) srcStats[res.kind] = (srcStats[res.kind] ?? 0) + 1;
const mirrors = reportRows.filter((r) => r.res.modrinthMirror).length;

let report = `# Starforge client package report

- Pack: ${EXPECTED.name} / ${EXPECTED.nameZh} — version \`${packVersionId(version)}\` (${stem})
- Minecraft ${EXPECTED.minecraft} · NeoForge ${EXPECTED.neoforge} · Java ${EXPECTED.java}
- Files in modrinth.index.json: ${files.length} (client set = both ${counts.both} + client ${counts.client}; server-only ${counts.server} excluded)
- Source of declared downloads: ${Object.entries(srcStats).map(([k, n]) => `${k}:${n}`).join(', ')}
- Entries whose primary URL was switched to a hash-identical Modrinth mirror: ${mirrors}
- Overrides shipped: ${packFiles.length} files from pack/ (config, kubejs incl. client scripts) + ${embeddedMods.length} embedded self-built jar(s) under overrides/mods/
${embeddedMods.length ? `- Embedded self-built mods (no download URL by design): ${embeddedMods.map((m) => `${m.mod.name} ${m.mod.version} (\`${m.mod.filename}\`)`).join(', ')}` : ''}

## Per-mod resolution

| mod | version | side | primary host | mirrors | license |
| --- | --- | --- | --- | --- | --- |
${reportRows.map(({ mod, res }) =>
  `| ${mod.name} | ${mod.version} | ${mod.side} | ${hostKind(res.primary)} | ${res.downloads.length - 1} | ${mod.license ?? 'unknown'} |`).join('\n')}

## Mods needing manual attention

${needsAttention.length === 0 && fatal.length === 0 ? 'None — every file resolved to a fetchable official URL.' : ''}
${needsAttention.map(({ mod, res }) =>
`- **${mod.name}** ${mod.version} (\`${mod.filename}\`)
  - current source: ${mod.download_url}
  - license: ${mod.license ?? 'unknown'}
  - issue: ${res.note}
  - identical Modrinth alternative: ${res.modrinthMirror ?? 'none found'}
  - manual action: ${res.kind === 'curseforge_cdn' ? 'confirm CurseForge third-party distribution terms, or accept CDN hotlink' : 'review source'}`).join('\n')}
${fatal.map((mod) =>
`- **${mod.name}** ${mod.version} (\`${mod.filename}\`) — FATAL: no usable download URL; .mrpack would be incomplete.`).join('\n')}
`;
writeFileSync(p('dist', 'client-package-report.md'), report);

if (fatal.length) {
  console.error(`FATAL: ${fatal.length} required mods have no usable download for .mrpack — see dist/client-package-report.md`);
  process.exit(1);
}

// ---- 6. write the .mrpack ---------------------------------------------------
const entries = [
  { name: 'modrinth.index.json', data: Buffer.from(JSON.stringify(index, null, 2), 'utf8') },
];
if (!packFiles.length) entries.push({ name: 'overrides/.keep', data: Buffer.alloc(0) });
for (const f of packFiles) {
  entries.push({ name: `overrides/${path.relative(DIRS.pack, f).replace(/\\/g, '/')}`, data: readFileSync(f) });
}
for (const { mod, buf } of embeddedMods) {
  entries.push({ name: `overrides/mods/${mod.filename}`, data: buf, compress: false });
}
const out = p('dist', `${stem}.mrpack`);
writeFileSync(out, createZip(entries));
console.log(`wrote ${out}`);
console.log(`  ${files.length} files declared (${mirrors} mirrored to Modrinth), overrides: ${packFiles.length} files + ${embeddedMods.length} embedded jars`);
if (needsAttention.length) {
  console.log(`  ${needsAttention.length} mods need manual attention — see dist/client-package-report.md`);
}
