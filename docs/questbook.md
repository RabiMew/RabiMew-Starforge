# 任务书与引导设计

FTB Quests 2101.1.36（NeoForge 1.21.1）承载任务书。**任务书是说明书与里程碑地图，不是进度闸门**：科技阶段一律由 ProgressiveStages 的服务端制造验证授予，任务不授予阶段、不消耗物品。任务之间用 `deps` 连成**树状依赖**（见 §5）：章节为 `progression_mode: "flexible"`，子任务进度随时可以推进（物品预积累），但完成/领奖按树序进行——这只约束任务书内部的完成顺序，不影响科技阶段。

引导体系的职责分层（V2）：

```text
ProgressiveStages  唯一状态源：8 个时代闸门 + 22 个能力节点（同一张依赖图）
Progression Map    总导航：PS 库存按钮打开，时代主线 + 能力分支 + 解锁条件
FTB Quests         说明书/路线：主线说明、支线推荐、手册页——完全可选
Advancements       成就记录：时代镜像 + 一次性玩法成就（只记录，不授权）
Manual             手册章：43 页分组知识库
Runtime hints      starforge_guidance.js：真实事件 → 计数器/成就/一次性提示
```

## 1. 章节结构（10 章）

```text
时代里程碑（milestones）  7 个 gamestage 任务，与 PS 时代阶段实时同步（无需手动完成）
启程（onboarding）        进图即见的前十分钟引导，9 个任务（链式小树，含"打开阶段图谱"）
七章路线                  工业 / 自动化物流 / 军事 / 航天 / 探索 / 农业后勤 / 建筑，与 content.json routes 一一对应
参考手册（manual）         43 条教程正文页，8 个分组（无依赖，自由翻阅）
```

### 时代里程碑章

每章任务为一个 `gamestage` 任务（`team_stage: true`），团队拥有对应时代阶段即自动完成——与 ProgressiveStages 图谱完全同步，玩家不需要也无法手动点掉。按 T1→T7 线序排列，奖励 `service_medal`（team 一次）。这是"任务书记录进度"而非"任务书授予进度"的直接体现。

### 启程章

| ID | 检测 | 目的 |
| --- | --- | --- |
| `welcome` | checkmark | 任务书定位：说明书而非闸门 |
| `your_team` | checkmark | 团队共享制造研究、个人可专精 |
| `first_camp` | checkmark | 庇护所、床、箱子、起步农田 |
| `first_kitchen` | item：烹饪锅 | 农夫乐事厨房起步，接农业线 |
| `milestone_assembly` | item：工程装配件 | **制成 T1 晋级证据**，讲清"做部件晋级"规则 |
| `register_base` | checkmark | 登记基地、认识基地状态 GUI |
| `routes_overview` | checkmark | 七章导览，之后自由选路 |
| `star_map` | checkmark | 指引玩家用 PS 库存按钮打开进度图谱（主线+能力分支+解锁条件） |

### 参考手册章

教程页按组排布，`quest_subtitle` 显示组名；每页一个 checkmark，标记为 FTB `optional`（不计入章节完成度）。

| 组 | 教程页 |
| --- | --- |
| 进度与生存 `progression` | team_progression · earth_alternative · storage_progression · backpack_kit · kitchen_automation · advanced_storage · expedition_backpack · cfb_kitchen · applied_kitchen · modern_kitchen · industrial_food · food_automation · client_qol |
| 能源·石油·网络 `energy` | power_priority · unified_oil · ae2_bootstrap · household_power · smart_home |
| 怪潮与防御 `defense` | horde_engineers · colony_security · colony_defense · defense_layers · turret_resupply · eos_arsenal · guard_weapons · tacz_addon_basics · low_gravity_combat |
| 殖民人口与驻军 `colony` | lightweight_colony · colony_residents · colony_guard · colony_armory · colony_ammunition · colony_supply · planetary_garrison · livable_base · modern_living |
| 岗位与维护 `workforce` | colony_workforce · job_assignment · maintenance_rewards |
| 铁路物流 `rail` | rail_logistics · starport_rail · railcraft_advanced |
| 航天与风险 `space` | safe_station · giselle_equipment · asteroid_belt_risk · expedition_ammo |
| 野外与遗迹 `field` | artifacts_curios · alien_archaeology · ecology_survey |

