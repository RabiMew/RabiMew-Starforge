// Starforge capability interop self-test — runs ONLY when kubejs/captest.json
// exists with {"enabled":true}.
// Phase A (on load): probe ItemHandler / FluidHandler / EnergyStorage block
// capabilities on representative devices from every logistics/power mod.
// Phase B (ticked): real transfers through FastPipes — chest->item pipe->chest,
// BC tank->fluid pipe->BC tank, IE capacitor->energy pipe->IE capacitor —
// including a conservation check (sink gain must never exceed source loss).
// Results go to kubejs/export/captest.json and the server log.

var sfCaptest = null;

function sfCapPlace(level, reg, id, pos) {
  var block = reg.BLOCK.get(reg.RL.parse(id));
  if (!block || String(block) === 'minecraft:air') return null;
  level.setBlockAndUpdate(pos, block.defaultBlockState());
  return block;
}

function sfCapAt(capField, level, pos, side) {
  return capField.getCapability(level, pos, level.getBlockState(pos), level.getBlockEntity(pos), side);
}

ServerEvents.loaded((e) => {
  var flag = JsonIO.read('kubejs/captest.json');
  if (!flag || !flag.enabled) return;

  var result = { ok: true, probes: {}, transfers: {}, notes: [] };
  var Capabilities = Java.loadClass('net.neoforged.neoforge.capabilities.Capabilities');
  var BuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries');
  var ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation');
  var BlockPos = Java.loadClass('net.minecraft.core.BlockPos');
  var Direction = Java.loadClass('net.minecraft.core.Direction');
  var ItemStack = Java.loadClass('net.minecraft.world.item.ItemStack');
  var FluidStack = Java.loadClass('net.neoforged.neoforge.fluids.FluidStack');
  var FluidAction = Java.loadClass('net.neoforged.neoforge.fluids.capability.IFluidHandler$FluidAction');
  var BlockHitResult = Java.loadClass('net.minecraft.world.phys.BlockHitResult');
  var Vec3 = Java.loadClass('net.minecraft.world.phys.Vec3');
  var FakePlayerFactory = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayerFactory');
  var InteractionHand = Java.loadClass('net.minecraft.world.InteractionHand');
  var reg = { BLOCK: BuiltInRegistries.BLOCK, ITEM: BuiltInRegistries.ITEM,
    FLUID: BuiltInRegistries.FLUID, RL: ResourceLocation };

  var level = e.server.overworld();
  var spawn = level.getSharedSpawnPos();
  var bx = spawn.getX() + 32;
  var by = spawn.getY() + 25;
  var bz = spawn.getZ() + 32;
  for (var fcx = (bx - 8) >> 4; fcx <= (bx + 48) >> 4; fcx++) {
    for (var fcz = (bz - 8) >> 4; fcz <= (bz + 24) >> 4; fcz++) {
      level.setChunkForced(fcx, fcz, true);
    }
  }

  var DIRS = [Direction.UP, Direction.DOWN, Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST, null];
  var CAPS = {
    item: Capabilities.ItemHandler.BLOCK,
    fluid: Capabilities.FluidHandler.BLOCK,
    energy: Capabilities.EnergyStorage.BLOCK
  };

  var probe = function (id, capName, x, z) {
    var pos = new BlockPos(x, by, z);
    var block = sfCapPlace(level, reg, id, pos);
    if (!block) { result.probes[id] = { cap: capName, present: 'no_block' }; return; }
    var sides = [];
    try {
      var state = level.getBlockState(pos);
      var be = level.getBlockEntity(pos);
      for (var d = 0; d < DIRS.length; d++) {
        var cap = CAPS[capName].getCapability(level, pos, state, be, DIRS[d]);
        if (cap) sides.push(DIRS[d] ? String(DIRS[d]) : 'any');
      }
    } catch (err) { sides.push('ERR:' + err); }
    result.probes[id] = { cap: capName, sides: sides, present: sides.length > 0 };
    console.log('[captest] ' + id + ' ' + capName + ' -> ' + (sides.length ? sides.join(',') : 'NONE'));
  };

  // ---------- Phase A: capability presence ----------
  var itemIds = [
    'minecraft:chest', 'storagedrawers:oak_full_drawers_1', 'storagedrawers:controller',
    'sophisticatedstorage:barrel', 'sophisticatedstorage:controller',
    'ae2:interface', 'ae2:drive', 'ae2:chest',
    'fastpipes:oak_barrel', 'fastpipes:basic_item_pipe',
    'buildcrafttransport:filtered_buffer', 'refurbished_furniture:black_cooler'
  ];
  var fluidIds = [
    'buildcraftfactory:tank', 'ic2cre:iron_tank', 'immersiveengineering:metal_barrel',
    'ad_astra:oxygen_loader', 'ad_astra:fuel_refinery',
    'refurbished_furniture:oak_kitchen_sink',
    'fastpipes:basic_fluid_pipe'
  ];
  var energyIds = [
    'ic2cre:batbox', 'ic2cre:generator', 'ic2cre:copper_cable',
    'immersiveengineering:capacitor_lv', 'immersiveengineering:connector_lv',
    'ad_astra:etrionic_capacitor', 'ad_astra:cryo_freezer', 'ad_astra:energizer',
    'buildcraftenergy:mj_dynamo',
    // BC powerMode=DISPLAY_FE: IMjReceiver tiles (machines) expose a receive-only
    // IEnergyStorage via MjReceiverEnergyStorage. NOTE: buildcraftenergy:engine_*
    // are ITEM ids — the engine block is buildcraftcore:engine[type=...]; those
    // are probed separately below.
    'buildcraftfactory:pump', 'buildcraftbuilders:quarry', 'buildcraftsilicon:laser',
    'ae2:energy_acceptor', 'ae2:energy_cell', 'ae2:controller',
    'energizedfurniture:energy_transformer',
    'railcraft:charge_terminal', 'railcraft:charge_motor',
    'starforge_compat:charge_bridge',
    'fastpipes:basic_energy_pipe', 'fastpipes:improved_energy_pipe', 'fastpipes:elite_energy_pipe'
  ];
  var px = 0;
  for (var ii = 0; ii < itemIds.length; ii++, px += 2) probe(itemIds[ii], 'item', bx + px, bz);
  for (var fi = 0; fi < fluidIds.length; fi++, px += 2) probe(fluidIds[fi], 'fluid', bx + px, bz + 4);
  for (var ei = 0; ei < energyIds.length; ei++, px += 2) probe(energyIds[ei], 'energy', bx + px, bz + 8);

  // BC engines: single block buildcraftcore:engine with a `type` property
  // (item ids engine_stone/engine_iron/engine_fe resolve to air when probed as
  // blocks — earlier captest rows measured nothing). Place typed variants to
  // record their real FE cap surface; expected NONE — engines push power into
  // neighbors' IEnergyStorage via MjPort FeEndpoint instead of exposing a cap.
  var sfPlaceEngine = function (pos, typeName) {
    var engBlock = reg.BLOCK.get(reg.RL.parse('buildcraftcore:engine'));
    var EnumEngineType = Java.loadClass('buildcraft.lib.internal.enums.EnumEngineType');
    var prop = engBlock.getStateDefinition().getProperty('type');
    var st = engBlock.defaultBlockState().setValue(prop, EnumEngineType.valueOf(typeName));
    level.setBlockAndUpdate(pos, st);
  };
  var probeEngine = function (typeName, x, z) {
    var pos = new BlockPos(x, by, z);
    sfPlaceEngine(pos, typeName);
    var sides = [];
    try {
      var state = level.getBlockState(pos);
      var be = level.getBlockEntity(pos);
      for (var d = 0; d < DIRS.length; d++) {
        var cap = CAPS.energy.getCapability(level, pos, state, be, DIRS[d]);
        if (cap) sides.push(DIRS[d] ? String(DIRS[d]) : 'any');
      }
    } catch (err) { sides.push('ERR:' + err); }
    var pid = 'buildcraftcore:engine[type=' + typeName.toLowerCase() + ']';
    result.probes[pid] = { cap: 'energy', sides: sides, present: sides.length > 0 };
    console.log('[captest] ' + pid + ' energy -> ' + (sides.length ? sides.join(',') : 'NONE'));
  };
  probeEngine('STONE', bx + px, bz + 8); px += 2;
  probeEngine('IRON', bx + px, bz + 8); px += 2;
  probeEngine('FE', bx + px, bz + 8); px += 2;

  // ---------- Phase B setup: real FastPipes transfers ----------
  // Item: source chest -> pipe (extractor on source side) -> sink chest.
  // Fluid: bc tank -> fluid pipe -> bc tank.
  // Energy: capacitor_lv -> energy pipe -> capacitor_lv (conservation: in<=out).
  var ty = by;
  var tz = bz + 12;
  var tx = bx;
  var transfers = {};
  // Hoisted for the tick handler — var inside try does not reliably hoist
  // under Rhino when the enclosing block throws.
  var engPos = null;
  try {
    var player = FakePlayerFactory.getMinecraft(level);
    var NetworkManager = Java.loadClass('com.piglinmine.fastpipes.network.NetworkManager');
    var attach = function (pipePos, side, attachId) {
      var stack = new ItemStack(reg.ITEM.get(reg.RL.parse(attachId)));
      try {
        var pipe = NetworkManager.get(level).getPipe(pipePos);
        var factory = stack.getItem().getFactory();
        var att = factory.create(pipe, side);
        pipe.getAttachmentManager().setAttachmentAndScanGraph(side, att);
        return 'attached:' + String(att.getId());
      } catch (err) { return 'ERR:' + err; }
    };

    // item line
    sfCapPlace(level, reg, 'minecraft:chest', new BlockPos(tx, ty, tz - 1));
    sfCapPlace(level, reg, 'fastpipes:basic_item_pipe', new BlockPos(tx, ty, tz));
    sfCapPlace(level, reg, 'minecraft:chest', new BlockPos(tx, ty, tz + 1));
    var srcChest = level.getBlockEntity(new BlockPos(tx, ty, tz - 1));
    if (srcChest && srcChest.setItem) {
      srcChest.setItem(0, new ItemStack(reg.ITEM.get(reg.RL.parse('minecraft:cobblestone')), 64));
    }
    transfers.item_attach = attach(new BlockPos(tx, ty, tz), Direction.NORTH, 'fastpipes:basic_extractor_attachment');
    transfers.item = { src: new BlockPos(tx, ty, tz - 1), dst: new BlockPos(tx, ty, tz + 1) };

    // fluid line (two blocks east)
    var fx = tx + 4;
    sfCapPlace(level, reg, 'buildcraftfactory:tank', new BlockPos(fx, ty, tz - 1));
    sfCapPlace(level, reg, 'fastpipes:basic_fluid_pipe', new BlockPos(fx, ty, tz));
    sfCapPlace(level, reg, 'buildcraftfactory:tank', new BlockPos(fx, ty, tz + 1));
    var fsrc = sfCapAt(CAPS.fluid, level, new BlockPos(fx, ty, tz - 1), null);
    if (fsrc) fsrc.fill(new FluidStack(reg.FLUID.get(reg.RL.parse('minecraft:water')), 8000), FluidAction.EXECUTE);
    transfers.fluid_attach = attach(new BlockPos(fx, ty, tz), Direction.NORTH, 'fastpipes:basic_extractor_attachment');
    transfers.fluid = { src: new BlockPos(fx, ty, tz - 1), dst: new BlockPos(fx, ty, tz + 1) };

    // energy line (four blocks east): <drainable FE source> -> pipe -> ae2 acceptor.
    // Source candidates tried in order; we need a block whose EnergyStorage cap
    // both accepts an external fill and allows extraction (IE capacitors are
    // receive-only through the cap, which is why they were rejected).
    var ex = tx + 8;
    sfCapPlace(level, reg, 'fastpipes:basic_energy_pipe', new BlockPos(ex, ty, tz));
    // Destination candidates — must consume FE through the cap. A bare AE2
    // energy_acceptor rejects FE (it only forwards into a live ME network);
    // the AE2 controller itself is the grid's energy input. First candidate
    // with receiveEnergy>0 wins.
    var dstPos = new BlockPos(ex, ty, tz + 1);
    // BC machine first so the DISPLAY_FE run exercises the
    // pipe -> MjReceiverEnergyStorage path end-to-end, not just cap presence.
    var dstCandidates = ['buildcraftfactory:pump', 'ic2cre:electric_furnace',
      'ae2:controller', 'ad_astra:compressor', 'immersiveengineering:furnace_heater'];
    var dstId = null;
    var dstReport = {};
    for (var dc = 0; dc < dstCandidates.length; dc++) {
      var did = dstCandidates[dc];
      sfCapPlace(level, reg, 'minecraft:air', dstPos);
      sfCapPlace(level, reg, did, dstPos);
      var drep = { sides: {} };
      var best = 0;
      for (var dd = 0; dd < 6; dd++) {
        var dcap = sfCapAt(CAPS.energy, level, dstPos, DIRS[dd]);
        if (dcap) {
          var rv = dcap.receiveEnergy(500, true);
          drep.sides[String(DIRS[dd])] = { recv: rv, canReceive: dcap.canReceive() };
          if (rv > best) best = rv;
        }
      }
      drep.best_sim_receive = best;
      dstReport[did] = drep;
      if (best > 0) { dstId = did; break; }
    }
    transfers.energy_dst_report = dstReport;
    transfers.energy_dst_id = dstId;
    var srcCandidates = ['ad_astra:energizer', 'ic2cre:batbox',
      'immersiveengineering:capacitor_creative'];
    var srcPos = new BlockPos(ex, ty, tz - 1);
    var esrc = null;
    var srcId = null;
    var srcReport = {};
    for (var sc = 0; sc < srcCandidates.length; sc++) {
      var cid = srcCandidates[sc];
      sfCapPlace(level, reg, 'minecraft:air', srcPos);
      sfCapPlace(level, reg, cid, srcPos);
      var rep = { sides: {} };
      var filled = 0;
      var drainCap = null;
      for (var sd = 0; sd < 6; sd++) {
        var cap = sfCapAt(CAPS.energy, level, srcPos, DIRS[sd]);
        if (cap) {
          rep.sides[String(DIRS[sd])] = {
            canExtract: cap.canExtract(), canReceive: cap.canReceive(),
            simExtract: cap.extractEnergy(500, true), simReceive: cap.receiveEnergy(500, true)
          };
          var got = cap.receiveEnergy(32000, false);
          if (got > filled) { filled = got; esrc = cap; }
          if (!drainCap && cap.canExtract() && cap.extractEnergy(500, true) > 0) drainCap = cap;
        }
      }
      rep.filled = filled;
      rep.stored = esrc ? esrc.getEnergyStored() : -1;
      rep.drainable = !!drainCap;
      srcReport[cid] = rep;
      if (drainCap && (filled > 0 || cid.indexOf('creative') >= 0)) { srcId = cid; break; }
      esrc = null;
    }
    transfers.energy_src_report = srcReport;
    transfers.energy_src_id = srcId;
    transfers.energy_attach = attach(new BlockPos(ex, ty, tz), Direction.NORTH, 'fastpipes:basic_extractor_attachment');
    transfers.energy = { src: srcPos, dst: dstPos };
    transfers.energy_src_start = esrc ? esrc.getEnergyStored() : -1;

    // engine line (six blocks east): fueled BC stirling engine -> energy pipe
    // -> ic2 furnace. Under powerMode=DISPLAY_FE the engine's MjPort resolves
    // the pipe's IEnergyStorage as an FeEndpoint, so it pushes FE directly —
    // no mj_dynamo needed. attemptRotation() is public on TileEngineBase_BC8
    // and re-aims the engine at the first side exposing a receiver (FE counts).
    var gx = tx + 12;
    engPos = new BlockPos(gx, ty, tz + 1);
    var epipePos = new BlockPos(gx, ty, tz);
    var edstPos = new BlockPos(gx, ty, tz - 1);
    sfPlaceEngine(engPos, 'STONE');
    sfCapPlace(level, reg, 'fastpipes:basic_energy_pipe', epipePos);
    sfCapPlace(level, reg, 'ic2cre:electric_furnace', edstPos);
    // BC engines only ignite while isRedstonePowered (classic BC mechanic,
    // unchanged by DISPLAY_FE) — park a redstone block next to the engine.
    sfCapPlace(level, reg, 'minecraft:redstone_block', new BlockPos(gx + 1, ty, tz + 1));
    var engItems = sfCapAt(CAPS.item, level, engPos, null);
    try {
      if (engItems) {
        engItems.insertItem(0, new ItemStack(reg.ITEM.get(reg.RL.parse('minecraft:coal')), 8), false);
        transfers.engine_fueled = engItems.getStackInSlot(0).getCount();
      } else transfers.engine_fueled = 'no_item_cap';
    } catch (err) { transfers.engine_fueled = 'ERR:' + err; }
    transfers.engine = { eng: engPos, pipe: epipePos, dst: edstPos };

    // ---------- charge bridge rigs (starforge_compat:charge_bridge) ----------
    // Five isolated rigs, all >4 blocks apart so each Charge node is its own
    // grid (ConnectType.BLOCK only links face-adjacent blocks). Conversion is
    // capped at 256 FE/t on BOTH the external cap and the tick conversion, so
    // no single call can fill a buffer — the tick handler keeps topping rigs
    // up and counts exactly what went in (ch.fed) for conservation math.
    var Charge = Java.loadClass('mods.railcraft.api.charge.Charge');
    var CBB = Java.loadClass('com.starforge.compat.ChargeBridgeBlock');
    var CBM = Java.loadClass('com.starforge.compat.ChargeBridgeMode');
    var charge = { rigs: {}, fed: {}, CBM: CBM };
    var sfChargeAcc = function (pos) {
      return Charge.distribution.network(level).access(pos);
    };
    charge.chargeOf = function (pos) {
      try {
        var st = sfChargeAcc(pos).storage().orElse(null);
        return st ? st.getEnergyStored() : -1;
      } catch (e2) { return 'ERR:' + e2; }
    };
    charge.chargeStore = function (pos) {
      try { return sfChargeAcc(pos).storage().orElse(null); } catch (e3) { return null; }
    };
    charge.feOf = function (pos) {
      var c = sfCapAt(CAPS.energy, level, pos, null);
      return c ? c.getEnergyStored() : -1;
    };
    charge.feCap = function (pos) { return sfCapAt(CAPS.energy, level, pos, null); };
    charge.setMode = function (pos, m) {
      level.setBlockAndUpdate(pos, level.getBlockState(pos).setValue(CBB.MODE, m));
    };
    // Hermetic placement: previous captest runs leave bridges + ChargeSavedData
    // battery records behind. Snapshot whatever a surviving bridge still holds
    // (restart-persistence evidence: FE buffer comes from BE NBT, charge from
    // Railcraft's ChargeSavedData), then air first (onRemove deregisters the
    // node and drops its record) and drain anything a revived record holds.
    var AIR = reg.BLOCK.get(reg.RL.parse('minecraft:air'));
    charge.leftover = {};
    var sfLeftover = function (key, pos) {
      try {
        var st = level.getBlockState(pos);
        if (String(reg.BLOCK.getKey(st.getBlock())) === 'starforge_compat:charge_bridge') {
          charge.leftover[key] = { fe: charge.feOf(pos), charge: charge.chargeOf(pos) };
        }
      } catch (e8) { charge.leftover[key] = 'ERR:' + e8; }
    };
    var sfFreshBridge = function (pos, mode) {
      level.setBlockAndUpdate(pos, AIR.defaultBlockState());
      sfCapPlace(level, reg, 'starforge_compat:charge_bridge', pos);
      try { sfChargeAcc(pos).removeCharge(2147483647, false); } catch (e9) {}
      charge.setMode(pos, mode);
    };
    var cbx = tx + 16;

    // rig1 (direct): FE -> Charge until t100, then flipped to Charge -> FE.
    var r1pos = new BlockPos(cbx, ty, tz);
    sfLeftover('direct', r1pos);
    sfFreshBridge(r1pos, CBM.FE_TO_CHARGE);
    charge.rigs.direct = { pos: r1pos, cap: charge.feCap(r1pos), want: 4096 };

    // rig2 (FastPipes FE -> bridge -> Charge): creative cap -> extractor ->
    // energy pipe -> bridge. Measures the full public-grid ingress path.
    var r2x = cbx + 4;
    sfCapPlace(level, reg, 'immersiveengineering:capacitor_creative', new BlockPos(r2x, ty, tz - 1));
    sfCapPlace(level, reg, 'fastpipes:basic_energy_pipe', new BlockPos(r2x, ty, tz));
    sfLeftover('pipe_to_charge', new BlockPos(r2x, ty, tz + 1));
    sfFreshBridge(new BlockPos(r2x, ty, tz + 1), CBM.FE_TO_CHARGE);
    charge.rigs.pipe_to_charge = {
      src: new BlockPos(r2x, ty, tz - 1), pipe: new BlockPos(r2x, ty, tz),
      dst: new BlockPos(r2x, ty, tz + 1),
      attach: attach(new BlockPos(r2x, ty, tz), Direction.NORTH, 'fastpipes:basic_extractor_attachment')
    };

    // rig3 (Charge -> bridge -> FastPipes FE): pre-charged bridge north of an
    // energy pipe, extractor drains the bridge into a BC pump (receive-only
    // MjReceiverEnergyStorage — the known-good FE sink from the dst probe).
    var r3x = cbx + 8;
    var r3pos = new BlockPos(r3x, ty, tz - 1);
    sfLeftover('charge_to_pipe', r3pos);
    sfFreshBridge(r3pos, CBM.CHARGE_TO_FE);
    sfCapPlace(level, reg, 'fastpipes:basic_energy_pipe', new BlockPos(r3x, ty, tz));
    // Air first so a leftover pump from an earlier run can't fake a passing dst.
    level.setBlockAndUpdate(new BlockPos(r3x, ty, tz + 1), AIR.defaultBlockState());
    sfCapPlace(level, reg, 'buildcraftfactory:pump', new BlockPos(r3x, ty, tz + 1));
    charge.rigs.charge_to_pipe = {
      bridge: r3pos, batPos: r3pos, batWant: 4096,
      pipe: new BlockPos(r3x, ty, tz), dst: new BlockPos(r3x, ty, tz + 1),
      attach: attach(new BlockPos(r3x, ty, tz), Direction.NORTH, 'fastpipes:basic_extractor_attachment')
    };

    // rig4 (redstone suppression): AUTO mode + redstone block neighbour. The
    // buffer sits BELOW the AUTO_LOW mark so, unpowered, Charge->FE would run;
    // with the signal on, nothing may move either way.
    var r4x = cbx + 12;
    var r4pos = new BlockPos(r4x, ty, tz);
    sfCapPlace(level, reg, 'minecraft:redstone_block', new BlockPos(r4x + 1, ty, tz));
    sfLeftover('redstone_off', r4pos);
    sfFreshBridge(r4pos, CBM.AUTO);
    charge.rigs.redstone_off = { pos: r4pos, cap: charge.feCap(r4pos), want: 512 };

    // rig5 (AUTO dead zone): buffer inside [AUTO_LOW, AUTO_HIGH) with a charged
    // battery on the same node — both sides energized, conversion must idle.
    // Placed in OFF so the cap-fed buffer lands inside the dead zone without
    // ever crossing AUTO_LOW (a low buffer would legitimately pull charge);
    // flipped to AUTO at t100, after which nothing may move.
    var r5x = cbx + 16;
    var r5pos = new BlockPos(r5x, ty, tz);
    sfLeftover('auto_deadzone', r5pos);
    sfFreshBridge(r5pos, CBM.OFF);
    charge.rigs.auto_deadzone = { pos: r5pos, cap: charge.feCap(r5pos),
      batPos: r5pos, want: 2048, batWant: 2000 };

    transfers.charge = charge;
  } catch (err) {
    result.notes.push('setup error: ' + err);
    console.log('[captest] setup error: ' + err);
  }

  sfCaptest = { ticks: 0, result: result, transfers: transfers, level: level,
    CAPS: CAPS, reg: reg, FluidAction: FluidAction, engPos: engPos,
    Direction: Direction };
});

