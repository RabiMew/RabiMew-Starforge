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
- 模组集变更（锁定侧已生效，运行时未复测）：移除 Phenominae 1.3.3（CurseForge 源，分发条款不明）；新增 Creature Feature 1.2.3.3 + Arachnids 0.3.0（均 Modrinth/MIT）及其依赖 Blueprint 8.2.0、AzureLib 3.1.11。当前 76 个启用模组（both 65 / client 8 / server 3）。上述 65/71-mod 服务端实测记录基于旧模组集；新集合（含 Blueprint/AzureLib 与 In Control/KubeJS 生成规则）尚未做运行时验证。
- 2026-09-22 扩展（已运行时验证）：新增 **Railcraft Reborn 1.2.10**、**Ad-Astra: Giselle Addon 8.1**、**Ad Astra: Asteroid Belt 1.0**（CurseForge，JAR 内 MIT）、**Simple Structures: Ad Astra 1.3**；当前 80 个启用模组。服务器 Java 21 启动 `Done (1.8s)`，四模组全部加载，KubeJS 启动/服务端脚本 0 错 0 警告，stagetest 8/8 阶段链路全 OK（含新增锁规则）。

## 已确认的关键真实 ID（示例，完整见 registry-export/）

- IC2CRE 命名空间为 `ic2cre:`：`ic2cre:generator`、`ic2cre:circuit`、`ic2cre:advanced_circuit`、`ic2cre:alloy`、`ic2cre:iridium`/`iridium_shard`、`ic2cre:matter_generator`、`ic2cre:uu_matter_cell`、`ic2cre:nuclear_reactor` 等。
- IE：`immersiveengineering:component_iron|component_steel|component_electronic|component_electronic_adv`、`plate_*`、`wirecoil_*`、`heavy_engineering` 等。
- AE2：`ae2:inscriber`、`ae2:*_processor_press`、`ae2:*_processor`、`ae2:controller`、`ae2:pattern_provider`、`ae2:quantum_entangled_singularity` 等。
- BC CE：`buildcraftcore:gears/gear_iron`、`buildcraftbuilders:quarry`、`buildcraftfactory:pump|mining_well`、`buildcraftenergy:engine_*`、`buildcrafttransport:*`、`buildcraftsilicon:assembly_table|laser`。
- 炮塔体系：`immersiveengineering:turret_gun|turret_chem`（IE 原生，T2）+ `taczturrets:turret`（物品与实体同 id，T4）。Defense Turrets 已整体移除。
- TaCZ：通用物品型（`tacz:modern_kinetic_gun`、`tacz:ammo`、`tacz:attachment`、`tacz:gun_smith_table`）；具体枪/弹在 `tacz_default_gun` 与 `eos`（EOS – Dawn Goddess Lab）枪包内定义（`GunId`/`AmmoId` 存于 `minecraft:custom_data`）。
- Ad Astra 维度：`ad_astra:moon|mars|venus|mercury|glacio` 及各自 `_orbit`，含 `ad_astra:earth_orbit`（空间站候选维度集合）。
- Asteroid Belt（modid `pv_ad_asterobelt`，维度命名空间独立为 `pv_asteroid_belt`）：`pv_asteroid_belt:asteroid_belt`（planet tier 2、0.5g、无氧、-50℃、自然刷怪关）与 `pv_asteroid_belt:asteroid_belt_orbit`（0g、-170℃）；`neoforge tps` 运行时两维度均注册在列。
- Railcraft：基础轨 `railcraft:strap_iron_track`（**不存在** `railcraft:iron_track`）；轨道族 `electric_track`/`reinforced_track`/`high_speed_track`/`high_speed_electric_track`/`elevator_track`；实体 `cargo_minecart`/`tank_minecart`/`steam_locomotive`/`electric_locomotive`/`world_spike_minecart`（已在小行星带维度实测生成并在 tick）；标签 `c:ingots|plates|gears|nuggets|storage_blocks/steel`、`c:coal_coke`、`c:dusts/saltpeter`、`c:fluids/steam`→`railcraft:steam`；数据图类型 `railcraft:fluid_heat`（fluid 注册表）与 `railcraft:tunnel_bore_head`（item 注册表）。
- Giselle：`ad_astra_giselle_addon:fuel_loader|rocket_sensor|gravity_normalizer|automation_nasa_workbench|oxygen_can|netherite_oxygen_can` 均已在注册表导出确认。
- Simple Structures: Ad Astra（modid `pv_ad_astra_structures`）：8 个结构集（spacing 27–38 / separation 18–29），命名空间与 `ad_astra_more_structures` 不重叠；Boss 战利品表含 desh/ostrum/calorite 等行星材料。

## 正在实现

- P1 阶段推进链路已实测通过（见下「阶段推进实测」）；锁 enforcement 待真实玩家进世界验证。
- P2 防御原型：配置层已落地并加载验证（见下「P2 已实现」）；炮塔弹药消耗已由 TACZ Turrets 原生解决（见降级记录）；怪潮阶段化仍需 compat 模组。

## P1 已实现并验证（服务端）

- `design/semantic-map.json` + `tools/check-mapping.mjs`：388 条语义→真实 ID 映射全部解析成功（含 `modpack:` 本地物品白名单校验）；首轮即捕获 8 条猜测错误 ID（如 `buildcrafttransport:pipe_item_wood` 实为 `buildcrafttransport:wood_item`），本轮再捕获 `railcraft:iron_track` 臆造 ID（实际为 `railcraft:strap_iron_track`）。
- `tools/build-pack.mjs`：从 `design/content.json`/`semantic-map.json`/`stage-locks.json`/`localization/*.json` 生成 KubeJS 物品注册、语义映射脚本、双语 lang、物品模型与占位贴图、ProgressiveStages 全局配置与 8 个 stage 定义。`localization/` 仍是唯一文案源。
- `tools/gen-mod-lang-zh.mjs`：补齐模组自带 `zh_cn` 缺失键（framedblocks 330、refurbished_furniture 654、mcwfurnitures 56、energizedfurniture 12、immersivecooking 53、tmted 15），产物为 `pack/kubejs/assets/<mod>/lang/zh_cn.json`（KubeJS 按键覆盖，不影响 jar 内已有译文）。模组升版后重跑即可。
- `design/stage-locks.json` + 生成器：每阶段 `stage.toml/progression.toml/rules.toml`。`/progressivestages validate` 8/8 通过；`/stage tree` 显示 T0→T5 链与 T6/T7 分叉（T7 不依赖 T6）。
- 阶段授予 = 双通道触发（schema-4 `[[triggers]] mode=any_of`）：原生 `craft` 条件 + KubeJS `starforge_triggers.js` 在 `ItemEvents.crafted` 上累加 `custom_counter`。凭证物品：T1 `modpack:engineering_assembly`、T2 `ic2cre:generator`、T3 `information_interface`、T4 `heavy_industry_control`、T5 `reactor_control`、T6 `space_control_core`、T7 `quantum_control`；T0 为 `starting_stages` 自动授予。FTB Teams 团队共享（`team_mode=ftb_teams`）。

### 阶段推进实测（dedicated server，`kubejs/stagetest.json` 开启时自动跑）