## 2. 任务描述格式

任务描述固定两段式：正文是「目标—操作提示—为什么值得做」的摘要（现有 `modpack.quest.*.description` 文案直接沿用），末尾追加一行 raw JSON `change_page` 链接指向手册页：

```json
{"text":"» 详见手册：xxx","color":"aqua","clickEvent":{"action":"change_page","value":"<手册页 hex id>"}}
```

- 链接文本按语言生成（`modpack.quest.manual_link` 模板，`%1$s` = 手册页标题）。
- 跨路线跳转只允许指向手册页；任务之间不互相引用。
- FTB Quests 2100+ 支持 description 行内的 raw JSON text 与 `change_page` clickEvent（value 为目标对象的长 hex ID）。导出器生成**确定性 ID**，链接跨构建稳定。

## 3. 检测类型映射

117 个任务节点中约半数自动检测（item/dimension/advancement/kill/gamestage）、半数 checkmark，另有 43 页手册。不伪造「运行成功」检测——无法诚实验证的布局/演练/运营目标一律 checkmark。支线（optional）只承载推荐与演练，不影响章节完成度与任何阶段授予。下表为原 35 个主线任务的检测映射（新增中间节点均为 item/checkmark/stage 子步骤，详见 content.json）：

| 任务 | 阶段 | task | 目标（语义键/字面量） |
| --- | --- | --- | --- |
| ic2_generator | T1 | item ×1 | ic2_generator |
| ore_processing | T2 | item ×1 | ic2_macerator |
| nuclear_grid | T5 | checkmark | — |
| earth_quantum | T7 | item ×1 | quantum_control |
| physical_logistics | T1 | item ×8 + item ×1 | bc_pipe_item_stone + bc_tank |
| ae2_bootstrap | T3 | item ×1 | ae2_inscriber |
| stock_control | T3 | checkmark | — |
| remote_supply | T7 | item ×1 | ae2_quantum_ring |
| rail_freight | T1 | item ×1 + item ×2 | rc_cargo_minecart + rc_item_loader |
| spaceport_rail | T6 | checkmark | — |
| layered_defense | T0 | checkmark | — |
| gunsmith | T2 | item ×2 | tacz_workbench_a + tacz_gun_table |
| armed_guards | T2 | checkmark | — |
| ie_turret | T2 | item ×1 | ie_turret_gun |
| ammo_line | T2 | item ×2 + item ×32 | tacz_ammo_box + ie_bullet_casull |
| ammo_logistics | T3 | checkmark | — |
| tacz_turret | T4 | item ×1 | tt_turret |
| eos_arsenal | T5 | checkmark | — |
| swarm_suppression | T5 | checkmark | — |
| expedition_firepower | T6 | checkmark | — |
| munitions_supply | T3 | checkmark | —（自动化章） |
| defense_drill | T5 | checkmark + item ×4 | ie_steel_component（支线 optional） |
| launch_preparation | T5 | item ×1 | space_control_core |
| first_launch | T6 | advancement | `starforge:first_launch` |
| orbital_station | T6 | dimension | earth_orbit |
| colony_network | T6 | checkmark | — |
| space_equipment | T6 | item ×1 | gz_oxygen_can |
| asteroid_belt | T6 | dimension | asteroid_belt |
| asteroid_mining | T6 | checkmark | — |
| survey | T0 | checkmark | — |
| ruin_salvage | T3 | item ×4 | ae2_sky_stone |
| optional_boss | T6 | kill ×1 | `#mutantmonsters:mutants`（实体标签） |
| anomaly_research | T6 | item ×1 | anomaly_analysis |
| alien_ruins | T6 | checkmark | — |
| alien_relics | T6 | checkmark | — |
| base_kitchen | T0 | item ×1 | `farmersdelight:cooking_pot` |
| food_buffers | T1 | checkmark | — |
| fuel_crops | T4 | item ×1 | `immersiveengineering:biodiesel_bucket` |
| planetary_greenhouse | T6 | checkmark | — |
| factory_layout | T0 | checkmark | — |
| building_gadget | T2 | item ×1 | bg_building_gadget |
| industrial_district | T4 | checkmark | — |
| colony_architecture | T6 | checkmark | — |

