# 简体中文本地化审计报告

生成：`node tools/audit-lang.mjs` · 2026-09-24 · MC 1.21.1 / neoforge

覆盖层级：JAR 自带 `zh_cn`（优先）→ `pack/kubejs/assets/<ns>/lang/zh_cn.json` 覆盖层
（`tools/gen-mod-lang-zh.mjs` 生成，含 vendor 的 CFPA/I18nUpdateMod 子集）。

## 汇总

| 指标 | 数量 |
| --- | --- |
| 启用 Mod（manifest） | 112 |
| 有语言文件的 Mod / 命名空间 | 82 / 84 |
| 无语言文件的 Mod | 30 |
| en_us 键总数 | 21484 |
| 缺失键总数 | 0 |
| zh 空值键 | 3 |
| zh 与 en 相同（可疑） | 105 |

- **完整**：84 个命名空间
- **存在硬编码英文**：30 个 Mod

## JAR 与 manifest 不一致

- mods/ 中存在但未锁定：`jei-1.21.1-neoforge-19.57.0.446.jar`
- mods/ 中存在但未锁定：`sophisticatedbackpacks-1.21.1-3.26.3.2158.jar`

## 各命名空间覆盖明细

| Mod | 命名空间 | 来源 | en 键 | 自带 zh | KubeJS 覆盖 | 缺失 | 空值 | 同英文 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ic2cre | ic2cre | assets | 1033 | 1035 | - | - | - | 2 | 完整 |
| buildcraft | buildcraft | assets | 1976 | 无 | 1976 | - | - | 4 | 完整 |
| immersiveengineering | immersiveengineering | assets | 1952 | 1935 | 18 | - | - | 13 | 完整 |
| immersivepetroleum | immersivepetroleum | assets | 234 | 230 | 4 | - | 2 | 4 | 完整 |
| storagedrawers | storagedrawers | assets | 148 | 148 | - | - | - | 14 | 完整 |
| sophisticatedstorage | sophisticatedstorage | assets | 420 | 420 | - | - | - | 1 | 完整 |
| sophisticatedbackpacks | sophisticatedbackpacks | assets | 406 | 406 | - | - | - | - | 完整 |
| fastpipes | fastpipes | assets | 153 | 153 | - | - | - | - | 完整 |
| ae2 | ae2 | assets | 1021 | 1017 | 4 | - | - | 1 | 完整 |
| railcraft | railcraft | assets | 1075 | 1075 | - | - | - | 3 | 完整 |
| ad_astra | ad_astra | assets | 831 | 823 | 19 | - | - | 11 | 完整 |
| ad_astra_giselle | ad_astra_giselle_addon | assets | 168 | 137 | 51 | - | - | 1 | 完整 |
| ad_astra_asteroid_belt | pv_asteroid_belt | assets | 6 | 无 | 6 | - | - | - | 完整 |
| the_hordes | hordes | assets | 22 | 21 | 30 | - | - | 4 | 完整 |
| the_hordes | hordes | config_defaults | 30 | 27 | 30 | - | - | - | 完整 |
| tacz_turrets | taczturrets | assets | 34 | 无 | 34 | - | - | - | 完整 |
| taczaddon | taczaddon | assets | 6 | 6 | - | - | - | 1 | 完整 |
| progressivestages | progressivestages | assets | 62 | 无 | 62 | - | - | - | 完整 |
| ftb_quests | ftbquests | assets | 772 | 651 | 127 | - | - | - | 完整 |
| farmersdelight | farmersdelight | assets | 479 | 479 | 2 | - | - | - | 完整 |
| cookingforblockheads | cookingforblockheads | assets | 260 | 262 | - | - | - | - | 完整 |
| almostunified | almostunified | assets | 6 | 6 | - | - | - | - | 完整 |
| appliedcooking | appliedcooking | assets | 28 | 28 | - | - | - | 2 | 完整 |
| applieddelight | applieddelight | assets | 24 | 24 | - | - | - | 2 | 完整 |
| starforge_compat | starforge_compat | assets | 37 | 37 | - | - | - | - | 完整 |
| framedblocks | framedblocks | assets | 436 | 108 | 330 | - | - | - | 完整 |
| supplementaries | supplementaries | assets | 1366 | 1364 | 2 | - | - | 3 | 完整 |
| mcw_furniture | mcwfurnitures | assets | 661 | 605 | 56 | - | - | - | 完整 |
| refurbished_furniture | refurbished_furniture | assets | 654 | 无 | 654 | - | - | - | 完整 |
| energized_furniture | energizedfurniture | assets | 12 | 无 | 12 | - | - | - | 完整 |
| engineers_delight | tmted | assets | 15 | 无 | 15 | - | - | - | 完整 |
| immersivecooking | immersivecooking | assets | 53 | 无 | 53 | - | - | - | 完整 |
| vinery | vinery | assets | 352 | 267 | 187 | - | - | - | 完整 |
| buildinggadgets | buildinggadgets2 | assets | 112 | 112 | - | - | - | - | 完整 |
| endermanoverhaul | endermanoverhaul | assets | 135 | 131 | 5 | - | - | - | 完整 |
| mutantmonsters | mutantmonsters | assets | 102 | 112 | 2 | - | - | - | 完整 |
| creature_feature | creaturefeature | assets | 172 | 无 | 172 | - | - | 2 | 完整 |
| arachnids | arachnids | assets | 27 | 无 | 27 | - | - | - | 完整 |
| easy_villagers | easy_villagers | assets | 32 | 32 | - | - | - | - | 完整 |
| guard_villagers | guardvillagers | assets | 74 | 57 | 17 | - | - | 24 | 完整 |
| tacz | tacz | assets | 295 | 295 | 3 | - | - | 2 | 完整 |
| guard_villagers_tacz | guardvillagerstaczsupport | assets | 48 | 无 | 48 | - | - | - | 完整 |
| artifacts | artifacts | assets | 448 | 422 | 26 | - | - | 1 | 完整 |
| jei | jei | assets | 539 | 270 | 283 | - | - | 1 | 完整 |
| guideme | guideme | assets | 36 | 无 | 36 | - | - | - | 完整 |
| mezzconfig | mezz_config | assets | 18 | 无 | 18 | - | - | - | 完整 |
| polymorph | polymorph | assets | 3 | 3 | - | - | - | - | 完整 |
| controlling | controlling | assets | 12 | 12 | - | - | - | - | 完整 |
| craftingtweaks | craftingtweaks | assets | 40 | 23 | 18 | - | - | - | 完整 |
| appleskin | appleskin | assets | 22 | 22 | - | - | - | - | 完整 |
| jade | jade | assets | 410 | 410 | - | - | 1 | 3 | 完整 |
| jade_addons | jadeaddons | assets | 38 | 无 | 38 | - | - | - | 完整 |
| emi | emi | assets | 747 | 841 | 6 | - | - | - | 完整 |
| inventoryprofilesnext | inventoryprofilesnext | assets | 557 | 517 | 41 | - | - | 1 | 完整 |
| xaeros_minimap | xaerobetterpvp | assets | 78 | 77 | 1 | - | - | - | 完整 |
| xaeros_minimap | xaerominimap | assets | 646 | 518 | 128 | - | - | - | 完整 |
| xaeros_world_map | xaeroworldmap | assets | 322 | 无 | 322 | - | - | - | 完整 |
| shulkerboxtooltip | shulkerboxtooltip | assets | 93 | 91 | 3 | - | - | - | 完整 |
| betterf3 | betterf3 | assets | 231 | 231 | - | - | - | 1 | 完整 |
| chatheads | chat_heads | assets | 30 | 27 | 3 | - | - | - | 完整 |
| skinlayers3d | skinlayers3d | assets | 44 | 44 | - | - | - | - | 完整 |
| defaultoptions | defaultoptions | assets | 6 | 无 | 6 | - | - | - | 完整 |
| modernfix | modernfix | assets | 155 | 134 | 22 | - | - | - | 完整 |
| iris | iris | assets | 73 | 67 | 6 | - | - | - | 完整 |
| entityculling | entityculling | assets | 27 | 27 | - | - | - | - | 完整 |
| dynamicfps | dynamic_fps | assets | 85 | 71 | 14 | - | - | - | 完整 |
| structure_layout_optimizer | structure_layout_optimizer | assets | 6 | 无 | 6 | - | - | 1 | 完整 |
| betteradvancedtooltips | betteradvancedtooltips | assets | 5 | 无 | 5 | - | - | - | 完整 |
| ftb_library | ftblibrary | assets | 113 | 113 | - | - | - | - | 完整 |
| ftb_teams | ftbteams | assets | 112 | 无 | 112 | - | - | - | 完整 |
| ftb_xmod_compat | ftbxmodcompat | assets | 0 | 无 | - | - | - | - | 完整 |
| sophisticatedcore | sophisticatedcore | assets | 318 | 318 | - | - | - | - | 完整 |
| balm | balm | assets | 36 | 无 | 36 | - | - | - | 完整 |
| searchables | searchables | assets | 1 | 1 | - | - | - | - | 完整 |
| moonlight | moonlight | assets | 265 | 1690 | 253 | - | - | 1 | 完整 |
| resourcefulconfig | resourcefulconfig | assets | 28 | 无 | 28 | - | - | - | 完整 |
| atlaslib | atlaslib | assets | 0 | 无 | - | - | - | - | 完整 |
| commonstoragelib | common_storage_lib | assets | 3 | 无 | 3 | - | - | 1 | 完整 |
| placebo | placebo | assets | 6 | 6 | - | - | - | - | 完整 |
| blueprint | blueprint | assets | 19 | 无 | 19 | - | - | - | 完整 |
| azurelib | azurelib | assets | 52 | 52 | - | - | - | - | 完整 |
| libipn | libipn | assets | 34 | 34 | - | - | - | - | 完整 |
| clothconfig | cloth-config2 | assets | 49 | 48 | 1 | - | - | 1 | 完整 |
| curios | curios | assets | 48 | 41 | 7 | - | - | - | 完整 |

