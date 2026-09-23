// Builds the Starforge Compatibility addon mod with plain javac (no Gradle).
// Classpath = the dedicated server's full library set (mojmap-named, the same
// jars the production runtime uses) + local compile-only mod deps from mods/.
// The jar is written deterministically (sorted entries, fixed timestamps,
// DEFLATE) so identical sources produce identical sha256 for lockfile pinning.
// Usage: node tools/build-compat.mjs
import { execFileSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const compatDir = path.join(root, 'compat');
const srcDir = path.join(compatDir, 'src', 'main', 'java');
const resDir = path.join(compatDir, 'src', 'main', 'resources');
const outDir = path.join(compatDir, 'build');
const classesDir = path.join(outDir, 'classes');
const modsDir = path.join(root, 'mods');
const VERSION = '0.1.0';
const JAR_NAME = `starforge-compat-${VERSION}.jar`;

// compile-only mod deps resolved by filename prefix under mods/
const COMPILE_DEPS = ['The-Hordes'];

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// ---- classpath: every jar under run/server/libraries + compile deps ----------
const libDir = path.join(root, 'run', 'server', 'libraries');
const libs = [...walk(libDir)].filter((f) => f.endsWith('.jar'));

// The vanilla srg jar keeps NeoForge-AT'd members package-private, but the
// runtime applies accesstransformer.cfg. Produce a compile-only patched copy
// of that jar so javac sees the same visibility as the runtime.
const findJar = (frag) => libs.find((f) => f.includes(frag));
const srgJar = findJar(`${path.sep}server-1.21.1-20240808.144430-srg.jar`);
const neoforgeJar = findJar(`neoforge-21.1.251-universal.jar`);
const atJar = findJar(`${path.sep}accesstransformers-10.0.1.jar`);
const asmJar = findJar(`${path.sep}asm-9.10.1.jar`);
const asmTreeJar = findJar(`${path.sep}asm-tree-9.10.1.jar`);
const antlrJar = findJar(`${path.sep}antlr4-runtime-4.13.1.jar`);
const slf4jJar = findJar(`${path.sep}slf4j-api-2.0.9.jar`);
const patchedMc = path.join(outDir, 'mc-at.jar');
const toolSrc = path.join(compatDir, 'tools', 'ApplyAT.java');
const toolCls = path.join(outDir, 'tools', 'ApplyAT.class');
const atCfg = path.join(outDir, 'META-INF', 'accesstransformer.cfg');

if (!existsSync(patchedMc)) {
  mkdirSync(outDir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', neoforgeJar, 'META-INF/accesstransformer.cfg', '-d', outDir]);
  const toolCp = [atJar, asmJar, asmTreeJar, antlrJar, slf4jJar].join(path.delimiter);
  if (!existsSync(toolCls)) {
    execFileSync('javac', ['-cp', toolCp, '-d', path.join(outDir, 'tools'), toolSrc], { stdio: 'inherit' });
  }
  execFileSync('java', ['-cp', `${toolCp}${path.delimiter}${path.join(outDir, 'tools')}`,
    'ApplyAT', atCfg, srgJar, patchedMc], { stdio: 'inherit' });
}

const cp = [patchedMc, ...libs.filter((f) => f !== srgJar)];
for (const prefix of COMPILE_DEPS) {
  const hit = readdirSync(modsDir).find((f) => f.startsWith(prefix) && f.endsWith('.jar'));
  if (!hit) throw new Error(`compile dep not found in mods/: ${prefix}`);
  cp.push(path.join(modsDir, hit));
}

// ---- javac ------------------------------------------------------------------
const sources = [...walk(srcDir)].filter((f) => f.endsWith('.java'));
rmSync(classesDir, { recursive: true, force: true });
mkdirSync(classesDir, { recursive: true });
execFileSync('javac', [
  '-encoding', 'utf-8', '-proc:none', '-d', classesDir,
  '-cp', cp.join(path.delimiter), ...sources
], { stdio: 'inherit' });

// ---- deterministic zip -------------------------------------------------------
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
// fixed DOS datetime: 1980-01-01 00:00:00
const DOS_DATE = 0x0021, DOS_TIME = 0x0000;

function zipEntry(name, data, compressed) {
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);               // version needed
  local.writeUInt16LE(0x0800, 6);           // UTF-8 flag
  local.writeUInt16LE(8, 8);                // deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  return { local: Buffer.concat([local, nameBuf, compressed]), crc, nameBuf, data, compressed };
}

function buildJar(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    parts.push(e.local);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(DOS_TIME, 12);
    c.writeUInt16LE(DOS_DATE, 14);
    c.writeUInt32LE(e.crc, 16);
    c.writeUInt32LE(e.compressed.length, 20);
    c.writeUInt32LE(e.data.length, 24);
    c.writeUInt16LE(e.nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([c, e.nameBuf]));
    offset += e.local.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, end]);
}

const files = new Map();
for (const f of walk(classesDir)) {
  files.set(path.relative(classesDir, f).replace(/\\/g, '/'), readFileSync(f));
}
for (const f of walk(resDir)) {
  files.set(path.relative(resDir, f).replace(/\\/g, '/'), readFileSync(f));
}
const entries = [...files.keys()].sort().map((name) =>
  zipEntry(name, files.get(name), deflateRawSync(files.get(name), { level: 9 })));
const jar = buildJar(entries);
mkdirSync(modsDir, { recursive: true });
writeFileSync(path.join(modsDir, JAR_NAME), jar);

const digest = createHash('sha256').update(jar).digest('hex');
writeFileSync(path.join(outDir, 'artifact.json'),
  JSON.stringify({ filename: JAR_NAME, version: VERSION, sha256: digest }) + '\n');
console.log(`built ${JAR_NAME} (${jar.length} bytes, ${entries.length} entries)`);
console.log(`sha256 ${digest}`);