多任务任务（physical_logistics、rail_freight）默认「全部完成」。`physical_logistics` 不用抽屉控制器做目标：它属于 T2 解锁，任务推荐阶段是 T1。

`first_launch` 用数据包自定义 advancement（`changed_dimension` → 六个轨道维度任一，`requirements` 单行多判据 = OR），`hidden` display 弹 toast 不刷屏聊天。由 `content.json` 的 `advancements[]` 声明、`build-pack.mjs` 生成到 `pack/kubejs/data/starforge/advancement/`。

## 4. 奖励

`reward_policy: optional_non_progression` 落地为按任务差异化的物品奖励。规则：

- **scope=player → `team_reward: false`**（每名队员可领，后进服的队友也有补给）；**scope=team → `team_reward: true`**（全队一次，用于里程碑纪念）。
- 奖励物品的解锁阶段必须 ≤ 任务 `suggested_stage`（校验器强制）。
- 不发未解锁机器/电路/唯一蓝图，不用 command 奖励。
- 里程碑任务（晋级证据、首航、首领、小行星带采矿、量子桥等）发 `service_medal`（服役纪念章，团队一次）——专用纪念物品，不占用实用产出。

各任务奖励明细见 `design/content.json` 的 `rewards` 字段；方向：军事给弹药原料、航天给补给耗材、建筑给建材、农业给种子食材、里程碑给纪念章。

## 5. 依赖与排版

- `deps` 导出为 FTB `dependencies`，画出树线。章节 `progression_mode: "flexible"`：**任务进度随时可推进（预完成），完成/领奖须等父任务完成**——FTB 中唯一的连线语义；它是任务书内部的完成顺序，不授予/不阻碍科技阶段。所有任务始终可见、可读（不设置隐藏属性），说明书属性保留。
- `deps` 只允许同章引用（跨章联系一律走手册页链接），必须成森林；校验器强制无环、同章、非自引用。
- 章内布局（导出器自动计算）：横轴 = 树深（x = depth × 3.2），纵轴 = 前序 DFS 行位（行距 1.5），兄弟节点按可达子树规模降序排列使主干在上、支线在下；汇流节点（双父）只放置一次，挂在先访问的子树旁。
- 复杂节点用**子步骤清单**（`tasks` 数组 2–5 个目标，全部完成才算完成），如 `space_equipment` 要求氧气罐+四件航天服、`first_camp` 要求箱子+火把+checkmark。
- 推荐阶段通过 `quest_subtitle`（`modpack.quest.stage_hint` 模板填入阶段名）显示，不做隐藏锁定。
- 晋级证据类与挑战类任务用 `shape: "pentagon"` + `size: 1.5` 突出；手册页用 `rsquare` + `min_width: 360`。

## 6. 数据 schema（content.json 扩展）