- `starforge_stage_test.js` 用 FakePlayer 验证：8/8 阶段注册 → 授予 `survival_age` → 依次推进 mechanical→electric→information→heavy_industry→atomic→space+quantum，**全部 OK**（`kubejs/export/stagetest.json` 记录）。
- 服务端日志确认 `Per-stage triggers active for 7 stage(s), 7 rule(s) total`，7 个 trigger 全部触发授阶。
- 关键技术修正：PS schema-4 的触发语法是 `[[triggers]]` + `[[triggers.conditions]]`（`type`/`item`/`counter`/`count`），不是早期猜测的 `[[grants]] condition={...}`（该写法被静默忽略导致授阶全 FAIL）；`custom_counter` 的字段名是 `counter`（兼容 `key`/`id`/`target`）。
- 锁实现：`[recipes].locked_items` 封制造 + `action=use/place` 锁使用/放置 + `action=enter` 锁维度（space_age 锁全部 Ad Astra 维度与轨道）。示例计数：electric_age 28 锁、space_age 35 锁。
- KubeJS 配方层 `starforge_recipes.js`：SF-01..SF-30 中除 TaCZ（SF-31..33，走枪包数据）外全部落地。实测导出 6606 配方：46 条 `kubejs:`/`minecraft:kjs/` 新配方生效，32 条被替换的原配方全部移除（含 `ic2cre:generator`/`generator_from_furnace` 双路径）。流体原料配方（IE capacitor 三级）用 `e.custom` 原样保留 `immersiveengineering:fluid_stack` 成分。
- 石油经济已统一（实测 tag 导出）：`starforge_fluids.js` 在 `ServerEvents.tags('fluid')` 桥接两层——原油层 `c:oil`/`c:crude_oil`/`ic2cre:fluid_heat/oil` 现含全部 8 种原油等价物（BC oil/dense/heavy + flowing、ad_astra:oil、IP crudeoil）；燃料层 `c:fuel`/`ic2cre:fluid_heat/fuel` 现含 22 种精炼燃料（IP diesel/diesel_sulfur/gasoline、IE biodiesel/high_power_biodiesel、BC 五种燃料 + flowing、ad_astra fuel/cryo_fuel）。原生 `ad_astra:oil` 与 `ad_astra:tier_*_rocket_fuel` 本已互通，桥接补齐了剩余缺口。本轮再加第三层——杂酚油 `c:creosote`/`ic2cre:semifluid_generator/creosote` 统一 railcraft+IE+ic2cre 共 6 种流体形态。

### 2026-09-22 扩展集成（已验证）

- **Railcraft 分层**（`design/stage-locks.json`，PS 规则生成实测加载）：T1 蒸汽核心（strap_iron_track、装卸机、焦炉/高炉砖、低压锅炉、蒸汽机车、货运/罐车、基础信号件）；T2 电气化（电力轨/机车、动力辊压机、破碎机、流体燃烧室+高压锅炉+蒸汽涡轮、charge 网络与电池、全套信号盒）；T4 重型（加固/高速轨、隧道掘进机四种钻头、高级装卸机、WorldSpike 全家——唯一的强加载入口）。`railcraft-server.toml` 实测**无区块加载开关**，故以阶段锁而非配置控制 WorldSpike。
- **Railcraft×统一流体经济**：`pack/kubejs/data/railcraft/data_maps/fluid/fluid_heat.json`（RC 自带同路径文件的合法覆盖，保留 `#c:creosote`=4800 并接入 `#c:oil`=16000、`#c:crude_oil`=16000、`#c:fuel`=64000——BC/IP/Ad Astra 燃料可烧流体锅炉）。
- **杂酚油互认**：`wooden_tie` 原配方硬编码 `railcraft:creosote_bucket`；新增 `c:buckets/creosote` 物品标签（railcraft/IE/ic2cre 三种桶）并经 KubeJS 重写配方接收该标签（导出确认 `kubejs:kjs/railcraft_wooden_tie` 生效）。
- **Asteroid Belt**：维度锁并入 `space_age`；`incontrol/spawn.json` 拒绝两 belt 维度的自然敌对生成；Chunky 实测 500 格半径预生成 4225 区块/32 秒，`neoforge tps` 全维度 20.000。矿物为原版系矿石 + Ad Astra 铁构件（NBT palette 实测）；误降/丢火箭机制保留。
- **战利品护栏**：`pv` 命名空间 `glacio_loot_simple`/`mercury_loot_simple` 经 `kubejs/data` 覆盖，直刷 `ad_astra:space_suit` 被移除（不白送航天服）；其余普通材料与行星素材保留。Simple Structures 与 More Structures 结构集/命名空间不重叠，共存保留。
- **Giselle**：全部功能性方块纳入 `space_age` 阶段锁（燃料装载机/火箭传感器/重力稳定器/自动 NASA 台/氧气罐/下界合金氧气罐），不绕过氧气、燃料与火箭等级。可选联动（Mekanism/PNC/AE2/TIF）未装，对应 mixin 安静跳过。
- **工具链修正**：`check-closure.mjs` 学会解析机器配方的 `outputs[]`/`results[]`（此前 84 条 `railcraft:crushing` 全部误判孤儿），新增地球流体容器白名单（杂酚油桶=焦炉地球产出）与 RC 地表矿白名单（jar biome_modifier 核实 `#minecraft:is_overworld`；`firestone` 为下界专属未列入）。
- 铱的地球路径确认：`ic2cre:iridium` 由 `iridium_shard→iridium_ore→iridium` 链产出（铱矿无 overworld worldgen，IC2CRE biome_modifier 仅加锡/铅/铀+橡胶树，已核实 jar 内 `neoforge/biome_modifier/`），UU/scanner 链为地球路线基础。
- **地球闭环实测**（`tools/check-closure.mjs`，基于 6605 条真实配方导出递归展开）：`ad_astra:tier_1_rocket` **0 项太空独占材料**——首航完全由地球工业完成（钢件+IC2 电机+IE 钢构件+气罐，全部地球可产）；`ad_astra:tier_2_rocket` 需月球 desh（符合递进设计，非违规）。T1–T7 全部阶段凭证物品、纳米甲/量子甲、AE2 controller 均 0 太空依赖、0 死槽——**T7 地球量子路线不碰太空已验证到配方图层面**。tag 配料按「任一成员地球可得即通过」处理；IC2/IE 地表矿与橡胶树经 worldgen 白名单豁免（jar 内 biome_modifier 已核实指向 `#minecraft:is_overworld`）。

### P2 已实现并验证（服务端配置层）

- **The Hordes**：感染机制全关（`enableMobInfection=false`/`infectPlayers=false`，设计要求的可控可治愈降级为关闭）；怪潮按玩家在线时长每 4–6 天（≈80–120 分钟）触发、首夜不触发、单事件同时上限 48、波次 12/批、事件期间禁睡、无人在线暂停。
- **怪潮组成表**重写（`config/hordes/data/.../tables/default.json`，已实测加载）：剔除下界单位（zoglin/僵尸猪灵/三叉戟骑手），按事件天数分档——0d 僵尸群 → 10d 尸壳/溺尸 → 15d 骷髅 → 25d 苦力怕 → 30d 流髑/沼骸 → 35d 女巫 → 40d 稀有突变僵尸精英（weight 1）→ 45d 僵尸马骑手。
- **Zombies Break & Build**：`affectedEntityIdList` 从 `@monster` 收窄到僵尸系（zombie/husk/drowned/zombie_villager + hordes 僵尸玩家）；`maximumBreakableBlockHardness=2.0`（只能拆软障碍，硬度≥3 的机器/仓储/反应堆安全）；`breakCooldown=5s`（T2 工程兵速率）；`builtBlocksDisappearing=true/60s`（事件搭建物自动清理不可收割）。
- **Guard Villagers TaCZ Support**：`zombie_tacz_weapon_spawn_chance=0.0`、`pillager_tacz_weapon_spawn_chance=0.0`——自然怪永不随机持枪（设计硬性禁令）；守卫弹药/食物箱搜索等原生机制保留（radius 64，冷却 100t）。
- **Guard Villagers 交战规则**（`pack/config/guardvillagers-common.toml`）：`All mobs attack guards = true`（怪潮必须攻击守卫——守卫是防御层，不是免费 DPS）；黑名单移除 creeper（远程守卫须在爬行者贴墙前击杀），保留 enderman（瞬移使远程交战无意义）。
- **In Control!** `spawn.json`：全部 6 个 `ad_astra:*_orbit` 维度拒绝敌对生物生成（空间站/轨道安全基线）。
- TaCZ 服务端：保留 `EnableDefaultGunSmithTableFilter` 与 `AmmoBoxStackSize=3` 默认。

