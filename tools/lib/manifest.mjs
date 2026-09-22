// Manifest helpers: locked-mods.json is the single source of truth for mod
// versions, download sources, side and hashes. version.json is the single
// source of truth for the pack release version.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DIRS, p } from './paths.mjs';

export const SIDES = ['both', 'client', 'server'];
export const CLIENT_ACCEPTS = ['both', 'client'];
export const SERVER_ACCEPTS = ['both', 'server'];

export function loadLock() {
  return JSON.parse(readFileSync(path.join(DIRS.manifest, 'locked-mods.json'), 'utf8'));
}

export function saveLock(lock) {
  writeFileSync(path.join(DIRS.manifest, 'locked-mods.json'), JSON.stringify(lock, null, 2) + '\n');
}

export function loadVersion() {
  const v = JSON.parse(readFileSync(path.join(DIRS.manifest, 'version.json'), 'utf8'));
  if (!v.version || !v.channel) throw new Error('manifest/version.json needs {version, channel}');
  return v;
}

// starforge-alpha-0.1.0 style stem shared by every release artifact.
export function artifactStem(v = loadVersion()) {
  return `starforge-${v.channel}-${v.version}`;
}

export function packVersionId(v = loadVersion()) {
  return `${v.version}-${v.channel}`;
}

export const enabledMods = (lock) => lock.mods.filter((m) => m.enabled !== false);
export const sideMods = (lock, accepts) => enabledMods(lock).filter((m) => accepts.includes(m.side));

export function sideCounts(lock) {
  const c = { both: 0, client: 0, server: 0 };
  for (const m of enabledMods(lock)) c[m.side] = (c[m.side] ?? 0) + 1;
  return c;
}

// Re-key a locked mod entry so `sha1` sits next to the other hashes; keeps the
// JSON diff readable when the field is backfilled into locked-mods.json.
export function withSha1Field(mod, sha1) {
  const out = {};
  for (const [k, v] of Object.entries(mod)) {
    if (k === 'sha256') out.sha1 = sha1;
    if (k !== 'sha1') out[k] = v;
  }
  if (!('sha1' in out)) out.sha1 = sha1; // entries without sha256 (defensive)
  return out;
}

export const EXPECTED = {
  minecraft: '1.21.1',
  loader: 'neoforge',
  neoforge: '21.1.251',
  java: 21,
  name: "RabiMew's Starforge",
  nameZh: '星铸',
  summary: "RabiMew's Starforge / 星铸",
  author: 'RabiMew',
};

export function checkLockMeta(lock) {
  const errors = [];
  if (lock.minecraft !== EXPECTED.minecraft) errors.push(`minecraft: expected ${EXPECTED.minecraft}, got ${lock.minecraft}`);
  if (lock.loader !== EXPECTED.loader) errors.push(`loader: expected ${EXPECTED.loader}, got ${lock.loader}`);
  if (lock.neoforge_version !== EXPECTED.neoforge) errors.push(`neoforge: expected ${EXPECTED.neoforge}, got ${lock.neoforge_version}`);
  if (Number(lock.java) !== EXPECTED.java) errors.push(`java: expected ${EXPECTED.java}, got ${lock.java}`);
  return errors;
}

export { p };
