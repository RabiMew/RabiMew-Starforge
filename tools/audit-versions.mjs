// Read-only upstream version audit: for every Modrinth-sourced mod, list the newest
// 1.21.1 + NeoForge versions per release channel and compare against the lockfile.
// Non-Modrinth entries are reported with their distribution channel for manual checks.
// Usage: node tools/audit-versions.mjs [--json]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'manifest/locked-mods.json'), 'utf8'));
const modlist = JSON.parse(readFileSync(join(root, 'manifest/mod-list.json'), 'utf8'));
const mods = (lock.mods || lock).filter((m) => m.enabled !== false);
const listByKey = new Map((modlist.mods || modlist).map((m) => [m.key, m]));
const asJson = process.argv.includes('--json');
const UA = { 'User-Agent': 'RabiMew-Starforge/0.1.0 (version audit)' };

const getJson = async (url) => {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  return res.json();
};

const results = [];
for (const m of mods) {
  const src = listByKey.get(m.key)?.source;
  const row = {
    key: m.key, name: m.name, locked: m.version, filename: m.filename,
    side: m.side, distribution: m.distribution,
    sourceType: src?.type || null, slug: src?.slug || null,
  };
  if (src?.type === 'modrinth') {
    const q = `loaders=${encodeURIComponent('["neoforge"]')}&game_versions=${encodeURIComponent('["1.21.1"]')}`;
    const versions = await getJson(`https://api.modrinth.com/v2/project/${src.slug}/version?${q}`);
    if (versions.error) {
      row.error = versions.error;
    } else {
      const byType = {};
      for (const v of versions) (byType[v.version_type] ||= []).push(v);
      // API returns newest first; pick newest per channel.
      row.latest = {};
      for (const [type, arr] of Object.entries(byType)) {
        const v = arr[0];
        row.latest[type] = { version: v.version_number, date: v.date_published, id: v.id };
      }
      row.totalCompatible = versions.length;
      // does the locked version appear among compatible versions?
      const norm = (s) => String(s).replace(/\.jar$/, '').replace(/\+neoforge.*$/, '');
      row.lockedStillPublished = versions.some((v) =>
        norm(v.version_number) === norm(m.version) || v.files?.some((f) => f.filename === m.filename));
    }
  }
  results.push(row);
  if (!asJson) {
    const mark = row.latest?.release ? `release=${row.latest.release.version}` :
      row.latest ? `channels=${Object.keys(row.latest).join(',')}` : 'n/a';
    console.log(`${m.key.padEnd(24)} locked=${String(m.version).padEnd(38)} ${mark}${row.error ? ' ERR:' + row.error : ''}`);
  }
}
if (asJson) console.log(JSON.stringify(results, null, 1));