## 待验证

- 锁 enforcement（配方封锁/使用锁/维度锁）需要真实玩家进世界验证；FakePlayer 已验证授阶链路，真实客户端合成事件路径相同。
- stage 显示文案 i18n 已落地（待进游戏目验）：字节码确认 PS 3.0.5 不支持 translatable key（`TextUtil.parseColorCodes`→`Component.literal`，文档无 lang 字段）。方案：生成器保留 "zh / en" 字面量并输出 `config/starforge/stage_i18n.json`（literal→lang key，71 对，复用现有 `modpack.*` 键，解锁标题合成 `modpack.stage_i18n.*` 键带 `§l`）；`starforge_compat` 新增 mixin——`ClientStageCache` 的 `getDisplayName/getDescription/getCategory` 按客户端语言返回半句（覆盖图谱节点/详情面板/工具提示/分类/搜索），`TextUtil.parseColorCodes` 把含双语字面量的输入重组为 translatable 复合组件（服务端广播的解锁消息/封锁提示也按各端本地化），`TranslatableContents` 构造器重写含双语字面量的 String args（`stage_required` 等嵌套名称同样本地化）。缺失映射时全部回退原双语字面量。
- ~~服务端 `HumanoidModel`/`PoseStack` wrong-dist 报错~~ 已修复：根因是 `starforge_dump.js` 用 `ITEM.getKey(ri.getItem())` 取配方产出，Rhino 会反射扫描 Item 实例类（Supplementaries/Ad Astra 的物品带客户端渲染方法签名）。改用 `getItemHolder().unwrapKey()` 后专用服务器日志 0 条 wrong-dist 报错，6605 配方导出中 6336 条含 result。

## 实测失败 / 技术降级记录

- ~~**DefenseTurrets 炮塔无弹药/能量消耗**~~ **已随模组移除而关闭**：原炮塔 BE `shoot` 不消耗任何物品（原生无限射击），Mixin 注入方案不再需要。继任者 TACZ Turrets 原生消耗弹药：装入 TaCZ 枪后从脚下/相邻容器取弹（服务端实测：AK47 与 DRG gk2 均从下方箱子取弹并击杀目标），“弹药经济”由继任模组原生实现，无需附属。
- **The Hordes 阶段化组成受限**：其 `gamestages:gamestage` 条件依赖 darkhax GameStages API（未安装；与 ProgressiveStages 是两套体系）。降级：组成表用 `first_day/last_day` 天数窗口做固定档位升级；真正的「按团队科技阶段换表」需要 compat 层或事件驱动调度（设计文档已预留该适配路径）。
- **怪潮预算 B=12+0.8H 未实现**：基地威胁值 H 需要基地登记/设备摘要等适配层，当前用固定 spawnAmount/days 近似；文档允许 MVP 固定档位，不宣称动态威胁已实现。
- **下界/末地怪潮未单独关闭**：Hordes 无维度条件，In Control 无法区分怪潮来源；记为已知缺口（玩家在对应维度被追潮属于边缘情况）。
- 其余历史记录见 git 历史与上文「正在实现/待验证」。

- `incontrol` 首次启动写默认 `areas.json` 报错一次（`Error writing areas.json!`）；其余规则文件正常生成。影响：无（areas.json 为可选规则文件，发行版由我们提供显式配置）。
- KubeJS 2101.7.2-build.377 服务端脚本注意点：无 `ServerEvents.started`（用 `ServerEvents.loaded`）；Rhino 下 `String` 不能直接当 Java `Function` 用；局部变量名避免与 KubeJS 全局冲突（`dims`/`recipes` 等会报 redeclaration）；`Registry.get(tagKey)` 重载会被 KubeJS ID 解析拦截，改用 `getTag(TagKey)`；`RecipeSerializer.codec()` 返回 MapCodec，需再 `.codec()` 得到 Codec 才能 `encodeStart`。
- 配方 JSON 编码失败 175/6595（如 `Field[...]`/`RecordCodec` 自定义序列化器），均有 id/type/serializer/result 兜底；需要精确编辑这些配方时按原数据包 JSON 重写。
- `atlaslib` 的更新检查 URL 返回畸形 JSON（三方检查器噪音，非整合包问题）。
- IC2CRE Dev-0.4 仅取主 JAR；Advanced Solar Panels / Gravitation Suite / Iridium Source 子附属未纳入首轮（设计文档未要求）。
- Easy Villagers（ARR）与 ProgressiveStages（ARR）等仅通过 manifest URL 分发，不提交 JAR。

## 尚未实现（按批次）

- P1 收尾：锁 enforcement 实机验证、AE2 冷启动链路实玩验证（新玩家从 T0 合成链是否全程可通）。
- P2 收尾：starforge-compat 附属已首轮交付（红石怪潮警报 + 厨房动态热源，服务端实测通过，见末节）；剩余项：基地威胁 H、事件预算、怪潮阶段化、空间站临时事件白名单；真实怪潮多人实机验收。（炮塔弹药消耗已由 TACZ Turrets 原生解决，不再是 Mixin 缺口。）
- P3–P6：T4–T7 高级链条实测、Ad Astra 首航**实机**验证（配方图闭环已验证，见「地球闭环实测」）、殖民岗位、任务、发行打包、性能实测。
- 客户端实机验证已补（Prism 离线账号 `RabiTest`，Starforge-DOtest 实例）：主菜单 → `--quickPlayMultiplayer` 直连专用服务器 → 进世界 → EMI/JEMI 80 个 JEI 分类 + 原生插件共 63630 配方 → Default Options 22 条键位全量生效 0 错误。皮肤拉取/3D 层渲染/小地图雷达实测关闭画面仍待人工目检。

## 性能结果

- 空服务器 65 mods：启动 73.9s（含首次世界生成），Done 后空载正常。
- 71 模组空世界待机实测（`/tick query`）：平均 0.4 ms/tick，P50 0.3 ms，P95 0.6 ms，P99 0.8 ms（预算 50 ms）。真实负载（怪潮+机器+管道网络）MSPT/FPS 待客户端实机与多人场景补测。
- 2026-09-22 QoL+性能层扩展后基线（98 enabled）：专用服务器 17 维度全部 20.000 TPS、总 8.0 ms/tick（一玩家在线）；客户端进服 + EMI 烘焙 63630 配方约 17s。新增 Fast Noise / Structure Layout Optimizer / AllTheLeaks / GPU Mem Leak Fix 均已加载且无冲突日志；AllTheLeaks 版本守卫按预期逐条判定（如 betterf3.FixDebugScreen 命中 11.0.3）。
- 风险项：Immersive Petroleum 油藏特征 `/place feature` 强制放置会在区块递归中触发 watchdog 终止（自然生成未触发，详见 compatibility.md 实测记录）；VRAM/内存长时间回收表现、连续跨维度压力测试待人工游玩补测。

## Alpha 打包

- `node tools/setup-server.mjs`：Java21 检查 → NeoForge 21.1.251 安装 → 按 lock 从官方源下载模组 → 同步 pack → eula/server.properties，一条命令出可跑服务端。
- `node tools/package.mjs`：产出 `dist/starforge-alpha-mc1.21.1-nf21.1.251.zip`（166 文件、7.5 MB，不含第三方 jar，符合分发许可）。

## 2026-09-22 饰品层增量（已运行时验证）