```jsonc
"chapters": [
  { "id": "onboarding", "title_key": "...", "description_key": "...",
    "icon": "<语义键|ns:path 字面量>", "order": 0 }
],

"quests[i]": {
  "chapter": "onboarding | milestones | <route id> | manual",   // 路线任务省略时取 route
  "task":   { "type": "item|checkmark|kill|dimension|advancement|biome|structure|stage",
              "target": "<语义键|ns:path|advancement id|#实体标签>",
              "stage": "<progression 节点 id>",                  // type=stage 时
              "count": 1,
              "components": { "minecraft:custom_data": {...} } }, // 可选：写进 item.components（如 TACZ 枪包方块的 BlockId）
  "tasks":  [ ... ],                               // 子步骤清单：多目标任务用 tasks 数组（全部完成）
  "icon": "<语义键|ns:path>" 或 { "id": "<语义键|ns:path>", "components": {...} },
  "deps": ["quest_id"],                            // 树形父依赖 → FTB dependencies（flexible：进度自由、完成按序）
  "manual_refs": ["tutorial_id"],                  // 描述尾部生成 change_page 链接
  "rewards": [{ "item": "<语义键|ns:path>", "count": 8, "scope": "player|team", "components": {...} }],
  "optional": true,                                // 支线：不计章节完成度
  "tags": ["side_quest"],                          // 可选 FTB 标签
  "required_stage": "<progression 节点 id>",       // 可选：PS 混入强制（本包未用）
  "shape": "pentagon", "size": 1.5                 // 可选，默认 circle / 1.0
},

"tutorials[i]": { "title_key": "modpack.tutorial.x.title", "group": "colony", ... },

"questbook": {                                   // 导出器用的固定文案键
  "title_key": "modpack.questbook.title",
  "manual_link_key": "modpack.quest.manual_link",
  "stage_hint_key": "modpack.quest.stage_hint"
},
"tutorial_groups": [                             // 手册章分组（有序、有标题键）
  { "id": "progression", "title_key": "modpack.tutorial.group.progression" }
],
"advancements": [                                // 自定义 advancement → build-pack 生成数据包 JSON
  { "id": "first_launch", "title_key": "...", "description_key": "...",
    "icon": "aa_tier1_rocket", "trigger": "changed_dimension",
    "dimensions": ["earth_orbit", ...] }         // 任一满足即完成（OR）
]
```

## 7. 导出管线

```text
tools/export-quests.mjs:
  tools/lib/design.mjs（design/content.json + progression.json + semantic-map.json + stage-locks.json）+ localization/*.json
    → pack/config/ftbquests/quests/data.snbt              （任务书根对象 + file 标题）
    → pack/config/ftbquests/quests/chapter_groups.snbt    （空组列表）
    → pack/config/ftbquests/quests/chapters/<id>.snbt     （结构：任务/坐标/图标/任务项/奖励）
    → pack/config/ftbquests/quests/lang/zh_cn.snbt        （全部文本）
    → pack/config/ftbquests/quests/lang/en_us.snbt
```

要点：

- FTB Quests 2100+ 把全部文本放在 `lang/<locale>.snbt`，键形如 `chapter.<HEX>.title`、`quest.<HEX>.title` / `.quest_subtitle` / `.quest_desc`（列表）、`chapter.<HEX>.chapter_subtitle`（列表）、`file.<HEX>.title`；客户端按各自 MC 语言渲染，天然满足双语同服。
- **确定性 63-bit hex ID**（`tools/lib/hexid.mjs`，导出器与校验器共用）：`sha256("ftbquests/<type>:<path>")` 取高 63 bit 转 16 位大写 hex。路径带类型与层级命名空间，如 `chapter:industry`、`quest:industry/ic2_generator`、`task:space/first_launch/0`、`reward:industry/ic2_generator/0`、`manual:unified_oil`、`file:starforge`——同名对象在不同章节/类型下不冲突，`change_page` 链接可预先算得。
- 章文件字段（2101 实测格式）：`filename/group/icon{id}/id/order_index/progression_mode:"flexible"/default_quest_shape/default_hide_dependency_lines/images/quest_links/quests[]`；任务 `{id,x,y,shape,size,icon{id},min_width,tasks[],rewards[]}`。
- 任务 SNBT（按 2101 源码字段）：item `{type:"item", item:{id,count:1}, count:N, consume_items:false}`；checkmark `{type:"checkmark"}`；dimension `{type:"dimension", dimension:"ns:dim"}`；advancement `{type:"advancement", advancement:"ns:path", criterion:""}`；kill `{type:"kill", entity:"ns:e" 或 entityTypeTag:"ns:tag", value:1}`；biome/structure 同名字段；**gamestage `{type:"gamestage", stage:"modpack:<id>", team_stage:true}`**（ProgressiveStages 提供 stage provider，团队持有时自动完成）。
- 奖励 SNBT：`{type:"item", item:{id,count:N}, team_reward:<bool>}`（数量在物品栈内，与 ItemTask 的顶层 `count` 不同）。
- item 任务写 `consume_items: false`（显式覆盖，章节默认也是 false 但不依赖默认）。
- `pack/config/ftbquests/` 经 `sync-pack.mjs` 同时下发到客户端与服务端（任务书数据在服务端持有、客户端同步显示，lang 文件两端都需要）；该目录加入 `OWNED_DIRS` 清 stale。
- `release.mjs` 在 `build-pack` 后增加 `export-quests` 步骤。