### zh 空值（en 非空但 zh 为空串）

- **immersivepetroleum / immersivepetroleum**：`ie.manual.entry.reservoirs.consonant`, `ie.manual.entry.reservoirs.vowel`
- **jade / jade**：`gui.jade.configuration.desc2`

### zh 与 en 完全相同（疑似未翻译；已排除 ID/占位符/纯大写）

- **ic2cre / ic2cre**：2 键
  - `ic2cre.gui.distribution.up`
  - `ic2cre.gui.distribution.down`
- **buildcraft / buildcraft**：4 键
  - `buildcraft.jade.group.mj`
  - `buildcraft.jade.group.fe`
  - `item.buildcraftsilicon.facade.named`
  - `buildcraft.guide.contents.community_edition`
- **immersiveengineering / immersiveengineering**：13 键
  - `advancement.immersiveengineering.craft_pump`
  - `desc.immersiveengineering.flavour.revolver.einhorn`
  - `item.immersiveengineering.revolver.einhorn`
  - `item.immersiveengineering.shader.name.angelsthesis`
  - `item.immersiveengineering.shader.name.bipride`
  - `item.immersiveengineering.shader.name.crimsonlotus`
  - `item.immersiveengineering.shader.name.darkfire`
  - `item.immersiveengineering.shader.name.dragonsbreath`
  - …另 5 键
