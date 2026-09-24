// Builds the player-facing client packages.
//   (default)    dist/starforge-<channel>-<version>.mrpack
//                Standard Modrinth pack: modrinth.index.json declares every
//                client-side jar (both|client) with downloads+hashes; pack/
//                ships under overrides/. Only the self-built local: addon is
//                embedded — third-party jars are never redistributed.
//                dist/starforge-<channel>-<version>-cn.mrpack
//                Mainland-China-friendly variant: files whose license permits
//                redistribution (per tools/lib/license.mjs, incl. explicit
//                redistribution:"allow" lockfile overrides) are embedded under
//                overrides/ so import doesn't hit foreign API/CDN for them;
//                everything else stays on official downloads. Same standard
//                mrpack format — Prism/HMCL/PCL import it identically.
//   --standard / --cn   build only that variant
//   --local      dist/starforge-<channel>-<version>-local.zip
//                Dev-only instance overlay containing the actual jars. Marked
//                LOCAL TEST ONLY; never a release artifact, never committed.
// Every run also writes dist/THIRD_PARTY_MODS.md (provenance manifest),
// dist/SHA256SUMS.txt (embedded-file checksums) and dist/client-package-report.md.
// Any required mod that cannot be expressed fails the build — we never
// silently drop or substitute a locked mod.
// Usage: node tools/package-client.mjs [--local] [--standard] [--cn]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DIRS, p } from './lib/paths.mjs';
import { checkNode } from './lib/env.mjs';
import {
  loadLock, loadVersion, artifactStem, packVersionId,
  sideMods, sideCounts, CLIENT_ACCEPTS, EXPECTED,
} from './lib/manifest.mjs';
import { ensureLockedJars, backfillSha1 } from './lib/jars.mjs';
import { ensureLockedResources, backfillResourceSha1, enabledResources } from './lib/resources.mjs';
import { hashes } from './lib/hash.mjs';
import { createZip } from './lib/zip.mjs';
import { resolveDownloads, hostKind } from './lib/mrpack-sources.mjs';
import { checkLock, jarVersionWarnings } from './lib/lockcheck.mjs';
import { embedStatus, thirdPartyModsMd, sha256SumsTxt, securityMd } from './lib/license.mjs';

checkNode();
const localOnly = process.argv.includes('--local');
const onlyStandard = process.argv.includes('--standard');
const onlyCn = process.argv.includes('--cn');
const variants = (onlyStandard !== onlyCn) ? [onlyStandard ? 'standard' : 'cn'] : ['standard', 'cn'];
const lock = loadLock();
const version = loadVersion();
const stem = artifactStem(version);
mkdirSync(DIRS.dist, { recursive: true });

// ---- 0. lockfile audit ------------------------------------------------------
const { fatal: lockFatal, warn: lockWarn } = checkLock(lock);
for (const w of lockWarn) console.warn(`WARN ${w}`);
if (lockFatal.length) {
  for (const e of lockFatal) console.error(`FATAL ${e}`);
  console.error('lockfile audit failed — fix manifest/locked-mods.json first');
  process.exit(1);
}

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