ServerEvents.tick((e) => {
  if (!sfCaptest) return;
  sfCaptest.ticks++;
  // The FastPipes energy pipe's cap delegates to its pipe network, which needs
  // a few ticks to form after placement — rotating the engine during setup sees
  // no receiver. Retry until it locks onto a side (or give up at 200).
  if (sfCaptest.transfers.engine && sfCaptest.engPos && !sfCaptest.engineRotateOk && sfCaptest.ticks <= 200) {
    var be = sfCaptest.level.getBlockEntity(sfCaptest.engPos);
    if (be) {
      try {
        var rr = String(be.attemptRotation());
        sfCaptest.transfers.engine_rotate = rr + '@' + sfCaptest.ticks;
        if (rr === 'SUCCESS') sfCaptest.engineRotateOk = true;
      } catch (err) { sfCaptest.transfers.engine_rotate = 'ERR:' + err; }
    } else sfCaptest.transfers.engine_rotate = 'no_be';
  }
  // Charge bridge: keep feeding each rig until its target is met (the cap is
  // 256/t per direction, so one call cannot top a buffer), track per-tick
  // deltas on the direct rig for the rate-cap check, and flip rig1 at t100.
  var charge = sfCaptest.transfers ? sfCaptest.transfers.charge : null;
  if (charge && sfCaptest.ticks <= 200) {
    var fed = charge.fed;
    // Caps/storages are re-resolved every tick: the Charge network rebuilds
    // nodes on chunk load and replaces the battery object a setup-time
    // access() returned, so a cached ChargeStorage silently detaches.
    var feedCap = function (pos, key, want) {
      if ((fed[key] || 0) >= want) return;
      var cap = charge.feCap(pos);
      if (cap) fed[key] = (fed[key] || 0) + cap.receiveEnergy(want - (fed[key] || 0), false);
    };
    var feedBat = function (pos, key, want) {
      if ((fed[key] || 0) >= want) return;
      var st = charge.chargeStore(pos);
      if (st) fed[key] = (fed[key] || 0) + st.receiveEnergy(want - (fed[key] || 0), false);
    };
    var d = charge.rigs.direct;
    feedCap(d.pos, 'direct', d.want);
    var r3 = charge.rigs.charge_to_pipe;
    feedBat(r3.batPos, 'r3bat', r3.batWant);
    var r4 = charge.rigs.redstone_off;
    feedCap(r4.pos, 'r4', r4.want);
    var r5 = charge.rigs.auto_deadzone;
    feedCap(r5.pos, 'r5', r5.want);
    feedBat(r5.batPos, 'r5bat', r5.batWant);
    if (sfCaptest.ticks === 100) {
      charge.direct_t100 = { buffer: charge.feOf(d.pos), battery: charge.chargeOf(d.pos),
        fe_total: fed.direct || 0 };
      charge.setMode(d.pos, charge.CBM.CHARGE_TO_FE);
      charge.setMode(r5.pos, charge.CBM.AUTO);
      charge.deadzone_t100 = { buffer: charge.feOf(r5.pos), battery: charge.chargeOf(r5.pos) };
    }
    if (sfCaptest.ticks === 150) {
      charge.direct_t150 = { buffer: charge.feOf(d.pos), battery: charge.chargeOf(d.pos) };
    }
    var bufNow = charge.feOf(d.pos), batNow = charge.chargeOf(d.pos);
    if (charge.prev && typeof bufNow === 'number' && typeof charge.prev.buf === 'number' &&
        typeof batNow === 'number' && typeof charge.prev.bat === 'number') {
      charge.max_fe_tick = Math.max(charge.max_fe_tick || 0, Math.abs(bufNow - charge.prev.buf));
      charge.max_charge_tick = Math.max(charge.max_charge_tick || 0, Math.abs(batNow - charge.prev.bat));
    }
    charge.prev = { buf: bufNow, bat: batNow };
  }
  if (sfCaptest.ticks < 200) return;
  var t = sfCaptest, r = t.result, level = t.level;
  try {
    // item
    var dst = level.getBlockEntity(t.transfers.item.dst);
    var got = 0;
    if (dst && dst.getContainerSize) {
      for (var s = 0; s < dst.getContainerSize(); s++) {
        var st = dst.getItem(s);
        if (st && !st.isEmpty()) got += st.getCount();
      }
    }
    r.transfers.item = { attach: t.transfers.item_attach, delivered: got, ok: got > 0 };

    // fluid
    var fsrc = sfCapAt(t.CAPS.fluid, level, t.transfers.fluid.src, null);
    var fdst = sfCapAt(t.CAPS.fluid, level, t.transfers.fluid.dst, null);
    var srcLeft = fsrc ? fsrc.getFluidInTank(0).getAmount() : -1;
    var dstGot = fdst ? fdst.getFluidInTank(0).getAmount() : -1;
    r.transfers.fluid = { attach: t.transfers.fluid_attach, src_left: srcLeft,
      dst_got: dstGot, ok: dstGot > 0, conserved: dstGot <= 8000 - 0 && srcLeft >= 0 };

    // energy + conservation
    var Direction2 = Java.loadClass('net.minecraft.core.Direction');
    var esrc = sfCapAt(t.CAPS.energy, level, t.transfers.energy.src, null);
    var esrcS = sfCapAt(t.CAPS.energy, level, t.transfers.energy.src, Direction2.SOUTH);
    var edst = sfCapAt(t.CAPS.energy, level, t.transfers.energy.dst, null);
    var srcNow = esrc ? esrc.getEnergyStored() : -1;
    var dstNow = edst ? edst.getEnergyStored() : -1;
    var srcLost = t.transfers.energy_src_start - srcNow;
    r.transfers.energy = { attach: t.transfers.energy_attach,
      src_start: t.transfers.energy_src_start, src_now: srcNow, dst_now: dstNow,
      moved: dstNow, ok: dstNow > 0,
      conserved: dstNow <= srcLost,
      src_can_extract: esrcS ? esrcS.canExtract() : 'nocap',
      src_sim_extract: esrcS ? esrcS.extractEnergy(500, true) : 'nocap',
      dst_sim_receive: edst ? edst.receiveEnergy(500, true) : 'nocap',
      dst_sides: (function () {
        var m = {};
        for (var q = 0; q < 6; q++) {
          var c = sfCapAt(t.CAPS.energy, level, t.transfers.energy.dst, Direction2.values()[q]);
          if (c) m[String(Direction2.values()[q])] = { recv: c.receiveEnergy(500, true), stored: c.getEnergyStored() };
        }
        return m;
      })(),
      pipe_stored: (function () {
        var c = sfCapAt(t.CAPS.energy, level, new (Java.loadClass('net.minecraft.core.BlockPos'))(
          t.transfers.energy.dst.getX(), t.transfers.energy.dst.getY(), t.transfers.energy.dst.getZ() - 1), null);
        return c ? c.getEnergyStored() : 'nocap';
      })() };
    console.log('[captest] energy: src ' + t.transfers.energy_src_start + '->' + srcNow +
      ', dst ' + dstNow + ', conserved=' + (dstNow <= srcLost));

    // stirling engine -> energy pipe -> ic2 furnace (DISPLAY_FE direct FE push)
    var eeng = t.transfers.engine;
    if (eeng) {
      var ebe = level.getBlockEntity(eeng.eng);
      var epipe = sfCapAt(t.CAPS.energy, level, eeng.pipe, null);
      var efur = sfCapAt(t.CAPS.energy, level, eeng.dst, null);
      var pipeNow = epipe ? epipe.getEnergyStored() : -1;
      var furNow = efur ? efur.getEnergyStored() : -1;
      var burning = 'no_be', stage = 'no_be';
      try { burning = ebe ? String(ebe.isBurning()) : 'no_be'; } catch (e0) { burning = 'ERR'; }
      try { stage = ebe ? String(ebe.getPowerStage()) : 'no_be'; } catch (e1) { stage = 'ERR'; }
      r.transfers.engine = { rotate: t.transfers.engine_rotate,
        fueled: t.transfers.engine_fueled, burning: burning, stage: stage,
        pipe_stored: pipeNow, dst_stored: furNow, ok: pipeNow > 0 || furNow > 0 };
      console.log('[captest] engine: pipe=' + pipeNow + ', dst=' + furNow +
        ', burning=' + burning + ', stage=' + stage);
    }

    // charge bridge results
    var ch = t.transfers.charge;
    if (ch) {
      var rr = {};
      var dd = ch.rigs.direct;
      var fbuf = ch.feOf(dd.pos), fbat = ch.chargeOf(dd.pos);
      var feIn = ch.fed.direct || 0;
      var t100 = ch.direct_t100 || {};
      rr.direct = {
        mode_seq: 'fe_to_charge@0 -> charge_to_fe@100',
        fe_in: feIn,
        at_t100: t100, at_t150: ch.direct_t150,
        fe_buffer_final: fbuf, charge_battery_final: fbat,
        fe_to_charge_ok: typeof t100.battery === 'number' && t100.battery > 0,
        charge_to_fe_ok: fbuf > 0 && fbat === 0,
        battery_full_ok: t100.battery === 4096,
        measured_ratio_fe_to_charge:
          (typeof t100.battery === 'number' && (t100.fe_total - t100.buffer) > 0)
            ? t100.battery / (t100.fe_total - t100.buffer) : 'n/a',
        roundtrip_conserved: (fbuf + Math.max(0, fbat)) <= feIn,
        max_fe_per_tick: ch.max_fe_tick, max_charge_per_tick: ch.max_charge_tick,
        rate_capped: (ch.max_fe_tick || 0) <= 256 && (ch.max_charge_tick || 0) <= 256
      };
      var p2c = ch.rigs.pipe_to_charge;
      var p2cPipe = sfCapAt(t.CAPS.energy, level, p2c.pipe, null);
      rr.fastpipes_fe_to_charge = {
        attach: p2c.attach,
        charge_battery: ch.chargeOf(p2c.dst), bridge_buffer: ch.feOf(p2c.dst),
        pipe_stored: p2cPipe ? p2cPipe.getEnergyStored() : 'nocap',
        ok: ch.chargeOf(p2c.dst) > 0
      };
      var c2p = ch.rigs.charge_to_pipe;
      var c2pPipe = sfCapAt(t.CAPS.energy, level, c2p.pipe, null);
      var c2pDst = sfCapAt(t.CAPS.energy, level, c2p.dst, null);
      var c2pPipeStored = c2pPipe ? c2pPipe.getEnergyStored() : -1;
      var c2pDstStored = c2pDst ? c2pDst.getEnergyStored() : -1;
      rr.fastpipes_charge_to_fe = {
        attach: c2p.attach, charged_in: ch.fed.r3bat || 0,
        charge_left: ch.chargeOf(c2p.bridge), bridge_buffer: ch.feOf(c2p.bridge),
        pipe_stored: c2pPipeStored, dst_stored: c2pDstStored,
        ok: (c2pDstStored + c2pPipeStored) > 0 && ch.chargeOf(c2p.bridge) < (ch.fed.r3bat || 0)
      };
      var g4 = ch.rigs.redstone_off;
      var g4buf = ch.feOf(g4.pos), g4bat = ch.chargeOf(g4.pos);
      rr.redstone_off = { fe_in: ch.fed.r4 || 0, buffer: g4buf, battery: g4bat,
        ok: g4buf === 512 && g4bat === 0 };
      var g5 = ch.rigs.auto_deadzone;
      var g5buf = ch.feOf(g5.pos), g5bat = ch.chargeOf(g5.pos);
      var dz100 = ch.deadzone_t100 || {};
      rr.auto_deadzone = { fe_in: ch.fed.r5 || 0, charged: ch.fed.r5bat || 0,
        at_t100: dz100, buffer: g5buf, battery: g5bat,
        // AUTO engaged at t100 with buffer mid-dead-zone: nothing may move.
        ok: g5buf === 2048 && g5bat === 2000 &&
            dz100.buffer === 2048 && dz100.battery === 2000 };
      rr.restart_persistence = { leftover: ch.leftover,
        // rig5 sat idle in AUTO with both sides stocked; a saved+reloaded world
        // must hand back exactly those values (BE NBT + ChargeSavedData).
        ok: ch.leftover.auto_deadzone &&
            ch.leftover.auto_deadzone.fe === 2048 &&
            ch.leftover.auto_deadzone.charge === 2000 };
      r.transfers.charge_bridge = rr;
      console.log('[captest] charge_bridge: direct t100=' + JSON.stringify(t100) +
        ' final buf=' + fbuf + ' bat=' + fbat +
        ' | pipe->charge bat=' + rr.fastpipes_fe_to_charge.charge_battery +
        ' | charge->pipe dst=' + c2pDstStored + '/pipe=' + c2pPipeStored +
        ' | redstone buf=' + g4buf + ' | deadzone buf=' + g5buf + '/bat=' + g5bat);
    }
  } catch (err) {
    r.notes.push('measure error: ' + err);
    console.log('[captest] measure error: ' + err);
  }
  JsonIO.write('kubejs/export/captest.json', r);
  console.log('[captest] done -> kubejs/export/captest.json');
  sfCaptest = null;
});
