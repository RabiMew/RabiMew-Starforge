// Hash helpers: compute sha1/sha256/sha512 over a buffer and verify a jar
// against its locked-mods.json entry. Verification is all-or-nothing — a
// mismatch is always a hard error, never a reason to skip a mod.
import { createHash } from 'node:crypto';

export const sha = (buf, algo) => createHash(algo).update(buf).digest('hex');
export const sha1 = (buf) => sha(buf, 'sha1');
export const sha256 = (buf) => sha(buf, 'sha256');
export const sha512 = (buf) => sha(buf, 'sha512');

export function hashes(buf) {
  return { sha1: sha1(buf), sha256: sha256(buf), sha512: sha512(buf), size: buf.length };
}

// Compare buffer against a locked mod entry. Returns list of mismatch strings
// (empty = verified). sha1 is checked only when the lockfile declares it —
// older locks lack the field and package-client backfills it.
export function verifyLocked(mod, buf) {
  const errs = [];
  if (buf.length !== mod.size) errs.push(`size ${buf.length} != locked ${mod.size}`);
  if (mod.sha256 && sha256(buf) !== mod.sha256) errs.push('sha256 mismatch');
  if (mod.sha512 && sha512(buf) !== mod.sha512) errs.push('sha512 mismatch');
  if (mod.sha1 && sha1(buf) !== mod.sha1) errs.push('sha1 mismatch');
  return errs;
}
