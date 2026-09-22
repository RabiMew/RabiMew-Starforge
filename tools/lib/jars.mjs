// Locked-jar inventory: guarantees every enabled mod's exact locked file is
// present under mods/ and passes size+sha256+sha512(+sha1 when declared).
// Missing jars are downloaded from the lockfile's pinned download_url — never
// re-resolved to a newer upstream version. Mismatches are fatal upstream.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DIRS } from './paths.mjs';
import { enabledMods, saveLock, withSha1Field } from './manifest.mjs';
import { verifyLocked, sha1 } from './hash.mjs';
import { fetchBuffer } from './download.mjs';

// -> {jars: Map<key, {path, buf}>, errors: string[]}
export async function ensureLockedJars(lock, { downloadMissing = true } = {}) {
  mkdirSync(DIRS.mods, { recursive: true });
  const jars = new Map();
  const errors = [];
  for (const mod of enabledMods(lock)) {
    const target = path.join(DIRS.mods, mod.filename);
    let buf;
    if (existsSync(target)) {
      buf = readFileSync(target);
    } else if (!downloadMissing) {
      errors.push(`${mod.key}: missing ${mod.filename}`);
      continue;
    } else {
      process.stdout.write(`  fetching ${mod.filename} ... `);
      try {
        buf = await fetchBuffer(mod.download_url);
      } catch (e) {
        console.log('FAILED');
        errors.push(`${mod.key}: download failed ${e.message}`);
        continue;
      }
      console.log(`${(buf.length / 1e6).toFixed(2)} MB`);
      writeFileSync(target, buf);
    }
    const errs = verifyLocked(mod, buf);
    if (errs.length) {
      errors.push(`${mod.key} (${mod.filename}): ${errs.join(', ')}`);
      continue;
    }
    jars.set(mod.key, { path: target, buf });
  }
  return { jars, errors };
}

// Fill missing sha1 fields in locked-mods.json from the verified local jars.
// Returns number of entries updated (0 = already complete / jars absent).
export function backfillSha1(lock, jars) {
  let touched = 0;
  lock.mods = lock.mods.map((m) => {
    if (m.enabled === false || m.sha1 || !jars.has(m.key)) return m;
    touched++;
    return withSha1Field(m, sha1(jars.get(m.key).buf));
  });
  if (touched) saveLock(lock);
  return touched;
}
