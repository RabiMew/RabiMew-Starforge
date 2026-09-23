const slugs = [
  'immersiveengineering','immersive-petroleum','storagedrawers','sophisticated-storage',
  'sophisticated-backpacks','sophisticated-core','ae2','ad-astra','ad-astra-more-structures',
  'the-hordes','zombies-break-and-build','tacz-turrets','taczaddon','tacz-pack-upgrader','in-control','progressivestages',
  'kubejs','ftb-quests','farmers-delight','cooking-for-blockheads','framedblocks',
  'supplementaries','macaws-furniture','modern-decorations-mod','building-gadgets','building-gadgets2','enderman-overhaul','mutant-monsters',
  'creature-feature','arachnids','easy-villagers','guard-villagers','tacz-1.21.1','guard-villagers-tacz-support',
  'polymorph','controlling','searchables','mouse-tweaks','crafting-tweaks','balm','appleskin',
  'jade-addons','jade','carry-on','jei','modernfix','ferrite-core','servercore','fastsuite',
  'placebo','let-me-despawn','almanac','clumps','sodium','immediatelyfast','entityculling',
  'dynamic-fps','lithium','spark','chunky','ftb-library','ftb-teams','ftb-xmod-compat',
  'moonlight','selene','framework','bookshelf','puzzles-lib','moonlight-lib'
];
const q = encodeURIComponent(JSON.stringify({game_versions:['1.21.1'],loaders:['neoforge']}));
for (const slug of slugs) {
  try {
    const r = await fetch(`https://api.modrinth.com/v2/project/${slug}/version?loaders=%5B%22neoforge%22%5D&game_versions=%5B%221.21.1%22%5D`);
    if (!r.ok) { console.log(`${slug}: MISS(${r.status})`); continue; }
    const vs = await r.json();
    console.log(`${slug}: ${vs.length} versions, latest=${vs[0]?.version_number}`);
  } catch (e) { console.log(`${slug}: ERR ${e.message}`); }
}
