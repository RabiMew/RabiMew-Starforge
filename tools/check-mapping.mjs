// Validates design/semantic-map.json against registry-export/*.
// modpack:* items must be declared in design/content.json (registered by KubeJS at runtime).
// Usage: node tools/check-mapping.mjs   (fails on any unknown id)
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const j = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));

const map = j('design/semantic-map.json');
const content = j('design/content.json');
const packItems = new Set(content.items.map((i) => `modpack:${i.id}`));

const registries = {
  items: 'items.json',
  fluids: 'fluids.json',
  entities: 'entity_types.json',
  dimensions: 'dimensions.json'
};
const sets = {};
for (const [section, file] of Object.entries(registries)) {
  const p = `registry-export/${file}`;
  assert(existsSync(path.join(root, p)), `missing ${p} — run the registry dump first`);
  sets[section] = new Set(j(p));
}
const tagSets = {
  items: new Set(Object.keys(j('registry-export/tags_item.json'))),
  fluids: new Set(Object.keys(j('registry-export/tags_fluid.json')))
};

let errors = 0;
for (const [section, entries] of Object.entries(map)) {
  if (!entries || typeof entries !== 'object' || section === 'schema_version' || section === 'comment') continue;
  for (const [sem, id] of Object.entries(entries)) {
    if (section === 'tags') {
      const ok = tagSets.items.has(id) || tagSets.fluids.has(id);
      if (!ok) { console.error(`MISSING tag ${sem} -> ${id}`); errors++; }
      continue;
    }
    const reg = sets[section];
    if (!reg) { console.error(`unknown section ${section}`); errors++; continue; }
    if (packItems.has(id)) continue; // our own items
    if (id.startsWith('modpack:')) { console.error(`undeclared pack item ${sem} -> ${id} (not in content.json)`); errors++; continue; }
    if (!reg.has(id)) { console.error(`MISSING ${section} ${sem} -> ${id}`); errors++; }
  }
}
// stage-locks.json: every entry must be a semantic key declared in the map's matching section.
const locksPath = 'design/stage-locks.json';
if (existsSync(path.join(root, locksPath))) {
  const locks = j(locksPath);
  const stages = new Set(j('design/content.json').stages.map((s) => s.id));
  for (const [stageId, lock] of Object.entries(locks)) {
    if (stageId === 'schema_version' || stageId === 'comment') continue;
    if (!stages.has(stageId)) { console.error(`stage-locks: unknown stage ${stageId}`); errors++; continue; }
    for (const section of ['items', 'blocks', 'dimensions']) {
      const lookup = section === 'dimensions' ? map.dimensions : map.items;
      for (const sem of lock[section] ?? []) {
        if (!lookup[sem]) { console.error(`stage-locks ${stageId}.${section}: unmapped semantic key ${sem}`); errors++; }
      }
    }
  }
}

// Progression-deadlock guard: a stage's unlock_evidence item must not be locked
// by any stage outside that stage's ancestor set (otherwise the evidence can
// never be crafted and the chain stalls).
{
  const deps = {};
  for (const s of content.stages) deps[s.id] = s.depends_on ?? [];
  const ancestors = (id) => {
    const seen = new Set();
    const walk = (x) => (deps[x] ?? []).forEach((d) => { if (!seen.has(d)) { seen.add(d); walk(d); } });
    walk(id);
    return seen;
  };
  const locks = existsSync(path.join(root, locksPath)) ? j(locksPath) : {};
  for (const s of content.stages) {
    const ev = s.unlock_evidence;
    if (!ev?.component) continue;
    const itemId = map.items[ev.component];
    if (!itemId) continue; // already reported above
    const anc = ancestors(s.id);
    for (const [lockStage, lock] of Object.entries(locks)) {
      if (lockStage === 'schema_version' || lockStage === 'comment') continue;
      const ids = [...(lock.items ?? []), ...(lock.blocks ?? [])].map((k) => map.items[k] ?? k);
      if (ids.includes(itemId) && !anc.has(lockStage)) {
        console.error(`DEADLOCK: ${s.id} evidence ${itemId} is locked by non-ancestor stage ${lockStage}`);
        errors++;
      }
    }
  }
}
if (errors) { console.error(`FAIL: ${errors} unresolved mappings`); process.exit(1); }
console.log(`PASS: all semantic ids resolve (${Object.values(map).filter(v => v && typeof v === 'object').reduce((s, o) => s + Object.keys(o).length, 0)} entries)`);
