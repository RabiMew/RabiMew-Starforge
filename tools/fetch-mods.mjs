// Resolves manifest/mod-list.json to real files, downloads them, hashes them,
// and writes manifest/locked-mods.json. Jars land in mods/ (gitignored).
// Usage: node tools/fetch-mods.mjs [--check|--locked|--only k1,k2]
//   (default)  re-resolve every source and rewrite locked-mods.json
//   --check    re-resolve but only verify jars exist; does NOT rewrite the lockfile
//   --locked   no resolution: download missing jars from the lockfile's pinned
//              download_url, verify size+sha256+sha512, backfill sha1
//   --only k   resolve just the listed mod-list keys, merge them into the
//              existing lockfile, and drop lock entries absent from mod-list.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ensureLockedJars, backfillSha1 } from './lib/jars.mjs';
import { ensureLockedResources, backfillResourceSha1 } from './lib/resources.mjs';
import { verifyLocked } from './lib/hash.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const listPath = path.join(root, 'manifest/mod-list.json');
const lockPath = path.join(root, 'manifest/locked-mods.json');
const modsDir = path.join(root, 'mods');
const resDir = path.join(root, 'build', 'resources');
const checkOnly = process.argv.includes('--check');
const lockedMode = process.argv.includes('--locked');
const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.slice(7)
  ?? (process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null);
const onlySet = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim()).filter(Boolean)) : null;
const list = JSON.parse(readFileSync(listPath, 'utf8'));
mkdirSync(modsDir, { recursive: true });

if (lockedMode) {
  // Lockfile-pinned mode: fetch the exact files the lockfile declares, verify
  // every hash, backfill sha1. Never re-resolves upstream versions.
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const { jars, errors } = await ensureLockedJars(lock);
  const { files, errors: resErrors } = await ensureLockedResources(lock, { downloadMissing: errors.length === 0 });
  const all = [...errors, ...resErrors];
  if (all.length) {
    for (const e of all) console.error(`FAIL ${e}`);
    process.exit(1);
  }
  const n = backfillSha1(lock, jars);
  const rn = backfillResourceSha1(lock, files);
  console.log(`locked: ${jars.size} mods + ${files.size} resources verified` +
    (n + rn ? `, backfilled sha1 on ${n + rn}` : ''));
  process.exit(0);
}

const HEADERS = { 'User-Agent': 'RabiMew-Starforge/modpack-dev (github.com/RabiMew/RabiMew-Starforge)' };