// overrides/ carries pack content only — configs, scripts, quest book, lang,
// presets. Binaries and runtime dirs never belong there (jars reach
// overrides/mods/ only through the explicit embed path below, sourced from
// mods/ + the lockfile — never from pack/).
const OVERRIDE_DENY = [/^mods\//i, /^libraries?\//i, /^versions?\//i, /^saves\//i,
  /^logs?\//i, /^crash-reports\//i, /^\.git/i];
const RESOURCE_DIRS = /^(shaderpacks|resourcepacks|datapacks|tacz)\//i;
const KNOWN_TOP = new Set(['config', 'defaultconfigs', 'kubejs', 'shaderpacks',
  'resourcepacks', 'datapacks', 'scripts', 'options.txt', 'servers.dat', 'icon.png']);
const overrideIssues = [];
const overrideWarns = [];
const topSeen = new Set();
for (const f of packFiles) {
  const rel = path.relative(DIRS.pack, f).replace(/\\/g, '/');
  topSeen.add(rel.split('/')[0]);
  if (OVERRIDE_DENY.some((re) => re.test(rel))) {
    overrideIssues.push(`${rel}: path is not pack-owned content`);
  } else if (/\.jar$/i.test(rel)) {
    overrideIssues.push(`${rel}: jars must come from the lockfile, not pack/`);
  } else if (/\.(exe|dll|bat|cmd|ps1|sh|com|scr)$/i.test(rel)) {
    overrideIssues.push(`${rel}: executable/script files are not allowed in overrides`);
  } else if (RESOURCE_DIRS.test(rel) && /\.zip$/i.test(rel)) {
    overrideIssues.push(`${rel}: resource archives ride files[]/embed path with provenance, not pack/`);
  }
}
for (const t of topSeen) {
  if (!KNOWN_TOP.has(t)) overrideWarns.push(`pack/${t}: unusual override top-level — confirm it belongs in the instance`);
}
if (overrideIssues.length) {
  for (const e of overrideIssues) console.error(`FATAL override ${e}`);
  process.exit(1);
}

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
The official player packages are the .mrpack files built by the same tool
without --local (standard + -cn variants), which either download mods from
their official sources on import or embed only redistribution-permitted jars.

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

// ---- 4. resolve downloads once (shared by both variants) --------------------
const ENV = {
  both: { client: 'required', server: 'required' },
  client: { client: 'required', server: 'unsupported' },
};

const resolutions = new Map(); // key -> resolveDownloads result
const fatal = [];              // {key, filename, err}
const needsAttention = [];
const versionWarns = [];

for (const mod of clientMods) {
  const jar = jars.get(mod.key);
  versionWarns.push(...jarVersionWarnings(mod, jar.buf));
  if (mod.download_url?.startsWith('local:')) continue; // self-built, embedded
  const res = await resolveDownloads(mod, hashes(jar.buf));
  if (!res.downloads.length) {
    fatal.push({ key: mod.key, filename: mod.filename, err: 'no usable download URL' });
    continue;
  }
  resolutions.set(mod.key, res);
  if (res.kind === 'curseforge_cdn' && !res.modrinthMirror) needsAttention.push({ mod, res });
  if (res.kind === 'other') needsAttention.push({ mod, res });
}

// ---- 5. assemble one .mrpack per variant (zip written after fatal check) ----
// Per-entry dispositions feed THIRD_PARTY_MODS.md and the package report.
const provRows = new Map(); // key -> {entry, type, primary, dispositions:{}}
const provRow = (entry, type, primary) => {
  let r = provRows.get(entry.key);
  if (!r) provRows.set(entry.key, (r = { entry, type, primary, dispositions: {} }));
  else if (primary) r.primary = primary;
  return r;
};

function buildVariant(variant) {
  const cn = variant === 'cn';
  const files = [];
  const embedded = []; // {path, buf, entry, reason}
  const sums = [];

  const embedEntry = (entry, type, instPath, buf, reason) => {
    const h = hashes(buf);
    embedded.push({ path: instPath, buf, entry, reason });
    sums.push({ path: instPath, sha256: h.sha256 });
    provRow(entry, type, null).dispositions[variant] = { embed: true, reason };
  };
  const remoteEntry = (entry, type, instPath, buf, downloads, env, reason) => {
    const h = hashes(buf);
    files.push({ path: instPath, hashes: { sha1: h.sha1, sha512: h.sha512 },
      env, downloads, fileSize: h.size });
    provRow(entry, type, downloads[0]).dispositions[variant] = { embed: false, reason };
  };

  for (const mod of clientMods) {
    const jar = jars.get(mod.key);
    const instPath = `mods/${mod.filename}`;
    if (mod.download_url?.startsWith('local:')) {
      // Self-built addon (our own source): no download URL exists. Embed the
      // jar under overrides/mods/ — our own mod has no third-party constraint.
      embedEntry(mod, 'mod', instPath, jar.buf,
        `self-built from compat/ in this repo (${mod.license ?? 'MIT'}) — no upstream URL exists`);
      continue;
    }
    const res = resolutions.get(mod.key);
    if (!res) continue; // already recorded in fatal[]
    const st = embedStatus(mod);
    if (!cn && mod.embed_reason) {
      // Standard variant: a platform-downloadable jar may be embedded only with
      // an explicit lockfile embed_reason — and only when redistribution is
      // actually permitted. Embedding without justification is a build error.
      if (!st.embed) {
        fatal.push({ key: mod.key, filename: mod.filename,
          err: `embed_reason set but redistribution not permitted (${st.basis}: ${st.reason})` });
        continue;
      }
      embedEntry(mod, 'mod', instPath, jar.buf, mod.embed_reason);
      continue;
    }
    if (cn && st.embed) {
      embedEntry(mod, 'mod', instPath, jar.buf, st.reason);
      continue;
    }
    const reason = cn ? st.reason
      : (res.modrinthMirror ? 'downloaded from official source (Modrinth mirror preferred)'
                          : 'downloaded from official source');
    remoteEntry(mod, 'mod', instPath, jar.buf, res.downloads, ENV[mod.side], reason);
  }

  // Non-mod resources (shaderpacks, gun packs) — same embed/remote decision by
  // license; remote entries land at their real instance path so launchers
  // fetch them from the official URL.
  for (const res of clientResources) {
    const buf = resFiles.get(res.key).buf;
    const env = { client: 'required', server: res.side === 'both' ? 'required' : 'unsupported' };
    const st = embedStatus(res);
    if (cn && st.embed) {
      embedEntry(res, res.type ?? 'resource', res.path, buf, st.reason);
      continue;
    }
    remoteEntry(res, res.type ?? 'resource', res.path, buf, [res.download_url], env,
      cn ? st.reason : 'downloaded from official source');
  }

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

  const provMd = thirdPartyModsMd({
    packName: `${EXPECTED.name} / ${EXPECTED.nameZh}`,
    versionId: packVersionId(version), minecraft: EXPECTED.minecraft, neoforge: EXPECTED.neoforge,
    variants: [variant],
    rows: [...provRows.values()].map((r) => ({ ...r, dispositions: { [variant]: r.dispositions[variant] } })),
  });
  const entries = [
    { name: 'modrinth.index.json', data: Buffer.from(JSON.stringify(index, null, 2), 'utf8') },
    { name: 'THIRD_PARTY_MODS.md', data: Buffer.from(provMd, 'utf8') },
    { name: 'SHA256SUMS.txt', data: Buffer.from(sha256SumsTxt(sums), 'utf8') },
    { name: 'SECURITY.md', data: Buffer.from(securityMd({
      packName: `${EXPECTED.name} / ${EXPECTED.nameZh}`, versionId: packVersionId(version),
      variant, embeddedCount: embedded.length, remoteCount: files.length }), 'utf8') },
  ];
  if (!packFiles.length && !embedded.length) entries.push({ name: 'overrides/.keep', data: Buffer.alloc(0) });
  for (const f of packFiles) {
    entries.push({ name: `overrides/${path.relative(DIRS.pack, f).replace(/\\/g, '/')}`, data: readFileSync(f) });
  }
  for (const e of embedded) {
    entries.push({ name: `overrides/${e.path}`, data: e.buf, compress: false });
  }
  return { variant, out: p('dist', `${stem}${cn ? '-cn' : ''}.mrpack`), files, embedded, sums, entries };
}

const built = variants.map(buildVariant);

// ---- 6. generated provenance artifacts in dist/ ------------------------------
const distProv = thirdPartyModsMd({
  packName: `${EXPECTED.name} / ${EXPECTED.nameZh}`,
  versionId: packVersionId(version), minecraft: EXPECTED.minecraft, neoforge: EXPECTED.neoforge,
  variants: built.map((b) => b.variant),
  rows: [...provRows.values()],
});
writeFileSync(p('dist', 'THIRD_PARTY_MODS.md'), distProv);
const allSums = new Map();
for (const b of built) for (const s of b.sums) allSums.set(s.path, s.sha256);
writeFileSync(p('dist', 'SHA256SUMS.txt'),
  sha256SumsTxt([...allSums.entries()].map(([path, sha256]) => ({ path, sha256 }))));

// ---- 7. client package report -----------------------------------------------
const srcStats = {};
for (const [, res] of resolutions) srcStats[res.kind] = (srcStats[res.kind] ?? 0) + 1;
const mirrors = [...resolutions.values()].filter((r) => r.modrinthMirror).length;
const embeddedSummary = built.map((b) =>
  `${b.variant}: ${b.embedded.length} embedded (${b.embedded.filter((e) => e.path.startsWith('mods/')).length} mods), ${b.files.length} remote`).join(' · ');

const report = `# Starforge client package report

- Pack: ${EXPECTED.name} / ${EXPECTED.nameZh} — version \`${packVersionId(version)}\` (${stem})
- Minecraft ${EXPECTED.minecraft} · NeoForge ${EXPECTED.neoforge} · Java ${EXPECTED.java}
- Variants built: ${built.map((b) => `\`${path.basename(b.out)}\``).join(', ')}
- Client set = both ${counts.both} + client ${counts.client}; server-only ${counts.server} excluded
- ${embeddedSummary}
- Source of remote downloads: ${Object.entries(srcStats).map(([k, n]) => `${k}:${n}`).join(', ') || 'none'}
- Entries whose primary URL was switched to a hash-identical Modrinth mirror: ${mirrors}
- Overrides shipped: ${packFiles.length} files from pack/ (config, kubejs incl. client scripts)

