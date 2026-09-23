# 性能层与运维工具

本文件记录性能候选的装载侧、解决的问题与验收要求。所有性能结论必须通过 spark 实测 MSPT、实体与区块统计得出，不凭感觉宣称“优化”。怪潮事件自身的预算、实体上限与降级规则见[攻防与殖民](defense-and-colonies.md)的性能预算一节。

## 分侧原则

- 服务端只安装双端或服务端模组；客户端渲染优化不进入服务端运行依赖。
- 不盲目堆叠：每个性能模组必须对应一个已记录的真实热点，移除无对应问题的项。
- 客户端清单允许在不改变逻辑内容的前提下调整纯客户端模组，但发行默认集必须实测。

## 通用 / 服务端候选

| 模组 | 本轮找到的候选 | 装载侧 | 解决的问题 |
| --- | --- | --- | --- |
| ModernFix | 5.27.24+mc1.21.1 | 双端 | 启动时间、内存与资源加载开销 |
| FerriteCore | 7.0.3 | 双端 | 方块状态与模型的内存占用 |
| ServerCore | 1.5.19+1.21.1 | 双端（服务端用途） | 动态实体/激活距离与杂项服务端开销 |
| FastSuite | 6.0.7（依赖 Placebo） | 双端 | 大量配方下的配方匹配开销 |
| Let Me Despawn | 1.5.0（依赖 Almanac；依赖声明为服务端侧） | 服务端 | 避免怪潮与工程兵留下不正常的永久实体 |
| Clumps | 19.0.0.1 | 双端 | 大规模战斗后合并经验球，减少实体数量 |
| Fast Noise | 1.0.13+1.21.1（modid `zfastnoise`，MPL-2.0） | 双端 | 世界生成噪声计算开销；上游声明与 moonrise/antixray 不兼容（均未装）。已随服务器+客户端实测加载，维度/生物群系/结构定位正常；**尚未做同种子开关对比，不能宣称生成结果逐块一致** |
| Structure Layout Optimizer | 1.0.12（依赖 resourceful-config，已装） | 双端 | 结构/Jigsaw 布局匹配开销；Ad Astra 各星球结构定位实测正常 |
| AllTheLeaks | 1.1.13+1.21.1（CurseForge 独占） | 双端 | 已知模组/MC/NeoForge 内存泄漏修复集；遵守上游版本守卫，与 ModernFix 重叠项由其守卫逻辑自动跳过（实测日志按版本范围逐条判定加载） |

## 客户端候选

以下均为客户端优化，不放入纯服务端运行依赖。

| 模组 | 本轮找到的候选 | 解决的问题 |
| --- | --- | --- |
| Sodium | 0.8.13+mc1.21.1 | 渲染管线重写；其元数据声明与 Embeddium 不兼容，二者不共装 |
| ImmediatelyFast | 1.6.14+1.21.1 | 文本与界面渲染开销 |
| Entity Culling | 1.11.2 | 不可见实体的渲染剔除 |
| Dynamic FPS | 3.11.4 | 后台与失焦时的帧率限制；默认聚焦不限帧、失焦 30、最小化 10（`pack/config/dynamic_fps.json`） |
| Mem Leak Fix GPU | 1.8+1.21.1（modid `gpumemleakfix`，MIT） | 客户端 RenderTarget/VRAM 泄漏清理；延迟队列释放，无强制 GC。与 Sodium+ImmediatelyFast 同实例实测加载无渲染错误日志；VRAM 长期表现仍需游玩观察 |
| Iris | 1.8.14-beta.1+1.21.1-neoforge（LGPL-3.0-only） | 光影加载器，默认光影的运行时依赖 |
| MakeUp - Ultra Fast | 9.5e（LGPL-3.0-or-later，Modrinth `izsIPI7a`） | 默认光影包本体；非模组，`shaderpacks/` 资源经 .mrpack 官方 URL + hash 下发 |

