// Shared design-data loader. Design sources were split so stage relationships
// live in exactly one file:
//   design/content.json      questbook content (chapters/quests/tutorials/items)
//   design/progression.json  T0-T7 era stages + capability (ability) nodes
//   design/advancements.json custom advancement definitions
//   design/guidance.json     runtime guidance events (detection -> counter/adv/hint)
//   design/reward-pools.json milestone_reward_pack loot pools per era tier
//   design/semantic-map.json semantic id registry
//   design/tech-tiers.json   per-era affordability tiers (design metadata, not locks)
// Loaders return one merged view so every generator reads the same truth.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const j = (root, p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));

export function loadDesign(root) {
  const content = j(root, 'design/content.json');
  const progression = j(root, 'design/progression.json');
  const advancements = j(root, 'design/advancements.json');
  const guidance = j(root, 'design/guidance.json');
  const rewardPools = j(root, 'design/reward-pools.json');
  const sm = j(root, 'design/semantic-map.json');
  const tiers = j(root, 'design/tech-tiers.json');
  return {
    ...content,
    stages: progression.stages,
    abilities: progression.abilities ?? [],
    categories: progression.categories ?? [],
    advancements: advancements.advancements ?? [],
    advancementBackground: advancements.default_background ?? null,
    guidance: guidance ?? { events: [] },
    rewardPools: rewardPools.pools ?? {},
    sm,
    tiers,
  };
}

// Every node on the progression map (eras + abilities) shares the modpack
// namespace and the same dependency graph — none of them gate gameplay.
export function allNodes(design) {
  return [...design.stages, ...design.abilities];
}