- 新增模组：**Curios API 9.5.1+1.21.1**（LGPL-3.0-or-later）、**Artifacts 13.2.5**（MIT，内嵌 Expandability 12.0.0/MIT 经 jarJar）。启用模组 98 → **100**。锁定清单/哈希经 `tools/fetch-mods.mjs --only` 落盘，`audit-deps` 全量通过。
- 槽位：`curios-common.toml` 保持 `slots=[]`；运行时确认 Curios 11 槽/12 实体分配（含 `back`）。Sophisticated Backpacks 原生 Curios 集成（jar 内验证）；Artifacts 仅注册 head/necklace/belt/hands/feet，不占胸甲槽——与 Ad Astra 宇航服、喷气装备零冲突。未引入 Accessories Compatibility Layer。
- 掉落重分布（KubeJS 数据包，非脚本）：`pack/config/artifacts/items.toml` 关 25 留 23；`starforge:artifacts_tiers` GLM（`neoforge:add_table` + `loot_table_id` 条件）把 24 件被关物品按 地球→月/火→金/水→Glacio+小行星带+轨道 四层重投，Boss 表 100% 保底一件，`eternal_steak` 完全禁用。RCON 实测 `loot insert` 命中 warp_drive（moon_boss）与 crystal_heart/chorus_totem（rare_glacio）。
- 键位：Curios G 键与 TaCZ 冲突 → defaultoptions 默认解绑（GUI 按钮不受影响）。
- i18n：新增 `alien_relics` 探索任务（design/content.json，35/35 校验通过）+ `starforge.curio.tier.*` 双语 tooltip（client script 按物品标注来源层级）。
- 服务端：`Done (1.725s)`，KubeJS 0 错，无新增 loot/GLM 解析错误；仅存的 4 条 `Couldn't parse` 为 Creature Feature 姊妹模组缺表的既有告警。
- **性能边界（如实记录）**：ProgressiveStages 自带 Curios compat 每 tick 扫描 curio 槽（上游既有行为）；本层不新增 tick 逻辑。
- **仍待验证**：客户端 GUI 会话内 Back 槽放入/取出背包实测；Artifacts 营地生成频率在星球维度的目检。

## 2026-09-23 家具层增量调整（-4 / +2，100 启用模组；**MDM 已于 2026-09-24 移除**，当前状态见末节）

- **移除**：Rechiseled 1.2.6 及其独占依赖 SuperMartijn642 Core Lib 1.1.24a / Config Lib 1.1.8 / Fusion 1.3.15b。删除前经 `manifest/jar-deps.json` 反向查询确认：三个库仅有 rechiseled 一个依赖方，rechiseled 自身无其它依赖方。
- **新增**（Modrinth 1.21.1+NeoForge 最新 release，URL+SHA 经 `fetch-mods --only` 落锁）：
  - ~~**MDM（Modern Decorations Mod）26.9**~~：**2026-09-24 移除**，由 Refurbished + Framework + Energized Furniture 接替（末节）；
  - **Macaw's Furniture 3.4.1**：成套厨房/客厅/浴室家具，含储物衣柜/抽屉柜/水槽。
- **重叠审计**（详见 `mod-compatibility-report.md` 家具层节）：无配方碰撞（MDM 264 条全部为切石型、McW 为香草材料成形配方）；无平行材料体系（双方消费统一木材/铁/石材）；储物家具与抽屉→Sophisticated→AE2 仓储层级不冲突；家具电器为储物/装饰非加工设备（Cooking for Blockheads 保留功能厨房角色）。**KubeJS 无需配方层整合**。
- **i18n**：`gen-mod-lang-zh.mjs` 移除 rechiseled 覆盖，新增 mdm（274 键，模组仅带 en_us——**已随模组移除**）与 mcwfurnitures（56 键，补齐 3.4.x 厨房水槽系与沙发色组缺失行）。
- Supplementaries 3.9.9、FramedBlocks 10.6.1、Building Gadgets 2 1.3.9 保持原锁定版本未动。
- **运行时验证**：dedicated server `Done (1.653s)`，mdm 26.9 / mcwfurnitures 3.4.1 正常加载，KubeJS 5/5 脚本 0 错 0 警；仅存 ERROR 为既有告警（4 条姊妹模组 loot_table 缺表 + `modid:example` DataMapLoader 噪音，旧日志同款）。`registry-export/` 已用本次启动重导出（8302 配方；mdm 265 物品/264 方块、mcwfurnitures 654/652；被删模组 ID 清零）。
- 待验证：客户端实机目检家具模型/储物 GUI 与中文显示。

## 2026-09-23 材料统合 + 跨 Mod 联动增量（+3 模组，103 启用）

### 新增兼容模组（已锁定、已启动验证）

| 模组 | 版本 | 许可证 | 必需依赖 | 用途 |
| --- | --- | --- | --- | --- |
| Almost Unified | 1.21.1-1.4.2+neoforge | LicenseRef-ARR（manifest URL 分发，不入库 jar） | 无 | 把 `c:` 标签内重复材料的配方输出统一为优先级物品 |
| Applied Cooking | 6.2.1 | MIT | ae2、cooking-for-blockheads、balm | Kitchen Station 让 CFB 直接读 ME 网络食材 |
| Applied Delight | 1.1.0 | MIT | ae2、farmers-delight | ME Cooking Pot 从 ME 取食材，仍要求真实热源 |

三者经 `fetch-mods --only` 落锁（`manifest/locked-mods.json`，103 启用）。依赖闭包全部由既有模组满足，未引入新前置。

### 标准材料输出（服务端验证：0 个非标准产出）

优先级 `IE > IC2CRE > Ad Astra > Railcraft`（末影粉单独覆盖为 AE2）：

- 钢/铅/镍/银/铀锭与块、全部板材、铁杆/钢杆 → Immersive Engineering
- 锡/青铜锭、锡/青铜板 → IC2CRE
- 焦煤与焦煤块 → IE `coal_coke` / `coke`
- 末影粉 → AE2 `ender_dust`
- 硫磺/硝石/黑曜石/煤等粉末 → 标签首优先项（IE/IC2CRE）

验证方式：`registry-export/recipes.json` 全量扫描，产出非标签首选物品的配方数为 **0**（改造前 Ad Astra/IC2CRE/RC 各自输出本家钢锭等）。

### 输入统一（KubeJS `starforge_unify.js`）

- `ServerEvents.recipes` `replaceInput`：65 条显式 物品→`c:` 标签 映射（锭/板/杆/粉/粒/粗矿/块/焦煤）。
- `replaceOutput` 兜底 AU 无法改写的自定义序列化器（`minecraft:` 命名空间锡熔炼、RC 合金合成等）。
- 数据包配方覆盖 5 条（AU/KubeJS 均改不动的序列化器）：`ic2cre` 末影珍珠打粉→AE2 粉、`railcraft:coking` 焦煤→IE、`railcraft:coal_coke` 解压、RC 辊压锡板/青铜板→IC2CRE。
- 删除重复锭↔块↔粒压缩配方 32 条（被删方块的合成改由标准 Mod 配方经标签输入完成，双向链路不断）。

### 标签补齐

- `c:storage_blocks/{steel,lead,tin,silver,bronze,uranium}` ← IC2CRE 六金属块（原先完全无标签）。
- `c:dusts/ender_pearl` ← `ic2cre:ender_pearl_dust`（现为 3 成员）。
- `ad_astra:steel_blocks` ← `ic2cre:steel_block`。
- `c:buckets/oil`（11 桶）/ `c:buckets/fuel`（22 桶）+ `c:buckets` 父标签——只统一"桶装接口"，未改变任何能量密度/机器效率/火箭燃料要求。
- 以上走 `kubejs/data/**/tags/*.json` 数据包路径（原生加载顺序，保证 AU 输出统一能看到）。

### 矿层去重（数据包 `neoforge:add_features` 空表覆盖，可逆）

| 矿种 | 保留来源 | 禁用来源 |
| --- | --- | --- |
| 锡 | IC2CRE（2 矿脉） | Railcraft ×2 |
| 铅 | Immersive Engineering | IC2CRE ×2 + Railcraft ×1 |
| 铀 | IC2CRE（3 矿脉） | IE ×1 |
| 镍 | IE | Railcraft ×3 |
| 银 | IE | Railcraft ×2 |
| 硫/硝石/锌/铝 | Railcraft（独家）/ IE（铝独家） | 无 |

