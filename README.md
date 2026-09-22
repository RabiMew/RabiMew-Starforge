# RabiMew's Starforge · 星铸

Minecraft 1.21.1 / NeoForge 的工业科幻整合包设计基线，版本 0.1，核查日期 2026-09-22。

**制作者：RabiMew** · 原创内容采用 [MIT 许可证](LICENSE)。

**工业的目标，是维持不断扩大的生产、防御和殖民网络。** IC2CRE 提供核心科技，BuildCraft CE 承担工程物流，沉浸工程承担重工业，应用能源 2 在中后期接管复杂调度。

本仓库当前交付的是设计、双语内容源和静态校验工具，**不是可启动的客户端或服务端整合包**。模组候选版本已初步核查；尚未下载模组、锁定依赖、实现联动适配或进行游戏内测试。`客户端/` 与 `服务端/` 留作后续发行目录。

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

该校验仅检查内容数据和阶段依赖，不代表配方、模组接口或服务器性能已经通过测试。

## 署名与许可

RabiMew's Starforge（星铸）由 **RabiMew** 制作。

Copyright (c) 2026 RabiMew。除另有注明外，本仓库原创设计文档、脚本、配置和本地化文本采用 [MIT 许可证](LICENSE)，允许使用、修改、再分发及商业使用；分发副本或重要部分时须保留版权与许可声明。

本许可不覆盖所引用或后续随整合包分发的第三方模组、库、纹理、模型、音效及其他外部素材。它们的作者署名和原有许可证保持有效，具体使用与分发遵循各自许可。
