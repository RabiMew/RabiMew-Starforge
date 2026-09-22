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
