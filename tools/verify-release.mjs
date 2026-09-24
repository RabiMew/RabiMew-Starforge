// Release verifier. Fails (exit 1) on any check below:
//   meta     lockfile pins minecraft 1.21.1 / neoforge 21.1.251 / java 21
//   lockfile no duplicate keys/files/hashes, license+source+hashes recorded,
//            redistribution overrides carry a documented basis
//   mods     every enabled jar exists, size+sha1+sha256+sha512 all correct,
//            side is a known value
//   client   run/client/mods = exactly the both|client set (no server-only)
//   server   run/server/mods = exactly the both|server set (no client-only)
//   mrpack   dist/*.mrpack parses, index schema+dependencies+files[]+hashes+
//            fileSize+env correct, overrides/ present, root docs present
//   mrpack-cn dist/*-cn.mrpack parses; files[] = exactly the non-embeddable
//            set; every embedded override jar hash-matches a permitted locked
//            entry; SHA256SUMS.txt consistent
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
import { verifyLocked, sha1, sha256, sha512 } from './lib/hash.mjs';
import { enabledResources } from './lib/resources.mjs';
import { listZip, readEntry } from './lib/zip.mjs';
import { checkLock } from './lib/lockcheck.mjs';
import { embedStatus } from './lib/license.mjs';

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

// ---- lockfile audit -----------------------------------------------------------
{
  const s = section('lockfile');
  const { fatal: lockFatal, warn: lockWarn } = checkLock(lock);
  for (const e of lockFatal) fail(s, e);
  for (const w of lockWarn) s.details.push(`WARN ${w}`);
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

// ---- run dirs: locked resources present at their declared path --------------
// side=client -> run/client only; side=server -> run/server only; side=both ->
// both (e.g. tacz/ gun packs the dedicated server also needs). Shaderpacks
// remain banned on the server regardless.
{
  const s = section('run resources');
  for (const r of enabledResources(lock)) {
    for (const sideName of ['client', 'server']) {
      const accepted = (r.side === 'both') || (r.side === sideName);
      const fp = path.join(ROOT, 'run', sideName, ...r.path.split('/'));
      if (!accepted) {
        if (existsSync(fp)) fail(s, `${r.key}: side=${r.side} but present in run/${sideName}/${r.path}`);
        continue;
      }
      if (!existsSync(fp)) { fail(s, `missing run/${sideName}/${r.path} — run sync-mods ${sideName}`); continue; }
      for (const e of verifyLocked(r, readFileSync(fp))) fail(s, `run/${sideName}/${r.path}: ${e}`);
    }
  }
  const serverShaderDir = path.join(ROOT, 'run', 'server', 'shaderpacks');
  if (existsSync(serverShaderDir) && readdirSync(serverShaderDir).some((f) => f.endsWith('.zip')))
    fail(s, 'run/server/shaderpacks contains a shader archive');
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
      // Mods embedded under overrides/mods/ in the standard pack: self-built
      // local: addons (no download URL exists) plus any entry with an explicit
      // lockfile embed_reason. Nothing else may be embedded — platform-hosted
      // jars must stay on files[] downloads.
      const embeddedMods = sideMods(lock, CLIENT_ACCEPTS)
        .filter((m) => m.download_url?.startsWith('local:') || m.embed_reason);
      const embeddedPaths = new Set(embeddedMods.map((m) => `mods/${m.filename}`));
      for (const m of embeddedMods.filter((m) => !m.download_url?.startsWith('local:'))) {
        const st = embedStatus(m);
        if (!st.embed) fail(s, `${m.key}: embed_reason set but redistribution not permitted (${st.basis})`);
      }
      for (const doc of ['THIRD_PARTY_MODS.md', 'SHA256SUMS.txt', 'SECURITY.md']) {
        if (!byName.has(doc)) fail(s, `${doc} missing at pack root`);
      }
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
        const wantResources = new Map(
          enabledResources(lock).filter((r) => r.side === 'client' || r.side === 'both').map((r) => [r.path, r]));
        const seen = new Set();
        for (const f of idx.files ?? []) {
          const res = wantResources.get(f.path);
          const m = res ?? wantMods.get(f.path);
          if (!m) {
            if (!f.path?.startsWith('mods/')) fail(s, `file path outside mods/: ${f.path}`);
            else fail(s, `unexpected file entry ${f.path} (server-only or unknown)`);
            continue;
          }
          seen.add(f.path);
          if (!f.hashes?.sha1 || !f.hashes?.sha512) fail(s, `${f.path}: missing sha1/sha512`);
          if (!Array.isArray(f.downloads) || !f.downloads.length) fail(s, `${f.path}: downloads empty`);
          if (!f.fileSize) fail(s, `${f.path}: fileSize missing`);
          if (res) {
            // Locked non-mod resource (shaderpack etc.): hash against the
            // downloaded copy under build/resources/, never a jar.
            const rp = path.join(DIRS.resources, res.filename);
            const rbuf = existsSync(rp) ? readFileSync(rp) : null;
            if (!rbuf) fail(s, `${res.key}: missing ${res.filename} under build/resources`);
            else {
              if (f.fileSize !== rbuf.length) fail(s, `${f.path}: fileSize ${f.fileSize} != ${rbuf.length}`);
              if (f.hashes?.sha512 !== res.sha512) fail(s, `${f.path}: sha512 != lockfile`);
              if (f.hashes?.sha1 !== sha1(rbuf)) fail(s, `${f.path}: sha1 != file`);
            }
            const resEnvServer = res.side === 'both' ? 'required' : 'unsupported';
            if (f.env?.client !== 'required' || f.env?.server !== resEnvServer)
              fail(s, `${f.path}: resource env must be client=required/server=${resEnvServer}, got ${JSON.stringify(f.env)}`);
          } else {
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
        }
        for (const fp of wantMods.keys()) {
          if (embeddedPaths.has(fp)) continue;
          if (!seen.has(fp)) fail(s, `locked mod absent from files[]: ${fp}`);
        }
        for (const fp of wantResources.keys()) if (!seen.has(fp)) fail(s, `locked resource absent from files[]: ${fp}`);
      }
      if (!ents.some((e) => e.name.startsWith('overrides/'))) fail(s, 'overrides/ absent');
      // every override must correspond to a committed pack/ file — except
      // embedded local: mod jars, which are verified against the lockfile.
      for (const e of ents) {
        if (!e.name.startsWith('overrides/') || e.name.endsWith('/')) continue;
        const rel = e.name.slice('overrides/'.length);
        if (rel === '.keep') continue;
        const embedded = embeddedMods.find((m) => `mods/${m.filename}` === rel);
        if (embedded) {
          const data = readEntry(zbuf, e);
          if (embedded.sha512 && sha512(data) !== embedded.sha512)
            fail(s, `embedded ${rel}: sha512 != lockfile`);
          const jbuf = jarBufs.get(embedded.key);
          if (jbuf && sha1(data) !== sha1(jbuf)) fail(s, `embedded ${rel}: sha1 != built jar`);
          continue;
        }
        if (!existsSync(path.join(DIRS.pack, rel))) fail(s, `override ${rel} has no pack/ source`);
      }
      for (const rel of embeddedPaths) {
        if (!byName.has(`overrides/${rel}`)) fail(s, `local mod not embedded in overrides/: ${rel}`);
      }
    }
  }
}