`tools/check-closure.mjs` 的地球世界生成白名单已同步收窄；七种材料闭环全部 0 缺链（银多一条 IC2CRE 碎矿死槽告警，主链不受影响）。

### 厨房 / 家具 / 氧气（`starforge_compat.js`）

- `cookingforblockheads:kitchen_item_providers`：+553 件储物类家具（Refurbished 113 + Macaw 440：柜、抽屉、台面、冰箱等）；`kitchen_connectors`：+86 件 Refurbished 家电/水槽/橱柜壳。邮箱、邮筒、回收桶、餐盘刻意排除出 providers；清单全部来自 JAR blockstates 而非猜测。CFB 标签语义是"对该方块查询 IItemHandler/Container"——Refurbished 储物 BE 是真实 `Container`，CFB 原生支持；**库存读取有效性待客户端实机验证**。
- `ad_astra:passes_flood_fill`：+1101 件 Refurbished/McW 家具方块（家具不应封死房间氧气）。FramedBlocks 刻意不加——拟态方块应按被模仿方块的气密性处理。**实际氧气传播行为待客户端实机验证**。

### 怪潮警报（`starforge_horde.js` + `starforge_compat` 附属）

- `NativeEvents` 钩子 `HordeStartEvent`/`HordeEndEvent`（零轮询）：怪潮开始播放袭击号角 + 标题 + 聊天警报，结束提示补给。已确认这两个事件在 NeoForge 事件总线上（可取消、含玩家上下文）。
- 红石警报层已实现：`starforge_compat:horde_alarm` 方块（见下文 compat 附属节）。KubeJS 只保留表现层（标题/号角/聊天），红石信号由附属接管。

### TaCZ / 军事链审计结果

- 全部 24 条 TaCZ 弹药配方**原生即用 `c:` 标签**（`c:ingots/copper`、`c:gunpowders`、`c:ingots/iron` 等）——统一铜/铁自动流入弹药经济，无需重写。Defense Turrets 已移除；炮塔弹药经济由 TACZ Turrets 原生承担（容器取弹，已实测）。

### 军事层扩展（2026-09-23，已服务端实测）

- **加入**：TACZ Turrets 2.0.0（MIT）、TaCZ Addon 1.1.8-fix2（许可证字段不一致，见兼容性表）、TaCZ Pack Upgrader 2.1.3（同上）、~~DRG Gun Pack 1.2.6.1~~ → **EOS – Dawn Goddess Lab 1.1.1-hotfix1**（ARR，仅 manifest URL 分发；2026-09-24 替换，见文末变更记录）。
- **移除**：Defense Turrets 全部内容——manifest/lockfile 条目、5 条 KubeJS 配方、`dt_*` 语义键 7 个、三个阶段锁组、4 个任务节点（first_turret/turret_net/combined_fire/laser_grid）与对应文案。
- **枪包升级实测**：Pack Upgrader 启动时把旧格式枪包升级为 `+1.21.1` 版（`forge:`→`c:` 标签转换确认——EOS 的配件与 `eos_old` 配方同样依赖此路径）；TaCZ 识别 `eos` 命名空间，25 把枪 + 7 种弹药经 KubeJS 重写为工业材料配方后注册（经 `.id()` 固定回 `eos:*` 命名空间，走 EOS 自带 `eos_printer` 工作台）。
- **炮塔实测**（DRG 时代，机制不变）：`taczturrets:turret` 召唤、装入 `tacz:ak47` 与枪包武器，对召唤僵尸自动开火击杀，弹药从**脚下箱子**扣取（内置 Inventory 缓冲 10 格）——“最后一公里物流”设计成立；EOS 武器同为 `tacz:modern_kinetic_gun` 物品，链路一致。
- **枪包不可用内容**：EOS 侧 `eos:eoslab_12g` 有弹药索引但上游无配方（视同禁用，同 DRG 的 `ani_pro`/`pickaxe`/`supply` 先例）。
- **枪包阶段门槛**（经配方材料而非物品锁——枪/弹共用 `tacz:` 物品 id，PS 无法按 id 锁）：T3 `ae2:engineering_processor` 高斯枪族（HG-57/M-57CW/AR-68/QGZ-86/极速追星/陸弓）；T4 `ie:heavy_engineering` 重型高斯与特种（MG-85/SR-85/猫又/阿喀琉斯/四叶十字/WA2000 双型）；T5 `ic2cre:containment_reactor_plating`+奇点/异常分析 ELP 电浆系与艾莲娜之钉/混沌。
- **任务书**：军事章 11 任务（含新增 armed_guards/ie_turret/ammo_logistics/tacz_turret/eos_arsenal/swarm_suppression/expedition_firepower），自动化章新增 `munitions_supply`；手册新增 6 页（分层防御/炮塔补给/EOS 定位/警卫武器/TaCZ Addon/远征弹药）；运行时首次造炮塔与首次获得 EOS 枪各一条一次性提示。
- **服务端战斗基准**（RCON 实测，4 炮塔 + ~35 怪潮 [30 僵尸+5 Arachnids]）：空载 1.0 → 战斗中 3.0–3.9 ms/tick，TPS 稳定 20；同时在场 `tacz:bullet` 弹丸峰值 36；约 2 分钟内全灭该波次；弹药链实测为 箱→炮塔内仓（10格）→枪膛（打完弹匣后自动从库存补弹）。EOS 武器走同一 `tacz:bullet`/装填机制。
- **Guard Villagers TACZ Support 部分验证**：goal 经 Mixin 无条件挂到全部 Guard（`TaczGunAttackGoal`+`TaczTargetAssistGoal`）；弹药判定走 TaCZ 原生 `IAmmo.isAmmoOfGun`，消耗守卫自身 `guardInventory` 弹药并支持 ammo_box；实测守卫吞掉了塞入库存的枪包弹药并完成装填——供弹链路成立。但无头环境无法复现真实索敌开火（需玩家互动/村庄上下文/拾取路径），多人与实机行为列为待人工验收。

### 已知残留 / 未做

- AU 的 `priority_overrides` 与无 `{material}` 占位符的字面标签条目疑似不生效（`c:coal_coke` 平标签需 `c:{material}` 模式覆盖）；RC 辊压/焦化炉输出已用数据包覆盖兜底。
- `appliedcooking:guide_book` 配方因 Patchouli 未装而优雅降级（仅 WARN，无害）。
- Almost Unified `unification/materials.json` 为 AU 自动生成的默认副配置（截断优先级），实测不影响主 `unify.json` 生效——保留观察。
- EMI 重复条目隐藏（AU `recipe_viewer_hiding`）、厨房读取、氧气穿透——均需客户端实机复核。怪潮警报红石层已经服务端实机验证（见下文）。

## 2026-09-23 `starforge_compat` 附属首轮交付（已实现并服务端实测）

KubeJS 无法表达的行为型兼容，现由自有附属 `starforge-compat-0.1.0.jar` 承担。源码 `compat/src/`，确定性构建 `node tools/build-compat.mjs`（javac + AT 变换编译 jar + 固定时间戳打包），经 `manifest` `local` 源入锁（sha256 以 `manifest/locked-mods.json` 为准），同步至 `run/server/mods/`。

### `starforge_compat:horde_alarm`（红石怪潮警报）

- 机制：放置时方块实体把坐标登记进维度级 `SavedData`（`starforge_compat_horde_alarms.dat`），破坏即注销；`NeoForge.EVENT_BUS` 监听 `HordeStartEvent`/`HordeEndEvent` 翻转 `active` 标志并对登记位点 `setBlock`（flag 3 邻居更新）；方块 `getSignal`/`getDirectSignal` 激活期输出 15。零 tick 轮询、零世界扫描；区块未加载的警报在加载时经 `reconcile` 对齐当前怪潮状态。
- 服务端实测（RCON + FakePlayer 构造真实 `HordeStartEvent`/`HordeEndEvent` 注入 NeoForge 事件总线）：`active` false→true→false；相邻红石粉信号 0→15→0；相邻红石灯 `lit` false→true→false（灯熄灭依赖世界 tick，见下）；破坏后 `alarms` 长数组清空（落盘文件验证）；重启后登记位点仍在 SavedData 中。
- 可直接驱动：红石灯、Supplementaries Speaker Block/Redstone Illuminator、门禁等任意红石消费者。