async function jget(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

// ---- resolvers: return {version, filename, url, page, license, deps:[{key?,slug?}]} ----
async function resolveModrinth(src) {
  const params = 'loaders=%5B%22neoforge%22%5D&game_versions=%5B%221.21.1%22%5D';
  const versions = await jget(`https://api.modrinth.com/v2/project/${src.slug}/version?${params}`);
  if (!versions.length) throw new Error(`modrinth:${src.slug}: no 1.21.1/neoforge file`);
  const rank = { release: 0, beta: 1, alpha: 2 };
  versions.sort((a, b) =>
    (rank[a.version_type] ?? 3) - (rank[b.version_type] ?? 3) ||
    new Date(b.date_published) - new Date(a.date_published));
  const v = src.version_prefix
    ? versions.find((x) => x.version_number.startsWith(src.version_prefix))
    : versions[0];
  if (!v) throw new Error(`modrinth:${src.slug}: no version matching prefix ${src.version_prefix}`);
  const file = v.files.find((f) => f.primary) ?? v.files[0];
  const project = await jget(`https://api.modrinth.com/v2/project/${src.slug}`);
  const deps = [];
  for (const d of v.dependencies ?? []) {
    if (d.dependency_type !== 'required' || !d.project_id) continue;
    const dep = await jget(`https://api.modrinth.com/v2/project/${d.project_id}`).catch(() => null);
    deps.push({ source: 'modrinth', slug: dep?.slug ?? d.project_id });
  }
  return { version: v.version_number, filename: file.filename, url: file.url,
    page: `https://modrinth.com/mod/${project.slug}`, license: project.license?.id ?? 'unknown',
    deps, distribution: 'modrinth_cdn' };
}

async function resolveCurseForge(src) {
  // cfwidget: key-free JSON mirror of the CurseForge file list.
  const j = await jget(`https://api.cfwidget.com/minecraft/mc-mods/${src.slug}`);
  const want = (f) => {
    const vs = (f.versions ?? []).map((x) => x.toLowerCase());
    return vs.includes('1.21.1') && vs.includes('neoforge');
  };
  const file = (j.files ?? []).find(want);
  if (!file) throw new Error(`curseforge:${src.slug}: no 1.21.1/neoforge file in widget list`);
  const url = `https://mediafilez.forgecdn.net/files/${Math.floor(file.id / 1000)}/${file.id % 1000}/${encodeURIComponent(file.name)}`;
  return { version: (file.name.match(/(\d+\.\d+[\w.\-]*)/) ?? [null, 'unknown'])[1],
    filename: file.name, url, page: `https://www.curseforge.com/minecraft/mc-mods/${src.slug}`,
    license: 'unknown-cf', deps: [], distribution: 'curseforge_cdn', cfFileId: file.id };
}

async function resolveGithub(src) {
  const rels = await jget(`https://api.github.com/repos/${src.repo}/releases?per_page=30`);
  const rel = rels.find((r) => r.tag_name === src.tag || r.name === src.tag);
  if (!rel) throw new Error(`github:${src.repo}: release ${src.tag} not found`);
  const re = new RegExp(src.asset);
  const asset = rel.assets.find((a) => re.test(a.name));
  if (!asset) throw new Error(`github:${src.repo}@${src.tag}: asset ${src.asset} not found`);
  return { version: src.tag, filename: asset.name, url: asset.browser_download_url,
    page: rel.html_url, license: 'see-repo', deps: [], distribution: 'github_release' };
}

async function resolveFtbMaven(src) {
  const base = `https://maven.ftb.dev/releases/dev/ftb/mods/${src.artifact}`;
  const meta = await (await fetch(`${base}/maven-metadata.xml`, { headers: HEADERS })).text();
  const version = src.version ?? meta.match(/<latest>([^<]+)</)?.[1];
  if (!version) throw new Error(`ftbmaven:${src.artifact}: no <latest>`);
  return { version, filename: `${src.artifact}-${version}.jar`,
    url: `${base}/${version}/${src.artifact}-${version}.jar`,
    page: `https://maven.ftb.dev/#/releases/dev/ftb/mods/${src.artifact}`,
    license: 'see-repo', deps: [], distribution: 'ftb_maven' };
}

// Non-mod resources (shaderpacks etc.) resolve through the same Modrinth
// version API — but e.g. shader projects use loaders like "iris"/"optifine"
// instead of "neoforge", so the loader filter comes from the resource source.
async function resolveModrinthResource(src) {
  const params = `game_versions=${encodeURIComponent('["1.21.1"]')}` +
    (src.loaders?.length ? `&loaders=${encodeURIComponent(JSON.stringify(src.loaders))}` : '');
  const versions = await jget(`https://api.modrinth.com/v2/project/${src.slug}/version?${params}`);
  if (!versions.length) throw new Error(`modrinth:${src.slug}: no 1.21.1 resource file`);
  const rank = { release: 0, beta: 1, alpha: 2 };
  versions.sort((a, b) =>
    (rank[a.version_type] ?? 3) - (rank[b.version_type] ?? 3) ||
    new Date(b.date_published) - new Date(a.date_published));
  const v = src.version_prefix
    ? versions.find((x) => x.version_number.startsWith(src.version_prefix))
    : versions[0];
  if (!v) throw new Error(`modrinth:${src.slug}: no resource version matching prefix ${src.version_prefix}`);
  const file = v.files.find((f) => f.primary) ?? v.files[0];
  const project = await jget(`https://api.modrinth.com/v2/project/${src.slug}`);
  return { version: v.version_number, filename: file.filename, url: file.url,
    page: `https://modrinth.com/${project.project_type}/${project.slug}`,
    license: project.license?.id ?? 'unknown', distribution: 'modrinth_cdn' };
}

const resolvers = { modrinth: resolveModrinth, curseforge: resolveCurseForge, github: resolveGithub, ftbmaven: resolveFtbMaven };

function sha(buf, algo) { return createHash(algo).update(buf).digest('hex'); }

const lock = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  minecraft: list.minecraft,
  loader: list.loader,
  neoforge_version: list.neoforge_version,
  java: list.java,
  mods: []
};

const oldByKey = new Map(
  (onlySet && existsSync(lockPath)
    ? JSON.parse(readFileSync(lockPath, 'utf8')).mods ?? []
    : []
  ).map((m) => [m.key, m]));

