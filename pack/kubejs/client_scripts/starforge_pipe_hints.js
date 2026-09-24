// Starforge pipe-role hints — one-line role tags so EMI/JEI/tooltips teach the
// pack's logistics split: FastPipes = default item/fluid/FE network, BC pipes =
// legacy adapters around BC specialty machines, IE conveyors/fluid pipes =
// visible industrial lines. Text lives in localization/* (modpack.tip.*).
ItemEvents.modifyTooltips((e) => {
  const t = (k) => [Text.translate(k)];
  const fpLogistics = [
    'basic_item_pipe', 'improved_item_pipe', 'advanced_item_pipe',
    'basic_fluid_pipe', 'improved_fluid_pipe', 'advanced_fluid_pipe',
    'elite_fluid_pipe', 'ultimate_fluid_pipe',
    'basic_extractor_attachment', 'improved_extractor_attachment',
    'advanced_extractor_attachment', 'elite_extractor_attachment',
    'ultimate_extractor_attachment', 'basic_inserter_attachment',
    'improved_inserter_attachment', 'advanced_inserter_attachment',
    'elite_inserter_attachment', 'ultimate_inserter_attachment',
    'void_attachment', 'sensor_attachment', 'terminal', 'wrench'
  ];
  for (const id of fpLogistics) {
    e.add('fastpipes:' + id, t('modpack.tip.fastpipes'));
  }
  const fpEnergy = [
    'basic_energy_pipe', 'improved_energy_pipe', 'advanced_energy_pipe',
    'elite_energy_pipe', 'ultimate_energy_pipe'
  ];
  for (const id of fpEnergy) {
    e.add('fastpipes:' + id, t('modpack.tip.fastpipes_energy'));
  }
  // BC generic transport pipes — re-costed as legacy shells (SF-35).
  e.add(/^buildcrafttransport:.*_(item|fluid|power|fe)$/, t('modpack.tip.bc_pipe_legacy'));
  // IE visible-line carriers.
  e.add(/^immersiveengineering:(conveyor_[a-z_]+|fluid_pipe.*)$/, t('modpack.tip.ie_visual'));
});
