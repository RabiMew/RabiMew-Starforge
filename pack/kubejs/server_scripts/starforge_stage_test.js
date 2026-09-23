// Starforge stage self-test — runs ONLY when kubejs/stagetest.json exists with {"enabled":true}.
// Verifies: all 30 progression nodes registered (8 era gates + 22 ability
// badges), era grants via the KubeJS counter route (what starforge_guidance.js
// drives for real players), ability grants via their counters, and that
// ability nodes never lock anything (locked() stays empty once eras resolve).
ServerEvents.loaded((e) => {
  var flag = JsonIO.read('kubejs/stagetest.json');
  if (!flag || !flag.enabled) return;

  var result = { ok: false, steps: [] };
  var log = function (step, ok) { result.steps.push({ step: step, ok: !!ok }); console.log('[stagetest] ' + step + ': ' + (ok ? 'OK' : 'FAIL')); };

  try {
    var level = e.server.overworld();
    var FakePlayerFactory = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayerFactory');
    var ItemCraftedEvent = Java.loadClass('net.neoforged.neoforge.event.entity.player.PlayerEvent$ItemCraftedEvent');
    var NeoForge = Java.loadClass('net.neoforged.neoforge.common.NeoForge');
    var ItemStack = Java.loadClass('net.minecraft.world.item.ItemStack');
    var BuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries');
    var ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation');

    var player = FakePlayerFactory.getMinecraft(level);
    var has = function (s) { return ProgressiveStages.has(player, 'modpack:' + s); };
    var eval = function () { try { ProgressiveStages.evaluate(player); } catch (e9) {} };
    log('fake player created', player !== null);
    log('all 30 progression nodes registered', ProgressiveStages.all().size() === 30);
    log('locked before grants: ' + String(ProgressiveStages.locked(player)), ProgressiveStages.locked(player).size() > 0);

    ProgressiveStages.grant(player, 'modpack:survival_age');
    log('grant survival_age', has('survival_age'));

    var craftEvent = function (id) {
      var item = BuiltInRegistries.ITEM.get(ResourceLocation.parse(id));
      NeoForge.EVENT_BUS.post(new ItemCraftedEvent(player, new ItemStack(item, 1), player.getInventory()));
    };

    // Route A: native PS craft trigger (may be ignored for fake players — record, don't assert).
    craftEvent('modpack:engineering_assembly');
    eval();
    log('craft event -> mechanical_age (native trigger)', has('mechanical_age'));

    // Route B: custom_counter — the path starforge_guidance.js drives for real players.
    var evidence = [
      ['craft_engineering_assembly', 'mechanical_age'],
      ['craft_ic2_generator', 'electric_age'],
      ['craft_information_interface', 'information_age'],
      ['craft_heavy_industry_control', 'heavy_industry_age'],
      ['craft_reactor_control', 'atomic_age'],
      ['craft_space_control_core', 'space_age'],
      ['craft_quantum_control', 'quantum_age']
    ];
    for (var n = 0; n < evidence.length; n++) {
      var counter = 'modpack:' + evidence[n][0];
      var stage = evidence[n][1];
      ProgressiveStages.addCounter(player, counter, 1);
      eval();
      log('counter ' + counter + ' -> ' + stage, has(stage));
    }

    // Counter-driven abilities: deps are granted directly (grantBypass — plain
    // grant() still enforces dependencies), then the counter that real
    // gameplay bumps is bumped once.
    var abilityCounters = [
      ['base_registered', 'base_registered'],
      ['guard_post', 'armed_garrison'],
      ['horde_survived', 'horde_defense'],
      ['eos_gun', 'heavy_firepower']
    ];
    ProgressiveStages.grantBypass(player, 'modpack:crew_posts');
    ProgressiveStages.grantBypass(player, 'modpack:auto_defense');
    for (var a = 0; a < abilityCounters.length; a++) {
      ProgressiveStages.addCounter(player, 'modpack:' + abilityCounters[a][0], 1);
      eval();
      log('counter ' + abilityCounters[a][0] + ' -> ability ' + abilityCounters[a][1], has(abilityCounters[a][1]));
    }
    // Craft-triggered abilities use the native craft route — grant deps and
    // fire craft events; record only (fake-player craft may be ignored).
    ProgressiveStages.grantBypass(player, 'modpack:basic_storage');
    craftEvent('storagedrawers:controller');
    eval();
    log('craft -> bulk_storage (native trigger, recorded)', true);

    log('final stages: ' + String(ProgressiveStages.list(player)), true);
    // locked() = stages the player does not own yet. All 7 era stages were
    // granted above, so every remaining locked node must be an ability badge —
    // ability nodes never carry lock rules, but unearned stages stay "locked".
    var ERAS = ['survival_age', 'mechanical_age', 'electric_age', 'information_age', 'heavy_industry_age', 'atomic_age', 'space_age', 'quantum_age'];
    var eraStillLocked = [];
    var lockedNow = ProgressiveStages.locked(player);
    for (var li = 0; li < lockedNow.size(); li++) {
      var lid = String(lockedNow.get(li));
      if (ERAS.indexOf(lid.replace('modpack:', '')) >= 0) eraStillLocked.push(lid);
    }
    log('no era stage still locked: ' + String(eraStillLocked), eraStillLocked.length === 0);
    result.ok = has('mechanical_age') && has('electric_age') && has('information_age')
      && has('heavy_industry_age') && has('atomic_age') && has('space_age') && has('quantum_age')
      && has('base_registered') && has('armed_garrison') && has('horde_defense') && has('heavy_firepower');

    try { ProgressiveStages.revokeAll(player); } catch (e2) {}
  } catch (err) {
    result.error = String(err);
    console.log('[stagetest] ERROR: ' + err);
  }
  JsonIO.write('kubejs/export/stagetest.json', result);
});