- **immersivepetroleum / immersivepetroleum**：4 键
  - `item.immersivepetroleum.shader.name.blue`
  - `item.immersivepetroleum.shader.name.orange`
  - `item.immersivepetroleum.shader.name.cube0`
  - `item.immersivepetroleum.shader.name.cube1`
- **storagedrawers / storagedrawers**：14 键
  - `item.storagedrawers.hopper_upgrade`
  - `item.storagedrawers.hopper_upgrade.desc`
  - `item.storagedrawers.magnet_upgrade`
  - `item.storagedrawers.magnet_upgrade.desc`
  - `item.storagedrawers.magnet_upgrade.range`
  - `item.storagedrawers.magnet_upgrade.speed`
  - `item.storagedrawers.magnet_upgrade_2`
  - `item.storagedrawers.magnet_upgrade_3`
  - …另 6 键
- **sophisticatedstorage / sophisticatedstorage**：1 键
  - `gui.sophisticatedstorage.upgrades.buttons.io_mode_side_info`
- **ae2 / ae2**：1 键
  - `gui.ae2.CompatibleUpgrade`
- **railcraft / railcraft**：3 键
  - `fml.menu.mods.info.displayname.railcraft`
  - `itemGroup.railcraft`
  - `key.railcraft.category`
- **ad_astra / ad_astra**：11 键
  - `painting.ad_astra.alpha_centauri.title`
  - `painting.ad_astra.the_milky_way.title`
  - `text.ad_astra.gravity`
  - `text.ad_astra.oxygen_false`
  - `text.ad_astra.oxygen_true`
  - `text.ad_astra.temperature`
  - `tooltip.ad_astra.energy`
  - `tooltip.ad_astra.energy_per_tick`
  - …另 3 键
