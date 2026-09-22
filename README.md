# RabiMew's Starforge · 星铸

Minecraft 1.21.1 / NeoForge 21.1.x 的工业科幻整合包，**Alpha（服务端可运行）**。

**制作者：RabiMew** · 原创内容采用 [MIT 许可证](LICENSE)。

**工业的目标，是维持不断扩大的生产、防御和殖民网络。** IC2CRE 提供核心科技，BuildCraft CE 承担工程物流，沉浸工程承担重工业，应用能源 2 在中后期接管复杂调度。

当前状态：**dedicated server 可在 Java 21 + NeoForge 21.1.251 上启动到 `Done`，80 个锁定模组零错误加载**；T0–T7 八阶段 ProgressiveStages 推进链（真实合成触发 + 计数器后备）已在运行时验证；SF-01..34 联动配方、统一流体桥（原油 8 种/燃料 22 种/杂酚油 6 种互通）、P2 防御配置层（Hordes/In Control/ZBB/TaCZ 守卫）已就位；T1 火箭地球闭环经配方图验证。本轮新增 **Railcraft Reborn**（行星内重型铁路物流层）、**Ad Astra: Giselle Addon**（航天自动化扩展）、**Ad Astra: Asteroid Belt**（高风险采矿维度，T6）与 **Simple Structures: Ad Astra**（外星结构加密）。客户端实机验证尚未进行。实测明细见 [实施状态](docs/implementation-status.md)。

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

## 玩家安装（Alpha）

正式发布包是标准 Modrinth `.mrpack`：`starforge-alpha-<version>.mrpack`（见 GitHub Releases / `dist/`）。它声明 Minecraft 1.21.1 + NeoForge 21.1.251 与全部客户端模组的官方下载地址，可被 **Prism Launcher**、**HMCL**、**PCL** 直接导入——不使用任何启动器私有格式。

安装步骤（三个启动器通用）：

1. 下载 `starforge-alpha-<version>.mrpack`
2. 打开启动器，选择"导入整合包 / 新建实例 → 导入"
3. 选择该 `.mrpack` 文件
4. 等待启动器按清单下载模组（全部来自官方来源并经 hash 校验）
5. 启动游戏

> 第三方模组 jar 不随 `.mrpack` 分发；导入时由启动器从 Modrinth / CurseForge CDN / GitHub Releases / FTB Maven 等官方地址下载。个别仅有 CurseForge CDN 地址的模组在 `dist/client-package-report.md` 中逐条记录。

默认启用轻量光影 **MakeUp - Ultra Fast**（经 Iris 加载，导入时自动下载）：首次进游戏即生效，可在 视频设置 → Shader Packs 中随时关闭或切换画质档位；关闭后回退到纯 Sodium 渲染，不影响存档。细节见 [性能层](docs/performance.md)。

## 开发者客户端

要求：Node.js ≥ 20、**Java 21**（Temurin 21 推荐；脚本会依次尝试 `STARFORGE_JAVA` → PATH → 常见 JDK 安装目录自动定位 21）。

```sh
git clone <repo> && cd "RabiMew's Starforge"
node tools/setup-client.mjs
```

构建 `run/client/`（mods 仅含 `side=both|client`、pack/ 覆盖层），用于本地开发调试。另有 `node tools/package-client.mjs --local` 生成本机测试 ZIP（内含完整 jar，标记 **LOCAL TEST ONLY**，不发布、不入库、不代表已获得再分发许可）。

## 开发者服务端

```sh
node tools/setup-server.mjs
```

setup 会校验 Java 21、下载并安装 NeoForge 21.1.251 专用服务端到 `run/server/`、按 `manifest/locked-mods.json` 固定 URL 下载全部锁定模组并校验哈希、同步 `pack/` 配置与 KubeJS 脚本、写入 eula 与基线 `server.properties`。第三方 jar 不入库，全部经 manifest 合法解析。

启动：

```sh
cd run/server
java @user_jvm_args.txt @libraries/net/neoforged/neoforge/21.1.251/win_args.txt nogui
```

无参验证：`node tools/check-mapping.mjs`（语义映射+阶段锁）、`node tools/check-closure.mjs <id...>`（地球生产闭环）、RCON 运行时阶段自测 `node tools/rcon.mjs stagetest`。

> **安全默认值**：自动生成的 `server.properties` 设 `online-mode=false`、RCON 密码 `starforge`——**仅供本地开发测试**。公开服务器必须改为 `online-mode=true` 并更换独立 RCON 密码或关闭 RCON。

## 生成 Release

```sh
node tools/release.mjs          # 完整流水线
node tools/release.mjs --local  # 额外产出开发者本地测试 ZIP
```

流水线：validate-design → build-pack → fetch-mods（锁定 hash 校验）→ dependency audit → client/server sync → `.mrpack` + server zip → verify-release → `dist/release-report.md`。任一步失败立即中止，不产出"看似成功"的 Release。

版本号唯一来源是 `manifest/version.json`；模组版本、下载源、side、hash 唯一来源是 `manifest/locked-mods.json`。

职责划分：`package-client.mjs` → 玩家 `.mrpack`；`package-server.mjs` → 服务端安装包；`package.mjs` → 源码/配置分发 ZIP（旧流程，保留）；`release.mjs` → 完整流水线。

## 署名与许可

RabiMew's Starforge（星铸）由 **RabiMew** 制作。

Copyright (c) 2026 RabiMew。除另有注明外，本仓库原创设计文档、脚本、配置和本地化文本采用 [MIT 许可证](LICENSE)，允许使用、修改、再分发及商业使用；分发副本或重要部分时须保留版权与许可声明。

本许可不覆盖所引用或后续随整合包分发的第三方模组、库、纹理、模型、音效及其他外部素材。它们的作者署名和原有许可证保持有效，具体使用与分发遵循各自许可。
