// Starforge material unification layer.
// Almost Unified owns the *output* side (canonical result per c: tag, configured in
// config/almostunified/unify.json with priority IE > IC2CRE > Ad Astra > Railcraft).
// This script owns the *input* side: literal duplicate inputs are widened to the
// matching c: tag so every equivalent material is accepted everywhere, plus the
// extra tag glue AU does not cover (storage blocks, buckets, ender dust).

const UNIFY_INPUT = {
  // ingots
  'ic2cre:steel_ingot': 'c:ingots/steel',
  'railcraft:steel_ingot': 'c:ingots/steel',
  'ad_astra:steel_ingot': 'c:ingots/steel',
  'ic2cre:lead_ingot': 'c:ingots/lead',
  'railcraft:lead_ingot': 'c:ingots/lead',
  'railcraft:tin_ingot': 'c:ingots/tin',
  'ic2cre:uranium_ingot': 'c:ingots/uranium',
  'railcraft:nickel_ingot': 'c:ingots/nickel',
  'ic2cre:silver_ingot': 'c:ingots/silver',
  'railcraft:silver_ingot': 'c:ingots/silver',
  'railcraft:bronze_ingot': 'c:ingots/bronze',

  // plates
  'ic2cre:iron_plate': 'c:plates/iron',
  'railcraft:iron_plate': 'c:plates/iron',
  'ad_astra:iron_plate': 'c:plates/iron',
  'ic2cre:copper_plate': 'c:plates/copper',
  'railcraft:copper_plate': 'c:plates/copper',
  'ic2cre:steel_plate': 'c:plates/steel',
  'railcraft:steel_plate': 'c:plates/steel',
  'ad_astra:steel_plate': 'c:plates/steel',
  'ic2cre:gold_plate': 'c:plates/gold',
  'railcraft:gold_plate': 'c:plates/gold',
  'ic2cre:lead_plate': 'c:plates/lead',
  'railcraft:lead_plate': 'c:plates/lead',
  'ic2cre:tin_plate': 'c:plates/tin',
  'railcraft:tin_plate': 'c:plates/tin',
  'railcraft:nickel_plate': 'c:plates/nickel',
  'railcraft:silver_plate': 'c:plates/silver',
  'ic2cre:bronze_plate': 'c:plates/bronze',
  'railcraft:bronze_plate': 'c:plates/bronze',

  // rods (specific tags only; treated/netherite sticks keep their identity)
  'ad_astra:iron_rod': 'c:rods/iron',
  'immersiveengineering:stick_iron': 'c:rods/iron',
  'ad_astra:steel_rod': 'c:rods/steel',
  'immersiveengineering:stick_steel': 'c:rods/steel',

  // dusts
  'ic2cre:iron_dust': 'c:dusts/iron',
  'ic2cre:copper_dust': 'c:dusts/copper',
  'ic2cre:gold_dust': 'c:dusts/gold',
  'ic2cre:lead_dust': 'c:dusts/lead',
  'ic2cre:tin_dust': 'c:dusts/tin',
  'ic2cre:silver_dust': 'c:dusts/silver',
  'ic2cre:bronze_dust': 'c:dusts/bronze',
  'railcraft:coal_dust': 'c:dusts/coal',
  'ic2cre:sulfur_dust': 'c:dusts/sulfur',
  'railcraft:sulfur_dust': 'c:dusts/sulfur',
  'railcraft:saltpeter_dust': 'c:dusts/saltpeter',
  'railcraft:obsidian_dust': 'c:dusts/obsidian',
  'railcraft:ender_dust': 'c:dusts/ender_pearl',

  // nuggets
  'railcraft:steel_nugget': 'c:nuggets/steel',
  'ad_astra:steel_nugget': 'c:nuggets/steel',
  'railcraft:lead_nugget': 'c:nuggets/lead',
  'railcraft:nickel_nugget': 'c:nuggets/nickel',
  'railcraft:silver_nugget': 'c:nuggets/silver',

  // raw materials + raw blocks
  'ic2cre:raw_lead': 'c:raw_materials/lead',
  'railcraft:lead_raw': 'c:raw_materials/lead',
  'railcraft:tin_raw': 'c:raw_materials/tin',
  'railcraft:nickel_raw': 'c:raw_materials/nickel',
  'railcraft:silver_raw': 'c:raw_materials/silver',
  'ic2cre:raw_uranium': 'c:raw_materials/uranium',
  'ic2cre:raw_lead_block': 'c:storage_blocks/raw_lead',
  'ic2cre:raw_uranium_block': 'c:storage_blocks/raw_uranium',

  // storage blocks
  'railcraft:steel_block': 'c:storage_blocks/steel',
  'ad_astra:steel_block': 'c:storage_blocks/steel',
  'railcraft:lead_block': 'c:storage_blocks/lead',
  'railcraft:nickel_block': 'c:storage_blocks/nickel',
  'railcraft:silver_block': 'c:storage_blocks/silver',
  'railcraft:coal_coke_block': 'c:storage_blocks/coal_coke',

  // coke
  'railcraft:coal_coke': 'c:coal_coke'
}