- **ad_astra_giselle / ad_astra_giselle_addon**：1 键
  - `gui.ad_astra_giselle_addon.gravity_normalizer.energy_using`
- **the_hordes / hordes**：4 键
  - `commands.hordes.StopHorde.usage`
  - `commands.hordes.HordeDebug.usage`
  - `commands.hordes.HordeReset.usage`
  - `commands.hordes.ListEntities.usage`
- **taczaddon / taczaddon**：1 键
  - `key.categories.taczaddon`
- **appliedcooking / appliedcooking**：2 键
  - `itemGroup.appliedcooking`
  - `category.appliedcooking.name`
- **applieddelight / applieddelight**：2 键
  - `itemGroup.applieddelight`
  - `category.applieddelight.main.name`
- **supplementaries / supplementaries**：3 键
  - `jukebox_song.supplementaries.heave_ho`
  - `jukebox_song.supplementaries.pancake`
  - `message.supplementaries.quiver.tooltip`
- **creature_feature / creaturefeature**：2 键
  - `creaturefeature.configuration.ff_reloaded`
  - `jukebox_song.creaturefeature.nothing`
- **guard_villagers / guardvillagers**：24 键
  - `guardvillagers.advancements.adventure.recruit_guard.description`
  - `guardvillagers.advancements.adventure.recruit_guard.title`
  - `guardvillagers.configuration.raids and illagers`
  - `guardvillagers.config.range`
  - `guardvillagers.config.RaidAnimals`
  - `guardvillagers.config.IllagersRunFromPolarBears`
  - `guardvillagers.config.armorvillager`
  - `guardvillagers.config.hotvPatrolPoint`
  - …另 16 键
- **tacz / tacz**：2 键
  - `commands.tacz.reload.backup`
  - `message.tacz.pre`
- **artifacts / artifacts**：1 键
  - `artifacts.tooltip.plus_mob_effect_chance`
- **jei / jei**：1 键
  - `_comment`
- **jade / jade**：3 键
  - `config.jade.overlay_pos_extra_msg`
  - `jade.infinity`
  - `jade.distance1`
- **inventoryprofilesnext / inventoryprofilesnext**：1 键
  - `inventoryprofiles.tooltip.fast_rename`
- **betterf3 / betterf3**：1 键
  - `text.betterf3.line.fps_tps`
- **structure_layout_optimizer / structure_layout_optimizer**：1 键
  - `config.structure_layout_optimizer.title`
- **moonlight / moonlight**：1 键
  - `moonlight.configuration.test_category.test_schema_map.description`
- **commonstoragelib / common_storage_lib**：1 键
  - `misc.common_storage_lib.energy`
- **clothconfig / cloth-config2**：1 键
  - `text.cloth-config.testing.2`

## 语言文件之外的检查