### `starforge_compat:electric_burner`（厨房动态热源）

- 机制：带 `LIT` blockstate 并列入 `farmersdelight:heat_sources`——FD 原生 `HeatableBlockEntity.isHeated` 读取 LIT，**断电即停热，无 Mixin**。方块实体挂 `Capabilities.EnergyStorage.BLOCK`（8000 FE 上限、800/tick 上限、仅接收），每 tick 有电时耗 40 FE 并保持 `LIT=true`，耗尽即 `LIT=false`。
- 服务端实测：`data merge` 充 8000 FE → `lit=true`；以 ~40 FE/tick 耗尽 → `lit=false`。`immersiveengineering:capacitor_creative` 相邻自动供电维持 8000（capability 注入有效）。
- 端到端烹饪实测：锅（FD Cooking Pot）内放骨汤配方原料——断电时 `CookTime` 恒为 0；供电后 `CookTime` 128/200 → 产出 `farmersdelight:bone_broth`（`RecipesUsed` 记一次）。**断电不煮、供电才煮，符合"不虚构能源"约束**。
- 能源经济：8000 FE ≈ 200 tick 续航，定位 T2 电气厨房入口；后期可由 Applied Delight ME Cooking Pot + 电网接管（FD 热源判定不变）。

### 重要发现：The Hordes `pauseEventServer`

- `hordes-common.toml` `pauseEventServer = true`（模组默认）会让 `MixinServerLevel` 在 0 玩家时**取消整个 `ServerLevel.tick`**——gametime/daytime、方块实体、漏斗、水流全部冻结，`tick query` 仍报正常（TRM 未冻结，只是 tick 体被跳过，MSPT 因而只有 0.2）。此前误判为"空服暂停"的测试异常全部由此导致。
- 处置：本包 `hordeEventByPlayerTime=true` 已让怪潮只跟玩家在线时间推进，`pauseEventServer` 的宣称目的本就冗余，而副作用是空服时机器/农场/AE2/burner 全停——与自动化定位冲突。**pack 配置已改为 `pauseEventServer = false`**（注释注明原因）；若未来想让基地在无人时休眠可改回，届时怪潮警报会保持离线前状态（世界冻结即警报冻结，属一致语义）。

### 仍未实现的 compat 项

- 基地威胁值 H、怪潮阶段化调度、空间站事件白名单（P2 原列项）；EOS 枪包客户端表现（模型/动画/音效/脚本特殊机制）与 TACZ 炮塔多人/区块卸载实机验收（P2 尾项）。

## 2026-09-23 隐藏彩蛋：首次 PvP 击杀奖励（已实现，待实机验证）

`starforge_compat` 新增 `EdiblePlayerHead`（`NeoForge.EVENT_BUS` 三个监听）：

- **触发**：`LivingDeathEvent` 中要求死者为 `ServerPlayer`、`DamageSource.getEntity()` 为另一名 `ServerPlayer`（排除自杀与 `FakePlayer`，覆盖近战/弹射物/引爆物等玩家归因伤害；环境/怪物伤害 `getEntity()` 非玩家不触发）。随后检查隐藏成就 `starforge:edible_player_head` 是否已完成——未完成才发放，天然保证每名杀手只领一次。
- **特殊头**：仍为 `minecraft:player_head`，但写入 `minecraft:profile`（被害者实时 `GameProfile`，含皮肤属性）、`minecraft:custom_name`（`item.starforge_compat.edible_player_head` = “%s的头颅” / “%s's Head”）、`minecraft:food`（0 营养/0 饱和/`canAlwaysEat`/1.6s 进食时长，靠 1.21.1 的 food 组件获得可食用性与进食动画）与 `minecraft:custom_data` 标记 `starforge:edible_player_head` + `starforge:victim_uuid` + `starforge:victim_name`。普通玩家头无标记、不可食用，行为完全不变。
- **成就**：`design/content.json` 新增 `trigger: "custom_event"` + `event: "starforge_compat:player_killed_player"`；`build-pack.mjs` 生成 `minecraft:impossible` 判据（只能由 `PlayerAdvancements.award` 授予），`hidden: true`、challenge 框、弹 toast 不广播。与阶段系统、ProgressiveStages、FTB Quests 无任何关联。
- **食用效果**：`LivingEntityUseItemEvent.Finish` 检测标记头 → `MobEffectInstance` 再生 VI + 凋零 VI，`duration = INFINITE_DURATION`（1.21 原生无限时长，与 `/effect ... infinite` 同义——牛奶、死亡、`/effect clear` 正常移除），`ambient=false`、`showParticles=false`、`showIcon=false`。
- **Tooltip**：`ItemTooltipEvent` 对标记头追加灰色“食用效果：”一行 + 5 行 `obfuscated` 彩色固定文本（暗紫/青/黄/红/绿；底文是固定翻译键，不靠每帧生成随机串），不泄露真实效果名。
- **顺手修复**：`tools/fetch-mods.mjs --only` 曾为重建后字节已变的 `local:` jar 携带旧 sha1，导致合并校验必然失败；现仅当旧 sha1 与新 jar 实际 sha1 一致时才携带，变更的条目由 `backfillSha1` 回填。
- **待实机验证**：双人 PvP 首杀发头 + 跳成就、头颅皮肤/名称渲染、进食动画与满饥饿可吃、双无限效果生效、牛奶可清除、tooltip 乱码行渲染（obfuscated 样式按原版机制逐帧换字形，属预期）。

## 2026-09-23 引导体系 V2：统一数据源 + 能力节点（已实现，静态 + 服务端验证通过）

按 `引导系统V2.txt` 重构引导层架构：**ProgressiveStages = 唯一状态源**（8 时代 + 22 能力节点同图）、**Progression Map = 总导航**、**FTB Quests = 说明书/路线**、**Advancements = 成就记录**、**手册 = 知识库**、**运行时提示 = 场景提醒**。

### 数据源拆分（design/ 新文件）

- `design/progression.json`：30 个进度节点——8 个时代（`kind: "era"`，`triggers`/`locks`/`unlock`/`preview`）+ 22 个能力节点（`kind: "ability"`，dependency 可指向时代或其他能力，**永不反向授权**、不带锁规则）。触发条件五类：原生 `craft`、`pickup`、`dimension`、`custom_counter`、`has_item`（metadata），均服务端可验证。
- `design/advancements.json`：成就定义独立（`stage_granted` / `vanilla_trigger` / `custom_event` 三类），只记录不授权。
- `design/guidance.json`：14 条运行时引导事件，每条含检测路由（craft_item/inventory_item(s)/inventory_tag/block_use/block_tag/dimension/entity_spawned/quest/horde_start/horde_end/gun_ns/advancement_earned）与效果（计数器/成就/一次性提示）。
- `tools/lib/design.mjs`：统一加载器，content+progression+advancements+guidance+semantic-map+stage-locks 合并为单个 design 对象；四个工具全部改走它。

### 生成物

