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
  'ic2cre:(rubber_log|rubber_wood|stripped_rubber_log|stripped_rubber_wood|rubber_leaves|rubber_sapling|sticky_resin)',
  'ic2cre:((deepslate_)?(tin|lead|uranium)_ore|raw_(tin|lead|uranium)(_block)?)',
  'immersiveengineering:((deepslate_)?ore_(aluminum|lead|nickel|silver|uranium)|raw_(aluminum|lead|nickel|silver|uranium)|raw_block_(aluminum|lead|nickel|silver|uranium))',
].join('|') + '$');

const byResult = new Map();
for (const r of recipes) {
  const m = /^(\S+) x\d+$/.exec(r.result ?? '');
  const rid = m ? m[1] : r.json?.result?.id ?? r.json?.result?.item;
  if (rid) {
    if (!byResult.has(rid)) byResult.set(rid, []);
    byResult.get(rid).push(r);
  }
}

const spaceOnly = (id) => SPACE_ONLY.some((re) => re.test(id));
const rawEarth = (id) => (EARTH_RAW.test(id) || WORLDGEN_EARTH.test(id)) && !spaceOnly(id);
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
