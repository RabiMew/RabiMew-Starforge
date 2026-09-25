// Starforge FTB Essentials command-gate self-test — runs ONLY when
// kubejs/essentialstest.json exists with {"enabled":true}.
// Verifies the live dispatcher: player commands usable by a level-0
// FakePlayer source, admin commands gated to permission level >=2,
// and the disabled /enderchest module absent from the command tree.
ServerEvents.loaded((e) => {
  var flag = JsonIO.read('kubejs/essentialstest.json');
  if (!flag || !flag.enabled) return;

  var result = { ok: false, steps: [] };
  var log = function (step, ok) { result.steps.push({ step: step, ok: !!ok }); console.log('[essentialstest] ' + step + ': ' + (ok ? 'OK' : 'FAIL')); };

  try {
    var level = e.server.overworld();
    var FakePlayerFactory = Java.loadClass('net.neoforged.neoforge.common.util.FakePlayerFactory');
    var player = FakePlayerFactory.getMinecraft(level);

    var root = e.server.getCommands().getDispatcher().getRoot();
    var playerStack = player.createCommandSourceStack();
    var consoleStack = e.server.createCommandSourceStack();

    log('fake player is level-0 (hasPermission(2)=' + playerStack.hasPermission(2) + ', console=' + consoleStack.hasPermission(2) + ')',
      playerStack.hasPermission(2) === false && consoleStack.hasPermission(2) === true);

    var canUse = function (name, stack) {
      var node = root.getChild(name);
      return node === null ? null : node.canUse(stack);
    };

    // Required basic-teleport set (+ module-provided siblings) — must exist and
    // be usable by a non-op player.
    var playerCmds = ['tpa', 'tpahere', 'tpaccept', 'tpdeny',
      'home', 'sethome', 'delhome', 'listhomes',
      'back', 'spawn', 'playerspawn', 'warp', 'listwarps', 'rtp',
      'kickme', 'trashcan', 'nickname', 'leaderboard', 'give_me_kit'];
    for (var i = 0; i < playerCmds.length; i++) {
      var n = playerCmds[i];
      log('player can use /' + n + ' (registered=' + (root.getChild(n) !== null) + ')', canUse(n, playerStack) === true);
    }

    // Admin/mod commands — registered but denied for level-0 players.
    var adminCmds = ['fly', 'god', 'heal', 'feed', 'extinguish', 'invsee',
      'mute', 'unmute', 'kit', 'tp_offline', 'teleport_last', 'tpx', 'jump',
      'setwarp', 'delwarp', 'hat', 'near', 'open'];
    for (var j = 0; j < adminCmds.length; j++) {
      var m = adminCmds[j];
      log('/' + m + ' admin-only (player=' + canUse(m, playerStack) + ', console=' + canUse(m, consoleStack) + ')',
        canUse(m, playerStack) === false && canUse(m, consoleStack) === true);
    }

    // /speed: bare form is a read-only self info display (usable by all);
    // the boost_percent child (actual modification) must stay op-gated.
    var speedBoost = root.getChild('speed') === null ? null : root.getChild('speed').getChild('boost_percent');
    log('/speed self-info usable by player', canUse('speed', playerStack) === true);
    log('/speed <boost> admin-only', speedBoost !== null && speedBoost.canUse(playerStack) === false && speedBoost.canUse(consoleStack) === true);

    // Disabled module must be absent entirely.
    log('/enderchest absent', root.getChild('enderchest') === null);

    // Pack config values took effect (pack/config/ftbessentials.snbt).
    var FTBEConfig = Java.loadClass('dev.ftb.mods.ftbessentials.config.FTBEConfig');
    log('home max = ' + FTBEConfig.MAX_HOMES.value.get(), Number(FTBEConfig.MAX_HOMES.value.get()) === 3);
    log('home warmup = ' + FTBEConfig.HOME.getWarmup(player), FTBEConfig.HOME.getWarmup(player) === 3);
    log('tpa cooldown = ' + FTBEConfig.TPA.getCooldown(player), FTBEConfig.TPA.getCooldown(player) === 10);

    // Real executions as the fake player (level 0): dispatcher.execute throws
    // CommandSyntaxException when a requires() gate rejects the source, so
    // reaching the mod handler (any int return, incl. 0) proves the gate passed.
    // Note: FTB Essentials returns empty player-data for fake players, so
    // sethome/home land on the mod's own early-exit (return 0) — the assertion
    // is "not refused by the dispatcher", not the result value.
    var dispatcher = e.server.getCommands().getDispatcher();
    var run = function (stack, cmd) {
      try { return dispatcher.execute(cmd, stack); } catch (ex) { return 'ERR ' + ex; }
    };
    var rSethome = run(playerStack, 'sethome base');
    log('exec /sethome base passed gate -> ' + rSethome, String(rSethome).indexOf('ERR') !== 0);
    var rList = run(playerStack, 'listhomes');
    log('exec /listhomes passed gate -> ' + rList, String(rList).indexOf('ERR') !== 0);
    var rFly = run(playerStack, 'fly');
    log('exec /fly refused by gate -> ' + rFly, String(rFly).indexOf('ERR') === 0);

    result.ok = result.steps.every(function (s) { return s.ok; });
  } catch (err) {
    result.error = String(err);
    console.log('[essentialstest] ERROR: ' + err);
  }
  JsonIO.write('kubejs/export/essentialstest.json', result);
});
