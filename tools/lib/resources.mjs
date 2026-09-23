// Locked non-mod resources (e.g. shaderpacks, TaCZ gun packs) — same guarantees
// as jars.mjs: the exact locked file lives under build/resources/ and must pass
// size+sha256+sha512(+sha1 when declared). Missing files are fetched from the
// lockfile's pinned download_url — never re-resolved to a newer upstream
// version. side is client|server|both: shaderpacks stay client-only, gun packs
// (dir=tacz) are required on dedicated servers too.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DIRS } from './paths.mjs';
import { saveLock, withSha1Field } from './manifest.mjs';
import { verifyLocked, sha1 } from './hash.mjs';
import { fetchBuffer } from './download.mjs';

export const enabledResources = (lock) => (lock.resources ?? []).filter((r) => r.enabled !== false);

// -> {files: Map<key, {path, buf}>, errors: string[]}
export async function ensureLockedResources(lock, { downloadMissing = true } = {}) {
  const files = new Map();
  const errors = [];
  const list = enabledResources(lock);
  if (!list.length) return { files, errors };
  mkdirSync(DIRS.resources, { recursive: true });
  for (const res of list) {
    if (!['client', 'server', 'both'].includes(res.side)) {
      errors.push(`${res.key}: unknown resource side "${res.side}" (want client|server|both)`);
      continue;
    }
    if (res.type === 'shaderpack' && res.side !== 'client') {
      errors.push(`${res.key}: shaderpacks are client-only (got "${res.side}")`);
      continue;
    }
    if (!res.path || !res.filename || !res.path.endsWith(`/${res.filename}`)) {
      errors.push(`${res.key}: bad path/filename (${res.path} vs ${res.filename})`);
      continue;
    }
    const target = path.join(DIRS.resources, res.filename);
    let buf;
    if (existsSync(target)) {
      buf = readFileSync(target);
    } else if (!downloadMissing) {
      errors.push(`${res.key}: missing ${res.filename}`);
      continue;
    } else {
      process.stdout.write(`  fetching ${res.filename} ... `);
      try {
        buf = await fetchBuffer(res.download_url);
      } catch (e) {
        console.log('FAILED');
        errors.push(`${res.key}: download failed ${e.message}`);
        continue;
      }
      console.log(`${(buf.length / 1e6).toFixed(2)} MB`);
      writeFileSync(target, buf);
    }
    const errs = verifyLocked(res, buf);
    if (errs.length) {
      errors.push(`${res.key} (${res.filename}): ${errs.join(', ')}`);
      continue;
    }
    files.set(res.key, { path: target, buf });
  }
  return { files, errors };
}

// Fill missing sha1 fields on lock.resources from the verified local files.
export function backfillResourceSha1(lock, files) {
  let touched = 0;
  lock.resources = (lock.resources ?? []).map((r) => {
    if (r.enabled === false || r.sha1 || !files.has(r.key)) return r;
    touched++;
    return withSha1Field(r, sha1(files.get(r.key).buf));
  });
  if (touched) saveLock(lock);
  return touched;
}