- **ProgressiveStages**：30 个 stage 目录。schema-4 `dependencies`/`dependency_mode`/`[[triggers]]` + `[display]`（frame/reveal/sort_order/category）+ `[unlock]`（toast/progress_nudges/hud_bar）+ `[advancements].locked`（reveal_at 隐藏）；`scope=team`。能力节点无锁、无时代依赖。
- **FTB Quests**：10 章 160 节点（43 手册页）148 奖励。新增 `milestones` 章——7 个 `gamestage` 任务（`team_stage: true`），团队持阶即自动完成，与 PS 图谱实时同步；`star_map` 任务指引玩家打开 PS 库存按钮的进度图谱；37 个支线新任务全部 `optional: true`。
- **成就**：29 个 JSON 生成到 `pack/kubejs/data/starforge/advancement/`（含 8 个 `stage_granted` 时代镜像）。
- **运行时**：`starforge_guidance.js`（生成）取代手写 `starforge_triggers.js`——七条时代证据计数器 + 14 条引导事件 + `ProgressiveStages.onGranted` 同步（stage_granted 成就 + 下一步提示）。维度/FTB 任务用节流 tick 轮询（无 direct 事件）；EOS 枪用 `GunId` NBT 命名空间 `eos:*` 区分普通 TaCZ 枪；FTB `quest` 路由严禁投喂时代证据计数器（任务书永远可选）。
- **语言**：652 个双语键（en_us/zh_cn 全量一致）。

### 验证结果（静态，本轮）

```text
validate-design: PASS — 30 节点 / 7 路线 / 10 章 / 117 任务 / 43 手册页 / 14 引导事件 / 652 双语键
export-quests:   10 chapters, 160 quest nodes, 148 rewards
build-pack:      13 items, 30 stages (8 era + 22 ability), 29 advancements, guidance script, 2 lang files
check-mapping:   PASS — 全部 427 条语义 ID 可解析
compat 附属构建: starforge-compat-0.1.0.jar 成功
```

新校验项：进度图无环、时代依赖禁能力反向、依赖阶段不倒挂、required 不依赖 optional、guidance 路由/计数器/引用完整、`via.quest` 禁投时代证据、generated-ID 全局唯一。

### 运行时验证（2026-09-23 dedicated server，Java 21，本轮实跑）

- `/progressivestages validate`：**30/30 通过**（首轮抓出 `[unlock]`/`[advancements]` 段错放 `stage.toml`——文件夹格式下前者属 `progression.toml`、后者属 `rules.toml`，生成器已修正）。
- 服务端启动 `Done (1.810s)`：`starforge_guidance.js` 0.119s 加载、全部 Java 类解析成功（ResourceLocation/Long/ServerQuestFile/HordeStartEvent/HordeEndEvent），KubeJS 0 错。
- `Per-stage triggers active for 29 stage(s), 29 rule(s)`（survival_age 为 starting stage 无触发）。
- `/stage tree`：8 时代主链 + 22 能力分支形状与设计一致。
- FTB Quests：`Loaded 1 chapter groups, 10 chapters, 160 quests`，双语翻译表加载，无解析错误。
- **stagetest（FakePlayer，`kubejs/stagetest.json` 启用）全 OK**：30 节点注册、survival 授予、native craft→mechanical、7 条时代计数器、4 条能力计数器（base_registered/guard_post/horde_survived/eos_gun）、bulk_storage native craft、无时代残留 locked。修复两处：补依赖须 `grantBypass`（`grant` 仍检查依赖）；`locked()` 返回未持有阶段而非锁规则。
- **KubJS 顶层 `const` 跨文件共享**：`HordeEndEvent`/`EVIDENCE` 与 horde.js/旧 triggers.js 冲突报错——生成脚本全部改 `SF_` 前缀（沿用 starforge_dump.js 既有约定）；`global.*` 只能 startup_scripts 用（sfGuidance 导出已移除，无消费者）。
- `sync-pack.mjs` 新增 `kubejs/{server_scripts,startup_scripts,client_scripts,data,assets}` 为 OWNED_DIRS——旧 `starforge_triggers.js` 在 run/ 残留的问题已根治（runtime 的 export/、config/、stagetest.json 不属 OWNED）。
- `deep_space`/`highrisk_survey` 的 `any_of`→`all_of`（描述为"抵达 X 与 Y"）。

### 仍待实机验证（需真实玩家/客户端）

- `ProgressiveStages.onGranted` → `stage_granted` 成就颁发给真实玩家（FakePlayer 路径无错但无法观测授予结果）。
- 14 条引导事件的真实触发（拾取/方块交互/维度轮询/gun_ns/horde/quest/advancement_earned）。
- FTB `gamestage` 任务的客户端显示与 `team_stage` 同步；milestones 章视觉。
- `[unlock]` toast/title 实机表现（常驻 hud_bar 已按设计关闭，见文末变更）；`[advancements].locked` 隐藏效果。
- 锁 enforcement（制造/使用/维度进入）真实玩家进世界抽查。
- 双人 PvP 彩蛋（见上节）。

## 2026-09-24 变更：EOS 枪包替换 DRG + 模型/成就页修复 + 时代 HUD 收敛（已实现，静态验证通过）

### EOS – Dawn Goddess Lab 取代 Deep Rock Galactic Gun Pack

- **资源层**：`manifest/mod-list.json`/`locked-mods.json` 的 `drg_gun_pack` 条目替换为 `eos_gun_pack`——CurseForge `tacz-eoslab-gunpack` file 7182834（`EOS_Dawn Goddess Lab ver1.1.1-hotfix1.zip`，15,677,704 B，sha256 `0b490c48…71bb3`），ARR 许可、仅 manifest URL 分发；`fetch-mods --locked` 106+2 全量校验通过。
- **包内结构**：`eos` 命名空间，25 把枪（高斯 HG-57/M-57CW/AR-68/QGZ-86/MG-85/SR-85、特种猫又/阿喀琉斯/四叶十字/极速追星/陸弓/WA2000/蛇吻、ELP-13~72 电浆系、艾莲娜之钉、混沌）+ 7 种弹药 + 57 种配件；自带工作台 `eos:eos_printer`（`tacz:workbench_b` + `BlockId`）与 `eos_old` 换肤转换台；`recipe_filters` 让 `eos:*` 配方全部落在打印台（默认枪匠台黑名单 eos）。
- **配方层（SF-16 重写）**：移除上游 `eos:gun/*`（25）、`eos:ammo/*`（7）、`eos:blocks/*`（2）后按工业中间件重挂——T3 `ae2:engineering_processor`、T4 `ie:heavy_engineering`、T5 `ic2cre:containment_reactor_plating`+奇点/异常分析；弹药产率沿上游（57x24×50/68x57×45/85x76×60/28x300×6/battery×2/arrow×60/alloy×10），battery 改用 `ic2cre:energy_crystal`。重挂配方经 `KubeRecipe.id()` 固定回 `eos:*`，使包内 `recipe_filters` 白名单 `^eos:.*$` 把它们路由到 EOS 打印台（默认台黑名单 eos ——`.id()` 不可用时回退 `kubejs:*`，改在默认台显示，功能等价）。`eos:attachments/*`（57）与 `eos_old:gun/*`（2 条极速追星换肤）保持上游不动；`eos:eoslab_12g` 上游无配方维持禁用。
- **工作台配方修正**：上游 `eos_printer`/`old_conversion` 是带 `forge:` 标签 + 1.20 `nbt` 结果语法的原版合成表，升级器未必覆盖——已用 `c:` 标签 + `components`（`minecraft:custom_data` 写 `BlockId`）重写为 1.21.1 形式（打印台 = 磨制深板岩+铁+铜+黄色玻璃；换肤台 = 铁+铜）。
- **联动层**：`design/guidance.json` 事件 `eos_gun`（`GunId` 前缀 `eos:`，计数器 `modpack:eos_gun`，成就 `eos_arsenal`，提示 `modpack.message.eos_gun_tip`）；`heavy_firepower` 能力触发改为 `modpack:eos_gun`；任务 `eos_arsenal`/`eos_challenge`、手册页 `eos_arsenal`、stage_test 计数器同步改名；EMI 自动随配方管理器呈现新配方，无额外配置。
- **文案**：en/zh 全部 `drg_*` 键更名 `eos_*`，描述更新为 EOS 武器族（高斯/ELP 电浆/特种）与打印台引导；FTB Quests 双语 snbt 重新生成（`eos_arsenal` 等任务 hex id 随更名更新，export-quests 全量重建无残留）。
- **registry-export**：`recipes.json` 中 DRG 条目（34 配件 + 30 条 `tacz:kjs/*` + AU tracker）替换为 EOS 对应快照（25 枪 + 7 弹 + 57 配件 + 2 换肤 + 2 工作台 + `almostunified:eos` tracker）；待下次实机 dump 复核。