- ✅ FTB Quests snbt：en/zh 键完全一致（547 键）
- ✅ FTB Quests 章节文件：未发现英文硬编码文本（文本经 lang snbt 本地化）
- ✅ progressivestages.toml：全部消息均为 <ps:*> 标记或双语字面量
- ✅ stage_i18n.json：覆盖全部 stage.toml 双语字面量
- ✅ KubeJS 脚本：未发现硬编码英文（经 Text.translate / translate 组件本地化）
- ✅ starforge_compat：zh_cn 完整（37 键）
- ✅ EOS 枪包（eos_gun_pack_1.1.1-hotfix1.zip）：zh_cn 完整（147 键，JSONC）
- ✅ pack/config：未发现疑似英文的玩家可见文本

## 存在硬编码英文（无语言文件机制）

以下 Mod 不含 `assets/<ns>/lang/`，其玩家可见文本由代码直接输出，
语言文件无法覆盖，需 Mod 更新或 compat 层处理：

- **ad_astra_more_structures**（ad_astra_more_structures-1.21.1-neoforge.jar）
- **simple_structures_ad_astra**（Simple Structures Ad Astra 1.21.1 1.3.jar）
- **zombies_break_and_build**（ZombiesBreak&Build-neoforge-1.21.1-1.7.0.jar）
- **tacz_pack_upgrader**（tacz-pack-upgrader-2.1.3.jar）
- **incontrol**（incontrol-1.21-10.3.0.jar）
- **kubejs**（kubejs-neoforge-2101.7.2-build.377.jar）
- **framework**（framework-neoforge-1.21.1-0.13.11.jar）
- **mousetweaks**（MouseTweaks-neoforge-mc1.21-2.26.1.jar）
- **betterpingdisplay**（BetterPingDisplay-1.21.1-1.1.jar）
- **customskinloader**（CustomSkinLoader_Universal-15.0.1.jar）
- **i18nupdatemod**（I18nUpdateMod-3.7.0-all.jar）
- **ferritecore**（ferritecore-7.0.3-neoforge.jar）
- **servercore**（servercore-neoforge-1.5.19+1.21.1.jar）
- **fastsuite**（FastSuite-1.21.1-6.0.7.jar）
- **letmedespawn**（letmedespawn-1.21.x-neoforge-1.5.0.jar）
- **clumps**（Clumps-neoforge-1.21.1-19.0.0.1.jar）
- **sodium**（sodium-neoforge-0.8.13+mc1.21.1.jar）
- **immediatelyfast**（ImmediatelyFast-NeoForge-1.6.14+1.21.1.jar）
- **fastnoise**（zfastnoise-1.0.13+1.21.1+neoforge.jar）
- **alltheleaks**（alltheleaks-1.1.13+1.21.1-neoforge.jar）
- **memleakfixgpu**（gpumemleakfix-neoforge-1.21.1-1.0.0.jar）
- **spark**（spark-1.10.124-neoforge.jar）
- **chunky**（Chunky-NeoForge-1.4.23.jar）
- **rhino**（rhino-2101.2.7-build.85.jar）
- **architectury**（architectury-13.0.11-neoforge.jar）
- **resourcefullib**（resourcefullib-neoforge-1.21-3.0.12.jar）
- **geckolib**（geckolib-neoforge-1.21.1-4.9.3.jar）
- **puzzleslib**（PuzzlesLib-v21.1.60-mc1.21.1-NeoForge.jar）
- **almanac**（Almanac-1.21.1-2-neoforge-1.5.2.jar）
- **kotlinforforge**（kotlinforforge-5.12.0-all.jar）

已知字符串（ZombiesBreak&Build，经 `tools/dump-class-strings.ps1` 提取）：
`Unknown config path:`、`Failed to save config`、`Failed to load config`、
`Reloaded config`、`Invalid resource location`、`Not a collection config value` 等。
这些仅在 `/zbb` 管理命令反馈中出现，普通玩家不可见。

## 状态判定标准

- **完整**：无缺失键
- **少量缺失**：缺失 ≤5 键 或 ≤5%
- **部分汉化**：缺失 ≤50%
- **严重缺失**：缺失 >50%
- **未汉化**：无自带 zh_cn 且无 KubeJS 覆盖
- **存在硬编码英文**：无语言文件机制，文本硬编码于代码中
