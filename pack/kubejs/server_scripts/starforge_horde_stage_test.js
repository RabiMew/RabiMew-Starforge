// Horde stage-table self-test — runs ONLY when kubejs/hordetest.json exists
// with {"enabled":true}. Verifies the starforge:stage script condition
// (starforge_compat HordeStageCondition) actually swaps the horde spawn table
// by ProgressiveStages era stage: drives a real HordeBuildSpawnDataEvent
// through HordeScriptLoader for a FakePlayer and asserts which table each
// stage tier selects. Era bands per docs/defense-and-colonies.md:
// T0–T1 default / T2 default_t2 / T3–T4 default_t3 / T5 default_t5 / T6+ default_t6.
ServerEvents.loaded((e) => {
  var flag = JsonIO.read('kubejs/hordetest.json');
  if (!flag || !flag.enabled) return;

  var result = { ok: false, steps: [] };
  var log = function (step, ok) { result.steps.push({ step: step, ok: !!ok }); console.log('[hordetest] ' + step + ': ' + (ok ? 'OK' : 'FAIL')); };

  try {
    var level = e.server.overworld();
    var FakePlayerFactory = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayerFactory');
    var HordeSavedData = Java.loadClass('net.smileycorp.hordes.hordeevent.capability.HordeSavedData');
    var BuildEvent = Java.loadClass('net.smileycorp.hordes.common.event.HordeBuildSpawnDataEvent');
    var ScriptLoader = Java.loadClass('net.smileycorp.hordes.hordeevent.data.HordeScriptLoader');

    var player = FakePlayerFactory.getMinecraft(level);
    var horde = HordeSavedData.getData(level).getEvent(player.getGameProfile().getId());
    log('fake player + horde event data', player !== null && horde !== null);

    var pickTable = function () {
      var ev = new BuildEvent(player, horde);
      ScriptLoader.INSTANCE.applyScripts(ev);
      var t = ev.getSpawnData().getTable();
      return t === null ? 'null' : String(t.getName());
    };

    var expect = function (grant, table) {
      if (grant !== null) ProgressiveStages.grantBypass(player, 'modpack:' + grant);
      var got = pickTable();
      var ok = got === table;
      log((grant === null ? 'no stage' : grant) + ' -> ' + table + ' (got ' + got + ')', ok);
      return ok;
    };

    var allOk = expect(null, 'hordes:default')
      && expect('mechanical_age', 'hordes:default')
      && expect('electric_age', 'hordes:default_t2')
      && expect('information_age', 'hordes:default_t3')
      && expect('atomic_age', 'hordes:default_t5')
      && expect('space_age', 'hordes:default_t6');

    result.ok = allOk;
    try { ProgressiveStages.revokeAll(player); } catch (e2) {}
  } catch (err) {
    result.error = String(err);
    console.log('[hordetest] ERROR: ' + err);
  }
  JsonIO.write('kubejs/export/hordetest.json', result);
});