// ---- CN offline .mrpack -------------------------------------------------------
// Same format as the standard pack, but every locked entry whose license
// permits redistribution travels under overrides/ instead of files[].
// Verifies: files[] is exactly the non-embeddable set, every embedded binary
// hash-matches a locked entry that is actually allowed to be embedded, and
// SHA256SUMS.txt covers exactly the embedded set.
{
  const s = section('mrpack-cn');
  const mp = p('dist', `${stem}-cn.mrpack`);
  if (!existsSync(mp)) { fail(s, `${mp} not found — run tools/package-client.mjs`); }
  else {
    const zbuf = readFileSync(mp);
    let ents;
    try { ents = listZip(zbuf); } catch (e) { fail(s, `unreadable zip: ${e.message}`); ents = null; }
    if (ents) {
      const byName = new Map(ents.map((e) => [e.name, e]));
      const wantMods = sideMods(lock, CLIENT_ACCEPTS);
      const wantResources = enabledResources(lock).filter((r) => r.side === 'client' || r.side === 'both');
      // Expected split: embeddable -> overrides/, rest -> files[].
      const embeddable = new Map();
      const remote = new Map();
      for (const m of wantMods) {
        const allowed = m.download_url?.startsWith('local:') || embedStatus(m).embed;
        (allowed ? embeddable : remote).set(`mods/${m.filename}`, m);
      }
      for (const r of wantResources) {
        (embedStatus(r).embed ? embeddable : remote).set(r.path, r);
      }

      const idxEnt = byName.get('modrinth.index.json');
      if (!idxEnt) fail(s, 'modrinth.index.json missing at zip root');
      let idx = null;
      if (idxEnt) {
        try { idx = JSON.parse(readEntry(zbuf, idxEnt).toString('utf8')); }
        catch (e) { fail(s, `modrinth.index.json invalid JSON: ${e.message}`); }
      }
      if (idx) {
        if (idx.formatVersion !== 1) fail(s, `formatVersion ${idx.formatVersion} != 1`);
        if (idx.name !== EXPECTED.name) fail(s, `name "${idx.name}"`);
        if (idx.versionId !== packVersionId(version)) fail(s, `versionId "${idx.versionId}"`);
        if (idx.dependencies?.minecraft !== EXPECTED.minecraft) fail(s, 'dependencies.minecraft wrong');
        if (idx.dependencies?.neoforge !== EXPECTED.neoforge) fail(s, 'dependencies.neoforge wrong');
        const seen = new Set();
        for (const f of idx.files ?? []) {
          const entry = remote.get(f.path);
          if (!entry) {
            fail(s, embeddable.has(f.path)
              ? `files[] entry ${f.path} should be embedded, not downloaded`
              : `unexpected files[] entry ${f.path}`);
            continue;
          }
          seen.add(f.path);
          if (!f.hashes?.sha1 || !f.hashes?.sha512) fail(s, `${f.path}: missing sha1/sha512`);
          if (f.hashes?.sha512 !== entry.sha512) fail(s, `${f.path}: sha512 != lockfile`);
          if (!Array.isArray(f.downloads) || !f.downloads.length) fail(s, `${f.path}: downloads empty`);
          if (!f.fileSize) fail(s, `${f.path}: fileSize missing`);
          if (f.fileSize !== entry.size) fail(s, `${f.path}: fileSize ${f.fileSize} != locked ${entry.size}`);
          const envWant = entry.side === 'both' ? 'required' : 'unsupported';
          if (f.env?.client !== 'required' || f.env?.server !== envWant) {
            fail(s, `${f.path}: env must be client=required/server=${envWant}, got ${JSON.stringify(f.env)}`);
          }
        }
        for (const fp of remote.keys()) {
          if (!seen.has(fp)) fail(s, `non-embeddable entry absent from files[]: ${fp}`);
        }
      }

      // Embedded overrides: every binary must be an expected embeddable entry
      // and hash-match the lockfile; every embeddable entry must be present.
      const sumsEnt = byName.get('SHA256SUMS.txt');
      const sums = new Map(); // instance path -> sha256 declared in the pack
      if (!sumsEnt) fail(s, 'SHA256SUMS.txt missing at pack root');
      else {
        for (const line of readEntry(zbuf, sumsEnt).toString('utf8').split(/\r?\n/)) {
          if (!line.trim()) continue;
          const m = line.match(/^([0-9a-f]{64})  (.+)$/);
          if (!m) { fail(s, `SHA256SUMS.txt unparsable line: ${line}`); continue; }
          sums.set(m[2], m[1]);
        }
      }
      const embeddedSeen = new Set();
      for (const e of ents) {
        if (!e.name.startsWith('overrides/') || e.name.endsWith('/')) continue;
        const rel = e.name.slice('overrides/'.length);
        if (rel === '.keep') continue;
        const locked = embeddable.get(rel);
        if (locked) {
          const data = readEntry(zbuf, e);
          embeddedSeen.add(rel);
          if (locked.sha512 && sha512(data) !== locked.sha512) fail(s, `embedded ${rel}: sha512 != lockfile`);
          if (locked.sha256 && sha256(data) !== locked.sha256) fail(s, `embedded ${rel}: sha256 != lockfile`);
          if (sums.has(rel) && sums.get(rel) !== sha256(data)) fail(s, `embedded ${rel}: sha256 != SHA256SUMS.txt`);
          continue;
        }
        // Non-binary override must come from pack/ (pack-owned content only).
        if (/\.(jar|zip|exe|dll)$/i.test(rel)) {
          fail(s, `embedded binary with no lockfile entry or redistribution right: ${rel}`);
        } else if (!existsSync(path.join(DIRS.pack, rel))) {
          fail(s, `override ${rel} has no pack/ source`);
        }
      }
      for (const fp of embeddable.keys()) {
        if (!embeddedSeen.has(fp)) fail(s, `embeddable entry missing from overrides/: ${fp}`);
      }
      for (const [fp] of sums) {
        if (!embeddedSeen.has(fp)) fail(s, `SHA256SUMS.txt lists non-embedded path: ${fp}`);
      }
      for (const doc of ['THIRD_PARTY_MODS.md', 'SECURITY.md']) {
        if (!byName.has(doc)) fail(s, `${doc} missing at pack root`);
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
    // locked resource archives (shaderpack zips) are client-only — the server
    // zip must never carry one, inside pack/ or anywhere else.
    // Locked resource archives (shaderpack zips, gun pack zips) are never
    // embedded in the server zip — setup-server fetches them via the lockfile.
    for (const n of names) {
      const base = n.split('/').pop();
      if (enabledResources(lock).some((r) => r.filename === base))
        fail(s, `locked resource embedded in server zip: ${n}`);
    }
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
    for (const r of enabledResources(lock).filter((r) => r.side === 'client' || r.side === 'both')) {
      if (!names.has(r.path)) fail(s, `locked resource missing: ${r.path}`);
    }
  }
}

// ---- git hygiene ---------------------------------------------------------------
{
  const s = section('git');
  const gi = p('.gitignore');
  if (!existsSync(gi)) fail(s, '.gitignore missing');
  const mustIgnore = ['mods/x.jar', 'run/client/x', 'dist/x.zip', 'neoforge-x-installer.jar', 'installer.log', 'build/resources/x.zip'];
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
