# 兼容性与证据

核查日期：2026-09-22。目标：Minecraft **1.21.1**、NeoForge **21.1.x**、Java **21**。1.21、1.21.11、Forge、Fabric、26.1.2 均不能仅凭相似名称混入发行版。

下表“候选”仅表示作者发布页或 Modrinth 官方 API 中发现对应游戏版本/加载器的文件，**不等于这些版本组合已通过联机验证**。未下载 JAR、未解析所有依赖、未建立哈希锁文件。发布源可能不同步，表中不承诺是所有平台的最新版本。

| 模组 | 本轮找到的候选 | 第一方证据 | 仍须验证 |
| --- | --- | --- | --- |
| IC2CRE | Dev-0.4，开发版 | [作者发布页](https://github.com/BigFish520/IC2-CRE/releases/tag/Dev-0.4) | 电压、mEU API、核电、UU、物品/流体注册名与配方可覆盖性 |
| BuildCraft CE | 8.0.19 | [BCCE-team 发布页](https://github.com/BCCE-team/BuildCraft/releases/tag/8.0.19) | 对应 1.21.1 资产、MJ/FE、机器接口、采石场加载与管道可靠性 |
| Immersive Engineering | 12.4.2-194 | [版本记录](https://modrinth.com/mod/immersiveengineering/version/uNRARSH2) | 配方序列化、重型成形、原油链需要的新增工序 |
| Immersive Petroleum | 1.21.1-4.5.0-39（CurseForge，NeoForge） | [文件列表](https://www.curseforge.com/minecraft/mc-mods/immersive-petroleum/files/all?version=1.21.1&gameVersionTypeId=6) | 依赖 IE 的版本范围；与 BC 原油/燃料/炼油设备和流体标签的重叠、重复配方归并 |
| Storage Drawers | 13.11.4 | [Modrinth](https://modrinth.com/mod/storagedrawers) | 声明游戏范围 [1.21,1.21.1]；抽屉控制器与 AE2 存储总线对接、压缩抽屉配方 |
| Sophisticated Storage | 1.5.91（依赖 Sophisticated Core ≥1.4.88） | [Modrinth](https://modrinth.com/mod/sophisticated-storage) | 仓储控制器与总线对接、升级配方可覆盖性、容器替换的数据保留 |
| Sophisticated Backpacks | 3.26.3（依赖 Sophisticated Core ≥1.5.1） | [Modrinth](https://modrinth.com/mod/sophisticated-backpacks) | 升级分阶、自动拾取/补给边界、背包内加工能力的限制方式 |
| Applied Energistics 2 | 19.2.17 | [版本记录](https://modrinth.com/mod/ae2/version/kfyIqgJ6) | 处理器冷启动、跨维度桥、升级和自动合成绕锁 |
| Ad Astra | NeoForge 1.16.26 | [项目发布记录](https://www.curseforge.com/minecraft/mc-mods/ad-astra) | 火箭等级、氧气、环境伤害、站点维度与依赖 |
| Ad Astra: More Structures | 1.21.1-neoforge | [文件记录](https://www.curseforge.com/minecraft/mc-mods/ad-astra-more-structures/files/all) | 与上述 Ad Astra 组合、Boss 名单、结构战利品 |
| Railcraft Reborn | 1.2.10（2025-12-29 release，Modrinth） | [Modrinth](https://modrinth.com/mod/railcraft-reborn) / [GitHub](https://github.com/railcraft-reborn/railcraft) | 自定义许可（公开整合包允许，需附源码链接）；NeoForge≥21.1.50、MC[1.21.1,1.22)；无硬依赖，JEI 可选；实测已加载、注册表导出、`strap_iron_track` 等真实 ID 已核；`fluid_heat`/`tunnel_bore_head` 数据图类型已核 |
| Ad-Astra: Giselle Addon | 8.1（2026-08-29 release，Modrinth） | [Modrinth](https://modrinth.com/mod/ad-astra-giselle-addon) | MIT；硬依赖 `ad_astra≥1.16.0`、`common_storage_lib≥0.0.9`、`resourcefulconfig≥3.0.11`（均已满足）；可选联动 Mekanism/PneumaticCraft/AE2/Industrial Foregoing——均未装，对应 mixin/recipe 安静跳过 |
| Ad Astra: Asteroid Belt | 1.0（CurseForge 独占，file 8887640，2026-09-15） | [CurseForge](https://www.curseforge.com/minecraft/mc-mods/ad-astra-asteroid-belt) | MIT（JAR `neoforge.mods.toml` 确认；CF 项目页 license 字段为空）；modid `pv_ad_asterobelt`，维度命名空间 `pv_asteroid_belt:*`；无硬依赖；**项目较新、下载量小，列为风险项跟踪** |
| Simple Structures: Ad Astra | 1.3（2026-09-16 release，Modrinth） | [Modrinth](https://modrinth.com/mod/simple-structures-ad-astra) | MIT；modid `pv_ad_astra_structures`；服务端必需/客户端可选；Patchouli 为可选依赖（未装）；与 More Structures 命名空间/结构集互不重叠，共存已实测加载 |
| The Hordes | 1.21.1-1.6.3f | [文件记录](https://www.curseforge.com/minecraft/mc-mods/the-hordes/files/all?page=1&pageSize=20&version=1.21.1) | 时间控制、按基地波次参数、感染、维度排除 |
| Zombies Break & Build | 1.21.1-1.7.0-neoforge | [版本记录](https://modrinth.com/mod/zombies-break-and-build/version/OyzwivCD) | 单位标记/阶段支持、领地权限、破坏和搭建限额 |
| Defense Turrets | NeoForge 1.21.1-1.2.0 | [文件记录](https://www.curseforge.com/minecraft/mc-mods/defenseturrets/files/all) | 弹药输入、能源、红石、友军、AoE 地形损坏 |
| In Control! | 1.21-10.3.0，Beta，文件标记 1.21.1 | [项目发布记录](https://www.curseforge.com/minecraft/mc-mods/in-control) | 当前 schema、召唤/转移绕过、规则优先级 |
| ProgressiveStages | 3.0.5 候选 | [版本列表](https://modrinth.com/mod/progressivestages/versions) | 阶段本地化、团队同步、机器配方与自动合成覆盖 |
| KubeJS | 2101.7.2-build.377 | [版本记录](https://modrinth.com/mod/kubejs/version/THIGFPwf) | 7.2 API、数据组件、各模组配方插件 |
| FTB Quests | 2101.1.36 | [项目发布记录](https://www.curseforge.com/minecraft/mc-mods/ftb-quests-forge) | 对应语言导出格式、团队依赖、XMod Compat |
| Farmer's Delight | 1.21.1-1.3.4 | [版本记录](https://modrinth.com/mod/farmers-delight/version/XTVZDOol) | 切菜/烹饪锅与厨房识别、自动进出料 |
| Cooking for Blockheads | 21.1.24+neoforge-1.21.1 | [版本记录](https://modrinth.com/mod/cooking-for-blockheads/version/MQCIy6VF) | 农夫乐事配方桥接、容器与碗回收 |
| Rechiseled | 1.2.6-neoforge-mc1.21，文件标记含 1.21.1 | [版本记录](https://modrinth.com/mod/rechiseled/version/6muGRqvu) | 前置与服务器共装 |
| FramedBlocks | 10.6.1 | [版本记录](https://modrinth.com/mod/framedblocks/version/FBXGqSP5) | 氧气密封、伪装材质的硬度/抗爆、施工工具兼容 |
| Supplementaries | 1.21.1-3.9.9 | [版本记录](https://modrinth.com/mod/supplementaries/version/WrZWfRjP) | 前置、交互功能是否重复、管道/红石边界 |
| Building Gadgets 2 | 1.3.9 | [作者项目页](https://www.curseforge.com/minecraft/mc-mods/building-gadgets) | 现代文件名是 BuildingGadgets2；库存复制、撤销和权限 |
| Enderman Overhaul | 2.0.3 | [版本记录](https://modrinth.com/mod/enderman-overhaul/version/TH9YXp9r) | 真空环境、瞬移目标、主动敌对性与炮塔识别 |
| Mutant Monsters | v21.1.1-1.21.1-NeoForge | [版本记录](https://modrinth.com/mod/mutant-monsters/version/dauEcrnZ) | 爆炸、实体体型、环境伤害、掉落 |
| Creature Feature | 1.2.3.3 | [Modrinth](https://modrinth.com/mod/creature-feature) | MIT；替代 Phenominae；稀有异常/特殊机制敌对生物，按自带生物群系标签低权重生成；依赖 Blueprint |
| Arachnids | 0.3.0 | [Modrinth](https://modrinth.com/mod/arachnids) | MIT；星河战队式虫群敌人；默认仅沙漠/恶地生成，经 `kubejs/data` 生物群系标签扩展到金星/水星/霜原星，In Control 在月球/火星拒绝并在主世界限流；依赖 AzureLib |
| Easy Villagers | neoforge-1.21.1-1.1.42 | [Modrinth](https://modrinth.com/mod/easy-villagers) | 许可证为保留所有权利，分发方式需确认；自动输入输出、漏斗/BC 管道/AE2 对接、村民 NBT 保留、多人、大量设施性能 |
| Guard Villagers | 2.4.12 | [Modrinth](https://modrinth.com/mod/guard-villagers) | 自定义许可证；护甲/武器槽、巡逻 AI、团队与炮塔友军识别、怪潮互动、外星环境、大量守卫性能 |
| TaCZ（非官方 NeoForge 移植） | 1.1.8-hotfix-r6 | [Modrinth](https://modrinth.com/mod/tacz-1.21.1) | GPL-3.0-only；非官方移植质量基线、枪包格式、武器数据配置、弹药/附件、爆头与护甲计算、服务端 MSPT 与客户端 FPS |
| Guard Villagers TACZ Support | 1.0.1 | [Modrinth](https://modrinth.com/mod/guard-villagers-tacz-support) | MIT；元数据声明客户端不支持（服务端/单人）；索敌、射击、耗弹、Ammo Box、找弹药/食物、射界、友军识别、Zombie/Pillager 持枪能力逐项实测 |

## 体验辅助候选

下列模组不进入科技树、不产生新路线，仅降低操作负担。装载侧依据各文件 `neoforge.mods.toml` 依赖声明记录。

| 模组 | 本轮找到的候选 | 装载侧 | 职责与边界 | 仍须验证 |
| --- | --- | --- | --- | --- |
| Polymorph | 1.1.0+1.21.1 | 双端 | 仅作配方冲突的最后安全网；KubeJS 能修的冲突仍须主动修复，不用它掩盖整合问题 | 与工作台及机器配方选择界面的共存 |
| Controlling | 19.0.5（依赖 Searchables） | 客户端 | 大型整合包按键冲突检索 | 与各模组自带键位界面共存 |
| Mouse Tweaks | 2.26.1 | 客户端 | 物品拖拽交互 | 自定义容器界面兼容 |
| Crafting Tweaks | 21.1.11（依赖 Balm） | 双端 | 合成台交互优化 | 与自定义合成界面共存 |
| AppleSkin | 3.0.9 | 客户端 | 食物饱食度与效果展示，配合农业后勤路线 | 与农夫乐事数值一致 |
| Jade Addons | 6.1.1（依赖 Jade ≥15.10） | 双端 | 补充工业机器、仓储与能源信息展示 | 各模组方块信息提供器的覆盖范围 |
| Carry On（可选候选） | 2.2.6.13 | 双端 | 搬运方块；启用则必须配置黑名单 | 核反应堆、大型储罐、ME 存储核心、带能源/库存的关键工业设备、特殊 Ad Astra 设施、可绕阶段设备一律禁止搬运 |
| EMI | 1.1.24+1.21.1+neoforge | 客户端 | 默认配方/物品浏览界面；内建 JEMI 层将 JEI 插件配方导入 EMI | 已实测：客户端连上独立服务器后 JEMI 载入 80 个 JEI 配方分类（含 IC2CRE 金属成型机/洗矿/感应炉/电力高炉、BC CE Assembly/Integration/Programming Table、IE 电弧炉/合金窑/工程装配台、IP 蒸馏塔/焦炭塔/高压精炼、Ad Astra NASA 工作台/氧气装载机/燃料加注器/凛冰冻结装置、TaCZ 枪械/弹药/配件工作台、Railcraft 焦炉/高炉）；AE2、Sophisticated Core/Storage/Backpacks、Farmer's Delight、KubeJS、ProgressiveStages、Railcraft、Supplementaries、FramedBlocks、FTB Library 走 EMI 原生插件，合计烘焙 63630 条配方。JEI 保留装载。注意：JEI 19.57 的列表开关 `overlayEnabled` 是内存态（`ClientToggleState`，字节码核实），官方关闭方式是进世界后按 Ctrl+O（`key.jei.toggleOverlay`），状态不跨重启持久化——无配置项可默认关闭，文档如实记录 |
| Xaero's Minimap | 26.5.0（内嵌 xaerolib） | 双端 | 小地图与路径点；服务端组件提供世界识别与强制配置 | 实体雷达与洞穴模式由服务端 `server_profiles/default.cfg` 强制关闭；客户端默认配置同值 |
| Xaero's World Map | 1.46.0（内嵌 xaerolib） | 双端 | 世界地图、路径点列表、维度独立存档 | 同上，洞穴模式/小地图雷达经服务端强制配置关闭 |
| Inventory Profiles Next | 2.2.5（依赖 libIPN 6.6.3 + Kotlin for Forge 5.12.0） | 客户端 | 库存/容器排序、快捷栏自动补给 | 默认仅保留 GUI 排序按钮与中键排序；其余热键经 `inventoryprofilesnext/inventoryprofiles.json` 置空；排序只在容器 GUI 上下文生效，自带 AE2/Sophisticated/IE 集成提示 |
| Shulker Box Tooltip | 5.1.9+1.21.1 | 客户端 | 悬停简洁提示，Shift 展开完整内容 | `preview.alwaysOn=false` 上游默认即所需行为，不发额外配置 |
| BetterF3 | 11.0.3（依赖 Cloth Config 15.0.140） | 客户端 | 精简调试界面 | 默认模块集待实测修剪 |
| Better Ping Display | 1.1 | 客户端 | Tab 列表数字延迟 | 无键位 |
| Chat Heads | 0.15.7 | 客户端 | 聊天栏头像 | 无键位；已实测处理聊天事件 |
| 3D Skin Layers | 1.11.3 | 客户端 | 皮肤 3D 分层 | tr7zw 许可允许官方渠道分发；与 CustomSkinLoader 共存已加载，实际渲染待人工目检 |
| CustomSkinLoader | 15.0.1 Universal | 客户端 | 第三方皮肤源 | GPL-3.0；Bootstrap 变换服务实测加载，与 3D Skin Layers 共存无冲突日志；皮肤实际拉取待人工目检 |
| Default Options | 21.1.8（依赖 Balm） | 客户端 | 首次安装默认键位/选项下发 | 只改仍为出厂默认的键位，不覆盖玩家已改设置；`config/defaultoptions/keybindings.txt` |

性能与运维层候选的分侧记录见[性能层](performance.md)。

## 键位整理（Controlling 已装，首装默认经 Default Options 下发）

实测冲突修复（上游默认 → Starforge 默认）：Xaero 新建路径点 `B→N`（B 留给 Sophisticated Backpacks 打开背包）、路径点列表 `U→J`（U 留给 EMI/JEI 的 Uses）、放大地图 `Z→解绑`（Z 为 TaCZ 配件拆装）、世界地图设置 `]` 解绑、小地图设置 `Y`、世界地图 `M` 不变。`R` 全程为 TaCZ 换弹：EMI/JEI 的 Recipe/Uses 只在 GUI 上下文触发，Building Gadgets 的 `R`/`G`/`U`/`H` 注册在"手持 gadget"的自定义冲突上下文，持枪时不生效。IC2CRE 的 `mode_switch`（原 `M`，UNIVERSAL 上下文）移至 `;`，`side_inventory`/`hud_mode`/`boost`（原 Left Ctrl，与疾跑冲突）解绑；Railcraft 机车 `mode/whistle/reverse` 移到方向键、`change_aura` 解绑；Easy Villagers `pick_up` 移至 `I`、`cycle_trades` 解绑；Supplementaries quiver 解绑；GuideMe 指南书 `G→F6`（G 留给 TaCZ 射击模式切换）；Ad Astra `open_radio→\`、`toggle_suit_flight→`` `；IE `magnetEquip` `S→=`（S 是后退键）；Immersive Petroleum `projector.flip` `M→-`。核心操作（WASD/E/Q/F/Shift/Ctrl/Space/数字栏）与 TaCZ 射击/瞄准/换弹/配件不改。

2026-09-22 干净首装验证：删除 `options.txt` 后启动，Default Options 载入并应用全部 22 条默认（0 错误，日志 `Applied 22 defaults to key mappings (20 keys were reconfigured)`），生成键位与上表一致。对生成结果做全量重复键扫描，剩余同键组合全部为上下文隔离（JEI 键仅在 JEI GUI、FTB Quests 编辑键仅在任务界面、CraftingTweaks 仅在合成 GUI、Sophisticated 自带 `BackpackKeyConflictContext` 仅在容器界面、Railcraft 机车键仅在乘车、Building Gadgets 仅在手持 gadget）或修饰键不同（`Alt+T`/`Alt+X`/`Alt+Z`/`Ctrl+O`），无实际影响冲突。

TaCZ Pack Upgrader 2.1.3（LGPL-3.0-or-later）仅在确实使用旧版 1.20.1 TaCZ 枪包时加入，不默认安装。Guard Villagers TACZ Support 的必需前置为 Guard Villagers 与上述 TaCZ 移植版；Easy Villagers 的 The One Probe / JEI / Jade 为可选前置。

Modrinth 数据使用官方 `/v2/project/{slug}/version` 接口并同时筛选 `game_versions=["1.21.1"]` 与 `loaders=["neoforge"]`，不是只看文件名。IC2CRE 的发现过程使用百科定位作者仓库，最终版本判断依据作者发布说明。BuildCraft CE 在不同托管页存在进度差异，本设计引用 BCCE-team，实施时必须确认发行来源与资产身份。

## 需要单独交付的适配

| 编号 | 能力 | 首选实现 | 明确边界 / 降级 |
| --- | --- | --- | --- |
| A01 | 配方、标签、掉落统一 | KubeJS + 数据包，绑定实际序列化类型 | `event.custom` 不能修改所有硬编码逻辑；不可覆盖项用公共 API 小型附属 |
| A02 | 阶段同步与制造限制 | ProgressiveStages 实测支持 + 团队桥接 | 不把“隐藏配方”当锁；无人机器、原版合成器、AE2 样板分别验收 |
| A03 | 双语阶段/任务界面 | 原生可翻译组件或对应版本官方语言格式 | 任意字符串字段未必自动翻译；不支持时增加 UI 适配或停用该原生提示 |
| A04 | 基地威胁与按基地怪潮 | 有界事件累计 + The Hordes 接口 | 无现成接口则需要窄范围附属；固定波次只是原型 |
| A05 | 工程兵预算/区域权限 | 事件实体标记 + AI 钩子 | Mod 只支持全局开关时，不能假称能区分每只工程兵 |
| A06 | 空间站零自然敌对与事件豁免 | In Control! + 生成/转移统一检查 | 白名单按事件 UUID，不按物种永久开放 |
| A07 | 弹药、供能与维修 | 原生物品/能源 capability；必要时输入适配器 | 无弹药槽就无法直接用 AE2 补弹；无耐久不假定存在维修 |
| A08 | 火星虫群/霜原大型生物 | 先筛核心模组实体，再确定窄范围内容适配 | 贴名和加血不能替代体型、模型、AI 和战术；不引入完整新 RPG 模组 |
| A09 | 火箭、站点建造、地球航天材料 | 可覆写配方/建造规则与燃料绑定 | 不保证航行、自动货运、空间站耗材都是普通配方 |
| A10 | 厨房、锅具、AE2 自动补给 | 对真实库存面逐项测试并连接缓冲箱 | 不承诺懒人厨房自动完成切菜板和锅具的全部工序 |
| A11 | 统一石油经济 | 导出 BC 与 IP 流体、流体标签和配方比对，优先原生标签互通 | 两套各自产油互不认可即未达标；必须桥接时用 KubeJS/数据包，不猜 fluid ID |
| A12 | 实体仓储接入 AE2 | 各仓储控制器 + AE2 存储总线实测 | 不假定单一控制器统管两套仓储；总线读不到的内容另列适配 |
| A13 | Carry On 黑名单（若启用） | 配置黑名单 + 复现测试 | 无黑名单不进默认配置；搬运不得复制库存/能源或绕过阶段限制 |
| A14 | 守卫外星环境保护 | 实测 Ad Astra 航天服对 NPC 生效；不生效则小型兼容层（完整航天服 + 有效供氧 → 对应环境保护） | 无法可靠实现时外星守卫限定已供氧/已密封区域；不因能穿上就宣称能在真空生存 |
| A15 | 枪械伤害与护甲计算 | 实测 TaCZ 爆头/护甲/穿透与 IE/IC2/Ad Astra 护甲互动 | 不正确则记兼容问题，必要时 Starforge Combat Compatibility 小适配层；不批量改装备基础护甲值 |
| A16 | 守卫弹药与食物补给 | 实测 TACZ Support 原生箱子/木桶找弹药、Ammo Box、低血量找食物 | 优先用原生机制，不重复开发 NPC 补弹 AI；原生缺失再列适配 |
| A17 | 敌方持枪单位配额 | 事件池配置 + In Control!/适配层限制枪手比例与枪械参数 | 禁止自然怪随机配枪；超过预算上限即未达标 |
| A18 | 岗位工作站与基地绑定 | 工作站注册基地 UUID + 低频摘要读取 | 不逐 tick 扫描机器；岗位效果不跨基地生效 |
| A19 | 岗位效率增益 | 原生 API/配置 → KubeJS/数据包 → 小型适配层 | 机器速度不可安全修改时转为维护/副产物/提示收益；不为小增益 Mixin 整个机器系统 |
| A20 | 村民岗位数据完整性 | Easy Villagers 打包/放回岗位保留、Guard Villagers 换岗、NBT 与多人同步实测 | 岗位丢失、战斗 AI 残留或数据错配均记为未达标 |

优先减少适配范围，能以原生配置与配方实现的不再造系统。但用户要求的“真实工业规模驱动怪潮”“可靠安全空间站”“完整阶段 i18n”如果超出现成接口，就必须把附属开发作为实施工作，不能宣称仅靠 KubeJS 已全部解决。

## 前置与发布侧

FTB Quests 的作者页面明确指出 KubeJS、JEI 等集成需要 FTB XMod Compat；版本锁定时同时解析 FTB Library、FTB Teams 等实际依赖，不能仅凭核心模组名单装包。[FTB Quests 说明](https://www.curseforge.com/minecraft/mc-mods/ftb-quests-forge)

其余库以选定文件元数据为准递归解析，不从其他 Minecraft 版本抄前置。本轮新增候选已从文件元数据解析出前置：Sophisticated Core（Sophisticated Storage/Backpacks）、Balm（Crafting Tweaks）、Searchables（Controlling）、Jade（Jade Addons）、Placebo（FastSuite）、Almanac（Let Me Despawn）；锁定时递归复核完整闭包。IC2CRE 已把 Energy Core 合入主体，API JAR 仅用于编译，不能当运行模组；1.21.1 的 Energy Control 子附属状态不能按 26.1.2 推断。[IC2CRE 发布说明](https://github.com/BigFish520/IC2-CRE/releases)

默认配方查看器为 EMI（客户端侧），JEI 保留装载作为 API/插件兼容层（ftb-xmod-compat、BC CE、IC2CRE 等依赖其插件注册）。客户端放渲染与 UI 模组；公共内容、KubeJS 逻辑/资源、任务定义由同一构建源生成。服务端不加载纯客户端渲染依赖，客户端与服务器逻辑内容哈希必须一致。

## 实测记录（2026-09-22）

- 独立服务器：NeoForge 21.1.251 启动正常，RCON/spark 可用，`neoforge tps` 显示全部 17 个维度（Overworld、Nether、End、Ad Astra 五星球 + 全部轨道、Asteroid Belt + Orbit、Spatial Storage）20 TPS、总 ~8 ms/tick（有玩家在线）。
- 维度生物群系定位全部成功（`ad_astra:*` 九个、 `pv_asteroid_belt:asteroid_belt` 等），结构定位成功（`ad_astra_more_structures` 五座塔/竞技场、平原村庄、要塞）。
- 客户端（Prism 干净实例）：首装默认键位全量生效 → `--quickPlayMultiplayer` 直连服务器成功（`RabiTest joined the game`）→ EMI/JEMI 载入 80 个 JEI 分类 + 原生插件，烘焙 63630 配方。
- **已知风险（如实记录）**：在 Venus/Glacio 用 `/place feature` 强制放置 Immersive Petroleum 油藏特征时，`FeatureReservoir.scanChunkForNewReservoirs` 在异步区块生成中持锁自递归请求区块，单 tick 超 120 秒触发 watchdog 终止（crash-report 栈见 `run/server/crash-reports/`）。自然世界生成与正常游玩未触发该路径；`immersivepetroleum-server.toml` 的 `regenerate_missing_reservoirs` 已是 `false`。该问题判定为 IP 世界生成实现缺陷，与 Fast Noise / Structure Layout Optimizer 无关（栈上无二者帧）。禁止在联机服务器上强制 place IP 油藏特征；是否换用修复版本待上游 1.21.1 构建确认。

发行前从作者渠道锁定下载地址、版本、文件大小、SHA-512/SHA-256、游戏范围、加载器范围、依赖、装载侧及分发方式。当前表是设计候选表，不能直接改名成安装 manifest。先做最小 IC2/BC/IE 验证，再逐组加入其余内容。