// duplicate compress/decompress pairs removed after unification.
// Canonical ingots (IE for steel/lead/nickel/silver/uranium, IC2CRE for tin/bronze)
// keep their own pairs; removed variants stay obtainable via the canonical recipe
// since inputs are widened to c: tags first.
const REMOVE_UNCOMPRESS = [
  // ic2cre non-canonical metals (both duplicate compress ids + the decompress)
  'ic2cre:steel_block', 'ic2cre:steel_block_from_ingot', 'ic2cre:steel_ingot_from_block',
  'ic2cre:lead_block', 'ic2cre:lead_block_from_ingot', 'ic2cre:lead_ingot_from_block',
  'ic2cre:silver_block', 'ic2cre:silver_block_from_ingot', 'ic2cre:silver_ingot_from_block',
  'ic2cre:uranium_block', 'ic2cre:uranium_block_from_ingot', 'ic2cre:uranium_ingot_from_block',
  // ic2cre canonical metals: drop the redundant bare-name duplicate (keep *_from_ingot)
  'ic2cre:tin_block', 'ic2cre:bronze_block',
  // railcraft: canonical metals -> IE, so all four conversion recipes go
  'railcraft:steel_block_from_steel_ingot', 'railcraft:steel_ingot',
  'railcraft:steel_ingot_from_steel_nugget', 'railcraft:steel_nugget',
  'railcraft:lead_block_from_lead_ingot', 'railcraft:lead_ingot',
  'railcraft:lead_ingot_from_lead_nugget', 'railcraft:lead_nugget',
  'railcraft:nickel_block_from_nickel_ingot', 'railcraft:nickel_ingot',
  'railcraft:nickel_ingot_from_nickel_nugget', 'railcraft:nickel_nugget',
  'railcraft:silver_block_from_silver_ingot', 'railcraft:silver_ingot',
  'railcraft:silver_ingot_from_silver_nugget', 'railcraft:silver_nugget',
  // railcraft tin/bronze keep nugget pairs (sole nugget source), drop block pair
  'railcraft:tin_block_from_tin_ingot', 'railcraft:tin_ingot',
  'railcraft:bronze_block_from_bronze_ingot', 'railcraft:bronze_ingot',
  // ad_astra steel nugget/decompress (canonical steel is IE)
  'ad_astra:steel_ingot_from_steel_block', 'ad_astra:steel_nugget'
]

ServerEvents.tags('item', (e) => {
  // NOTE: tag entries that Almost Unified's output unifier must see live in
  // kubejs/data/**/tags/*.json (vanilla datapack load order). Entries here are
  // consumption-side only (bucket convenience tags read by recipes/players).

  // unified bucket families (fluid tags already bridge the fluids themselves)
  const oilBuckets = [
    'ad_astra:oil_bucket',
    'immersivepetroleum:crudeoil_bucket',
    'buildcraftenergy:oil/cool_bucket',
    'buildcraftenergy:oil/hot_bucket',
    'buildcraftenergy:oil/searing_bucket',
    'buildcraftenergy:oil_dense/cool_bucket',
    'buildcraftenergy:oil_dense/hot_bucket',
    'buildcraftenergy:oil_dense/searing_bucket',
    'buildcraftenergy:oil_heavy/cool_bucket',
    'buildcraftenergy:oil_heavy/hot_bucket',
    'buildcraftenergy:oil_heavy/searing_bucket'
  ]
  const fuelBuckets = [
    'ad_astra:fuel_bucket',
    'ad_astra:cryo_fuel_bucket',
    'immersivepetroleum:diesel_bucket',
    'immersivepetroleum:diesel_sulfur_bucket',
    'immersivepetroleum:gasoline_bucket',
    'immersiveengineering:biodiesel_bucket',
    'immersiveengineering:high_power_biodiesel_bucket',
    'buildcraftenergy:fuel_light/cool_bucket',
    'buildcraftenergy:fuel_light/hot_bucket',
    'buildcraftenergy:fuel_light/searing_bucket',
    'buildcraftenergy:fuel_dense/cool_bucket',
    'buildcraftenergy:fuel_dense/hot_bucket',
    'buildcraftenergy:fuel_dense/searing_bucket',
    'buildcraftenergy:fuel_gaseous/cool_bucket',
    'buildcraftenergy:fuel_gaseous/hot_bucket',
    'buildcraftenergy:fuel_gaseous/searing_bucket',
    'buildcraftenergy:fuel_mixed_light/cool_bucket',
    'buildcraftenergy:fuel_mixed_light/hot_bucket',
    'buildcraftenergy:fuel_mixed_light/searing_bucket',
    'buildcraftenergy:fuel_mixed_heavy/cool_bucket',
    'buildcraftenergy:fuel_mixed_heavy/hot_bucket',
    'buildcraftenergy:fuel_mixed_heavy/searing_bucket'
  ]
  e.add('c:buckets/oil', oilBuckets)
  e.add('c:buckets/fuel', fuelBuckets)
  e.add('c:buckets', oilBuckets.concat(fuelBuckets))
})

// leftover non-canonical outputs that Almost Unified could not rewrite
// (custom serializers: railcraft rolling/coke_oven, ic2cre macerator chain,
// minecraft-namespace smelting shipped by other mods). Same priority order.
const UNIFY_OUTPUT = {
  'railcraft:tin_ingot': 'ic2cre:tin_ingot',
  'railcraft:bronze_ingot': 'ic2cre:bronze_ingot',
  'railcraft:tin_plate': 'ic2cre:tin_plate',
  'railcraft:bronze_plate': 'ic2cre:bronze_plate',
  'railcraft:coal_coke_block': 'immersiveengineering:coke',
  'ic2cre:ender_pearl_dust': 'ae2:ender_dust'
}

ServerEvents.recipes((e) => {
  for (const from in UNIFY_INPUT) {
    e.replaceInput({ input: from }, from, `#${UNIFY_INPUT[from]}`)
  }
  for (const from in UNIFY_OUTPUT) {
    e.replaceOutput({}, from, UNIFY_OUTPUT[from])
  }
  for (const id of REMOVE_UNCOMPRESS) e.remove({ id: id })
})