## 默认光影方案（MakeUp - Ultra Fast）

Starforge 默认启用 **MakeUp - Ultra Fast 9.5e** 作为轻量光影。选型目标是工业基地、怪潮和多星球探索场景下的画质/性能比，而不是电影级画质展示；优先级为**稳定性 > FPS > 模组兼容性 > 视觉效果**。

| 组件 | 锁定版本 | 侧 | 角色 |
| --- | --- | --- | --- |
| Sodium | `mc1.21.1-0.8.13-neoforge`（release，2026-08-28） | client | 渲染管线重写 |
| Iris | `1.8.14-beta.1+1.21.1-neoforge`（beta，2026-06-13） | client | OptiFine 格式光影加载 |
| MakeUp - Ultra Fast | `9.5e`（release，2026-09-05） | client（`shaderpacks/`） | 光影包 |

**为什么是 Iris beta**：Sodium 0.8.x 系列要求 Iris ≥1.8.13；1.21.1+NeoForge 上满足这一点的只有 1.8.14-beta.1（"Updates to Sodium 0.8"）。最新稳定 Iris 1.8.12 锁定 Sodium 0.6.13，而 Supplementaries 3.9.9 的 `neoforge.mods.toml` 声明 `sodium [0,0.8.12-beta.1)` 为 **incompatible**（其 `CompatSodiumFluidRendererMixin` 依赖 Sodium 0.8 API）——NeoForge 对 `incompatible` 的处理是阻止加载，不是警告。因此本包不存在"全稳定"的 Iris+Sodium 组合，按既定规则采用唯一可行方案：Sodium 0.8.13 + Iris 1.8.14-beta.1。不安装 Oculus/Embeddium 等重复或冲突加载器（Iris 自身声明与 Embeddium 不兼容）。Iris 若发布 1.8.14+ 正式版，重新解析时会自动升级（`version_prefix: "1.8.14"`）。

**默认启用与配置**：`pack/config/iris.properties` 随 .mrpack overrides 下发 `enableShaders=true` + `shaderPack=MakeUp-UltraFast-9.5e.zip`；`pack/shaderpacks/MakeUp-UltraFast-9.5e.zip.txt` 锁定官方 `profile=low`（阴影开：Low 质量/Short 距离、AO、TAA、Bloom、体积云、深度 godrays、折射、太阳反射、植物摆动全部保留）并把 `REFLECTION_SLIDER` 降到 `1`（flipped image，代替耗时的 raymarching SSR）。彩色阴影、DoF、动态模糊、色差、材质高光在该 preset 下均关闭。

**玩家可自行**：视频设置 → Shader Packs 中整体关闭光影（关闭后走纯 Sodium 渲染，不影响内容与存档）、切换 MakeUp 内置 `no_effects`/`shadowless_low~high`/`low`/`medium`/`high`/`extremeplus` 官方档位或逐项微调。

**待实机验证**（未在本轮执行，发现问题先降级处理）：
- IC2CRE / BuildCraft / Immersive Engineering 动态机器模型、AE2 网络方块在光影下的渲染
- TaCZ 枪械模型与瞄具（光影下手持/第一人称渲染常见偏差）
- Ad Astra 各维度天空盒（地球/月球/火星/小行星带）与行星渲染
- TACZ Turrets 弹幕/索敌、EOS 高射速与 AoE 武器（MG-85、M-57CWX2、ELP-72/52 电浆、四叶十字、艾莲娜之钉等）与 The Hordes 怪潮下的粒子表现、夜间工业基地观感
- 方块半透明/发光渲染、shader compile error、Iris compatibility warning、黑白屏

## 测试后决定