## 8. 校验器新增检查（validate-design.mjs）

- 章节：id 唯一、`title_key`/`description_key`/icon 存在且可解析，10 章。
- **进度图**：8 时代 + 22 能力节点全局无环；时代依赖只能是时代（能力永不反向授权）；能力触发条件（craft/pickup/dimension/custom_counter/has_item）逐条解析校验；`reveal ∈ {always,dependencies,unlocked}`、`frame ∈ {task,goal,challenge}`、category 有效；`stage-locks.json` 只允许挂在时代上。
- 任务：`chapter` 合法（route 任务缺省取 `route`）；`task.type` ∈ 允许集合（含 `stage`）；`task.target`/`task.stage` 可解析并对照 `registry-export/`——item/图标/奖励解析后须在 `items.json` 或为本包 `modpack:*` 自定义物品（对照 `content.items`），dimension 须在 `dimensions.json`，kill 实体/标签须在 `entity_types.json`/`tags_entity.json`，advancement 须是 `advancements.json` 中声明的 `starforge:<id>`，stage 须是进度图节点；biome/structure 仅校验 `ns:path` 格式（注册表导出不含这两类）。
- **依赖阶段不倒挂**：`deps` 指向的 `suggested_stage` 不得高于本任务（支线排程与主线一致）。
- **optional 规则**：非 optional 任务不得依赖 optional 任务（required 不等待 side quest）。
- **任务阶段一致性**：item 类任务目标的解锁阶段 ≤ `suggested_stage`（同奖励规则；据此把 `anomaly_analysis` 的解锁从 quantum_age 修正为 atomic_age——SF-28 设计为 T5 地球制造，原 stage-locks 条目与设计文档冲突）。
- 奖励：`scope ∈ {player,team}`、物品解锁阶段 ≤ `suggested_stage`、count ≥ 1；全部奖励非阶段凭证物品本身以外的禁令项。
- `manual_refs` 指向存在的 tutorial；`deps` 指向同章任务、无环、非自引用，每章至少一个根节点。
- 教程：`title_key`、`group` 必填，`modpack.tutorial.group.<group>` 双语键存在。
- 成就：`advancements.json` 的 icon/reveal_at/dimensions/items/entities/stage 引用全部可解析；`stage_granted` 只能镜像已有进度节点。
- **guidance 事件**：每条至少一条检测路由；计数器 `modpack:*` 且唯一；`via.quest` 事件严禁投喂 `modpack:craft_*` 时代证据计数器（FTB Quests 永远可选）；advancement/hint/quest/entity/dimension 引用可解析。
- **ID 冲突**：按导出器同一算法重算所有对象的 63-bit ID，断言全局唯一。
- 双语键集合一致性沿用现有校验（含 progression/advancements/guidance 中全部 `*_key` 字段的回收检查）。

## 9. 验收

- 双语客户端实测：无裸键、无混杂语言、`change_page` 链接跳转到正确手册页。
- 全任务可完成：创造档走查一遍；生存抽查 item/advancement/dimension/kill 四类。
- 奖励不绕锁：领取不到高于自身阶段的物品；`team_reward` 语义正确（per-player/per-team）。
- 任务书可完全禁用：禁用后 T0→T7 路径不变（ProgressiveStages 不变）。
- `first_launch` advancement 与整本任务书做客户端实机烟测（进图开书、章节齐全、达成进度触发任务完成）。
- 章内泳道与 `stage-locks.json` 实际解锁抽查一致。
