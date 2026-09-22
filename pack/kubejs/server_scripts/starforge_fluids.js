// Starforge unified oil economy — fluid tag bridge.
// One crude layer (BC oil / IP crudeoil / Ad Astra oil are interchangeable)
// and one refined-fuel layer (IP diesel+gasoline / IE biodiesel / BC fuels /
// Ad Astra fuel are interchangeable wherever a tag consumer asks for fuel).
// All ids resolve through global.SM.fluids (design/semantic-map.json) and the
// script throws on a missing key — never silently skips.
ServerEvents.tags('fluid', (e) => {
  const F = global.SM.fluids;
  const f = (k) => {
    const id = F[k];
    if (!id) throw new Error('semantic fluid id missing: ' + k);
    return id;
  };
  const all = (keys) => keys.map(f);

  // Crude oil equivalents (pump output / refinery input).
  const CRUDE = all([
    'bc_oil', 'bc_oil_flowing', 'bc_oil_dense', 'bc_oil_dense_flowing',
    'bc_oil_heavy', 'bc_oil_heavy_flowing', 'aa_oil', 'ip_crude_oil'
  ]);
  // Refined fuels (engine / generator / rocket burnables).
  const FUEL = all([
    'aa_fuel', 'aa_cryo_fuel',
    'ip_diesel', 'ip_diesel_flowing', 'ip_diesel_sulfur', 'ip_diesel_sulfur_flowing',
    'ip_gasoline', 'ip_gasoline_flowing',
    'ie_biodiesel', 'ie_biodiesel_flowing',
    'ie_high_power_biodiesel', 'ie_high_power_biodiesel_flowing',
    'bc_fuel_light', 'bc_fuel_light_flowing', 'bc_fuel_dense', 'bc_fuel_dense_flowing',
    'bc_fuel_gaseous', 'bc_fuel_gaseous_flowing',
    'bc_fuel_mixed_light', 'bc_fuel_mixed_light_flowing',
    'bc_fuel_mixed_heavy', 'bc_fuel_mixed_heavy_flowing'
  ]);

  // Creosote equivalents (Railcraft coke oven / IE coke oven / IC2 semifluid).
  const CREOSOTE = all([
    'rc_creosote', 'rc_creosote_flowing',
    'ie_creosote', 'ie_creosote_flowing',
    'ic2_creosote', 'ic2_creosote_flowing'
  ]);

  for (const tag of ['c:oil', 'c:crude_oil', 'ic2cre:fluid_heat/oil']) e.add(tag, CRUDE);
  for (const tag of ['c:fuel', 'ic2cre:fluid_heat/fuel']) e.add(tag, FUEL);
  for (const tag of ['c:creosote', 'ic2cre:semifluid_generator/creosote']) e.add(tag, CREOSOTE);
  console.log('[starforge] fluid bridge: crude x' + CRUDE.length + ', fuel x' + FUEL.length + ', creosote x' + CREOSOTE.length);
});
