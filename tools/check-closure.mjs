// Earth-closure check: expand a target item's recipe graph and flag inputs that
// require leaving Earth. Tag ingredients are alternatives — a slot is viable if
// ANY member is earth-obtainable; we recurse into one viable member only.
// Usage: node tools/check-closure.mjs <itemId> [<itemId>...]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const j = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));

const recipes = j('registry-export/recipes.json');
const itemTags = j('registry-export/tags_item.json');
const items = new Set(j('registry-export/items.json'));

// Ad Astra planet-only materials (no earth source by design).
const SPACE_ONLY = [
  /^ad_astra:(desh|ostrum|calorite)(_|$)/,
  /^ad_astra:(moon|mars|venus|mercury|glacio)_/,
  /^ad_astra:(aeronos|strophar|glacian|permafrost|ice_shard|cheese|etrionic|lunarian)/,
  /^ad_astra:sky_stone/,
];

const EARTH_RAW = /^minecraft:/; // vanilla ids are world-obtainable on earth

// Modded items confirmed to spawn on earth via overworld worldgen
// (verified: ic2cre rubber_tree + lead/tin/uranium biome modifiers target
// #minecraft:is_overworld; IE bauxite/nickel/lead/silver/uranium/mineral_veins
// do the same). Worldgen drops have no crafting recipe by nature.
const WORLDGEN_EARTH = new RegExp([
  'ic2cre:(rubber_log|rubber_wood|stripped_rubber_log|rubber_leaves|rubber_sapling|sticky_resin)',
  // Starforge worldgen dedup: IC2CRE lead veins disabled (kubejs/data override),
  // tin + uranium kept as the canonical IC2CRE deposits.
  'ic2cre:((deepslate_)?(tin|uranium)_ore|raw_(tin|uranium)(_block)?)',
  // IE keeps lead/nickel/silver/aluminum veins; IE uranium veins disabled.
  'immersiveengineering:((deepslate_)?ore_(aluminum|lead|nickel|silver)|raw_(aluminum|lead|nickel|silver)|raw_block_(aluminum|lead|nickel|silver))',
  // Railcraft earth deposits — lead/tin/silver/nickel veins disabled; sulfur,
  // zinc, saltpeter and quarried stone remain the sole Railcraft deposits.
  'railcraft:((deepslate_)?(sulfur|zinc)_ore|saltpeter_ore|quarried_stone)',
].join('|') + '$');

// Bucket items for fluids produced on earth by machines (no crafting recipe by
// nature — filled from the fluid). Verified: railcraft:coking outputs creosote
// (creosoteOutput 250–5000 mB), IE coke oven does the same; all are unified
// under c:creosote by the pack's fluid bridge.
const EARTH_FLUID_CONTAINER = /^(railcraft|immersiveengineering|ic2cre):creosote_bucket$/;

const byResult = new Map();
const indexResult = (rid, r) => {
  if (!rid) return;
  if (!byResult.has(rid)) byResult.set(rid, []);
  byResult.get(rid).push(r);
};
for (const r of recipes) {
  const m = /^(\S+) x\d+$/.exec(r.result ?? '');
  indexResult(m ? m[1] : r.json?.result?.id ?? r.json?.result?.item, r);
  // Machine recipes expose outputs[]/results[] instead of a single result.
  for (const arr of [r.json?.outputs, r.json?.results]) {
    if (!Array.isArray(arr)) continue;
    for (const o of arr) indexResult(o?.result?.id ?? o?.result?.item ?? o?.id ?? o?.item, r);
  }
}

const spaceOnly = (id) => SPACE_ONLY.some((re) => re.test(id));
const rawEarth = (id) => (EARTH_RAW.test(id) || WORLDGEN_EARTH.test(id) || EARTH_FLUID_CONTAINER.test(id)) && !spaceOnly(id);
const producible = (id) => rawEarth(id) || (byResult.has(id) && !spaceOnly(id));

// One ingredient slot -> list of alternative item ids.
const slotAlts = (ing) => {
  if (!ing) return [];
  if (Array.isArray(ing)) return ing.flatMap(slotAlts);
  if (ing.item) return [ing.item];
  if (ing.tag) return itemTags[ing.tag] ?? [];
  if (ing.id) return [ing.id];
  return [];
};

// A recipe's input slots: list of alternative-id lists.
const recipeSlots = (r) => {
  const j = r.json ?? {};
  let raw = j.ingredients ?? r.ingredients ?? Object.values(j.key ?? {});
  if (!Array.isArray(raw)) raw = Object.values(raw ?? {});
  return raw.map(slotAlts).filter((a) => a.length);
};

// Choose one earth-viable alternative for a slot, else null.
const pickViable = (alts) =>
  alts.find((a) => rawEarth(a)) ??
  alts.find((a) => producible(a)) ??
  null;

function closure(target, seen, flags) {
  if (seen.has(target)) return;
  seen.add(target);
  if (spaceOnly(target)) { flags.space.add(target); return; }
  const list = byResult.get(target);
  if (!list?.length) {
    if (!rawEarth(target) && items.has(target)) flags.orphan.add(target);
    return;
  }
  // Prefer a fully clean recipe; fall back to the first with any viable slots.
  const scored = list.map((r) => {
    const slots = recipeSlots(r);
    const dead = slots.filter((s) => s.every((a) => spaceOnly(a)) || s.every((a) => !producible(a)));
    return { slots, dead };
  });
  scored.sort((a, b) => a.dead.length - b.dead.length);
  const best = scored[0];
  for (const deadSlot of best.dead) {
    flags.noCleanRecipe.add(`${target} <- [${deadSlot.slice(0, 4).join('|')}${deadSlot.length > 4 ? '|…' : ''}]`);
  }
  for (const slot of best.slots) {
    const pick = pickViable(slot);
    if (pick) closure(pick, seen, flags);
  }
}

const targets = process.argv.slice(2);
if (!targets.length) { console.log('usage: node tools/check-closure.mjs <itemId>...'); process.exit(2); }
let bad = 0;
for (const t of targets) {
  const flags = { space: new Set(), orphan: new Set(), noCleanRecipe: new Set() };
  closure(t, new Set(), flags);
  console.log(`\n=== ${t}: ${flags.space.size} space-only, ${flags.noCleanRecipe.size} dead slots, ${flags.orphan.size} unproduced`);
  for (const s of flags.space) { console.log(`  SPACE-ONLY: ${s}`); bad++; }
  for (const s of flags.noCleanRecipe) { console.log(`  DEAD-SLOT: ${s}`); bad++; }
  for (const s of flags.orphan) console.log(`  no-recipe leaf: ${s}`);
}
process.exit(bad ? 1 : 0);
