// Starforge stage self-test — runs ONLY when kubejs/stagetest.json exists with {"enabled":true}.
// Verifies: stage registration, craft-event grants (native PS trigger), and the
// KubeJS counter grant route (what starforge_triggers.js drives for real players).
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
    log('fake player created', player !== null);
    log('all 8 stages registered', ProgressiveStages.all().size() === 8);
    log('locked before grants: ' + String(ProgressiveStages.locked(player)), ProgressiveStages.locked(player).size() > 0);

    ProgressiveStages.grant(player, 'modpack:survival_age');
    log('grant survival_age', has('survival_age'));

    var craftEvent = function (id) {
      var item = BuiltInRegistries.ITEM.get(ResourceLocation.parse(id));
      NeoForge.EVENT_BUS.post(new ItemCraftedEvent(player, new ItemStack(item, 1), player.getInventory()));
    };

    // Route A: native PS craft trigger (may be ignored for fake players — record, don't assert).
    craftEvent('modpack:engineering_assembly');
    try { ProgressiveStages.evaluate(player); } catch (e3) {}
    log('craft event -> mechanical_age (native trigger)', has('mechanical_age'));

    // Route B: custom_counter — the path starforge_triggers.js drives for real players.
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
      try { ProgressiveStages.evaluate(player); } catch (e4) {}
      log('counter ' + counter + ' -> ' + stage, has(stage));
    }

    log('final stages: ' + String(ProgressiveStages.list(player)), true);
    log('locked after all grants: ' + String(ProgressiveStages.locked(player)), ProgressiveStages.locked(player).size() === 0);
    result.ok = has('mechanical_age') && has('electric_age') && has('information_age')
      && has('heavy_industry_age') && has('atomic_age') && has('space_age') && has('quantum_age');

    try { ProgressiveStages.revokeAll(player); } catch (e2) {}
  } catch (err) {
    result.error = String(err);
    console.log('[stagetest] ERROR: ' + err);
  }
  JsonIO.write('kubejs/export/stagetest.json', result);
});