for (const mod of list.mods) {
  if (mod.enabled === false) {
    lock.mods.push({ key: mod.key, name: mod.name, enabled: false, side: mod.side, role: mod.role, notes: mod.notes ?? null });
    console.log(`SKIP ${mod.key} (disabled)`);
    continue;
  }
  if (onlySet && !onlySet.has(mod.key)) {
    const prev = oldByKey.get(mod.key);
    if (!prev) throw new Error(`${mod.key}: not in lockfile; include it in --only to resolve it`);
    lock.mods.push(prev);
    continue;
  }
  const r = await resolvers[mod.source.type](mod.source);
  const target = path.join(modsDir, r.filename);
  let buf;
  if (existsSync(target)) {
    buf = readFileSync(target);
  } else if (checkOnly) {
    throw new Error(`${mod.key}: missing file ${r.filename}`);
  } else {
    process.stdout.write(`  downloading ${r.filename} ... `);
    const resp = await fetch(r.url, { headers: HEADERS });
    if (!resp.ok) throw new Error(`${mod.key}: download HTTP ${resp.status} ${r.url}`);
    buf = Buffer.from(await resp.arrayBuffer());
    writeFileSync(target, buf);
    console.log(`${(buf.length / 1e6).toFixed(2)} MB`);
  }
  const entry = {
    key: mod.key, name: mod.name, enabled: true, role: mod.role, side: mod.side,
    version: r.version, filename: r.filename, size: buf.length,
    sha256: sha(buf, 'sha256'), sha512: sha(buf, 'sha512'),
    download_url: r.url, project_page: r.page, license: r.license,
    distribution: r.distribution, dependencies: r.deps,
    notes: mod.notes ?? null
  };
  if (onlySet && oldByKey.get(mod.key)?.sha1) entry.sha1 = oldByKey.get(mod.key).sha1;
  lock.mods.push(entry);
  console.log(`OK   ${mod.key} = ${r.version} (${r.filename})`);
}

// ---- non-mod resources (shaderpacks/...) -----------------------------------
const oldResByKey = new Map(
  (onlySet && existsSync(lockPath)
    ? JSON.parse(readFileSync(lockPath, 'utf8')).resources ?? []
    : []
  ).map((r) => [r.key, r]));

lock.resources = [];
for (const res of list.resources ?? []) {
  if (res.enabled === false) {
    lock.resources.push({ key: res.key, name: res.name, enabled: false, type: res.type, side: res.side, notes: res.notes ?? null });
    console.log(`SKIP ${res.key} (disabled resource)`);
    continue;
  }
  if (onlySet && !onlySet.has(res.key)) {
    const prev = oldResByKey.get(res.key);
    if (!prev) throw new Error(`${res.key}: not in lockfile; include it in --only to resolve it`);
    lock.resources.push(prev);
    continue;
  }
  if (res.source.type !== 'modrinth') throw new Error(`${res.key}: resource sources only support modrinth`);
  const r = await resolveModrinthResource(res.source);
  const target = path.join(resDir, r.filename);
  let buf;
  if (existsSync(target)) {
    buf = readFileSync(target);
  } else if (checkOnly) {
    throw new Error(`${res.key}: missing file ${r.filename}`);
  } else {
    mkdirSync(resDir, { recursive: true });
    process.stdout.write(`  downloading ${r.filename} ... `);
    const resp = await fetch(r.url, { headers: HEADERS });
    if (!resp.ok) throw new Error(`${res.key}: download HTTP ${resp.status} ${r.url}`);
    buf = Buffer.from(await resp.arrayBuffer());
    writeFileSync(target, buf);
    console.log(`${(buf.length / 1e6).toFixed(2)} MB`);
  }
  const dir = res.dir ?? 'shaderpacks';
  const entry = {
    key: res.key, name: res.name, enabled: true, type: res.type,
    side: res.side ?? 'client',
    version: r.version, filename: r.filename, path: `${dir}/${r.filename}`,
    size: buf.length, sha256: sha(buf, 'sha256'), sha512: sha(buf, 'sha512'),
    download_url: r.url, project_page: r.page, license: r.license,
    distribution: r.distribution, notes: res.notes ?? null
  };
  if (onlySet && oldResByKey.get(res.key)?.sha1) entry.sha1 = oldResByKey.get(res.key).sha1;
  lock.resources.push(entry);
  console.log(`OK   ${res.key} = ${r.version} (${r.filename} -> ${entry.path})`);
}

if (checkOnly) {
  console.log(`\n--check: all resolved files present in mods/; lockfile left untouched.`);
} else {
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  console.log(`\nWrote ${lockPath}: ${lock.mods.filter((m) => m.enabled).length} enabled mods, ${lock.resources.filter((r) => r.enabled).length} resources.`);
  if (onlySet) {
    // Re-run locked verification so new entries get a real sha1 and every
    // jar/file (kept + new) is hash-checked against the merged lockfile.
    const merged = JSON.parse(readFileSync(lockPath, 'utf8'));
    const { jars, errors } = await ensureLockedJars(merged);
    const { files, errors: resErrors } = await ensureLockedResources(merged);
    const all = [...errors, ...resErrors];
    if (all.length) {
      for (const e of all) console.error(`FAIL ${e}`);
      process.exit(1);
    }
    const n = backfillSha1(merged, jars); // mutates + saves the lockfile itself
    const rn = backfillResourceSha1(merged, files);
    console.log(`locked: ${jars.size} mods + ${files.size} resources verified` +
      (n + rn ? `, backfilled sha1 on ${n + rn}` : ''));
  }
}