## Per-mod resolution

| mod | version | side | primary host | mirrors | license |${built.map((b) => ` ${b.variant} |`).join('')}
| --- | --- | --- | --- | --- | --- |${built.map(() => ' --- |').join('')}
${[...provRows.values()].map(({ entry: m, primary, dispositions }) =>
  `| ${m.name} | ${m.version} | ${m.side} | ${hostKind(primary ?? m.download_url ?? '')} | ${(resolutions.get(m.key)?.downloads.length ?? 1) - 1} | ${m.license ?? 'unknown'} |` +
  built.map((b) => {
    const d = dispositions[b.variant];
    return d ? ` ${d.embed ? 'embedded' : 'remote'} |` : ' — |';
  }).join('')).join('\n')}

## Mods needing manual attention

${needsAttention.length === 0 && fatal.length === 0 ? 'None — every file resolved to a fetchable official URL.' : ''}
${needsAttention.map(({ mod, res }) =>
`- **${mod.name}** ${mod.version} (\`${mod.filename}\`)
  - current source: ${mod.download_url}
  - license: ${mod.license ?? 'unknown'}
  - issue: ${res.note}
  - identical Modrinth alternative: ${res.modrinthMirror ?? 'none found'}
  - manual action: ${res.kind === 'curseforge_cdn' ? 'confirm CurseForge third-party distribution terms, or accept CDN hotlink' : 'review source'}`).join('\n')}