| 模组 | 本轮找到的候选 | 状态与启用条件 |
| --- | --- | --- |
| Lithium | 官方 NeoForge 0.15.4+mc1.21.1（CaffeineMC，2026-06） | **保持 `enabled: false`——实测不兼容**。2026-09-23 全量实例 A/B：启动通过（与 ModernFix 重叠 patch 自动跳过、无 FATAL），但首个 `getEntitiesOfClass` 实体查询即崩——Lithium `EntityClassGroup` 反射分析类层次时触到 TaCZ 客户端类 `com.tacz.guns.client.resource.GunDisplayInstance`，`RuntimeDistCleaner` 在 `Guard.tick` 内抛异常崩服（`run/smoketest` 崩溃报告 21.59.53）。可在 `lithium.properties` 关 `mixin.chunk.entity_class_groups` 规避，但未经完整矩阵验证前不默认启用 |
| Async Locator Refined | `async-locator-refined`（Alvaro842DEV 维护，MIT，1.21.1 NeoForge） | 新增候选。把 `/locate`、藏宝图与海豚寻路结构搜索移出主线程；无游戏逻辑变化。首个待测项：与 Structure Layout Optimizer + Ad Astra 结构共存验证定位结果正确性 |
| BadOptimizations | 2.2.2（MIT，1.21.1 NeoForge） | 新增候选（client）。lightmap 更新缓存、天空色采样、空闲 debug renderer 跳过；与 Sodium+Iris+ImmediatelyFast 同实例验证无视觉异常后可启用 |
| Alternate Current | 1.9.0（1.21.1 NeoForge） | 新增候选。重写红石粉更新顺序为**非位置序**——这是行为变化而非纯优化。仅当 spark 证明大型基地红石为主热点时才测试；启用前必须重测 AE2/IE/BC/Railcraft 布线、horde_alarm 信号与全部红石装置 |
| ScalableLux | 1.21.1 NeoForge 仅有 alpha/devbuild（无稳定版） | 新增候选。Starlight 系光照引擎替换 + 并行光照更新；仅在区块生成/光照被证明是瓶颈且 Fast Noise 收益不足时单独特测，不叠加 |
| Noisiumed | 3.0.2（GPL-3.0-only，1.21.1 NeoForge） | 新增候选。区块生成 fast path，宣称输出与原版逐块一致。与 Fast Noise 目的重叠——只做 A/B 比较不盲叠，启用前做同种子四维世界生成一致性检查 |

## CPU 主线程专项（2026-09-23）

本轮按“减少无意义的工作，不削减玩法”原则落地。上游源码事实经 jar 反编译核实，不以印象写结论。

### 已落地的配置与基线

| 位置 | 修改 | 理由 |
| --- | --- | --- |
| `config/guardvillagerstaczsupport-common.toml` | `ammo/food_search_radius` 64→20；`ammo_search_cooldown` 100→300；`food_search_cooldown` 100→400；`container_reach_timeout` 400→200；`low_food_health_threshold` 18→10 | 上游每次补给搜索以 `BlockPos.withinManhattan` 遍历 `(2r+1)³` 并逐格 `getBlockEntity`：半径 64 ≈ 每次搜索约 140 万次方块实体查询，是殖民地最大已知单实体热点；半径 20 ≈ 4.6 万次（约 30×）。失败冷却加长，超时容器更快放弃 |
| `config/guardvillagers-common.toml` | `Range` 50→32；工作站巡逻 `false`（自然巡逻本就关闭） | 50 格村民受击保护扫描是守卫侧第二大开销；哨兵制下 32 格覆盖整个哨位庭院。工作站游荡让每名守卫持续跑村庄级 POI 搜索+寻路重算 |
| `config/servercore/config.yml` + `optimizations.yml` | 新增完整基线 | 见下 |
| `tools/setup-server.mjs` | `server.properties` 写入 `view-distance=10`、`simulation-distance=8`、`sync-chunk-writes=false`、`max-tick-time=-1` | 不再依赖原版默认值；worldgen 挂死类问题用 spark 调试而非 watchdog 崩服 |
| 同文件 `user_jvm_args.txt` 基线 | `STARFORGE_HEAP`（默认 6G）+ G1GC + `ParallelRefProcEnabled` + `DisableExplicitGC` | 见“JVM 与内存”一节 |

