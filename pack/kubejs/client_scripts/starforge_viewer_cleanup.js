// Starforge unobtainable-content cleanup — JEI/EMI entry hiding (client side;
// the server-side removeEntries variant only accepts Ingredient form, while
// the viewer plugins wrap predicates and support function filters).
// These entries are registered but can never be legitimately obtained or used
// in this pack (missing dependency resources, no recipe, dead upstream
// format). Recipes themselves are removed in starforge_recipes.js or via
// datapack overrides; this script only owns the viewer-side lists.
// TaCZ exposes guns/ammo/attachments as component variants of generic items
// (tacz:modern_kinetic_gun/tacz:ammo/tacz:attachment), so matching goes
// through custom_data keys (GunId/AmmoId/AttachmentId/BlockId).
function sfTag(stack, key) {
  try {
    const nbt = stack.customData ?? stack.nbt;
    if (!nbt) return '';
    const v = nbt.getString ? nbt.getString(key) : nbt[key];
    return String(v ?? '').replace(/^"|"$/g, '');
  } catch (err) { return ''; }
}
const sfVariant = (itemId, key, value) => (stack) =>
  String(stack.id) === itemId && sfTag(stack, key) === value;
const sfVariantNs = (itemId, key, ns) => (stack) =>
  String(stack.id) === itemId && sfTag(stack, key).startsWith(ns);

RecipeViewerEvents.removeEntries('item', (e) => {
  // eos:eos_chaos — its display/model/animation/audio all reference the
  // uninstalled setsentinel namespace; unusable without that mod.
  e.remove(sfVariant('tacz:modern_kinetic_gun', 'GunId', 'eos:eos_chaos'));
  // eos:eoslab_12g — ammo index exists upstream but no recipe anywhere.
  e.remove(sfVariant('tacz:ammo', 'AmmoId', 'eos:eoslab_12g'));
  // eos:alloy — ammo index entry no EOS gun fires; only referenced by the
  // dead upstream attachment recipes below.
  e.remove(sfVariant('tacz:ammo', 'AmmoId', 'eos:alloy'));
  // All eos:* attachments — every upstream attachment recipe uses the removed
  // pre-1.21 forge:partial_nbt/forge:tag ingredient syntax, so none load on
  // NeoForge 1.21.1: registered but unobtainable. Hidden wholesale.
  e.remove(sfVariantNs('tacz:attachment', 'AttachmentId', 'eos:'));
  // eos_old:old_conversion skin-conversion bench — its two chasing_light
  // conversion recipes are the same dead forge: format.
  e.remove(sfVariant('tacz:workbench_a', 'BlockId', 'eos_old:old_conversion'));
});

// SF-36: disabled generation devices. Public power is FE -> FastPipes fed by
// IE / IC2CRE / BuildCraft; Ad Astra, AE2 and Refurbished appliances are
// consumers only, so these entries are hidden along with their removed
// recipes (see starforge_recipes.js).
RecipeViewerEvents.removeEntries('item', (e) => {
  for (const id of [
    'ad_astra:coal_generator',
    'ad_astra:solar_panel',
    'refurbished_furniture:light_electricity_generator',
    'refurbished_furniture:dark_electricity_generator',
    'ae2:vibration_chamber'
  ]) e.remove(id);
});
