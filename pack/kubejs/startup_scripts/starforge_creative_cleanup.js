// Creative-tab cleanup — mirrors starforge_viewer_cleanup.js (server) for the
// TaCZ creative tabs so the hidden EOS entries do not linger in creative mode.
// Same reason: eos:eos_chaos (missing setsentinel dep), eos:eoslab_12g and
// eos:alloy (no recipe / unused ammo), all eos:* attachments and the
// eos_old:old_conversion bench (upstream forge: recipes cannot load).
function sfTag(stack, key) {
  try {
    const nbt = stack.customData ?? stack.nbt;
    if (!nbt) return '';
    const v = nbt.getString ? nbt.getString(key) : nbt[key];
    return String(v ?? '').replace(/^"|"$/g, '');
  } catch (err) { return ''; }
}
const sfHiddenTacz = (stack) => {
  const id = String(stack.id);
  if (id === 'tacz:modern_kinetic_gun') return sfTag(stack, 'GunId') === 'eos:eos_chaos';
  if (id === 'tacz:ammo') {
    const a = sfTag(stack, 'AmmoId');
    return a === 'eos:eoslab_12g' || a === 'eos:alloy';
  }
  if (id === 'tacz:attachment') return sfTag(stack, 'AttachmentId').startsWith('eos:');
  if (id === 'tacz:workbench_a') return sfTag(stack, 'BlockId') === 'eos_old:old_conversion';
  return false;
};

for (const tab of ['mg', 'ammo', 'scope', 'muzzle', 'stock', 'grip',
  'extended_mag', 'laser', 'other', 'pistol', 'sniper', 'rifle',
  'shotgun', 'smg', 'rpg']) {
  StartupEvents.modifyCreativeTab(`tacz:${tab}`, (e) => e.remove(sfHiddenTacz));
}
