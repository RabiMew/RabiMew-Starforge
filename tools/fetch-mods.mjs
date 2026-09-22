// Resolves manifest/mod-list.json to real files, downloads them, hashes them,
// and writes manifest/locked-mods.json. Jars land in mods/ (gitignored).
// Usage: node tools/fetch-mods.mjs [--check]
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const listPath = path.join(root, 'manifest/mod-list.json');
const lockPath = path.join(root, 'manifest/locked-mods.json');
const modsDir = path.join(root, 'mods');
const checkOnly = process.argv.includes('--check');
const list = JSON.parse(readFileSync(listPath, 'utf8'));
mkdirSync(modsDir, { recursive: true });

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
  const url = `https://mediafilez.forgecdn.net/files/${Math.floor(file.id / 1000)}/${file.id % 1000}/${file.name}`;
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

for (const mod of list.mods) {
  if (mod.enabled === false) {
    lock.mods.push({ key: mod.key, name: mod.name, enabled: false, side: mod.side, role: mod.role, notes: mod.notes ?? null });
    console.log(`SKIP ${mod.key} (disabled)`);
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
  lock.mods.push({
    key: mod.key, name: mod.name, enabled: true, role: mod.role, side: mod.side,
    version: r.version, filename: r.filename, size: buf.length,
    sha256: sha(buf, 'sha256'), sha512: sha(buf, 'sha512'),
    download_url: r.url, project_page: r.page, license: r.license,
    distribution: r.distribution, dependencies: r.deps,
    notes: mod.notes ?? null
  });
  console.log(`OK   ${mod.key} = ${r.version} (${r.filename})`);
}

writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
console.log(`\nWrote ${lockPath}: ${lock.mods.filter((m) => m.enabled).length} enabled mods.`);
