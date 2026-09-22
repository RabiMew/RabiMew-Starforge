// Starforge P0 registry & recipe audit exporter.
// Dumps real registry IDs + recipe JSON into kubejs/export/ on every server start.
// Ground truth for design/semantic-map.json — never guess IDs.

const SF_BI = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries');
const SF_Registries = Java.loadClass('net.minecraft.core.registries.Registries');
const SF_JsonOps = Java.loadClass('com.mojang.serialization.JsonOps');
const SF_RegistryOps = Java.loadClass('net.minecraft.resources.RegistryOps');
const SF_Ingredient = Java.loadClass('net.minecraft.world.item.crafting.Ingredient');
function sfRegIds(reg) {
  const list = [];
  reg.keySet().forEach((k) => list.push(String(k)));
  return list.sort();
}

function sfDumpTags(reg) {
  const out = {};
  reg.getTagNames().forEach((tk) => {
    const set = reg.getTag(tk);
    if (!set.isPresent()) return;
    const list = [];
    set.get().forEach((h) => {
      const k = h.unwrapKey();
      if (k.isPresent()) list.push(String(k.get().location()));
    });
    out[String(tk.location())] = list.sort();
  });
  return out;
}

ServerEvents.loaded((event) => {
  const server = event.server;
  try {
    JsonIO.write('kubejs/export/items.json', sfRegIds(SF_BI.ITEM));
    JsonIO.write('kubejs/export/blocks.json', sfRegIds(SF_BI.BLOCK));
    JsonIO.write('kubejs/export/fluids.json', sfRegIds(SF_BI.FLUID));
    JsonIO.write('kubejs/export/entity_types.json', sfRegIds(SF_BI.ENTITY_TYPE));
    JsonIO.write('kubejs/export/recipe_types.json', sfRegIds(SF_BI.RECIPE_TYPE));
    JsonIO.write('kubejs/export/recipe_serializers.json', sfRegIds(SF_BI.RECIPE_SERIALIZER));
    JsonIO.write('kubejs/export/mob_effects.json', sfRegIds(SF_BI.MOB_EFFECT));
    JsonIO.write('kubejs/export/tags_item.json', sfDumpTags(SF_BI.ITEM));
    JsonIO.write('kubejs/export/tags_block.json', sfDumpTags(SF_BI.BLOCK));
    JsonIO.write('kubejs/export/tags_fluid.json', sfDumpTags(SF_BI.FLUID));
    JsonIO.write('kubejs/export/tags_entity.json', sfDumpTags(SF_BI.ENTITY_TYPE));

    var levelList = [];
    server.levelKeys().forEach((k) => levelList.push(String(k.location())));
    var ra = server.registryAccess();
    var dimReg = ra.registryOrThrow(SF_Registries.DIMENSION);
    var dimTypes = ra.registryOrThrow(SF_Registries.DIMENSION_TYPE);
    JsonIO.write('kubejs/export/levels.json', levelList.sort());
    JsonIO.write('kubejs/export/dimensions.json', sfRegIds(dimReg));
    JsonIO.write('kubejs/export/dimension_types.json', sfRegIds(dimTypes));

    var ops = SF_RegistryOps.create(SF_JsonOps.INSTANCE, ra);
    var recipes = [];
    var failed = [];
    server.getRecipeManager().getRecipes().forEach((holder) => {
      var rec = holder.value();
      var id = String(holder.id());
      var entry = {
        id: id,
        type: String(SF_BI.RECIPE_TYPE.getKey(rec.getType())),
        serializer: String(SF_BI.RECIPE_SERIALIZER.getKey(rec.getSerializer()))
      };
      try {
        var enc = rec.getSerializer().codec().codec().encodeStart(ops, rec);
        var res = enc.result();
        if (res.isPresent()) entry.json = JSON.parse(res.get().toString());
        else failed.push(id);
      } catch (e) {
        entry.encode_error = String(e).slice(0, 200);
        failed.push(id);
      }
      try {
        var ingList = [];
        rec.getIngredients().forEach((ing) => {
          try {
            var ie = SF_Ingredient.CODEC.encodeStart(SF_JsonOps.INSTANCE, ing);
            var ir = ie.result();
            ingList.push(ir.isPresent() ? JSON.parse(ir.get().toString()) : String(ing));
          } catch (e2) { ingList.push(String(ing)); }
        });
        entry.ingredients = ingList;
      } catch (e) { entry.ingredients_error = String(e).slice(0, 120); }
      try {
        var ri = rec.getResultItem(ra);
        // getItemHolder().unwrapKey() reads the id without wrapping the Item
        // instance — keeps Rhino from introspecting client-annotated item
        // classes (SlingshotItem/JetSuitItem etc) on a dedicated server.
        if (ri && !ri.isEmpty()) {
          var hk = ri.getItemHolder().unwrapKey();
          if (hk.isPresent()) entry.result = String(hk.get().location()) + ' x' + ri.getCount();
        }
      } catch (e) { /* some recipe types have no static result */ }
      recipes.push(entry);
    });
    recipes.sort((a, b) => (a.id < b.id ? -1 : 1));
    JsonIO.write('kubejs/export/recipes.json', recipes);
    console.log(`[starforge-dump] exported registries; ${recipes.length} recipes, ${failed.length} encode failures`);
  } catch (e) {
    console.log('[starforge-dump] FAILED: ' + e + '\n' + (e.stack || ''));
  }
});
