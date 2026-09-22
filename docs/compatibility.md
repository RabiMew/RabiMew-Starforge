# 兼容性与证据

核查日期：2026-09-22。目标：Minecraft **1.21.1**、NeoForge **21.1.x**、Java **21**。1.21、1.21.11、Forge、Fabric、26.1.2 均不能仅凭相似名称混入发行版。

下表“候选”仅表示作者发布页或 Modrinth 官方 API 中发现对应游戏版本/加载器的文件，**不等于这些版本组合已通过联机验证**。未下载 JAR、未解析所有依赖、未建立哈希锁文件。发布源可能不同步，表中不承诺是所有平台的最新版本。

| 模组 | 本轮找到的候选 | 第一方证据 | 仍须验证 |
| --- | --- | --- | --- |
| IC2CRE | Dev-0.4，开发版 | [作者发布页](https://github.com/BigFish520/IC2-CRE/releases/tag/Dev-0.4) | 电压、mEU API、核电、UU、物品/流体注册名与配方可覆盖性 |
| BuildCraft CE | 8.0.19 | [BCCE-team 发布页](https://github.com/BCCE-team/BuildCraft/releases/tag/8.0.19) | 对应 1.21.1 资产、MJ/FE、机器接口、采石场加载与管道可靠性 |
| Immersive Engineering | 12.4.2-194 | [版本记录](https://modrinth.com/mod/immersiveengineering/version/uNRARSH2) | 配方序列化、重型成形、原油链需要的新增工序 |
| Applied Energistics 2 | 19.2.17 | [版本记录](https://modrinth.com/mod/ae2/version/kfyIqgJ6) | 处理器冷启动、跨维度桥、升级和自动合成绕锁 |
| Ad Astra | NeoForge 1.16.26 | [项目发布记录](https://www.curseforge.com/minecraft/mc-mods/ad-astra) | 火箭等级、氧气、环境伤害、站点维度与依赖 |
| Ad Astra: More Structures | 1.21.1-neoforge | [文件记录](https://www.curseforge.com/minecraft/mc-mods/ad-astra-more-structures/files/all) | 与上述 Ad Astra 组合、Boss 名单、结构战利品 |
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
| Phenominae | 1.3.3-neoforge-1.21.1 | [项目发布记录](https://www.curseforge.com/minecraft/mc-mods/phenominae) | 可配置维度、实体创建来源、世界观和可控事件 |

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

优先减少适配范围，能以原生配置与配方实现的不再造系统。但用户要求的“真实工业规模驱动怪潮”“可靠安全空间站”“完整阶段 i18n”如果超出现成接口，就必须把附属开发作为实施工作，不能宣称仅靠 KubeJS 已全部解决。

## 前置与发布侧

FTB Quests 的作者页面明确指出 KubeJS、JEI 等集成需要 FTB XMod Compat；版本锁定时同时解析 FTB Library、FTB Teams 等实际依赖，不能仅凭核心模组名单装包。[FTB Quests 说明](https://www.curseforge.com/minecraft/mc-mods/ftb-quests-forge)

其余库以选定文件元数据为准递归解析，不从其他 Minecraft 版本抄前置。IC2CRE 已把 Energy Core 合入主体，API JAR 仅用于编译，不能当运行模组；1.21.1 的 Energy Control 子附属状态不能按 26.1.2 推断。[IC2CRE 发布说明](https://github.com/BigFish520/IC2-CRE/releases)

默认配方查看器选 JEI，EMI 作为单独验证的替代配置，不强制双装。客户端放渲染与 UI 模组；公共内容、KubeJS 逻辑/资源、任务定义由同一构建源生成。服务端不加载纯客户端渲染依赖，客户端与服务器逻辑内容哈希必须一致。

发行前从作者渠道锁定下载地址、版本、文件大小、SHA-512/SHA-256、游戏范围、加载器范围、依赖、装载侧及分发方式。当前表是设计候选表，不能直接改名成安装 manifest。先做最小 IC2/BC/IE 验证，再逐组加入其余内容。