### ServerCore 基线

`dynamic.enabled=true`，`target-mspt=40`（p95 预算 45ms 之前开始降级）。降级顺序：`CHUNK_TICK_DISTANCE 10→6` → `MOBCAP_PERCENTAGE 100→50` → `SIMULATION_DISTANCE 8→6` → `CHUNK_TICK_DISTANCE 6→3` → `MOBCAP 50→30` → `VIEW_DISTANCE 10→6`。先砍纯 CPU（区块 tick），再砍自然刷怪，最后才动玩家可见的视距。
`activation-range` 保持 `enabled:false`——守卫、炮塔、列车、Boss、事件怪、投射物都需要豁免清单后才敢开；`lobotomize-villagers`、`breeding-cap` 同因关闭，留作后续杠杆。`optimizations.yml` 仅启用上游默认已开的 `reduce-sync-loads` 与 `cache-ticking-chunks`（后者与 Moonrise 不兼容，本包未装 Moonrise）。

### starforge_compat 性能层（mixin，随本仓构建）

| 目标 | 上游实测行为（反编译） | 本层改动 |
| --- | --- | --- |
| TACZ Turrets `TurretEntity` | 两个 Nearby* 传感器按 20t 平铺扫描（首次 tick 对齐 → 同区块加载的炮塔永久同相扫描）；`spreadTargets` 每 10t 两次 `getEntitiesOfClass`（范围≤射程） | `getSensors` RETURN 注入：无目标时按 `5+id%10` tick 获取目标（文档要求约 5t），已有目标时 `60+id%10` 复用；`spreadTargets` 改为 `(tickCount+id)%20`，批加载炮塔按实体 id 错峰且频率减半 |
| Guard Villagers TACZ `TaczGunAttackGoal` | 每守卫容器缓存未命中 → 全半径 Manhattan 扫描 | HEAD 注入先查 `SupplyPointData`（SavedData，逐维登记已证实含弹/食的香草容器；命中前逐一活体验证）；RETURN 注入把上游扫描成果回写注册表。不走假物流：登记只省“找”的开销，不省“有”的验证 |
| The Hordes `HordeTrackPlayerGoal` | 每怪随机初始化重算倒计时（上游已错峰），固定重置为 `hordePathingInterval`（25） | 重定向 `ConfigValue.get`：MSPT≤40→25，>40→≥40，>45→≥60（`ServerLoad` 读 `getCurrentSmoothedTickTime`） |
| The Hordes `HordeEvent.spawnWave` | 事件期间按间隔生成新波次 | HEAD 注入：平均 MSPT>45 时跳过本波次——只停新波，绝不动场上怪/Boss |

### KubeJS tick 审计结论

全脚本中只有 `starforge_guidance.js`（生成文件）含周期任务：维度到达 20t、外星神器 40t、任务完成 200t——原来全部按 `server.getTickCount() % N` 同相对齐，多人同 tick 集体执行。已改为 `(tickCount + entityId) % N` 错峰；外星神器检测新增 `inventoryChanged` 事件驱动主路径（40t 轮询降为兜底）；FTB Quests 完成事件在 architectury 内部事件总线而非 NeoForge bus，KubeJS 无法订阅——保留错峰轮询。其余脚本（horde/compat/dump/stagetest/recipes/unify/fluids）均为事件驱动或启动一次性，无每 tick 扫描。

### spark 压力测试矩阵（验收协议）

每场景跑 `/spark profiler --timeout 120` + `/spark health --memory` + `/tps`，记录 TPS、MSPT p50/p95/p99、entity tick、AI/pathfinding、block entity、chunk tick、worldgen、GC、活跃实体数、加载区块数。目标：20 TPS、MSPT p95 < 45。

