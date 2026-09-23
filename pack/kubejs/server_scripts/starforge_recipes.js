// Starforge recipe layer — implements SF-01..SF-30 against real registry ids.
// Semantic names resolve via global.SM (generated from design/semantic-map.json).
// TaCZ gun-pack re-costing lives below as SF-16 (EOS – Dawn Goddess Lab).
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

  // ---------- SF-16: EOS – Dawn Goddess Lab gun pack — industrial re-costing ----------
  // The pack ships flat vanilla-ish recipes (iron/copper + coals + netherite)
  // behind legacy forge: tags. Guns and ammo all share tacz:* item ids, so
  // ProgressiveStages cannot lock them — the gate is the stage-locked
  // industrial material inside each recipe instead:
  //   T3 (information_age): ae2:engineering_processor — gauss firearms (57x24/68x57/arrow)
  //   T4 (heavy_industry_age): immersiveengineering:heavy_engineering — heavy gauss / 85x76 / 308
  //   T5 (atomic_age): ic2cre:containment_reactor_plating + singularity/anomaly — ELP plasma / exotic
  // Recipe ids stay in the eos:* namespace so the pack's own recipe_filters
  // route them to the eos:eos_printer workbench (its whitelist is ^eos:.*$;
  // the default smith table blacklist excludes eos: recipes).
  // eos:attachments/* stays upstream (loads via pack upgrader), as do the two
  // eos_old: chasing_light display-variant conversions. eos:eoslab_12g has an
  // ammo index but no upstream recipe — left uncraftable.
  for (const rid of [
    'gun/chasing_light', 'gun/clover_cross', 'gun/elp_13_t3', 'gun/elp_13_t3x2',
    'gun/elp_34_t3', 'gun/elp_34c_t3', 'gun/elp_45_t3', 'gun/elp_47_t3',
    'gun/elp_52_t3', 'gun/elp_72_t3', 'gun/eos_achilles', 'gun/eos_ar68_t2',
    'gun/eos_chaos', 'gun/eos_helenas_nail', 'gun/eos_hg57_t2',
    'gun/eos_hg57_t2_smgmod', 'gun/eos_m_57cw_t2', 'gun/eos_m_57cw_t2x2',
    'gun/eos_mg85_t2', 'gun/eos_nekomata', 'gun/eos_qgz_86_t2',
    'gun/eos_riku_t2', 'gun/eos_sr85_t2', 'gun/wa2000', 'gun/wa2000_snake_kiss',
    'ammo/28x300', 'ammo/57x24', 'ammo/68x57', 'ammo/85x76', 'ammo/alloy',
    'ammo/arrow', 'ammo/battery',
    'blocks/eos_printer', 'blocks/old_conversion'
  ]) e.remove({ id: 'eos:' + rid });

  function eosMat(item, count) {
    return { item: item.startsWith('#') ? { tag: item.slice(1) } : { item: item }, count: count };
  }
  // .id() pins the recipe into the eos: namespace — required for the pack's
  // recipe_filters to route it to the EOS printer. If the id wrapper is ever
  // unavailable the recipe still registers (kubejs:* id, shown on the default
  // smith table instead of the printer).
  function withId(recipe, id) {
    try { recipe.id(id); } catch (err) { /* fall back to kubejs:* ids */ }
    return recipe;
  }
  function eosGun(id, mats) {
    return withId(e.custom({
      type: 'tacz:gun_smith_table_crafting',
      materials: mats.map((m) => eosMat(m[0], m[1])),
      result: { type: 'gun', id: id }
    }), 'eos:gun/' + id.split(':')[1]);
  }
  function eosAmmo(id, mats, count) {
    return withId(e.custom({
      type: 'tacz:gun_smith_table_crafting',
      materials: mats.map((m) => eosMat(m[0], m[1])),
      result: { type: 'ammo', id: id, count: count }
    }), 'eos:ammo/' + id.split(':')[1]);
  }

  // T3: conventional gauss firearms (57x24 pistols/SMGs, 68x57 rifles, arrows)
  const EOS_T3 = [['#c:plates/steel', 4], ['ae2:engineering_processor', 1],
    ['immersiveengineering:component_steel', 2], ['#c:dusts/redstone', 16]];
  const EOS_T4 = [['#c:plates/steel', 6], ['immersiveengineering:heavy_engineering', 1],
    ['immersiveengineering:component_steel', 2], ['ic2cre:circuit', 2], ['#c:dusts/redstone', 24]];
  const EOS_T5 = (rare) => [['#c:plates/steel', 8],
    ['ic2cre:containment_reactor_plating', 2], [rare, 1],
    ['immersiveengineering:component_electronic', 2], ['#c:dusts/redstone', 32]];
  const EOS_GUNS = [
    // T3 — gauss firearms + crossbow (57x24 / 68x57 / arrow)
    ['eos:eos_hg57_t2', EOS_T3],
    ['eos:eos_hg57_t2_smgmod', EOS_T3],
    ['eos:eos_m_57cw_t2', EOS_T3],
    ['eos:eos_m_57cw_t2x2', EOS_T3],
    ['eos:eos_ar68_t2', EOS_T3],
    ['eos:eos_qgz_86_t2', EOS_T3],
    ['eos:chasing_light', EOS_T3],
    ['eos:eos_riku_t2', EOS_T3],
    // T4 — heavy gauss / marksman / specials (85x76 / tacz:308)
    ['eos:eos_mg85_t2', EOS_T4],
    ['eos:eos_sr85_t2', EOS_T4],
    ['eos:eos_nekomata', EOS_T4],
    ['eos:eos_achilles', EOS_T4],
    ['eos:clover_cross', EOS_T4],
    ['eos:wa2000', EOS_T4],
    ['eos:wa2000_snake_kiss', EOS_T4],
    // T5 — ELP plasma family + exotic ordnance (battery / 28x300)
    ['eos:elp_13_t3', EOS_T5('ae2:singularity')],
    ['eos:elp_13_t3x2', EOS_T5('ae2:singularity')],
    ['eos:elp_34_t3', EOS_T5('ae2:singularity')],
    ['eos:elp_34c_t3', EOS_T5('ae2:singularity')],
    ['eos:elp_45_t3', EOS_T5('ae2:singularity')],
    ['eos:elp_47_t3', EOS_T5('ae2:singularity')],
    ['eos:elp_52_t3', EOS_T5('modpack:anomaly_analysis')],
    ['eos:elp_72_t3', EOS_T5('modpack:anomaly_analysis')],
    ['eos:eos_chaos', EOS_T5('ae2:singularity')],
    ['eos:eos_helenas_nail', EOS_T5('modpack:anomaly_analysis')]
  ];
  for (let gi = 0; gi < EOS_GUNS.length; gi++) {
    eosGun(EOS_GUNS[gi][0], EOS_GUNS[gi][1]);
  }

  // EOS ammunition — same industrial material families as vanilla TaCZ ammo
  // (copper/lead + gunpowder baseline), scaled to each weapon's throughput.
  // Yield counts follow the upstream pack (57x24×50, 68x57×45, 85x76×60, …).
  eosAmmo('eos:57x24',
    [['#c:ingots/lead', 8], ['#c:gunpowders', 6], ['#c:dusts/redstone', 8]], 50);
  eosAmmo('eos:68x57',
    [['#c:ingots/lead', 10], ['#c:gunpowders', 8], ['#c:dusts/redstone', 12]], 45);
  eosAmmo('eos:85x76',
    [['#c:ingots/steel', 4], ['#c:gunpowders', 10], ['#c:dusts/redstone', 16]], 60);
  eosAmmo('eos:28x300',
    [['#c:plates/steel', 4], ['#c:ingots/lead', 16], ['#c:dusts/redstone', 16]], 6);
  eosAmmo('eos:battery',
    [['#c:ingots/copper', 8], ['#c:dusts/redstone', 24], ['ic2cre:energy_crystal', 1]], 2);
  eosAmmo('eos:arrow',
    [['#c:ingots/iron', 4], ['minecraft:stick', 2], ['minecraft:feather', 2]], 60);
  eosAmmo('eos:alloy',
    [['#c:ingots/netherite', 2], ['minecraft:nether_star', 1]], 10);

  // EOS workbenches — upstream recipes use forge: tags + the pre-1.21 'nbt'
  // result syntax; re-added here in current form (c: tags + components).
  withId(e.custom({
    type: 'minecraft:crafting_shaped',
    pattern: ['ACA', 'DBD'],
    key: {
      A: { item: 'minecraft:polished_deepslate' },
      B: { tag: 'c:ingots/iron' },
      C: { item: 'minecraft:yellow_stained_glass' },
      D: { tag: 'c:ingots/copper' }
    },
    result: { id: 'tacz:workbench_b', components: { 'minecraft:custom_data': { BlockId: 'eos:eos_printer' } } }
  }), 'eos:blocks/eos_printer');
  withId(e.custom({
    type: 'minecraft:crafting_shaped',
    pattern: ['BD', 'DB'],
    key: {
      B: { tag: 'c:ingots/iron' },
      D: { tag: 'c:ingots/copper' }
    },
    result: { id: 'tacz:workbench_a', components: { 'minecraft:custom_data': { BlockId: 'eos_old:old_conversion' } } }
  }), 'eos:blocks/old_conversion');

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
