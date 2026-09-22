# RabiMew's Starforge · 星铸

Minecraft 1.21.1 / NeoForge 21.1.x 的工业科幻整合包，**Alpha（服务端可运行）**。

**制作者：RabiMew** · 原创内容采用 [MIT 许可证](LICENSE)。

**工业的目标，是维持不断扩大的生产、防御和殖民网络。** IC2CRE 提供核心科技，BuildCraft CE 承担工程物流，沉浸工程承担重工业，应用能源 2 在中后期接管复杂调度。

当前状态：**dedicated server 可在 Java 21 + NeoForge 21.1.251 上启动到 `Done`，71 个锁定模组零错误加载**；T0–T7 八阶段 ProgressiveStages 推进链（真实合成触发 + 计数器后备）已在运行时验证；SF-01..30 联动配方、统一石油流体桥（原油 8 种/燃料 22 种互通）、P2 防御配置层（Hordes/In Control/ZBB/TaCZ 守卫）已就位；T1 火箭地球闭环经配方图验证。客户端实机验证尚未进行。实测明细见 [实施状态](docs/implementation-status.md)。

| 内容 | 入口 |
| --- | --- |
| 科技树、七条专业路线、配方与资源经济 | [总体设计](docs/design.md) |
| 怪潮、星球生态、多人规则与性能预算 | [攻防与殖民](docs/defense-and-colonies.md) |
| 殖民人口、驻军、单兵军工与弹药后勤 | [殖民人口与驻军](docs/colonies.md) |
| 村民工业岗位、维护与后勤管理 | [殖民岗位与维护](docs/colony-workforce.md) |
| 标准战斗基准与 TTK 验收清单 | [战斗基准](docs/combat-benchmark.md) |
| 模组版本证据、能力边界与适配事项 | [兼容性核查](docs/compatibility.md) |
| 性能模组分侧、真实热点与验收原则 | [性能层](docs/performance.md) |
| i18n、任务导出、实施顺序和验收 | [实施与验收](docs/implementation.md) |
| 阶段、路线、任务和提示的语言键引用 | [内容目录](design/content.json) |
| 自定义中文 / 英文文本 | [简体中文](localization/zh_cn.json) / [English](localization/en_us.json) |

科技编号表示能力等级，不意味着所有玩家必须按 T0–T7 逐一体验：共同工业底座到达 T5 后，T6 航天殖民与 T7 地球量子工业分别发展；星际工业需要两者汇合。探索、农业与建筑始终有独立价值。Starforge 使用 Easy Villagers、Guard Villagers 与 TaCZ 构成轻量殖民人口及驻军体系，以工业生产和后勤支撑殖民防御，同时避免大型 NPC 城镇模拟成为服务器主要性能负担。

校验设计内容与中英文键是否一致：

```sh
node tools/validate-design.mjs
```

## 安装与启动（Alpha）

要求：Node.js ≥ 20、**Java 21**（Temurin 21 推荐；非默认 java 时设 `STARFORGE_JAVA` 指向 `java` 可执行文件）。

```sh
git clone <repo> && cd "RabiMew's Starforge"
node tools/setup-server.mjs
```

setup 会校验 Java 21、下载并安装 NeoForge 21.1.251 专用服务端到 `run/server/`、按 `manifest/locked-mods.json` 从官方来源（Modrinth CDN / CurseForge CDN / GitHub Releases / FTB Maven）下载全部锁定模组并校验哈希、同步 `pack/` 配置与 KubeJS 脚本、写入 eula 与基线 `server.properties`。第三方 jar 不入库，全部经 manifest 合法解析。

启动：

```sh
cd run/server
java @user_jvm_args.txt @libraries/net/neoforged/neoforge/21.1.251/win_args.txt nogui
```

无参验证：`node tools/check-mapping.mjs`（语义映射+阶段锁）、`node tools/check-closure.mjs <id...>`（地球生产闭环）、RCON 运行时阶段自测 `node tools/rcon.mjs stagetest`。

打包分发：`node tools/package.mjs` → `dist/starforge-alpha-*.zip`（不含第三方 jar）。

## 署名与许可

RabiMew's Starforge（星铸）由 **RabiMew** 制作。

Copyright (c) 2026 RabiMew。除另有注明外，本仓库原创设计文档、脚本、配置和本地化文本采用 [MIT 许可证](LICENSE)，允许使用、修改、再分发及商业使用；分发副本或重要部分时须保留版权与许可声明。

本许可不覆盖所引用或后续随整合包分发的第三方模组、库、纹理、模型、音效及其他外部素材。它们的作者署名和原有许可证保持有效，具体使用与分发遵循各自许可。
