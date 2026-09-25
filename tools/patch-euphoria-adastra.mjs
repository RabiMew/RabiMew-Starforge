// Applies the Starforge Ad Astra shader patch to a generated
// "ComplementaryReimagined_* + EuphoriaPatches_*" shader pack directory.
// Ops source of truth: compat/src/main/resources/starforge_compat/adastra/ops.json
// The same ops are applied at runtime by starforge_compat (AdAstraShaderPatch).
// Usage:
//   node tools/patch-euphoria-adastra.mjs [--pack <dir>] [--check]
//   --check  verify anchors resolve without writing (exit 1 on any failure)
import {
  existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const resDir = path.join(root, 'compat', 'src', 'main', 'resources', 'starforge_compat', 'adastra');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const packIdx = args.indexOf('--pack');
let packDir = packIdx >= 0 ? args[packIdx + 1] : null;
if (!packDir) {
  const sp = path.join(root, 'run', 'client', 'shaderpacks');
  packDir = readdirSync(sp).find((d) => /EuphoriaPatches/.test(d) && !d.endsWith('.zip') && !d.endsWith('.txt'));
  if (!packDir) { console.error('no generated Euphoria shader dir found'); process.exit(2); }
  packDir = path.join(sp, packDir);
}
console.log('patching:', packDir);

const manifest = JSON.parse(readFileSync(path.join(resDir, 'ops.json'), 'utf8'));
const payload = (rel) => readFileSync(path.join(resDir, rel), 'utf8');
let failures = 0;
const fail = (id, msg) => { failures++; console.error(`FAIL ${id}: ${msg}`); };

const readTarget = (op) => {
  const p = path.join(packDir, op.target);
  if (!existsSync(p)) { fail(op.id, `missing target ${op.target}`); return null; }
  return readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
};

for (const op of manifest.ops) {
  const targetPath = path.join(packDir, op.target);
  if (op.type === 'create_file') {
    if (!checkOnly) {
      mkdirSync(path.dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, payload(op.payload));
    }
    continue;
  }
  if (op.type === 'insert_after' || op.type === 'replace_once') {
    const text = readTarget(op);
    if (text == null) continue;
    const n = text.split(op.anchor).length - 1;
    if (n !== 1) { fail(op.id, `anchor occurs ${n} times in ${op.target}`); continue; }
    if (!checkOnly) {
      const body = payload(op.payload);
      let out;
      if (op.type === 'insert_after') {
        const end = text.indexOf(op.anchor) + op.anchor.length;
        const prefix = text.slice(0, end);
        const suffix = text.slice(end);
        const lead = prefix.endsWith('\n') || body.startsWith('\n') ? '' : '\n';
        const trail = body.endsWith('\n') || suffix.startsWith('\n') ? '' : '\n';
        out = prefix + lead + body + trail + suffix;
      } else {
        out = text.replace(op.anchor, body);
      }
      writeFileSync(targetPath, out);
    }
    continue;
  }
  if (op.type === 'generate_world_folders') {
    const srcRoot = path.join(packDir, op.source_folder);
    const files = readdirSync(srcRoot, { withFileTypes: true }).filter((e) => e.isFile());
    for (const [folder, defines] of Object.entries(op.folders)) {
      if (defines.length !== 1) { fail(op.id, `folder ${folder} needs exactly one define`); continue; }
      const dest = path.join(srcRoot, '..', folder);
      if (checkOnly) continue;
      mkdirSync(dest, { recursive: true });
      for (const f of files) {
        const src = path.join(srcRoot, f.name);
        const dst = path.join(dest, f.name);
        copyFileSync(src, dst);
        const t = readFileSync(dst, 'utf8').replace(/\r\n/g, '\n');
        const marks = t.split('\n').filter((l) => l === '#define OVERWORLD').length;
        if (/\.(vsh|fsh|csh)$/.test(f.name) && marks === 1) {
          writeFileSync(dst, t.replace('#define OVERWORLD', `#define OVERWORLD\n#define ADASTRA_PRESET 1\n#define ${defines[0]} 1`));
        }
      }
    }
    continue;
  }
  if (op.type === 'remap_dimension_properties') {
    const text = readTarget(op);
    if (text == null) continue;
    const lines = text.split('\n');
    const guard = lines.indexOf('#if MC_VERSION > 10710');
    const els = lines.indexOf('#else');
    if (guard < 0 || els < 0 || els <= guard) { fail(op.id, 'modern/legacy branch markers not found'); continue; }
    const remove = new Set(op.remove_ids);
    const counts = Object.fromEntries(op.remove_ids.map((id) => [id, 0]));
    const modern = lines.slice(guard + 1, els);
    const rewritten = [];
    for (let i = 0; i < modern.length; i++) {
      const line = modern[i];
      const cont = line.trimEnd().endsWith('\\');
      const body = cont ? line.trimEnd().slice(0, -1).trimEnd() : line;
      const toks = body.split(/\s+/).filter(Boolean);
      const matched = toks.filter((t) => remove.has(t));
      if (!matched.length) { rewritten.push(line); continue; }
      matched.forEach((t) => counts[t]++);
      const rest = toks.filter((t) => !remove.has(t));
      if (rest.length) {
        const indent = body.slice(0, body.length - body.trimStart().length);
        rewritten.push(`${indent}${rest.join(' ')}${cont ? ' \\' : ''}`);
      } else {
        if (!cont) { fail(op.id, `removed-id line lacks continuation: ${line}`); }
        i++; // skip the paired bare "\" line
      }
    }
    const bad = Object.entries(counts).filter(([, c]) => c !== 1);
    if (bad.length) { fail(op.id, `ids not found exactly once: ${bad.map(([k]) => k).join(',')}`); continue; }
    const endIdx = rewritten.findIndex((l) => l.startsWith('dimension.world1='));
    if (endIdx < 0) { fail(op.id, 'dimension.world1 group not found'); continue; }
    let insertAt = endIdx;
    while (rewritten[insertAt].trimEnd().endsWith('\\')) insertAt++;
    const banner = [
      '',
      '#---------------------------------------------------------------------------------------------------------------------',
      '# Starforge Ad Astra custom dimension mappings',
      '#---------------------------------------------------------------------------------------------------------------------',
      ...op.add_lines,
    ];
    rewritten.splice(insertAt + 1, 0, ...banner);
    if (!checkOnly) {
      writeFileSync(targetPath, [...lines.slice(0, guard + 1), ...rewritten, ...lines.slice(els)].join('\n'));
    }
    continue;
  }
  fail(op.id, `unknown op type ${op.type}`);
}

if (failures) { console.error(`${failures} op(s) failed`); process.exit(1); }
if (!checkOnly) writeFileSync(path.join(packDir, 'shaders', '.starforge_adastra_patch'), `applied=${new Date().toISOString()}\nops=${manifest.ops.length}\n`);
console.log(checkOnly ? 'check ok' : 'patch applied');