| # | 场景 | 构造 |
| --- | --- | --- |
| A | 空基地基线 | 已加载区块，无工业/驻军 |
| B | 大型工业基地 | IC2/IE 机器阵列 + BC 管道 + AE2 网络运行 |
| C | 32 名 Guard Villagers | 持 TaCZ 枪在岗哨+巡逻点，含弹药/食物补给容器 |
| D | 16–32 座 TACZ Turrets | 有弹有目标可打 |
| E | 48 怪怪潮 | `hordeSpawnMax=48` 完整事件 |
| F | C+D+E 同时 | 守卫+炮塔+怪潮并发 |
| G | AE2 自动合成 + BC 管道 + IC2/IE | 持续合成与物流 |
| H | Railcraft 长编组 | 长列车 + 装卸站运行 |
| I | 两殖民基地同载 | 双殖民地强加载 |
| J | 高速新区块探索 / Chunky 预生成 | 主世界、月球、火星、小行星带分别测 |

基线参照（2026-09-22）：独立服务器 17 维度全部 20 TPS、总 8.0 ms/tick（一玩家在线）。

### 已采集数据（2026-09-23，smoketest 实例，83 模组，Java 21）

| 场景 | 结果 |
| --- | --- |
| A 空基线（fresh world，无玩家） | TPS 20.0；tick min/med/p95/max = 0.3/0.5/0.8/59.2 ms（59ms 为启动残留尖峰） |
| C+D 守卫+炮塔 | 29 持枪守卫（TaCZ AK47、无弹药→补给搜索路径激活）+ 16→8 炮塔 + 20 husk 目标：TPS 20.0；tick 2.5/3.2/5.0/15.1 ms；守卫击杀全部 husk（战斗链路完整）；弹药箱 2 个在位供注册表命中 |
| J Chunky 预生成（半径 400，~2601 chunks/维） | 主世界 2:24（18.1 cps）；月球 1:43（25.2 cps）；火星 1:35（27.4 cps）；小行星带 0:32（81.3 cps）。生成期 1min 窗 p95 25.6–42.6ms、max 116ms，TPS 全程 20.0——世界生成走 worker 线程，主线程尖峰在区块装载 |
| Lithium A/B | 见上表结论：启动 OK、空转 OK、首个实体范围查询崩（TaCZ client-class 泄漏），**禁用维持** |

无头限制：怪潮事件需在线玩家目标（`/hordes start`/`spawnWave` 静默拒绝），工业/列车/殖民场景需要真实基地与玩家操作——B、E、F、G、H、I 留给玩家侧测试，协议照上表执行。

## JVM 与内存

- Java 21，保留默认 **G1GC**；不堆叠来源不明的“神奇参数”。
- 基线 `-Xms6G -Xmx6G`（`setup-server.mjs` 生成，`STARFORGE_HEAP` 覆盖）。**升 8G 的条件**：≥4–6 名常驻玩家、两个殖民基地同时加载、AE2 大网络+长列车组合常驻，或 spark `health --memory` 显示老年代占用持续 >70%/GC 频率明显升高。12–16G 不是优化——大堆拉长 G1 remark/mixed GC 尾部，反而恶化 p99。
- 附带参数及理由：`-XX:+UseG1GC`（钉死默认值防 vendor 差异）；`-XX:+ParallelRefProcEnabled`（引用处理并行化，削 block-entity 密集存档的 remark 尾部）；`-XX:+DisableExplicitGC`（个别模组仍调 `System.gc()`，一次 Full GC 就是 >200ms 尖刺）。
- 不启用 ZGC/Shenandoah：模组生态对非分代式低延迟 GC 的兼容性证据不足，且无对应热点。

## 服务器运维工具

| 工具 | 本轮找到的候选 | 用途边界 |
| --- | --- | --- |
| spark | 1.10.124 | 分析 MSPT、实体 AI、机器、管道、AE2 与炮塔的真实开销；所有调参以其报告为依据 |
| Chunky | 1.4.23 | 仅作服务器管理/预生成工具，预生成地球及主要殖民区域；不作为普通玩家科技内容 |

