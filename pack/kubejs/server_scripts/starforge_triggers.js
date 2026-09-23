// Starforge stage-evidence hook: crafting a milestone component increments the
// ProgressiveStages custom counter that grants the next stage. This is the
// server-verified production signal (ItemCraftedEvent fires server-side only).
// PS native 'craft' triggers remain as a second grant route.
const EVIDENCE_COMPONENTS = [
  'engineering_assembly', 'ic2_generator', 'information_interface',
  'heavy_industry_control', 'reactor_control', 'space_control_core', 'quantum_control'
];
const EVIDENCE = {};
for (let k = 0; k < EVIDENCE_COMPONENTS.length; k++) {
  let name = EVIDENCE_COMPONENTS[k];
  let itemId = global.SM.items[name];
  if (!itemId) throw new Error('missing evidence item mapping: ' + name);
  EVIDENCE[itemId] = 'modpack:craft_' + name;
}
ItemEvents.crafted((e) => {
  let key = EVIDENCE[String(e.item.id)];
  if (!key) return;
  let p = e.player || e.entity;
  try { ProgressiveStages.addCounter(p, key, 1); } catch (err) {
    console.log('[starforge] counter bump failed: ' + err);
  }
});

// First-time military guidance — once per player each, no spam.
ItemEvents.crafted('taczturrets:turret', (e) => {
  let p = e.player;
  if (!p || p.persistentData.getInt('sf_tip_turret')) return;
  p.persistentData.putInt('sf_tip_turret', 1);
  p.tell(Text.translate('modpack.message.tacz_turret_tip'));
});

// DRG guns arrive via the TaCZ smith table (no ItemEvents.crafted), so watch
// the inventory instead: custom_data.GunId namespaced deep_rock_galactic:*.
PlayerEvents.inventoryChanged('tacz:modern_kinetic_gun', (e) => {
  let p = e.player;
  if (!p || p.persistentData.getInt('sf_tip_drg')) return;
  let gid = '';
  try {
    let tag = e.item.nbt;
    if (tag && tag.GunId) gid = String(tag.GunId);
  } catch (err) { return; }
  if (!gid.startsWith('deep_rock_galactic:')) return;
  p.persistentData.putInt('sf_tip_drg', 1);
  p.tell(Text.translate('modpack.message.drg_gun_tip'));
});
