// Reads META-INF/neoforge.mods.toml (or mods.toml) from every jar in mods/
// and verifies the declared dependency closure is satisfied by the locked set.
// Also dumps each jar's declared mod ids + display side for the record.
// Usage: node tools/audit-deps.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const modsDir = path.join(root, 'mods');
const lock = JSON.parse(readFileSync(path.join(root, 'manifest/locked-mods.json'), 'utf8'));

// minimal TOML subset parser for mods.toml dependency tables
function parseModsToml(text) {
  const modIds = [];
  const deps = [];
  let inDeps = false;
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const sec = line.match(/^\[\[(.+)\]\]$/);
    if (sec) {
      if (cur) deps.push(cur);
      cur = null;
      inDeps = sec[1].startsWith('dependencies.');
      if (inDeps) cur = {};
      continue;
    }
    const kv = line.match(/^([A-Za-z_]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const [, k, v] = kv;
    const q = v.trim().match(/^"(.*?)"|^'(.*?)'|^(true|false|\S+)/);
    const val = q ? (q[1] ?? q[2] ?? q[3]) : v;
    if (k === 'modId' && !inDeps && cur === null) modIds.push(val);
    if (cur) cur[k] = val;
  }
  if (cur) deps.push(cur);
  return { modIds, deps };
}

// Minimal ZIP reader: locate End Of Central Directory, walk entries, inflate
// matching members. Returns [{name, buf}] so nested jarJar jars can be
// re-opened as zips themselves.
function readZipEntries(buf, wanted) {
  const out = [];
  if (buf.readUInt32LE(0) !== 0x04034b50) return out;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return out;
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const localOff = buf.readUInt32LE(off + 42);
    if (wanted(name)) {
      const ln = buf.readUInt16LE(localOff + 26);
      const le = buf.readUInt16LE(localOff + 28);
      const data = buf.subarray(localOff + 30 + ln + le, localOff + 30 + ln + le + compSize);
      try {
        out.push({ name, buf: method === 8 ? zlib.inflateRawSync(data) : method === 0 ? data : null });
      } catch { out.push({ name, buf: null }); }
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function readZipEntry(file, wanted) {
  const e = readZipEntries(readFileSync(file), (n) => wanted.includes(n))[0];
  return e?.buf ? e.buf.toString('utf8') : null;
}

function readTomlFromJar(jarPath) {
  const text = readZipEntry(jarPath, ['META-INF/neoforge.mods.toml', 'META-INF/mods.toml']);
  return text ? { entry: 'mods.toml', text } : null;
}

// Mod ids provided by embedded jarJar jars (e.g. xaerolib inside Xaero's jars).
function embeddedModIds(jarPath) {
  const out = [];
  for (const e of readZipEntries(readFileSync(jarPath), (n) => /^META-INF\/jarjar\/.+\.jar$/i.test(n))) {
    if (!e.buf) continue;
    const inner = readZipEntries(e.buf, (n) => n === 'META-INF/neoforge.mods.toml' || n === 'META-INF/mods.toml')[0];
    if (!inner?.buf) continue;
    const { modIds } = parseModsToml(inner.buf.toString('utf8'));
    for (const id of modIds) out.push({ jar: e.name, modId: id });
  }
  return out;
}

const present = new Map(); // modId -> {file, version}
const report = [];
for (const file of readdirSync(modsDir).filter((f) => f.endsWith('.jar'))) {
  const jar = path.join(modsDir, file);
  const found = readTomlFromJar(jar);
  if (!found) { report.push({ file, error: 'no mods.toml' }); continue; }
  const { modIds, deps } = parseModsToml(found.text);
  const embedded = embeddedModIds(jar);
  report.push({ file, modIds, embeddedModIds: embedded.map((e) => e.modId), deps });
  for (const id of modIds) present.set(id.toLowerCase(), file);
  for (const e of embedded) present.set(e.modId.toLowerCase(), `${file} -> ${e.jar}`);
}

const missing = [];
for (const r of report) {
  if (!r.deps) continue;
  for (const d of r.deps) {
    // neoforge.mods.toml: type="required"; legacy mods.toml: mandatory=true
    if (d.type === 'required' || d.mandatory === 'true') {
      const id = (d.modId || '').toLowerCase();
      if (!id || id === 'minecraft' || id === 'neoforge' || id === 'forge' || id === 'java') continue;
      if (!present.has(id)) missing.push({ jar: r.file, requires: d.modId, versionRange: d.versionRange ?? '' });
    }
  }
}

writeFileSync(path.join(root, 'manifest/mod-ids.json'),
  JSON.stringify(Object.fromEntries([...present.entries()].sort()), null, 2) + '\n');
writeFileSync(path.join(root, 'manifest/jar-deps.json'), JSON.stringify(report, null, 2) + '\n');

if (missing.length) {
  console.log('MISSING REQUIRED DEPENDENCIES:');
  for (const m of missing) console.log(`  ${m.jar} requires ${m.requires} ${m.versionRange}`);
  process.exitCode = 1;
} else {
  console.log(`All required mod dependencies satisfied across ${report.length} jars.`);
}
console.log(`Declared mod ids -> manifest/mod-ids.json; per-jar deps -> manifest/jar-deps.json`);
