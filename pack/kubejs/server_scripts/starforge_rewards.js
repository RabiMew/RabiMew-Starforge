// Milestone reward pack — right-click consumes one and rolls its loot table.
// FTB quest rewards stamp the pool into custom_data.reward_pool
// (design/content.json rewards[].pool -> export-quests -> item components);
// the tables are generated from design/reward-pools.json as
// modpack:milestone_reward/<pool>. Unstamped packs (creative/test) fall back
// to the opener's highest owned era stage via ProgressiveStages.
const SF_POOL_RE = /^tier_[1-7]$/;
// highest tier first — first owned era wins
const SF_ERA_TIERS = [
  'quantum_age', 'space_age', 'atomic_age', 'heavy_industry_age',
  'information_age', 'electric_age', 'mechanical_age'
];

ItemEvents.rightClicked('modpack:milestone_reward_pack', (e) => {
  const player = e.player;
  if (!player || !player.getServer()) return;
  // a single click can fire once per hand; consume only one pack per tick
  const tick = player.getServer().getTickCount();
  if (player.persistentData.getInt('sf_rp_tick') === tick) return;
  player.persistentData.putInt('sf_rp_tick', tick);

  let pool = '';
  try {
    const nbt = e.item.customData ?? e.item.nbt;
    if (nbt) {
      const raw = nbt.getString ? nbt.getString('reward_pool') : nbt.reward_pool;
      pool = String(raw ?? '').replace(/^"|"$/g, '');
    }
  } catch (err) {}
  if (!SF_POOL_RE.test(pool)) {
    pool = 'tier_1';
    for (const stage of SF_ERA_TIERS) {
      try {
        if (ProgressiveStages.has(player, `modpack:${stage}`)) {
          pool = `tier_${7 - SF_ERA_TIERS.indexOf(stage)}`;
          break;
        }
      } catch (err) {}
    }
  }

  e.item.shrink(1);
  const name = player.getGameProfile().getName();
  player.getServer().runCommandSilent(`loot give ${name} loot modpack:milestone_reward/${pool}`);
  player.getServer().runCommandSilent(`playsound minecraft:item.bundle.drop_contents player ${name} ~ ~ ~ 1 1`);
});
