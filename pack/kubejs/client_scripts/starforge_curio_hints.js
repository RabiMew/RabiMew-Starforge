// Starforge curio tier hints: appends a "found in" line to every Artifacts item.
// Hand-written (not generated) — text keys live in kubejs/assets/starforge/lang/.
const CURIO_TIERS = {
  earth: [
    'anglers_hat', 'aqua_dashers', 'bunny_hoppers', 'charm_of_shrinking',
    'charm_of_sinking', 'cowboy_hat', 'digging_claws', 'flippers', 'golden_hook',
    'kitty_slippers', 'lucky_scarf', 'novelty_drinking_hat', 'onion_ring',
    'panic_necklace', 'pickaxe_heater', 'plastic_drinking_hat', 'running_shoes',
    'snorkel', 'snowshoes', 'superstitious_hat', 'umbrella', 'villager_hat',
    'whoopee_cushion'
  ],
  moon_mars: [
    'antidote_vessel', 'cloud_in_a_bottle', 'everlasting_beef', 'flame_pendant',
    'helium_flamingo', 'night_vision_goggles', 'pocket_piston', 'rooted_boots',
    'steadfast_spikes', 'universal_attractor', 'warp_drive'
  ],
  venus_mercury: [
    'cross_necklace', 'feral_claws', 'fire_gauntlet', 'obsidian_skull',
    'power_glove', 'shock_pendant', 'strider_shoes', 'thorn_pendant',
    'vampiric_glove', 'withered_bracelet'
  ],
  glacio_belt: ['chorus_totem', 'crystal_heart', 'scarf_of_invisibility'],
  disabled: ['eternal_steak']
};

ItemEvents.modifyTooltips((e) => {
  for (const tier of Object.keys(CURIO_TIERS)) {
    const key = 'starforge.curio.tier.' + tier;
    for (const id of CURIO_TIERS[tier]) {
      e.add('artifacts:' + id, [Text.translate(key).gray()]);
    }
  }
});
