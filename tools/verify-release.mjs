// Release verifier. Fails (exit 1) on any check below:
//   meta     lockfile pins minecraft 1.21.1 / neoforge 21.1.251 / java 21
//   mods     every enabled jar exists, size+sha1+sha256+sha512 all correct,
//            side is a known value
//   client   run/client/mods = exactly the both|client set (no server-only)
//   server   run/server/mods = exactly the both|server set (no client-only)
//   mrpack   dist/*.mrpack parses, index schema+dependencies+files[]+hashes+
//            fileSize+env correct, overrides/ present
//   serverzip dist/*-server.zip has install payload and zero jars
//   local    dist/*-local.zip carries the LOCAL TEST ONLY marker
//   git      mods/ run/ dist/ *.jar installer.log are ignored and untracked
// Usage: node tools/verify-release.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DIRS, ROOT, p } from './lib/paths.mjs';
import {
  loadLock, loadVersion, artifactStem, packVersionId,
  enabledMods, sideMods, CLIENT_ACCEPTS, SERVER_ACCEPTS, EXPECTED, checkLockMeta,
} from './lib/manifest.mjs';
import { verifyLocked, sha1 } from './lib/hash.mjs';
import { listZip, readEntry } from './lib/zip.mjs';

const lock = loadLock();
const version = loadVersion();
const stem = artifactStem(version);
const results = []; // {section, ok, details[]}
const section = (name) => {
  const s = { name, details: [] };
  results.push(s);
  return s;
};
const fail = (s, msg) => s.details.push(`FAIL ${msg}`);
const jarsIn = (dir) => existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.jar')) : [];

// ---- meta ------------------------------------------------------------------
{
  const s = section('meta');
  for (const e of checkLockMeta(lock)) fail(s, e);
}

// ---- mods ------------------------------------------------------------------
const jarBufs = new Map();
{
  const s = section('mods');
  for (const m of lock.mods) {
    if (!['both', 'client', 'server'].includes(m.side)) fail(s, `${m.key}: unknown side "${m.side}"`);
    if (m.enabled === false) continue;
    if (!m.sha1) fail(s, `${m.key}: sha1 missing from lockfile (run fetch-mods --locked)`);
    const fp = path.join(DIRS.mods, m.filename);
    if (!existsSync(fp)) { fail(s, `${m.key}: missing ${m.filename}`); continue; }
    const buf = readFileSync(fp);
    jarBufs.set(m.key, buf);
    for (const e of verifyLocked(m, buf)) fail(s, `${m.key} (${m.filename}): ${e}`);
  }
}

// ---- client / server run dirs ----------------------------------------------
for (const [side, accepts, banned] of [
  ['client', CLIENT_ACCEPTS, new Set(enabledMods(lock).filter((m) => m.side === 'server').map((m) => m.filename))],
  ['server', SERVER_ACCEPTS, new Set(enabledMods(lock).filter((m) => m.side === 'client').map((m) => m.filename))],
]) {
  const s = section(`run/${side}`);
  const dir = path.join(ROOT, 'run', side, 'mods');
  if (!existsSync(dir)) { fail(s, `${dir} not built — run setup/sync first`); continue; }
  const have = jarsIn(dir);
  for (const f of have) if (banned.has(f)) fail(s, `wrong-side jar present: ${f}`);
  const want = new Set(sideMods(lock, accepts).map((m) => m.filename));
  for (const f of have) if (!want.has(f)) fail(s, `unexpected jar: ${f}`);
  for (const f of want) if (!have.includes(f)) fail(s, `missing jar: ${f}`);
}