### ~~MDM `electric_guitar_with_stand` 模型修复~~（2026-09-24 随 MDM 移除作废）

- 历史记录：上游 `mdm:models/custom/electric_guitar_black_standing` 的非法旋转曾由资源覆盖修复；模组移除后该覆盖文件与 `pack/kubejs/assets/mdm/` 已删除，记录保留备查。

### 遗物猎人（first_artifact）成就页背景修复

- 根因：29 个生成成就全是 root（无 parent → 各自成页），`display` 无 `background`——1.21.1 `AdvancementTab` 用 `INTENTIONAL_MISSING_TEXTURE` 兜底 → 页面背景显示缺图紫黑格。
- 处置：`design/advancements.json` 新增顶层 `default_background`（`minecraft:textures/block/smooth_basalt.png`，单条可 `background` 覆盖）；`tools/lib/design.mjs` 透出 `advancementBackground`，`build-pack.mjs` 对每个 root 成就输出 `display.background`——29/29 成就页现在有平铺背景。

### 时代阶段常驻 hud_bar 关闭

- 按单一数据源执行：`design/progression.json` 7 处 era `unlock.hud_bar` 全部 `true`→`false`（`toast`/`progress_nudges`/`title`/`sound` 不动），`node tools/build-pack.mjs` 重新生成——7 个时代 `progression.toml` 均无 `hud_bar` 行（生成器只在真值时输出）；能力节点本就不带 hud_bar。进度反馈保留：toast、progress_nudges、PS 阶段图谱、FTB Quests、成就页。
- **验证**：`grep hud_bar pack/config/progressivestages/` 零命中；`validate-design`/`check-mapping` PASS；`node --check` 三个脚本通过；`export-quests` 10 章 160 节点重建。
- **待实机复核**：EOS 打印台实际配方路由与 `.id()` 生效情况、电浆武器/换肤台表现、吉他模型渲染外观、成就页背景渲染。

## 2026-09-24 家具/厨房/能源/食品层增量（-1 / +6，111 启用模组）

- **移除**：MDM 26.9（无其它模组依赖它，`jar-deps.json` 反向查询确认）。残留清理覆盖 `manifest/*`、`design/*`、`localization/*`、KubeJS 脚本/资源、`pack/config/ftbquests/*`、`registry-export/*`、`run/client`+`run/server` 生成树与 `pack/kubejs/assets/mdm/`；源码 + 生成物全仓扫描 `mdm` 仅剩本文档与兼容性报告中被标记"已移除/作废"的历史条目。
- **新增**（均经 `fetch-mods` 落锁，版本/依赖逐 jar 核实）：
  - **Framework 0.13.11**（LGPL-2.1，Refurbished 前置）；
  - **MrCrayfish's Furniture Mod: Refurbished 1.0.22**（代码 MIT / 资产 ARR）；
  - **Energized Furniture 0.2.0**（ARR）：变压器 BE 原生继承 Refurbished `ElectricityGeneratorBlockEntity`，FE→Watt 为上游实现；注意其 `neoforge.mods.toml` 是模板，`refurbished_furniture` 属未声明硬依赖；
  - **Engineers Delight 2.0.0**（MPL-2.0，modid `tmted`）：IE×FD 数据包配方（cloche/press/squeezer/fermenter/mixer/bottler/sawmill）+ 钢制屠宰刀门槛；
  - **Immersive Cooking & Farming 0.2.0-beta-1**（MIT）：烹饪锅/发酵罐/食品处理机/烤炉多方块 + 专用配方序列化器；IE 硬依赖与本包锁定版精确一致；**beta 版，稳定性/性能/dedicated server 列入重点验收**；
  - **[Let's Do] Vinery 1.5.3**（ARR，锁 1.5.3 而非发布 5 天的 1.5.4）：IC&F 的 `neoforge.mods.toml` 用旧版 `mandatory=false` 字段，NeoForge 不识别、全部依赖按 required 处理——vinery 实为硬依赖（服务端实测缺它 FML 拒载），其唯一依赖 Architectury 已在锁内。
- **厨房联动**：`starforge_compat.js` 的 CFB 标签清单改为从安装 JAR blockstates 生成——providers 553（rf 113 + mcw 440，仅真实 `Container` BE：抽屉/冰箱/橱柜/台面等；邮箱/邮筒/回收桶/餐盘排除）、connectors 86（rf 家电与水槽）、氧气穿透 1101（rf 449 + mcw 652）。Refurbished 炉灶原生计入 `farmersdelight:heat_sources`，无需包内工作。
- **流体桥**：`starforge_compat` 为 `kitchen_sink/basin/toilet/bath` 注册 `Capabilities.FluidHandler.BLOCK`，委托 Refurbished `FluidContainer.push/pull`（1000 mB 桶模型），Supplementaries 水龙头/管道可真实读写；不伪造物品栏 capability。
- **电脑**：`Computer.installProgram` 追加 Starforge Control / Security 两应用（服务端 20 tick 采样 → payload → 客户端 `Display.bind`），原四应用不动；图标经 `program_icons.png` 命名空间序位。compat jar 编译通过（58 entries，sha256 见 locked-mods）。
- **能源**：FE 公共电网文档化（design.md §能源与工业核心）——IE/Ad Astra 直连 FE，BC 原生 FE↔MJ，Refurbished 经 Energized 变压器，IC2CRE 保留 mEU；未新增任何 FE↔mEU 转换器，无循环发电通道。
- **食品分层**：FD 手工 → CFB/Refurbished 厨房（T2）→ Engineers Delight 中型工业（T2–T3，`tmted_knife` 入 `electric_age` 锁）→ Immersive Cooking 自动化（T3–T4，`ic_*` 多方块入 `heavy_industry_age` 锁）→ AE2 → 殖民/航天。优先使用 ED 原生 IE 配方，KubeJS 不重复实现。
- **任务/手册**：+6 任务（modern_kitchen、industrial_food、food_factory、modern_living、household_power、smart_home）+ 6 手册页，en/zh 双语同步（localization 677 键）；export-quests 10 章 172 节点重建。
- **i18n**：`gen-mod-lang-zh.mjs` 重写为组合式生成——refurbished_furniture 654、energizedfurniture 12、immersivecooking 53、tmted 15 键 zh_cn；`pack/kubejs/assets/mdm/` 删除。
- **验证（本轮）**：`build-compat` 编译通过（58 entries）；`build-pack`/`export-quests` 重建成功；`audit-deps`（113 jars 闭包满足）/`check-closure`/`check-mapping`（438 语义映射）/`validate-design`（123 任务/49 手册页/677 双语键）PASS；**dedicated server `Done (1.724s)` 全量启动**：refurbished_furniture 1.0.22 / framework 0.13.11 / energizedfurniture 0.2.0 / tmted 2.0.0 / immersivecooking 0.2.0-beta-1 / vinery 1.5.3 全部加载，KubeJS 8/8 服务端脚本 0 错 0 警，FTB Quests 172 节点加载；运行时 registry-export 重导出（9003 配方；`mdm:` 0 条；`kitchen_item_providers` 688 项含 rf 113、`kitchen_connectors` 131 项含 rf 86、`passes_flood_fill` 1142 项含 rf 449+mcw 652）。
- **待实机验证**：Refurbished 电脑程序安装/渲染/警报往返（客户端会话）；流体桥经水龙头/管道实测；CFB 对 Refurbished 容器的库存读取；Energized FE→Watt 实际功率与电网拓扑；Immersive Cooking 多方块组装/运行/重载（beta）；家具模型与中文显示目检。
