// Starforge recipe layer — implements SF-01..SF-30 against real registry ids.
// Semantic names resolve via global.SM (generated from design/semantic-map.json).
// TaCZ gun/ammo changes (SF-31..33) live in the TaCZ gun pack override, not here.
ServerEvents.recipes((e) => {
  const M = global.SM.items;
  const missing = (k) => { throw new Error(`semantic id missing: ${k}`) };
  const i = (k) => M[k] || missing(k);

  // ---------- SF-01 T0: engineering_assembly (T1 evidence) ----------
  e.shaped(i('engineering_assembly'), ['ICI', 'RPR', 'ICI'], {
    I: 'minecraft:iron_ingot', C: 'minecraft:copper_ingot',
    R: 'minecraft:redstone', P: 'minecraft:piston'
  });

  // ---------- SF-03 T1: IC2 generator gains an IE iron mechanical component ----------
  e.remove({ output: 'ic2cre:generator' });
  e.shaped('ic2cre:generator', [' M ', 'PFP', 'PBP'], {
    M: i('ie_iron_component'), P: '#c:plates/iron',
    F: i('ic2_iron_furnace'), B: i('ic2_battery')
  });

  // ---------- SF-04 T2: IE capacitors require IC2 circuits ----------
  // Fluid ingredient must be passed through raw (immersiveengineering:fluid_stack).
  e.remove({ output: 'immersiveengineering:capacitor_lv' });
  e.custom({
    type: 'minecraft:crafting_shaped', category: 'misc',
    pattern: ['ere', 'awa', ' c '],
    key: {
      a: { tag: 'c:plates/lead' }, e: { tag: 'c:ingots/copper' },
      r: { type: 'immersiveengineering:fluid_stack', tag: 'c:redstone_acid', amount: 1000 },
      w: { item: 'immersiveengineering:basic_engineering' },
      c: { item: 'ic2cre:circuit' }
    },
    result: { id: 'immersiveengineering:capacitor_lv', count: 1 }
  });
  e.remove({ output: 'immersiveengineering:capacitor_mv' });
  e.custom({
    type: 'minecraft:crafting_shaped', category: 'misc',
    pattern: ['ere', 'awc', ' x '],
    key: {
      a: { tag: 'c:plates/nickel' }, c: { tag: 'c:plates/iron' }, e: { tag: 'c:ingots/electrum' },
      r: { type: 'immersiveengineering:fluid_stack', tag: 'c:redstone_acid', amount: 1000 },
      w: { item: 'immersiveengineering:basic_engineering' },
      x: { item: 'ic2cre:circuit' }
    },
    result: { id: 'immersiveengineering:capacitor_mv', count: 1 }
  });
  e.remove({ output: 'immersiveengineering:capacitor_hv' });
  e.custom({
    type: 'minecraft:crafting_shaped', category: 'misc',
    pattern: ['ere', 'awc', ' x '],
    key: {
      a: { tag: 'c:plates/aluminum' }, c: { tag: 'c:plates/hop_graphite' }, e: { tag: 'c:ingots/aluminum' },
      r: { type: 'immersiveengineering:fluid_stack', tag: 'c:redstone_acid', amount: 1000 },
      w: { item: 'immersiveengineering:basic_engineering' },
      x: { item: 'ic2cre:advanced_circuit' }
    },
    result: { id: 'immersiveengineering:capacitor_hv', count: 1 }
  });

  // ---------- SF-05 T2: information_interface (T3 evidence) ----------
  e.shapeless(i('information_interface'), [
    i('ic2_advanced_circuit'), '2x immersiveengineering:component_electronic', '2x ae2:quartz_glass'
  ]);

  // ---------- SF-06 T3: AE2 inscriber reworked ----------
  e.remove({ output: 'ae2:inscriber' });
  e.shaped('ae2:inscriber', ['IMI', 'CPC', 'IMI'], {
    I: 'minecraft:iron_ingot', M: i('ie_iron_component'),
    C: i('ic2_circuit'), P: 'minecraft:piston'
  });

  // ---------- SF-07 T3: Earth craft for all four AE2 presses ----------
  const pressMinerals = {
    'ae2:calculation_processor_press': 'ae2:certus_quartz_crystal',
    'ae2:engineering_processor_press': 'minecraft:diamond',
    'ae2:logic_processor_press': 'minecraft:gold_ingot',
    'ae2:silicon_press': 'ae2:silicon'
  };
  for (const press of Object.keys(pressMinerals)) {
    e.shapeless(press, [pressMinerals[press], '2x #c:plates/steel', i('ic2_circuit')]);
  }

  // ---------- SF-08 T3: AE2 controller reworked ----------
  e.remove({ output: 'ae2:controller' });
  e.shaped('ae2:controller', ['SCS', 'BEB', 'SAS'], {
    S: i('ae2_sky_stone'), C: i('ic2_advanced_circuit'),
    B: i('ae2_engineering_processor'), E: i('ie_electronic'),
    A: i('ae2_fluix_crystal')
  });

  // ---------- SF-09 T3: pattern provider / crafting unit / assembler ----------
  e.remove({ output: 'ae2:pattern_provider' });
  e.remove({ id: 'ae2:network/blocks/pattern_providers_interface_part' });
  e.shaped('ae2:pattern_provider', ['IMI', 'CFC', 'IMI'], {
    I: 'minecraft:iron_ingot', M: i('ie_iron_component'),
    C: i('ic2_circuit'), F: 'ae2:interface'
  });
  e.remove({ output: 'ae2:crafting_unit' });
  e.shaped('ae2:crafting_unit', ['IMI', 'KLK', 'IMI'], {
    I: 'minecraft:iron_ingot', M: i('ie_iron_component'),
    K: i('ae2_calculation_processor'), L: i('ae2_logic_processor')
  });
  e.remove({ output: 'ae2:molecular_assembler' });
  e.shaped('ae2:molecular_assembler', ['IMI', 'AWF', 'IMI'], {
    I: 'minecraft:iron_ingot', M: i('ie_iron_component'),
    A: i('ae2_annihilation_core'), F: i('ae2_formation_core'), W: 'minecraft:crafting_table'
  });

  // ---------- SF-10 T4: TACZ auto-turret (replaces Defense Turrets) ----------
  // Gun-carrying turret; feeds from the container it stands on. Default recipe
  // was plain iron — far below its mid-late military role.
  e.remove({ output: 'taczturrets:turret' });
  e.shaped('taczturrets:turret', ['SCS', 'PHP', 'SCS'], {
    S: '#c:plates/steel', C: i('ie_steel_component'),
    P: i('ae2_engineering_processor'), H: i('ie_heavy_engineering')
  });

  // ---------- SF-11 T3: heavy_industry_control (T4 evidence) ----------
  e.shapeless(i('heavy_industry_control'), [
    '2x ic2cre:advanced_circuit', '2x ae2:logic_processor', '2x immersiveengineering:component_steel'
  ]);

  // ---------- SF-12 T4: BC quarry reworked (orig structure + circuits + steel comps) ----------
  e.remove({ output: 'buildcraftbuilders:quarry' });
  e.shaped('buildcraftbuilders:quarry', ['SCS', 'DGD', 'SPS'], {
    S: i('ie_steel_component'), C: i('ic2_advanced_circuit'),
    D: i('bc_gear_diamond'), G: i('bc_gear_gold'), P: 'minecraft:diamond_pickaxe'
  });

  // ---------- SF-13 T4: IE heavy engineering block ----------
  e.remove({ output: 'immersiveengineering:heavy_engineering' });
  e.shaped('4x immersiveengineering:heavy_engineering', ['SAS', 'GCG', 'SAS'], {
    S: 'immersiveengineering:component_steel', A: i('ic2_alloy'),
    G: i('ic2_advanced_circuit'), C: 'immersiveengineering:sheetmetal_steel'
  });

  // ---------- SF-15 T4: reactor_control (T5 evidence) ----------
  e.shaped(i('reactor_control'), ['LLL', 'SAS', 'LLL'], {
    L: i('ic2_lead_plate'), S: 'immersiveengineering:component_steel', A: i('ic2_advanced_circuit')
  });

  // ---------- SF-16: Deep Rock Galactic gun pack — industrial re-costing ----------
  // The upgraded 1.21.1 pack ships flat vanilla-ish recipes (gold/diamond
  // blocks + redstone). Guns and ammo all share tacz:* item ids, so
  // ProgressiveStages cannot lock them — the gate is the stage-locked
  // industrial material inside each recipe instead:
  //   T3 (information_age): ae2:engineering_processor  — DRG rifles/SMGs
  //   T4 (heavy_industry_age): immersiveengineering:heavy_engineering — shotguns/specials
  //   T5 (atomic_age): ic2cre:containment_reactor_plating + singularity/anomaly — AoE/heavy
  // Dropped upstream content (unavailable deps — see docs/compatibility.md):
  //   ani_pro: ammo pixel_gun:pixel_ammo_sniper (mod not shipped)
  //   pickaxe: melee weapon built on lrtactical (mod not shipped)
  //   deep_rock_galactic:supply block (its block data requires lrtactical)
  for (const rid of [
    'gun/gk2', 'gun/m1000', 'gun/cross', 'gun/zkf', 'gun/subata', 'gun/voltaic',
    'gun/smart', 'gun/smart_1', 'gun/bulldog', 'gun/btr7', 'gun/drak_25',
    'gun/pump', 'gun/short', 'gun/impact', 'gun/lover', 'gun/doreda',
    'gun/minigun', 'gun/crspr', 'gun/rocket', 'gun/40mm', 'gun/thunder',
    'gun/hook', 'gun/pickaxe',
    'ammo/drg_generic_ammo', 'ammo/drg_big_ammo', 'ammo/drg_grenade_ammo',
    'ammo/drg_shortgun_ammo', 'ammo/impact_ammo', 'ammo/lover_ammo',
    'ammo/arrow', 'ammo/hook', 'melee/pickaxe', 'supply'
  ]) e.remove({ id: 'deep_rock_galactic:' + rid });

  function drgMat(item, count) {
    return { item: item.startsWith('#') ? { tag: item.slice(1) } : { item: item }, count: count };
  }
  function drgGun(id, group, mats) {
    e.custom({
      type: 'tacz:gun_smith_table_crafting',
      materials: mats.map((m) => drgMat(m[0], m[1])),
      result: { type: 'gun', group: group, id: id }
    });
  }
  function drgAmmo(id, mats, count) {
    e.custom({
      type: 'tacz:gun_smith_table_crafting',
      materials: mats.map((m) => drgMat(m[0], m[1])),
      result: { type: 'ammo', id: id, count: count }
    });
  }

  // T3: conventional DRG rifles / SMGs / marksman (generic ammo family)
  const DRG_T3 = [['#c:plates/steel', 4], ['ae2:engineering_processor', 1],
    ['immersiveengineering:component_steel', 2], ['#c:dusts/redstone', 16]];
  const DRG_T4 = [['#c:plates/steel', 6], ['immersiveengineering:heavy_engineering', 1],
    ['immersiveengineering:component_steel', 2], ['ic2cre:circuit', 2], ['#c:dusts/redstone', 24]];
  const DRG_GUNS = [
    // T3 — conventional rifles / SMGs / marksman (generic ammo family)
    ['deep_rock_galactic:gk2', 'drg:scout', DRG_T3],
    ['deep_rock_galactic:m1000', 'drg:scout', DRG_T3],
    ['deep_rock_galactic:cross', 'drg:scout', DRG_T3],
    ['deep_rock_galactic:zkf', 'drg:scout', DRG_T3],
    ['deep_rock_galactic:subata', 'drg:driller', DRG_T3],
    ['deep_rock_galactic:voltaic', 'drg:engineer', DRG_T3],
    ['deep_rock_galactic:smart', 'drg:engineer', DRG_T3],
    ['deep_rock_galactic:smart_1', 'drg:engineer', DRG_T3],
    ['deep_rock_galactic:bulldog', 'drg:gunner', DRG_T3],
    // T4 — squad support / shotguns / heavy sidearms
    ['deep_rock_galactic:btr7', 'drg:gunner', DRG_T4],
    ['deep_rock_galactic:drak_25', 'drg:scout', DRG_T4],
    ['deep_rock_galactic:pump', 'drg:engineer', DRG_T4],
    ['deep_rock_galactic:short', 'drg:scout', DRG_T4],
    ['deep_rock_galactic:impact', 'drg:driller', DRG_T4.concat([['#c:storage_blocks/iron', 1]])],
    ['deep_rock_galactic:lover', 'drg:else', DRG_T4],
    ['deep_rock_galactic:doreda', 'drg:else', DRG_T4],
    // grappling hook — traversal utility, T4
    ['deep_rock_galactic:hook', 'drg:scout', [['#c:plates/steel', 2],
      ['immersiveengineering:component_steel', 1], ['ic2cre:circuit', 1], ['#c:dusts/redstone', 8]]],
    // T5 — swarm annihilation / AoE: containment plating + singularity / anomaly core
    ['deep_rock_galactic:minigun', 'drg:gunner', [['#c:plates/steel', 8],
      ['ic2cre:containment_reactor_plating', 2], ['modpack:anomaly_analysis', 1],
      ['immersiveengineering:component_electronic', 2], ['#c:dusts/redstone', 32]]],
    ['deep_rock_galactic:crspr', 'drg:driller', [['#c:plates/steel', 8],
      ['ic2cre:containment_reactor_plating', 2], ['ae2:singularity', 1],
      ['immersiveengineering:component_electronic', 2], ['#c:dusts/redstone', 32]]],
    ['deep_rock_galactic:rocket', 'drg:gunner', [['#c:plates/steel', 8],
      ['ic2cre:containment_reactor_plating', 2], ['ae2:singularity', 1],
      ['immersiveengineering:component_electronic', 2], ['#c:dusts/redstone', 32]]],
    ['deep_rock_galactic:40mm', 'drg:engineer', [['#c:plates/steel', 8],
      ['ic2cre:containment_reactor_plating', 2], ['ae2:singularity', 1],
      ['immersiveengineering:component_electronic', 2], ['#c:dusts/redstone', 32]]],
    ['deep_rock_galactic:thunder', 'drg:gunner', [['#c:plates/steel', 8],
      ['ic2cre:containment_reactor_plating', 2], ['modpack:anomaly_analysis', 1],
      ['immersiveengineering:component_electronic', 2], ['#c:dusts/redstone', 32]]]
  ];
  for (let gi = 0; gi < DRG_GUNS.length; gi++) {
    drgGun(DRG_GUNS[gi][0], DRG_GUNS[gi][1], DRG_GUNS[gi][2]);
  }

  // DRG ammunition — same industrial material families as vanilla TaCZ ammo
  // (copper/lead + gunpowder baseline), scaled to each weapon's throughput.
  drgAmmo('deep_rock_galactic:drg_generic_ammo',
    [['#c:ingots/lead', 8], ['#c:gunpowders', 6], ['#c:dusts/redstone', 8]], 48);
  drgAmmo('deep_rock_galactic:drg_big_ammo',
    [['#c:ingots/steel', 4], ['#c:gunpowders', 10], ['#c:dusts/redstone', 16]], 96);
  drgAmmo('deep_rock_galactic:drg_grenade_ammo',
    [['#c:ingots/steel', 2], ['minecraft:tnt', 1], ['#c:dusts/redstone', 8]], 8);
  drgAmmo('deep_rock_galactic:drg_shortgun_ammo',
    [['#c:ingots/lead', 6], ['#c:gunpowders', 8], ['#c:ingots/copper', 4]], 24);
  drgAmmo('deep_rock_galactic:impact_ammo',
    [['#c:storage_blocks/iron', 1], ['#c:gunpowders', 8], ['#c:ingots/steel', 2]], 4);
  drgAmmo('deep_rock_galactic:lover_ammo',
    [['#c:ingots/steel', 2], ['#c:gunpowders', 6], ['#c:gems/diamond', 1]], 4);
  drgAmmo('deep_rock_galactic:arrow',
    [['minecraft:iron_ingot', 2], ['minecraft:stick', 2], ['minecraft:feather', 2]], 8);
  drgAmmo('deep_rock_galactic:hook',
    [['#c:ingots/iron', 4], ['#c:strings', 8]], 1);

  // ---------- SF-17 T5: space_control_core (T6 evidence) ----------
  // "aerospace alloy" maps to ad_astra:steel_plate (Earth-producible via compressor).
  e.shaped(i('space_control_core'), ['SCS', 'EBE', 'SCS'], {
    S: i('aa_steel_plate'), C: i('ic2_advanced_circuit'),
    E: i('ae2_engineering_processor'), B: i('ie_steel_component')
  });

  // ---------- SF-18 T6: rocket engines gain electric motors + heavy components ----------
  const engineTiers = [
    ['ad_astra:steel_engine', '#ad_astra:steel_plates', 'ad_astra:engine_frame'],
    ['ad_astra:desh_engine', '#ad_astra:desh_plates', 'ad_astra:steel_engine'],
    ['ad_astra:ostrum_engine', '#ad_astra:ostrum_plates', 'ad_astra:desh_engine'],
    ['ad_astra:calorite_engine', '#ad_astra:calorite_plates', 'ad_astra:ostrum_engine']
  ];
  for (const tier of engineTiers) {
    let eng = tier[0], plate = tier[1], base = tier[2];
    e.remove({ output: eng });
    e.shaped(eng, ['PPP', 'MEM', 'WFW'], {
      P: plate, M: i('ic2_electric_motor'), E: base,
      W: i('ie_steel_component'), F: 'ad_astra:fan'
    });
  }

  // ---------- SF-19 T6: navigation/control — NASA workbench embeds the space core ----------
  e.remove({ output: 'ad_astra:nasa_workbench' });
  e.shaped('ad_astra:nasa_workbench', ['|#|', 'TCT', '#B#'], {
    '#': '#ad_astra:steel_plates', '|': '#ad_astra:iron_rods',
    T: 'minecraft:redstone_torch', C: i('space_control_core'), B: '#ad_astra:steel_blocks'
  });

  // ---------- SF-20 T6: oxygen equipment embeds circuits + fluid engineering ----------
  e.remove({ output: 'ad_astra:oxygen_loader' });
  e.shaped('ad_astra:oxygen_loader', ['#F#', 'GCG', '#R#'], {
    '#': '#ad_astra:steel_plates', F: 'ad_astra:fan', G: 'ad_astra:gas_tank',
    C: i('ic2_circuit'), R: 'minecraft:redstone_block'
  });
  e.remove({ output: 'ad_astra:oxygen_gear' });
  e.shaped('ad_astra:oxygen_gear', [' C ', '#|#', '#P#'], {
    '#': '#ad_astra:steel_plates', '|': 'ad_astra:steel_rod',
    C: i('ic2_circuit'), P: i('ie_fluid_pipe')
  });

  // ---------- SF-21 T6: launch pad (station construction) gains power + logistics ----------
  e.remove({ output: 'ad_astra:launch_pad' });
  e.shaped('ad_astra:launch_pad', ['#|#', 'CLC', '#|#'], {
    '#': '#ad_astra:steel_plates', '|': '#ad_astra:steel_rods',
    C: i('ic2_energy_crystal'), L: i('ae2_logic_processor')
  });

  // ---------- SF-22 T6: colony_maintenance ----------
  e.shaped(i('colony_maintenance'), ['RPR', 'SCS', 'RPR'], {
    R: i('ic2_rubber'), P: 'immersiveengineering:plate_steel',
    S: 'immersiveengineering:component_iron', C: i('ic2_circuit')
  });

  // ---------- SF-23 T5: quantum_control (T7 evidence) — fully Earth-producible ----------
  e.shaped(i('quantum_control'), ['IAI', 'EHE', 'IAI'], {
    I: i('ic2_iridium'), A: i('ic2_advanced_circuit'),
    E: i('ae2_engineering_processor'), H: i('ie_heavy_engineering')
  });

  // ---------- SF-24 T7: quantum armor embeds the quantum control ----------
  const quantumPieces = {
    'ic2cre:quantum_helmet': {
      pattern: ['GNG', 'RLR', 'AQA'],
      keys: { G: 'ic2cre:reinforced_glass', N: 'ic2cre:nano_helmet', R: '#c:circuits/advanced', L: 'ic2cre:lapotron_crystal', A: 'ic2cre:alloy', Q: 'modpack:quantum_control' }
    },
    'ic2cre:quantum_chestplate': {
      pattern: ['ANA', 'ILI', 'JQJ'],
      keys: { A: 'ic2cre:alloy', N: 'ic2cre:nano_chestplate', I: 'ic2cre:iridium', L: 'ic2cre:lapotron_crystal', J: 'ic2cre:electric_jetpack', Q: 'modpack:quantum_control' }
    },
    'ic2cre:quantum_leggings': {
      pattern: ['MLM', 'INI', 'G G'],
      keys: { M: 'ic2cre:machine', L: 'ic2cre:lapotron_crystal', I: 'ic2cre:iridium', N: 'ic2cre:nano_leggings', G: 'minecraft:glowstone_dust' }
    },
    'ic2cre:quantum_boots': {
      pattern: ['   ', 'INI', 'RLR'],
      keys: { I: 'ic2cre:iridium', N: 'ic2cre:nano_boots', R: 'ic2cre:rubber_boots', L: 'ic2cre:lapotron_crystal' }
    }
  };
  for (const item of Object.keys(quantumPieces)) {
    let def = quantumPieces[item];
    e.remove({ output: item });
    let keys = Object.assign({}, def.keys);
    // Embed quantum control into leggings/boots by swapping iridium slots for the control.
    if (item === 'ic2cre:quantum_leggings' || item === 'ic2cre:quantum_boots') {
      keys.Q = 'modpack:quantum_control';
      def.pattern[1] = def.pattern[1].replace(/I/g, 'Q');
      delete keys.I;
    }
    e.shaped(item, def.pattern, keys);
  }

  // ---------- SF-25 T7: AE2 quantum bridge gains iridium + steel structure ----------
  e.remove({ output: 'ae2:quantum_ring' });
  e.shaped('ae2:quantum_ring', ['IEI', 'a e', 'IEI'], {
    I: i('ic2_iridium'), E: i('ie_heavy_engineering'),
    a: 'ae2:engineering_processor', e: 'ae2:energy_cell'
  });
  e.remove({ output: 'ae2:quantum_link' });
  e.shaped('ae2:quantum_link', ['GQG', 'QSQ', 'GQG'], {
    G: 'ae2:quartz_glass', Q: 'ae2:fluix_pearl', S: i('ic2_iridium')
  });

  // ---------- SF-26 T2: building gadget enters the industrial chain ----------
  e.remove({ output: 'buildinggadgets2:gadget_building' });
  e.shaped('buildinggadgets2:gadget_building', ['IMI', 'DBD', 'ICI'], {
    I: '#c:ingots/iron', M: i('ie_iron_component'), D: '#c:gems/lapis',
    B: i('ic2_battery'), C: i('ic2_circuit')
  });

  // ---------- SF-27: exchanging/copy-paste gadgets scale with tier ----------
  e.remove({ output: 'buildinggadgets2:gadget_exchanging' });
  e.shaped('buildinggadgets2:gadget_exchanging', ['iai', 'dAd', 'iCi'], {
    i: '#c:ingots/iron', a: '#c:dusts/redstone', d: '#c:gems/diamond',
    A: i('ic2_alloy'), C: i('ic2_advanced_circuit')
  });
  e.remove({ output: 'buildinggadgets2:gadget_copy_paste' });
  e.shaped('buildinggadgets2:gadget_copy_paste', ['iei', 'dPd', 'iCi'], {
    i: '#c:ingots/iron', e: '#c:gems/emerald', d: '#c:gems/diamond',
    P: i('ae2_engineering_processor'), C: i('ic2_lapotron_crystal')
  });

  // ---------- SF-28 T5: anomaly analysis module ----------
  e.shapeless(i('anomaly_analysis'), [
    '2x ic2cre:advanced_circuit', '2x ae2:calculation_processor', '4x ae2:fluix_crystal'
  ]);

  // ---------- SF-29 T2: sophisticated storage upgrade base ----------
  e.remove({ output: 'sophisticatedstorage:upgrade_base' });
  e.shaped('sophisticatedstorage:upgrade_base', ['PMP', 'ICI', 'PMP'], {
    P: '#minecraft:planks', I: '#c:ingots/iron', C: i('ic2_circuit'), M: i('ie_iron_component')
  });

  // ---------- SF-30 T2: sophisticated backpacks upgrade base ----------
  e.remove({ output: 'sophisticatedbackpacks:upgrade_base' });
  e.shaped('sophisticatedbackpacks:upgrade_base', ['SIS', 'CLC', 'SIS'], {
    S: '#c:strings', I: '#c:ingots/iron', C: i('ic2_circuit'), L: '#c:leathers'
  });

  // ---------- SF-34 T1: creosote mutual recognition for Railcraft ties ----------
  // railcraft:wooden_tie hard-codes railcraft:creosote_bucket; IE/IC2 creosote
  // fluids are unified under c:creosote, so accept any creosote bucket.
  // Same shape/count as the original (bucket over 3 wooden slabs, x3).
  e.remove({ output: i('rc_wooden_tie') });
  e.shaped(i('rc_wooden_tie'), [' B ', 'SSS', '   '], {
    B: '#c:buckets/creosote', S: '#minecraft:wooden_slabs'
  });

  console.log('[starforge] recipe layer loaded');
});

// Bucket forms of the unified creosote fluids (c:creosote, see starforge_fluids).
ServerEvents.tags('item', (e) => {
  const M = global.SM.items;
  e.add('c:buckets/creosote', [
    M.rc_creosote_bucket, M.ie_creosote_bucket, M.ic2_creosote_bucket
  ]);
});