## Starforge 真实热点

- 怪潮实体数量与 Zombie Break & Build 的寻路/拆搭检查
- TACZ Turrets 的索敌、容器取弹与弹道 tick；EOS 高射速武器的弹丸/粒子生成速率
- 殖民 NPC：居民/守卫寻路、索敌、找弹药/找食物、TaCZ 弹道与投射物、岗位工作站的基地摘要更新
- AE2 大型网络与自动合成
- BC 管道实体运输
- IC2 / IE 工厂机器 tick
- 多殖民地区块加载与 Ad Astra 多维度探索
- Railcraft 列车实体 tick（长编组 + 装卸站）、WorldSpike 强加载区块数（唯一强加载源，T4 阶段锁；`railcraft-server.toml` 无开关）、高速轨 `highSpeedTrackMaxSpeed`（默认 1.0，如 chunk 加载跟不上可调低）
- Asteroid Belt 世界生成：jigsaw 小行星结构 + 两套维度；实测 Chunky 预生成 500 格半径 4225 区块约 32 秒，spark 采样已留存
- 两个 Ad Astra 结构模组（More Structures + Simple Structures）同维度共存的结构密度与战利品开销
- Immersive Petroleum 油藏特征：`/place feature` 强制放置会在 `FeatureReservoir.scanChunkForNewReservoirs` 的区块递归中挂死 watchdog（详见 compatibility.md 实测记录）；自然生成未见触发，但列为世界生成风险项
- 2026-09-22 基线：独立服务器 17 维度全部 20 TPS、总 8.0 ms/tick（一玩家在线）；客户端进服 + EMI 烘焙 63630 配方 ~17s，无渲染异常日志

## 运行原则

- 怪潮存在实体硬上限；服务器卡顿期间积压的怪潮不补发。
- 不无限加载殖民区块；常驻加载设上限，超出部分依靠补给缓存而非强加载。
- 装饰方块不产生大量持续 tick；高频 tick 设备必须有明确职责。
- 大宗物流优先使用 BC 管道、AE2 网络等成熟方案，不用海量漏斗硬堆。
- 多星球结构（More Structures 等）密度必须受控。
- 后台基地有降级策略：无人加载时以摘要模式停产线、保留生命保障，而非全套设备空转；未加载殖民地的居民与守卫不跑完整 AI、不巡逻、不找弹药、不强加载区块。
- 殖民基地使用少量明确巡逻点，不让大量 NPC 全图自由寻路；若 Guard Villagers 某类巡逻 AI 实测开销异常，默认关闭或限制。
- 性能指标以 spark / MSPT 实测为准；未测量前不写“已优化”。

## 守卫与枪械基准

设计目标人口（非模组硬限制）：小型前哨 2–8 个活动居民/守卫，中型 8–20，大型 20–40。以下矩阵在完整实例上实测：

| 活动守卫数 | 状态 |
| --- | --- |
| 0 / 4 / 8 / 16 / 32 | 空闲、巡逻、普通战斗、TaCZ 持续射击、寻找弹药、大型怪潮 |

每格分别在 1 个基地与 2 个同时加载基地下记录：MSPT p50、MSPT p95、实体数量、AI 耗时、弹道/投射物耗时、客户端 FPS、内存。大型怪潮中大量枪械同时射击的服务端 MSPT 与客户端 FPS（粒子、声音、弹道）单独标注。

## 岗位工人基准

| 工人数 | 状态 |
| --- | --- |
| 0 / 4 / 8 / 16 / 32 | 空闲、工作站附近活动、工业运行、物流请求、与怪潮并行 |

记录 MSPT p50/p95、AI 耗时、实体寻路、工作站扫描耗时与区块加载。工作站基地摘要为低频更新（数秒至数十秒级，周期实测确定），不逐 tick 扫描机器；若 Guard Villagers 某类巡逻 AI 实测开销异常，默认关闭或限制。
