# 实施状态

本文件记录 Starforge 从设计仓库到可运行整合包的真实进度。规则：只记录已验证事实；失败与降级写明证据。

## 环境基线（已实测）

- Minecraft 1.21.1 / NeoForge **21.1.251** / Temurin **JDK 21.0.12**。
- 仓库所在机：Windows。`run/server` 为开发用 dedicated server；`run/client` 预留。
- Dedicated server **不**需要账号即可启动与自动化验证；客户端完整启动需要本地 Minecraft 账号与显示环境（见「未解决」）。

## 已完成

- [P0] NeoForge 21.1.251 dedicated server 裸启动通过（Done ~9.8s）。
- [P0] 71 个模组文件锁定：`manifest/locked-mods.json`（mod id、版本、文件名、大小、SHA-256/SHA-512、下载 URL、来源、许可证、依赖）。模组 JAR 不入库，`tools/fetch-mods.mjs` 可重现下载。
- [P0] `tools/audit-deps.mjs`：直接解析每个 JAR 内 `META-INF/neoforge.mods.toml`/`mods.toml`，验证必需依赖闭包（首次运行即捕获 `guideme`、`common_storage_lib`、`mezz_config` 缺失，已补齐）。
- [P0] 完整 65-mod 服务端组合启动通过：NeoForge 加载 73.9s，世界生成 + Done 正常，无模组级 ERROR（除下述 incontrol 警告）。
- [P0] KubeJS 注册表/配方导出器 `pack/kubejs/server_scripts/starforge_dump.js`：输出 item/block/fluid/entity_type/recipe_type/recipe_serializer/mob_effect、item/block/fluid/entity 标签全集、levels/dimensions/dimension_types，以及 6595 条配方（6420 条含完整 JSON 与 ingredient 明细，175 条为不可编码类型）。导出物在 `registry-export/`。

## 已确认的关键真实 ID（示例，完整见 registry-export/）

- IC2CRE 命名空间为 `ic2cre:`：`ic2cre:generator`、`ic2cre:circuit`、`ic2cre:advanced_circuit`、`ic2cre:alloy`、`ic2cre:iridium`/`iridium_shard`、`ic2cre:matter_generator`、`ic2cre:uu_matter_cell`、`ic2cre:nuclear_reactor` 等。
- IE：`immersiveengineering:component_iron|component_steel|component_electronic|component_electronic_adv`、`plate_*`、`wirecoil_*`、`heavy_engineering` 等。
- AE2：`ae2:inscriber`、`ae2:*_processor_press`、`ae2:*_processor`、`ae2:controller`、`ae2:pattern_provider`、`ae2:quantum_entangled_singularity` 等。
- BC CE：`buildcraftcore:gears/gear_iron`、`buildcraftbuilders:quarry`、`buildcraftfactory:pump|mining_well`、`buildcraftenergy:engine_*`、`buildcrafttransport:*`、`buildcraftsilicon:assembly_table|laser`。
- Defense Turrets：`defenseturrets:machine_gun_turret|grenade_turret|laser_turret|turret_base|turret_barrel|forged_alloy_ingot|uv_searchlight`。
- TaCZ：通用物品型（`tacz:modern_kinetic_gun`、`tacz:ammo`、`tacz:attachment`、`tacz:gun_smith_table`）；具体枪/弹在 `tacz_default_gun` 数据包内定义。
- Ad Astra 维度：`ad_astra:moon|mars|venus|mercury|glacio` 及各自 `_orbit`，含 `ad_astra:earth_orbit`（空间站候选维度集合）。

## 正在实现

- P1 阶段推进链路已实测通过（见下「阶段推进实测」）；锁 enforcement 待真实玩家进世界验证。
- P2 防御原型（TaCZ 弹药经济、In Control、Hordes、ZBB 配置）。

## P1 已实现并验证（服务端）

- `design/semantic-map.json` + `tools/check-mapping.mjs`：264 条语义→真实 ID 映射全部解析成功（含 `modpack:` 本地物品白名单校验）；首轮即捕获 8 条猜测错误 ID（如 `buildcrafttransport:pipe_item_wood` 实为 `buildcrafttransport:wood_item`）。
- `tools/build-pack.mjs`：从 `design/content.json`/`semantic-map.json`/`stage-locks.json`/`localization/*.json` 生成 KubeJS 物品注册、语义映射脚本、双语 lang、物品模型与占位贴图、ProgressiveStages 全局配置与 8 个 stage 定义。`localization/` 仍是唯一文案源。
- `design/stage-locks.json` + 生成器：每阶段 `stage.toml/progression.toml/rules.toml`。`/progressivestages validate` 8/8 通过；`/stage tree` 显示 T0→T5 链与 T6/T7 分叉（T7 不依赖 T6）。
- 阶段授予 = 双通道触发（schema-4 `[[triggers]] mode=any_of`）：原生 `craft` 条件 + KubeJS `starforge_triggers.js` 在 `ItemEvents.crafted` 上累加 `custom_counter`。凭证物品：T1 `modpack:engineering_assembly`、T2 `ic2cre:generator`、T3 `information_interface`、T4 `heavy_industry_control`、T5 `reactor_control`、T6 `space_control_core`、T7 `quantum_control`；T0 为 `starting_stages` 自动授予。FTB Teams 团队共享（`team_mode=ftb_teams`）。

