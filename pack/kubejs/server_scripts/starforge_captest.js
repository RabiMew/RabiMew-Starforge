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
  level.setChunkForced(bx >> 4, bz >> 4, true);

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
    'buildcraftenergy:engine_fe', 'buildcraftenergy:mj_dynamo',
    'ae2:energy_acceptor', 'ae2:energy_cell', 'ae2:controller',
    'energizedfurniture:energy_transformer',
    'railcraft:charge_terminal', 'railcraft:charge_motor',
    'fastpipes:basic_energy_pipe', 'fastpipes:improved_energy_pipe', 'fastpipes:elite_energy_pipe'
  ];
  var px = 0;
  for (var ii = 0; ii < itemIds.length; ii++, px += 2) probe(itemIds[ii], 'item', bx + px, bz);
  for (var fi = 0; fi < fluidIds.length; fi++, px += 2) probe(fluidIds[fi], 'fluid', bx + px, bz + 4);
  for (var ei = 0; ei < energyIds.length; ei++, px += 2) probe(energyIds[ei], 'energy', bx + px, bz + 8);

  // ---------- Phase B setup: real FastPipes transfers ----------
  // Item: source chest -> pipe (extractor on source side) -> sink chest.
  // Fluid: bc tank -> fluid pipe -> bc tank.
  // Energy: capacitor_lv -> energy pipe -> capacitor_lv (conservation: in<=out).
  var ty = by;
  var tz = bz + 12;
  var tx = bx;
  var transfers = {};
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
    var dstCandidates = ['ic2cre:electric_furnace', 'ae2:controller',
      'ad_astra:compressor', 'immersiveengineering:furnace_heater'];
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
  } catch (err) {
    result.notes.push('setup error: ' + err);
    console.log('[captest] setup error: ' + err);
  }

  sfCaptest = { ticks: 0, result: result, transfers: transfers, level: level,
    CAPS: CAPS, reg: reg, FluidAction: FluidAction };
});

ServerEvents.tick((e) => {
  if (!sfCaptest) return;
  sfCaptest.ticks++;
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
  } catch (err) {
    r.notes.push('measure error: ' + err);
    console.log('[captest] measure error: ' + err);
  }
  JsonIO.write('kubejs/export/captest.json', r);
  console.log('[captest] done -> kubejs/export/captest.json');
  sfCaptest = null;
});
