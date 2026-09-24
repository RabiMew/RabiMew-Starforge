// Lockfile integrity audit — runs before any packaging step. Fatal findings
// abort the build; warnings are surfaced in reports but don't block.
//
//   fatal  duplicated key/filename/sha512, missing license or download source,
//          missing pinned hashes, unknown source host, redistribution:"allow"
//          without a documented basis, invalid field values
//   warn   distribution unset but inferable, version not reflected in the
//          filename, review-class license (allowed but not embedded)
import { checkLockMeta, SIDES } from './manifest.mjs';
import { hostKind } from './mrpack-sources.mjs';
import { embedStatus } from './license.mjs';
import { listZip, readEntry } from './zip.mjs';

const REDISTRIBUTION_VALUES = new Set(['allow', 'deny']);

function checkEntry(kind, e, fatal, warn) {
  const tag = `${kind}:${e.key ?? '?'}`;
  if (!e.name) fatal.push(`${tag}: missing name`);
  if (!SIDES.includes(e.side)) fatal.push(`${tag}: unknown side "${e.side}"`);
  if (e.enabled === false) return; // disabled entries are kept for history only

  if (!e.license) fatal.push(`${tag}: license missing (set an SPDX id or a LicenseRef-* token)`);
  if (!e.version) fatal.push(`${tag}: version missing`);
  if (!e.filename) fatal.push(`${tag}: filename missing`);
  for (const h of ['size', 'sha256', 'sha512']) {
    if (e[h] == null) fatal.push(`${tag}: ${h} missing — run fetch-mods --locked`);
  }

  const local = e.download_url?.startsWith('local:');
  if (!e.download_url) fatal.push(`${tag}: download_url missing`);
  if (!local) {
    if (!e.project_page) warn.push(`${tag}: project_page missing`);
    const kind_ = e.distribution ?? hostKind(e.download_url ?? '');
    if (!e.distribution) {
      warn.push(`${tag}: distribution unset — inferred "${kind_}" from URL`);
    }
    if (kind_ === 'other') {
      fatal.push(`${tag}: unknown source host ${e.download_url} — set a known official host`);
    }
  }

  if (e.redistribution != null) {
    if (!REDISTRIBUTION_VALUES.has(e.redistribution)) {
      fatal.push(`${tag}: redistribution must be "allow"|"deny", got "${e.redistribution}"`);
    } else if (e.redistribution === 'allow' && !e.redistribution_note) {
      fatal.push(`${tag}: redistribution:"allow" needs redistribution_note documenting the basis`);
    }
  }
  // review-class licenses that will stay remote in the CN build — informational.
  const st = embedStatus(e);
  if (st.cls === 'review' && e.redistribution == null) {
    warn.push(`${tag}: license "${e.license}" is review-class — CN package keeps it on official download`);
  }
}

// Lockfile-level structural checks + per-entry checks.
// -> {fatal: string[], warn: string[]}
export function checkLock(lock) {
  const fatal = [];
  const warn = [];
  for (const e of checkLockMeta(lock)) fatal.push(e);

  const seenKeys = new Set();
  const seenFiles = new Map(); // filename -> key (enabled only)
  const seenSha512 = new Map(); // sha512 -> key (enabled only)
  const all = [
    ...(lock.mods ?? []).map((m) => ['mod', m]),
    ...(lock.resources ?? []).map((r) => ['resource', r]),
  ];
  for (const [kind, e] of all) {
    const tag = `${kind}:${e.key ?? '?'}`;
    if (seenKeys.has(e.key)) fatal.push(`${tag}: duplicate key`);
    seenKeys.add(e.key);
    checkEntry(kind, e, fatal, warn);
    if (e.enabled === false || !e.filename) continue;
    if (seenFiles.has(e.filename)) {
      fatal.push(`${tag}: filename ${e.filename} duplicates ${seenFiles.get(e.filename)}`);
    }
    seenFiles.set(e.filename, tag);
    if (e.sha512) {
      if (seenSha512.has(e.sha512)) {
        fatal.push(`${tag}: sha512 identical to ${seenSha512.get(e.sha512)} — same file locked twice`);
      }
      seenSha512.set(e.sha512, tag);
    }
    // Soft check: every numeric token of the locked version should appear in
    // the filename's own numeric tokens — catches "wrong file locked" mistakes
    // without false-positives on ordering/format differences.
    if (e.version && e.filename) {
      const toks = (s) => new Set(s.match(/\d+/g) ?? []);
      const vToks = toks(e.version), fToks = toks(e.filename);
      if (vToks.size && ![...vToks].every((t) => fToks.has(t))) {
        warn.push(`${tag}: version "${e.version}" not reflected in filename "${e.filename}" — confirm the locked file is the intended release`);
      }
    }
  }
  return { fatal, warn };
}

// Best-effort: compare the locked version with the version declared inside the
// jar's own mods.toml. Placeholders like ${file.jarVersion} are unresolvable —
// skipped. A literal mismatch is a warning, not fatal: display versions and
// jar versions legitimately differ (e.g. "8.0.19" vs "8.0.19+1.21.1").
export function jarVersionWarnings(mod, jarBuf) {
  const warns = [];
  let entries;
  try { entries = listZip(jarBuf); } catch { return warns; }
  const ent = entries.find((e) =>
    e.name === 'META-INF/neoforge.mods.toml' || e.name === 'META-INF/mods.toml');
  if (!ent) return warns;
  let text;
  try { text = readEntry(jarBuf, ent).toString('utf8'); } catch { return warns; }
  // version= line inside [[mods]] blocks only (top-level `version` is the
  // mandatory mods.toml schema version, not the mod's).
  const modBlocks = [...text.matchAll(/\[\[mods\]\]([^\[]*)/g)];
  for (const b of modBlocks) {
    const v = b[1].match(/^version\s*=\s*["']([^"']+)["']/m)?.[1];
    if (!v || v.includes('${')) continue;
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!norm(v).includes(norm(mod.version)) && !norm(mod.version).includes(norm(v))) {
      warns.push(`${mod.key}: jar declares version "${v}", lockfile pins "${mod.version}" — confirm`);
    }
  }
  return warns;
}