### 阶段推进实测（dedicated server，`kubejs/stagetest.json` 开启时自动跑）

- `starforge_stage_test.js` 用 FakePlayer 验证：8/8 阶段注册 → 授予 `survival_age` → 依次推进 mechanical→electric→information→heavy_industry→atomic→space+quantum，**全部 OK**（`kubejs/export/stagetest.json` 记录）。
- 服务端日志确认 `Per-stage triggers active for 7 stage(s), 7 rule(s) total`，7 个 trigger 全部触发授阶。
- 关键技术修正：PS schema-4 的触发语法是 `[[triggers]]` + `[[triggers.conditions]]`（`type`/`item`/`counter`/`count`），不是早期猜测的 `[[grants]] condition={...}`（该写法被静默忽略导致授阶全 FAIL）；`custom_counter` 的字段名是 `counter`（兼容 `key`/`id`/`target`）。
- 锁实现：`[recipes].locked_items` 封制造 + `action=use/place` 锁使用/放置 + `action=enter` 锁维度（space_age 锁全部 Ad Astra 维度与轨道）。示例计数：electric_age 28 锁、space_age 35 锁。
- KubeJS 配方层 `starforge_recipes.js`：SF-01..SF-30 中除 TaCZ（SF-31..33，走枪包数据）外全部落地。实测导出 6606 配方：46 条 `kubejs:`/`minecraft:kjs/` 新配方生效，32 条被替换的原配方全部移除（含 `ic2cre:generator`/`generator_from_furnace` 双路径）。流体原料配方（IE capacitor 三级）用 `e.custom` 原样保留 `immersiveengineering:fluid_stack` 成分。
- 石油经济：原生 tag 已部分统一（`ad_astra:oil` 含 BC oil + IP crudeoil；`ad_astra:tier_*_rocket_fuel` 含 IP diesel + IE biodiesel）。缺口：`c:oil` 不含 `immersivepetroleum:crudeoil`，待 datapack 桥接补齐。
- 铱的地球路径确认：`ic2cre:iridium` 由 `iridium_shard→iridium_ore→iridium` 链产出（无铱矿 worldgen），UU/scanner 链为地球路线基础。

## 待验证

- 锁 enforcement（配方封锁/使用锁/维度锁）需要真实玩家进世界验证；FakePlayer 已验证授阶链路，真实客户端合成事件路径相同。
- stage display_name 目前为生成器输出的双语字面量（PS 是否支持 translatable key 未验证；若支持再切回 key）。
- 服务端仍有 `HumanoidModel`/`PoseStack` wrong-dist 加载报错（疑为 Moonlight/Supplementaries 在服务端触碰渲染类，启动不阻断）；需定位并隔离。

## 实测失败 / 技术降级记录

- `incontrol` 首次启动写默认 `areas.json` 报错一次（`Error writing areas.json!`）；其余规则文件正常生成。影响：无（areas.json 为可选规则文件，发行版由我们提供显式配置）。
- KubeJS 2101.7.2-build.377 服务端脚本注意点：无 `ServerEvents.started`（用 `ServerEvents.loaded`）；Rhino 下 `String` 不能直接当 Java `Function` 用；局部变量名避免与 KubeJS 全局冲突（`dims`/`recipes` 等会报 redeclaration）；`Registry.get(tagKey)` 重载会被 KubeJS ID 解析拦截，改用 `getTag(TagKey)`；`RecipeSerializer.codec()` 返回 MapCodec，需再 `.codec()` 得到 Codec 才能 `encodeStart`。
- 配方 JSON 编码失败 175/6595（如 `Field[...]`/`RecordCodec` 自定义序列化器），均有 id/type/serializer/result 兜底；需要精确编辑这些配方时按原数据包 JSON 重写。
- `atlaslib` 的更新检查 URL 返回畸形 JSON（三方检查器噪音，非整合包问题）。
- IC2CRE Dev-0.4 仅取主 JAR；Advanced Solar Panels / Gravitation Suite / Iridium Source 子附属未纳入首轮（设计文档未要求）。
- Easy Villagers（ARR）与 ProgressiveStages（ARR）等仅通过 manifest URL 分发，不提交 JAR。

## 尚未实现（按批次）

- P1：SF 配方、阶段锁、石油经济互通、AE2 冷启动链路验证。
- P2–P6：防御、怪潮、殖民、航天、任务、发行打包、性能实测。
- 客户端启动：需要本地正版账号与图形环境；当前无法在本环境完成客户端实机验证（服务端可完整验证逻辑内容）。

## 性能结果

- 空服务器 65 mods：启动 73.9s（含首次世界生成），Done 后空载正常。MSPT/实体/区块实测待游戏内场景。