// ---- .mrpack -----------------------------------------------------------------
{
  const s = section('mrpack');
  const mp = p('dist', `${stem}.mrpack`);
  if (!existsSync(mp)) { fail(s, `${mp} not found`); }
  else {
    const zbuf = readFileSync(mp);
    let ents;
    try { ents = listZip(zbuf); } catch (e) { fail(s, `unreadable zip: ${e.message}`); ents = null; }
    if (ents) {
      const byName = new Map(ents.map((e) => [e.name, e]));
      const idxEnt = byName.get('modrinth.index.json');
      if (!idxEnt) fail(s, 'modrinth.index.json missing at zip root');
      let idx = null;
      if (idxEnt) {
        try { idx = JSON.parse(readEntry(zbuf, idxEnt).toString('utf8')); }
        catch (e) { fail(s, `modrinth.index.json invalid JSON: ${e.message}`); }
      }
      if (idx) {
        if (idx.formatVersion !== 1) fail(s, `formatVersion ${idx.formatVersion} != 1`);
        if (idx.game !== 'minecraft') fail(s, `game "${idx.game}" != minecraft`);
        if (idx.name !== EXPECTED.name) fail(s, `name "${idx.name}"`);
        if (idx.versionId !== packVersionId(version)) fail(s, `versionId "${idx.versionId}" != ${packVersionId(version)}`);
        if (idx.summary !== EXPECTED.summary) fail(s, `summary "${idx.summary}"`);
        if (idx.dependencies?.minecraft !== EXPECTED.minecraft) fail(s, 'dependencies.minecraft wrong');
        if (idx.dependencies?.neoforge !== EXPECTED.neoforge) fail(s, 'dependencies.neoforge wrong');
        const wantMods = new Map(sideMods(lock, CLIENT_ACCEPTS).map((m) => [`mods/${m.filename}`, m]));
        const seen = new Set();
        for (const f of idx.files ?? []) {
          if (!f.path?.startsWith('mods/')) fail(s, `file path outside mods/: ${f.path}`);
          const m = wantMods.get(f.path);
          if (!m) { fail(s, `unexpected file entry ${f.path} (server-only or unknown)`); continue; }
          seen.add(f.path);
          if (!f.hashes?.sha1 || !f.hashes?.sha512) fail(s, `${f.path}: missing sha1/sha512`);
          if (!Array.isArray(f.downloads) || !f.downloads.length) fail(s, `${f.path}: downloads empty`);
          if (!f.fileSize) fail(s, `${f.path}: fileSize missing`);
          const buf = jarBufs.get(m.key);
          if (buf) {
            if (f.fileSize !== buf.length) fail(s, `${f.path}: fileSize ${f.fileSize} != ${buf.length}`);
            if (f.hashes?.sha512 !== m.sha512) fail(s, `${f.path}: sha512 != lockfile`);
            if (f.hashes?.sha1 !== sha1(buf)) fail(s, `${f.path}: sha1 != jar`);
          }
          const envWant = m.side === 'both'
            ? { client: 'required', server: 'required' }
            : { client: 'required', server: 'unsupported' };
          if (f.env?.client !== envWant.client || f.env?.server !== envWant.server)
            fail(s, `${f.path}: env ${JSON.stringify(f.env)} != ${JSON.stringify(envWant)}`);
        }
        for (const fp of wantMods.keys()) if (!seen.has(fp)) fail(s, `locked mod absent from files[]: ${fp}`);
      }
      if (!ents.some((e) => e.name.startsWith('overrides/'))) fail(s, 'overrides/ absent');
      // every override must correspond to a committed pack/ file
      for (const e of ents) {
        if (!e.name.startsWith('overrides/') || e.name.endsWith('/')) continue;
        const rel = e.name.slice('overrides/'.length);
        if (rel === '.keep') continue;
        if (!existsSync(path.join(DIRS.pack, rel))) fail(s, `override ${rel} has no pack/ source`);
      }
    }
  }
}

// ---- server zip ---------------------------------------------------------------
{
  const s = section('serverzip');
  const sp = p('dist', `${stem}-server.zip`);
  if (!existsSync(sp)) { fail(s, `${sp} not found`); }
  else {
    const ents = listZip(readFileSync(sp));
    const names = new Set(ents.map((e) => e.name));
    for (const req of ['manifest/locked-mods.json', 'tools/setup-server.mjs',
      'LICENSE', 'README.md', 'SERVER_README.md']) {
      if (!names.has(req)) fail(s, `missing ${req}`);
    }
    if (![...names].some((n) => n.startsWith('pack/'))) fail(s, 'pack/ absent');
    if (![...names].some((n) => n.startsWith('tools/lib/'))) fail(s, 'tools/lib/ absent');
    for (const n of names) if (n.endsWith('.jar')) fail(s, `third-party jar embedded: ${n}`);
  }
}

// ---- local test zip (optional artifact) ---------------------------------------
{
  const s = section('localzip');
  const lp = p('dist', `${stem}-local.zip`);
  if (!existsSync(lp)) s.details.push('SKIP (not built — optional artifact)');
  else {
    const ents = listZip(readFileSync(lp));
    const names = new Set(ents.map((e) => e.name));
    if (!names.has('LOCAL_TEST_ONLY.txt')) fail(s, 'LOCAL_TEST_ONLY.txt marker missing');
    const want = sideMods(lock, CLIENT_ACCEPTS).length;
    const got = [...names].filter((n) => n.startsWith('mods/') && n.endsWith('.jar')).length;
    if (got !== want) fail(s, `mods/ has ${got} jars, expected ${want}`);
  }
}

// ---- git hygiene ---------------------------------------------------------------
{
  const s = section('git');
  const gi = p('.gitignore');
  if (!existsSync(gi)) fail(s, '.gitignore missing');
  const mustIgnore = ['mods/x.jar', 'run/client/x', 'dist/x.zip', 'neoforge-x-installer.jar', 'installer.log'];
  for (const probe of mustIgnore) {
    try { execFileSync('git', ['check-ignore', probe], { cwd: ROOT, stdio: 'pipe' }); }
    catch { fail(s, `not gitignored: ${probe}`); }
  }
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  for (const t of tracked) {
    if (/^(mods|run|dist)\//.test(t) || /\.jar$/.test(t)) fail(s, `build artifact tracked: ${t}`);
  }
}

// ---- report --------------------------------------------------------------------
let bad = 0;
for (const s of results) {
  const fails = s.details.filter((d) => d.startsWith('FAIL'));
  bad += fails.length;
  if (!fails.length && !s.details.length) console.log(`PASS ${s.name}`);
  else if (!fails.length) console.log(`PASS ${s.name} (${s.details.join('; ')})`);
  else {
    console.log(`FAIL ${s.name}`);
    for (const d of s.details) console.log(`  ${d}`);
  }
}
if (bad) { console.log(`\n${bad} problem(s)`); process.exit(1); }
console.log('\nrelease verification: all checks passed');
