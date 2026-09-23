// Horde alert hook: fires only when The Hordes starts/ends a horde event for a
// player (no per-tick scanning). Sends a title + sound + chat warning.
// The redstone layer is handled by starforge_compat:horde_alarm (the addon
// listens to the same events and drives a 15-strength signal) - this script
// only owns the presentation layer, so the two can evolve independently.

const HordeStartEvent = 'net.smileycorp.hordes.common.event.HordeStartEvent'
const HordeEndEvent = 'net.smileycorp.hordes.common.event.HordeEndEvent'

NativeEvents.onEvent(HordeStartEvent, (e) => {
  const player = e.getPlayer()
  if (!player) return
  const server = player.getServer()
  const name = player.getGameProfile().getName()
  server.runCommandSilent(`title ${name} times 10 70 20`)
  server.runCommandSilent(`title ${name} subtitle {"text":"Defend the base!","color":"red"}`)
  server.runCommandSilent(`title ${name} title {"text":"HORDE INCOMING","color":"dark_red","bold":true}`)
  server.runCommandSilent(`playsound minecraft:event.raid.horn hostile ${name} ~ ~ ~ 1 1`)
  player.tell(Text.red('A horde is descending on your position - turrets and guards to arms!'))
})

NativeEvents.onEvent(HordeEndEvent, (e) => {
  const player = e.getPlayer()
  if (!player) return
  player.tell(Text.green('The horde has been repelled. Resupply ammo, food and turret stock.'))
})
