# 键位表与冲突审计（Starforge）

默认键位经 **Default Options**（`pack/config/defaultoptions/keybindings.txt`）在首次安装时下发：只改写仍为出厂默认的绑定，**绝不覆盖玩家已改过的键**。游戏内可用 **Controlling**（已装）按按键名/功能搜索并检查冲突。

设计目标不是"所有按键字面上唯一"，而是：正常游玩中**无同一状态下的真实冲突**、高频操作顺手、同语义操作键位一致。因此允许"上下文互斥"的复用（例如游戏内 `R` 换弹 vs 背包 GUI 内 `R` 整理）。

## 快速键位表（玩家常用）

| 键 | 功能 | 触发上下文 |
| --- | --- | --- |
| **R** | TaCZ 换弹 | 游戏内持枪 |
| **R** | IPN 整理背包 / EMI·JEI 查看配方 | 仅 GUI 内 |
| **Z** | TaCZ 改装（配件界面） | 游戏内持枪 |
| **X** | TaCZ-addon 快速切枪 | 游戏内 |
| **C** | TaCZ 爬行（匍匐） | 游戏内 |
| **C** | IC2CRE 模式切换 | 游戏内持可切换模式 IC2 工具（与爬行有意共键，见 §C） |
| **V** | TaCZ 瞄具倍率（瞄准时）/ 近战（未瞄准时） | 游戏内持枪，上游按瞄准态分流 |
| **G** | TaCZ 开火模式 | 游戏内持枪 |
| **G** | Building Gadgets 设置 | 仅手持 gadget（与持枪互斥） |
| **H** | TaCZ 检视武器 | 游戏内持枪 |
| **H** | Building Gadgets 锚点 | 仅手持 gadget |
| **O** | TaCZ 持械互动 | 游戏内持枪 |
| **O** | Building Gadgets 撤销 | 仅手持 gadget |
| **B** | Sophisticated Backpacks 打开背包 | 游戏内 |
| **M** | Xaero 世界地图 | 游戏内 |
| **J** | FTB Quests 任务书（主要引导） | 游戏内 |
| **K** | ProgressiveStages 进度树 | 游戏内 |
| **U** | Xaero 路径点列表 | 游戏内（上游默认还原） |
| **N** | Xaero 新建路径点 | 游戏内 |
| **Y** | Xaero 小地图设置 | 游戏内 |
| **I** | Easy Villagers 抱起村民 | 游戏内指向村民 |
| **F6** | GuideMe（AE2 指南） | 游戏内 |
| **F8** | Iris 开关光影 | 游戏内 |
| **Alt+T** | TaCZ 配置界面 | 游戏内持枪 |
| **Alt+C** | 背包交互升级（SB interaction upgrades） | 游戏内 |
| **Alt+Z / Alt+X** | SB 升级槽 1/2 开关 | 游戏内 |
| **Alt+V** | IE 磁轨炮瞄准缩放 | 游戏内持磁轨炮 |
| **` ` `** | Ad Astra 宇航服飞行开关 | 游戏内穿喷气装置 |
| **`\`** | Ad Astra 收音机 | 游戏内 |
| **`=`** | IE 磁力装备开关 | 游戏内 |
| **`-`** | IP 投影仪镜像 | 游戏内手持投影仪 |

| **`[` / `]`** | Sophisticated 存/取到容器 | 游戏内手持存储物品 |
| **方向键** | Railcraft 机车 模式/汽笛/倒车 | 仅乘车时 |
| **`,` / `.`** | Railcraft 机车减速/加速 | 仅乘车时 |
| **小键盘区** | Jade 配置/覆盖层/液体/配方/用途/朗读；Xaero 即时路径点 `+` | 游戏内 |
| **中键** | 原版选取方块 | 游戏内 |
| **中键** | Sophisticated 容器整理 | 仅 Sophisticated GUI |
| **Ctrl+O** | JEI 覆盖层显示/隐藏（默认隐藏，JEI 仅作 API 层） | 游戏内/GUI |

GUI 内的编辑/浏览键（FTB Quests 编辑器、CraftingTweaks 合成格、JEI/EMI 搜索等）只在其界面内生效，与上表不冲突，不再单列。

## 冲突分类审计（2026-09-24 全量扫描）

### A. 真实冲突——已修复

同一游戏状态下两个功能会同时触发，必须改：

| 按键 | 冲突双方 | 处理 |
| --- | --- | --- |
| R | Iris `reload` × TaCZ 换弹（同为游戏内） | Iris reload → 解绑（视频设置→Shader Packs 可重载） |
| K | Iris `toggleShaders` × KubeJS Kubedex × 进度树 | Iris → `F8`；Kubedex → 解绑（演示/调试功能）；K 归进度树 |
| O | Iris `shaderPackSelection` × TaCZ 持械互动 | Iris → 解绑（视频设置有入口）；O 归 TaCZ |
| Tab | TaCZ-addon `switch_gun`（上游默认 Tab）× 原版玩家列表 | switch_gun → `X` |
| C | SB `inventory_interaction` × TaCZ 爬行 | SB → `Alt+C` |
| C / X | 原版 `save/loadToolbarActivator`（仅创造可用）占住战斗键位 | 均 → 解绑 |
| J | Xaero 路径点列表（旧默认）× 任务书需求位 | 路径点列表 → `U`（还原上游）；J 归任务书 |
| U | Xaero 路径点列表（新）× BG2 `undo`（持 gadget 时触发） | BG2 undo → `O`（持枪/持 gadget 互斥） |
| 中键 | IE `railgunZoom` × 原版选取方块（会切走手中物品） | railgunZoom → `Alt+V` |
| 中键(GUI) | IPN 整理 `BUTTON_3` × SophisticatedCore 整理 | IPN 整理 → `R`（符合"GUI 内整理=R"约定） |

### B. 上下文互斥——保留同键（不视为需修复的冲突）

| 按键 | 复用双方 | 互斥依据 |
| --- | --- | --- |
| R | TaCZ 换弹 ∥ IPN 整理 / EMI·JEI 配方 / BG2 `range` | 游戏内 vs GUI 内 vs 手持 gadget |
| V | TaCZ 缩放 ∥ TaCZ 近战 | TaCZ 内部按瞄准态分流（字节码确认 `isAim` 分支），上游有意共键 |
| G | TaCZ 开火模式 ∥ BG2 `settings_menu` | 持枪/持 gadget 单手互斥 |
| H | TaCZ 检视 ∥ BG2 `anchor` | 同上 |
| O | TaCZ 持械互动 ∥ BG2 `undo` | 同上 |
| U | Xaero 路径点列表 ∥ JEI `showUses` | 游戏内 vs GUI 内 |
| K | 进度树 ∥ CraftingTweaks `compress_stack`（及 Ctrl/Shift+K） | 游戏内 vs 合成 GUI |
| Tab | 原版玩家列表 ∥ CraftingTweaks `refill`、FTB Quests `next_chapter` | 游戏内 vs GUI 内 |
| `=` / `-` | IE 磁力 / IP 投影 ∥ FTB Quests GUI 缩放 | 游戏内 vs 任务界面 |
| 中键 | 原版选取方块 ∥ SophisticatedCore 整理 | 游戏内 vs GUI 内 |
| 方向键 | Railcraft 机车 ∥ FTB Quests/JEI 界面导航 | 乘车 vs GUI 内 |
| Shift / Ctrl | 潜行·疾跑 ∥ Jade 详情 / AE2 部件放置·滚轮修饰 | 上游有意设计（按住才生效的修饰语义） |
| F | 原版交换副手 ∥ GUI 内 Ctrl+F 搜索 | 游戏内 vs GUI 内 |

### C. 低风险——保留

- `key_gui.xaero_quick_confirm` = 右 Shift：仅在 Xaero 路径点确认 GUI 内。
- `key_gui.xaero_instant_waypoint` = 小键盘 `+`：快捷打点，无冲突。
- JEI 全套 GUI 键（R/U/A/书签/作弊等）：JEI 覆盖层默认隐藏（仅作 JEMI 的插件来源），按键休眠；玩家 `Ctrl+O` 唤出后是其独占语义，与 EMI 同键属"用户显式切换"而非冲突。
- `key_key.ic2cre.alt` = 左 Alt：IC2CRE 组合修饰基键，单独按下无副作用。
- `key_key.ic2cre.mode_switch` = C：与 TaCZ 爬行同键为**有意复用**（持可切换模式的 IC2 工具按 C 会同时触发爬行——已确认接受此重叠）；mode_switch 仅在手持该类物品时实际生效。

### D. 默认解绑（重复/调试/GUI 已有入口）

| 键位 | 原默认 | 理由 |
| --- | --- | --- |
| Xaero `enlarge_map` | Z | Z 归 TaCZ 改装；全屏地图已由 M 覆盖 |
| Xaero `open_settings` | `]` | 与小地图设置 Y 重复 |
| Curios `open` | G | 撞 TaCZ 开火模式；物品栏有 curio 页按钮 |
| Iris `reload` / `shaderPackSelection` | R / O | 撞战斗键；视频设置有入口 |
| KubeJS `kubedex` | K | 演示/调试 GUI |
| 原版 `saveToolbar`/`loadToolbar` | C / X | 创造专属低频功能，让位战斗键位 |
| Easy Villagers `cycle_trades` | C | 低频；交易界面内可点选 |
| Supplementaries `quiver` | V | 撞 TaCZ 战斗簇 |
| IC2CRE `side_inventory`/`hud_mode`/`boost` | C / X / 左Ctrl | 撞爬行/切枪/疾跑 |
| Railcraft `change_aura` | G | 撞开火模式；护目镜覆盖层低频 |
| Placebo `toggleTrails`/`toggleWings` | 小键盘 9/8 | 赞助者特效/调试开关 |
| Artifacts 各饰品开关 | （上游即未绑） | 低频；需要时自绑 |
| FTB `ftbteams.open_gui` / `cycle_pinned_tracker` | （未绑） | 任务书/侧边栏有入口 |
| SB `tool_swap`、`toggle_upgrade_3~5` | （未绑） | 低频 |
| DynamicFPS `toggle_*`、ModernFix `config`、EntityCulling `toggle` | （未绑） | 调试/低频 |
| Xaero `toggle_*`、GUI 缩放键 | （未绑） | 界面内设置可改 |

## 任务书动态按键提示（tutorial_hints）

任务书内给"不知道怎么按"的任务加了**动态按键提示**：导出器把 `design/content.json` 中任务的 `tutorial_hints[].keys` 渲染为 MC 原生 **`{"keybind":"<KeyMapping id>"}`** 文本组件（写入 `quest_desc` 语言行）。组件由客户端在渲染时解析——**永远显示玩家当前绑定**，改键即生效；上表的字面键名（R/I/J 等）只是 Default Options 下发的初值，任务文案中**严禁出现字面按键**。

数据格式与规则见 `docs/questbook.md` §2.1。维护要点：

- **合法 id 表 = `design/keybinds.json`**：本包已注册 KeyMapping id 注册表，`tutorial_hints` 只能引用其中条目。校验器（`validate-design.mjs`）与导出器（`export-quests.mjs`）都会对未注册 id 报错。
- **id 是 KeyMapping 注册名，不是 Default Options 行名**：`keybindings.txt` 里 `key_key.tacz.reload.desc` 的 `key_` 前缀是该文件的语法前缀，真实注册名是 `key.tacz.reload.desc`（options.txt 中 `key_key.X` 行去掉 `key_` 前缀即注册名）。
- 注意部分模组的注册名与语言键不同形：TaCZ 的按键注册名带 `.desc` 后缀（`key.tacz.reload.desc`），而 lang 键没有该后缀——以 `run/client/options.txt` 中的注册名为准。
- **注册表更新流程**：新装/升级 Mod 后，以 `run/client/options.txt` 的 `key_*:` 行重新生成 `design/keybinds.json`（外加已注册但无默认绑定的条目，如 `key.taczaddon.switch_gun.desc`），再跑 `node tools/validate-design.mjs`。
- 新增 hint 时先在游戏内 Controls/Controlling 确认该功能确有 KeyMapping；没有 KeyMapping 的交互（如"炮塔下方容器自动供弹"）写成纯文本提示、`keys: []`。

## 新装/更新 Mod 时的键位检查规则

1. **先看触发上下文，再看按键名。** NeoForge 的 `KeyConflictContext`（UNIVERSAL / IN_GAME / GUI）与模组内部的"手持物/瞄准/乘车"条件决定真实冲突；仅字面上同键不等于冲突。
2. 原版核心键（WASD、Space、Shift、Ctrl、E、Q、F、1–9、Tab、Esc）不得被普通 Mod 功能覆盖；明确上下文限定（仅某 GUI / 仅乘车）除外。
3. 战斗高频操作固定在 **Z X C V G H B + R + 鼠标键**；新动作类功能（趴下/翻滚/攀爬等）优先占用该簇空位或 `Alt+` 组合，不得把射击/瞄准/换弹/近战挤走。
4. 同类语义统一键位：整理=R（GUI 内）、开背包=B、地图=M、任务/引导=J、进度树=K、配方=R、用途=U（GUI 内）。
5. 低频、重复、可通过 GUI 完成、调试类功能**默认解绑**（`key.keyboard.unknown`）；确有必要保留的用 `Alt+`/`Ctrl+` 组合。
6. 改默认只动 `pack/config/defaultoptions/keybindings.txt`（+ IPN 走 `inventoryprofiles.json`、EMI 走自身 `emi.json`，二者均非原版 KeyMapping）；写完 `node tools/sync-pack.mjs all` 同步到 `run/`。
7. 已安装实例中已被玩家改过的键不会被覆盖；想应用新默认，在 选项→控制（Controlling 搜索）中手动改，或删 `options.txt` 重启。
8. 验证方式：删除 `options.txt` 首启后扫描日志 `Applied N defaults`；再用 Controlling 的冲突筛选确认游戏内上下文无红标。
