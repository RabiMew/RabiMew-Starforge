// Validates design/semantic-map.json against registry-export/*.
// modpack:* items must be declared in design/content.json (registered by KubeJS at runtime).
// Usage: node tools/check-mapping.mjs   (fails on any unknown id)
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadDesign } from './lib/design.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const j = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));

const design = loadDesign(root);
const map = design.sm;
const content = design;
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
// tech-tiers.json: design-only affordability metadata (NOT runtime locks — the
// pack is pure soft-lock). Every entry must be a semantic key declared in the
// map's matching section so quest/reward consistency checks can resolve it.
const tiers = design.tiers ?? {};
{
  const stages = new Set(design.stages.map((s) => s.id));
  for (const [stageId, tier] of Object.entries(tiers)) {
    if (stageId === 'schema_version' || stageId === 'comment') continue;
    if (!stages.has(stageId)) { console.error(`tech-tiers: unknown stage ${stageId}`); errors++; continue; }
    for (const section of ['items', 'blocks', 'dimensions']) {
      const lookup = section === 'dimensions' ? map.dimensions : map.items;
      for (const sem of tier[section] ?? []) {
        if (!lookup[sem]) { console.error(`tech-tiers ${stageId}.${section}: unmapped semantic key ${sem}`); errors++; }
      }
    }
  }
}

// Milestone-craftability guard: every era's unlock_evidence component must have
// at least one recipe producing it (stages are earned by crafting; an
// uncraftable component would make the milestone unreachable).
{
  const recipes = j('registry-export/recipes.json');
  const craftable = new Set();
  const addResult = (rid) => { if (rid) craftable.add(rid); };
  for (const r of recipes) {
    const m = /^(\S+) x\d+$/.exec(r.result ?? '');
    addResult(m ? m[1] : r.json?.result?.id ?? r.json?.result?.item);
    for (const arr of [r.json?.outputs, r.json?.results]) {
      if (!Array.isArray(arr)) continue;
      for (const o of arr) addResult(o?.result?.id ?? o?.result?.item ?? o?.id ?? o?.item);
    }
  }
  for (const s of design.stages) {
    const ev = s.unlock_evidence;
    if (!ev?.component) continue;
    const itemId = map.items[ev.component];
    if (!itemId) continue; // already reported above
    if (!craftable.has(itemId)) {
      console.error(`UNCRAFTABLE: ${s.id} evidence ${itemId} has no recipe in registry-export`);
      errors++;
    }
  }
}
if (errors) { console.error(`FAIL: ${errors} unresolved mappings`); process.exit(1); }
console.log(`PASS: all semantic ids resolve (${Object.values(map).filter(v => v && typeof v === 'object').reduce((s, o) => s + Object.keys(o).length, 0)} entries)`);