${fatal.map((f) =>
`- **${f.key}** (\`${f.filename}\`) — FATAL: ${f.err}; .mrpack withheld from dist/.`).join('\n')}

## Lockfile audit

- fatal: ${lockFatal.length} (build aborts when > 0)
- warnings:
${lockWarn.length ? lockWarn.map((w) => `  - ${w}`).join('\n') : '  - none'}
- jar version consistency (mods.toml vs lockfile):
${versionWarns.length ? versionWarns.map((w) => `  - WARN ${w}`).join('\n') : '  - all literal jar versions agree'}
- override hygiene warnings:
${overrideWarns.length ? overrideWarns.map((w) => `  - ${w}`).join('\n') : '  - none'}
`;
writeFileSync(p('dist', 'client-package-report.md'), report);

if (fatal.length) {
  for (const f of fatal) console.error(`FATAL ${f.key} (${f.filename}): ${f.err}`);
  console.error(`${fatal.length} problem(s) — .mrpack withheld; see dist/client-package-report.md`);
  process.exit(1);
}

// ---- 8. write the .mrpack zips -----------------------------------------------
for (const b of built) {
  writeFileSync(b.out, createZip(b.entries));
  console.log(`wrote ${b.out}`);
  console.log(`  ${b.files.length} remote files declared, ${b.embedded.length} embedded, overrides: ${packFiles.length} pack files`);
}
console.log(`  mirrors to Modrinth: ${mirrors}; provenance -> dist/THIRD_PARTY_MODS.md + dist/SHA256SUMS.txt`);
if (needsAttention.length) {
  console.log(`  ${needsAttention.length} mods need manual attention — see dist/client-package-report.md`);
}
if (lockWarn.length + versionWarns.length + overrideWarns.length) {
  console.log(`  ${lockWarn.length + versionWarns.length + overrideWarns.length} audit warning(s) — see dist/client-package-report.md`);
}
