# Starforge Mod Compatibility & API Audit

Audit date: 2026-02-29 · Pack `0.1.0-alpha` · Minecraft **1.21.1** · NeoForge **21.1.251** · Java 21

## Addendum — 2026-09-22 expansion (80 enabled)

Four mods added; verified from first-party sources and the locked jars, then boot-tested on the dedicated server.

| Mod | Locked | Source / license | Side | External deps (from jar) |
|---|---|---|---|---|
| Railcraft Reborn | 1.2.10 | Modrinth `rO6kKst6`; LicenseRef-Railcraft-Reborn (public packs allowed w/ source link) | both | neoforge [21.1.50,) ✓ · minecraft [1.21.1,1.22) ✓ · jei opt |
| Ad-Astra: Giselle Addon | 8.1 | Modrinth `XQDxCBVw`; MIT | both | ad_astra [1.16.0,) ✓ · common_storage_lib [0.0.9,) ✓ · resourcefulconfig [3.0.11,) ✓ · mekanism/pnc/tif/ae2 opt (absent — skip cleanly) |
| Ad Astra: Asteroid Belt | 1.0 | CurseForge file 8887640; MIT (jar `neoforge.mods.toml`) | both | — (declared) |
| Simple Structures: Ad Astra | 1.3 | Modrinth; MIT | server req / client opt | patchouli opt (absent) |

Runtime evidence (server, Java 21): all four loaded — `railcraft` 1.2.10, `ad_astra_giselle_addon` 8.1, `pv_ad_asterobelt` 1.0, `pv_ad_astra_structures` 1.3; KubeJS 5/5 server scripts 0 errors; `neoforge tps` shows `Asteroid Belt` + `Asteroid Belt Orbit` dimensions at 20 TPS. Chunky generated a 500-block radius in `pv_asteroid_belt:asteroid_belt` (4225 chunks in 32 s, spark profiles captured). Registry-verified corrections: base track is `railcraft:strap_iron_track` (no `railcraft:iron_track`); belt dims live under the `pv_asteroid_belt` namespace, not the modid.

Integration hooks verified against the jar, not old wikis:
- `railcraft:fluid_heat` (fluid registry) and `railcraft:tunnel_bore_head` (item registry) are real NeoForge DataMapTypes — pack overrides `data/railcraft/data_maps/fluid/fluid_heat.json` (superset of RC's own file, keeps `#c:creosote`=4800 and adds `#c:oil`=16000 / `#c:crude_oil`=16000 / `#c:fuel`=64000 so BC/IP/Ad Astra fuels feed RC fluid fireboxes).
- `c:creosote` fluid tag now spans railcraft + IE + ic2cre creosote (pack fluid bridge); `c:buckets/creosote` item tag added and `railcraft:wooden_tie` rewritten to accept it (creosote mutual recognition).
- No worldspike/chunk-loading toggle exists in `railcraft-server.toml` — the worldspike family is gated by the T4 stage lock instead of a config switch.

## Addendum — 2026-09-22 QoL/perf expansion (98 enabled, 2 candidates)

QoL layer + performance layer added; all resolved via `tools/fetch-mods.mjs` from Modrinth/CurseForge/GitHub and verified in a real Prism client + dedicated-server session.

| Mod | Locked | Side | Evidence |
|---|---|---|---|
| EMI | 1.1.24+1.21.1+neoforge | client | Primary browser; bundled JEMI imported **80 JEI categories** incl. IC2CRE/BC CE/IE/IP/Ad Astra/TaCZ; AE2/FD/Sophisticated/KubeJS/Railcraft use native EMI plugins; 63,630 recipes baked in live session |
| Inventory Profiles Next | 2.2.5 | client | deps libIPN 6.6.3 + KotlinForForge 5.12.0 auto-resolved; hotkeys except middle-click sort cleared via `inventoryprofiles.json`; built-in hints already cover AE2/IE/Sophisticated screens, pack adds TaCZ refit/smith screens |
| Xaero's Minimap | 26.5.0 (+xaerolib 1.7.3 jar-in-jar) | both | server profile enforcement live: `default_enforced_profile=default` in minimap/world-map/lib `common.cfg`; radar + cave mode off |
| Xaero's World Map | 1.46.0 | both | same enforcement channel |
| Shulker Box Tooltip | 5.1.9 | client | compact preview, Shift expands (upstream default) |
| BetterF3 | 11.0.3 | client | `pack/config/betterf3.toml` trims to minecraft/fps/coords/location/chunks/system + server/target; module ids & `[[modules_left]]` schema verified from `ModConfigFile` bytecode |
| Better Ping Display | 1.1 | client | no keybinds |
| Chat Heads | 0.15.7 | client | loaded; one cosmetic "no player name" warning |
| 3D Skin Layers | 1.11.3 | client | co-loads with CSL, no conflicts logged |
| CustomSkinLoader | 15.0.1 | client | co-loads with 3DSL; real skin fetch untested (offline test account) |
| Default Options | 21.1.8 (+Balm) | client | `keybindings.txt` applied on clean install: `Applied 22 defaults (20 keys reconfigured)`, zero errors |
| Controlling | 19.0.5 | client | conflict scan of generated options.txt: no impactful dupes remain (all surviving same-key pairs are GUI/context- or modifier-separated) |
| Fast Noise | 1.0.13 (`zfastnoise`) | both | loaded; upstream incompatibility list (moonrise/antixray) absent |
| Structure Layout Optimizer | 1.0.12 | both | loaded; Ad Astra structure locate checks pass |
| AllTheLeaks | 1.1.13 | both | version-guarded fixes engage (e.g. `betterf3.FixDebugScreen` matched 11.0.3) |
| Mem Leak Fix GPU | 1.8 (`gpumemleakfix`) | client | loaded with Sodium+ImmediatelyFast, no render errors in log |

Keybind delivery: `pack/config/defaultoptions/keybindings.txt` — only fires on factory-default mappings, so updating the pack never resets player-customized keys. Full mapping table and the duplicate-key audit are in `docs/keybinds.md` (summary in `docs/compatibility.md` §键位整理）.

Known limitation (verified, not hidden): JEI 19.57 stores `overlayEnabled` only in memory (`ClientToggleState` bytecode; no config key exists) — hiding the JEI sidebar requires Ctrl+O per session. Immersive Petroleum reservoir `/place feature` deadlocks chunk gen → watchdog kill; natural generation unaffected (details in `docs/compatibility.md` §实测记录）.

## Method

- Queried Modrinth API per project with `loaders=["neoforge"]`, `game_versions=["1.21.1"]`; selected the newest version **per release channel** and compared against `manifest/locked-mods.json`.
- Non-Modrinth sources checked at their origin: GitHub Releases (IC2CRE, BuildCraft CE), FTB Maven metadata (`maven.ftb.dev`), and Modrinth mirrors for the CurseForge-sourced files (Immersive Petroleum, Defense Turrets — 已于 2026-09-23 移除, Jade Addons, Let Me Despawn; Building Gadgets 2 has no Modrinth project — CurseForge page checked).
- NeoForge 21.1.x line checked against `maven.neoforged.net` metadata.
- Every jar's `neoforge.mods.toml` dependency table is extracted into `manifest/jar-deps.json`; all `required` ranges were verified against the locked set.
- KubeJS API surface verified by inspecting the installed jar `kubejs-neoforge-2101.7.2-build.377.jar` (event-group registry classes and `ModifyItemTooltipsKubeEvent` method descriptors), not from memory or old tutorials.

## Environment versions

| Component | Locked | Latest checked | Status |
|---|---|---|---|
| Minecraft | 1.21.1 | — | fixed by design |
| NeoForge | 21.1.251 | 21.1.251 | latest 21.1.x (maven metadata) |
| Java | 21 | — | required by NeoForge 21.1 |
| KubeJS | 2101.7.2-build.377 | release 2101.7.2-build.377 | latest stable |
| Rhino | 2101.2.7-build.85 | release 2101.2.7-build.85 (beta 2101.2.8 exists) | latest stable kept |

NeoForge floor: the strictest declared minimum is Supplementaries `[21.1.247,)` — satisfied by 21.1.251.

## Per-mod audit (76 enabled)

Legend for "latest checked": `release:`/`beta:`/`alpha:` = newest 1.21.1+NeoForge build in that Modrinth channel; `(non-Modrinth)` = checked at origin source. `req`/`opt` = required/optional dep declared in jar metadata.

| Mod | Locked | Latest checked (1.21.1 NeoForge) | Side | External deps |
|---|---|---|---|---|
| IC2CRE | Dev-0.4 | Dev-0.4 (GitHub; `ExpPreVersion-26.1.2.1` targets MC 26.1.2 — rejected) | both | mekanism opt, jade opt, terrablender opt |
| BuildCraft CE | 8.0.19 | 8.0.19 (GitHub, latest release has `+1.21.1+neoforge` asset) | both | jei opt [19,), jade opt [15.10.0,) |
| Immersive Engineering | 12.4.2-194 | release:12.4.2-194 | both | jei opt [19.10.0.126,) |
| Immersive Petroleum | 4.5.0-39 | 4.5.0-39 (Modrinth mirror latest release) | both | immersiveengineering req [1.21.1-12.4.2-194,) — exact match |
| Storage Drawers | 1.21.1-13.11.4 | release:13.11.4 | both | — |
| Sophisticated Storage | 1.21.1-1.5.91.2127 | release:1.5.91.2127 | both | sophisticatedcore req [1.4.88,) ✓1.5.1.2341 |
| Sophisticated Backpacks | 1.21.1-3.26.3.2158 | release:3.26.3.2158 | both | sophisticatedcore req [1.5.1,) ✓ |
| Applied Energistics 2 | 19.2.17 | release:19.2.17 | both | guideme req [21.1.1,) ✓21.1.19; emi/theoneprobe/jade opt |
| Ad Astra | 1.16.26 | release:1.16.26 | both | resourcefullib req, resourcefulconfig req, common_storage_lib req [0.0.10,) ✓ |
| Ad Astra: More Structures | 1.0.2 | release:1.0.2 | both | ad_astra req |
| The Hordes | 1.21.1-1.6.3f | release:1.6.3f | both | atlaslib req 1.1.14 ✓ |
| Zombies Break & Build | 1.7.0-neoforge | release:1.7.0-neoforge | both | — |
| ~~Defense Turrets~~ | 1.2.0 | **已移除（2026-09-23）**：原生炮塔不消耗弹药且无拦截接口；由 IE 原生炮塔 + TACZ Turrets 2.0.0 替代 | — | — |
| In Control! | 1.21-10.3.0 | beta:1.21-10.3.0 — **no release channel exists for 1.21.1** | both | lostcities opt, kubejs opt |
| ProgressiveStages | 3.0.5 | release:3.0.5 | both | emi/jei opt, ftbteams/ftbquests opt |
| KubeJS | 2101.7.2-build.377 | release:2101.7.2-build.377 | both | rhino req [2101.2.7-build.81,) ✓build.85; jei opt [19.25.0.322,) |
| FTB Quests | 2101.1.36 | 2101.1.36 (FTB Maven latest 2101.x) | both | architectury req [13.0.8,) ✓13.0.11; ftblibrary req [2101.1.36,) ✓; ftbteams req [2101.1.9,) ✓ |
| Farmer's Delight | 1.21.1-1.3.4 | release:1.3.4 | both | crafttweaker opt (absent) |
| Cooking for Blockheads | 21.1.24 | release:21.1.24 | both | balm req [21.0.39,) ✓21.0.65 |
| FramedBlocks | 10.6.1 | release:10.6.1 | both | all optional (create/jei/emi/ae2…) |
| Supplementaries | 1.21.1-3.9.9 | release:3.9.9 | both | moonlight req [1.21-3.6.4,) ✓3.6.8; **incompatible: farmersdelight<1.3.0** (have 1.3.4 ✓), **sodium<0.8.12-beta.1** (have 0.8.13 ✓) |
| Macaw's Furniture | 3.4.1 | release:3.4.1 | both | no deps declared in `neoforge.mods.toml` |
| ~~MDM (Modern Decorations Mod)~~ | 26.9 | **已移除（2026-09-24）**：现代家具层由 MrCrayfish's Furniture Refurbished 接替（原生储物容器 + 电力家电 + 电脑体系，见末节 addendum） | — | — |
| Framework | 0.13.11 | 0.13.11 (CF; Refurbished 前置库) | both | neoforge req [21.1,) ✓ · minecraft [1.21.1,) ✓ |
| MrCrayfish's Furniture Mod: Refurbished | 1.0.22 | 1.0.22 (CF; code MIT / assets ARR) | both | framework req [0.13.10,) ✓0.13.11 · neoforge [21.1,) ✓ |
| Energized Furniture | 0.2.0 | 0.2.0 (CF; ARR) | both | neoforge req [21.1.248,) ✓ · **refurbished_furniture 为隐式依赖**（mods.toml 是模板未声明；`EnergyTransformerBlockEntity extends ElectricityGeneratorBlockEntity` 字节码硬引用——Refurbished 必须同装） |
| Engineers Delight | 2.0.0 | 2.0.0 (Modrinth `tmted`; MPL-2.0) | both | minecraft [1.21.1,1.22) ✓（IE×FD 配方为数据驱动，无硬代码依赖） |
| Immersive Cooking & Farming | 0.2.0-beta-1 | 0.2.0-beta-1 (Modrinth `immersive-cooking-adoon`; MIT) | both | immersiveengineering req [12.4.2-194,) ✓exact · **farmersdelight/jei/vinery 实为硬依赖**——其 mods.toml 用旧版 `mandatory=false` 字段，NeoForge 不识别并按默认 required 处理（服务端实测缺 vinery 拒载）；三者均已装 |
| [Let's Do] Vinery | 1.5.3 | 1.5.3 (Modrinth `lets-do-vinery`; ARR) | both | architectury req（已锁 13.0.11 ✓）——Immersive Cooking 硬依赖，锁 1.5.3 而非 5 天前的 1.5.4 |
| Building Gadgets 2 | 1.3.9 | 1.3.9 (CF; 1.4.x targets MC 26.1.2 — rejected) | both | — |
| Enderman Overhaul | 2.0.3 | release:2.0.3 | both | resourcefullib req [3.0.11,) ✓3.0.12; geckolib req [4.7,) ✓4.9.3 |
| Mutant Monsters | v21.1.1 | release:v21.1.1 | both | puzzleslib req [21.1.10,) ✓21.1.60 |
| Creature Feature | 1.2.3.3 | release:1.2.3.3 | both | blueprint (bundled integration; `galena_hats` jar-in-jar) |
| Arachnids | 0.3.0 | release:0.3.0 | both | azurelib req [3.1.8,) ✓3.1.11 |
| Easy Villagers | 1.1.42 | release:1.1.42 | both | jei/jade/theoneprobe opt |
| Guard Villagers | 2.4.12 | release:2.4.12 | both | — |
| TaCZ (unofficial NeoForge port) | 1.1.8-hotfix-r6 | release:1.1.8-hotfix-r6 | both | — |
| Guard Villagers TACZ Support | 1.0.1 | release:1.0.1 | server | tacz + guardvillagers (both present) |
| JEI | **19.57.0.446** | beta:19.57.0.446 · release:19.51.0.418 | both | mezz_config req [0.5.12,1.0.0) ✓0.6.3 — see decision below |
| GuideME | 21.1.19 | release:21.1.19 | both | — |
| MezzConfig | 0.6.3 | beta:0.6.3 — no release channel for 1.21.1 | both | — |
| Polymorph | 1.1.0+1.21.1 | release:1.1.0 (beta 1.2.0 exists — kept stable per policy) | both | — |
| Controlling | 19.0.5 | release:19.0.5 | client | searchables req [1.0.1,) ✓1.0.2 |
| Mouse Tweaks | 2.26.1-neoforge | release:2.26.1 | client | — |
| Crafting Tweaks | 21.1.11 | release:21.1.11 | both | balm req [21.0.48,) ✓ |
| AppleSkin | 3.0.9+mc1.21 | release:3.0.9 | client | — |
| Jade | 15.10.6+neoforge | release:15.10.6 | both | — |
| Jade Addons | 6.1.1 | 6.1.1+neoforge (Modrinth mirror latest release) | both | jade req [15.10,) ✓15.10.6 |
| ModernFix | 5.27.24 | release:5.27.24 | both | jei opt |
| FerriteCore | 7.0.3 | release:7.0.3 | both | — |
| ServerCore | 1.5.19 | release:1.5.19 | both | — |
| FastSuite | 1.21.1-6.0.7 | release:6.0.7 | both | placebo req [9.9.0,) ✓9.9.2 |
| Let Me Despawn | 1.5.0 | 1.5.0 (Modrinth `lmd` latest release) | server | almanac req [1.0.2,) ✓1.5.2 |
| Clumps | 19.0.0.1 | release:19.0.0.1 | both | — |
| Sodium (NeoForge) | 0.8.13 | release:0.8.13 | client | incompatible: embeddium (not installed ✓); Supplementaries 3.9.9 requires ≥0.8.12-beta.1 ✓ |
| Iris | 1.8.14-beta.1 | beta:1.8.14-beta.1 — **no stable Iris supports Sodium 0.8 on 1.21.1** (stable 1.8.12 pins Sodium 0.6.13, blocked by Supplementaries) | client | sodium pair (installed 0.8.13); incompatible: embeddium (not installed ✓) |
| ImmediatelyFast | 1.6.14 | release:1.6.14 | client | — |
| Entity Culling | 1.11.2 | release:1.11.2 | client | — |
| Dynamic FPS | 3.11.4 | release:3.11.4 | client | — |
| spark | 1.10.124 | release:1.10.124 | both | — |
| Chunky | 1.4.23 | release:1.4.23 | both | — |
| Rhino | 2101.2.7-build.85 | release:build.85 (beta build.91 exists — kept stable) | both | — |
| Better Advanced Tooltips | 2101.1.0-build.5 | release:build.5 | both | kubejs opt [2101.1.0-build.1,) ✓ |
| Architectury API | 13.0.11 | release:13.0.11 | both | satisfies ftblibrary/teams/quests/xmod [13.0.6–13.0.8,) |
| FTB Library | 2101.1.36 | 2101.1.36 (latest 2101.x) | both | architectury req [13.0.6,) ✓ |
| FTB Teams | 2101.1.11 | 2101.1.11 (latest 2101.x; 2111.x is MC 1.21.11 — rejected) | both | ftblibrary req [2101.1.30,) ✓ |
| FTB XMod Compat | 21.1.12 | 21.1.12 (latest 21.1.x; **21.11.0 requires MC [1.21.11,) + Architectury [19.0.1,) + ftblibrary [2111.1.1,)** — rejected) | both | jei opt **[19.53.0.425,)**; kubejs opt [2100.7.0,) ✓ |
| Sophisticated Core | 1.5.1.2341 | release:1.5.1.2341 | both | — |
| Balm | 21.0.65 | release:21.0.65 | both | satisfies cfB [21.0.39,) + ctweaks [21.0.48,) |
| Searchables | 1.0.2 | release:1.0.2 | client | — |
| Moonlight Lib | 1.21.1-3.6.8 | release:3.6.8 | both | — |
| Resourceful Lib | 3.0.12 | release:3.0.12 | both | — |
| Resourceful Config | 3.0.11 | release:3.0.11 | both | — |
| GeckoLib | 4.9.3 | release:4.9.3 | both | incompatible: geckoanimfix (not installed ✓) |
| Puzzles Lib | 21.1.60 | release:21.1.60 | both | — |
| Atlas Lib | 1.21-1.1.14 | release:1.1.14 | both | — |
| Common Storage Lib | 0.0.10 | alpha:0.0.10 — no release channel for 1.21.1 | both | — |
| Placebo | 1.21.1-9.9.2 | release:9.9.2 | both | — |
| Blueprint | 8.2.0 | release:8.2.0 | both | — |
| AzureLib | 3.1.11 | release:3.1.11 | both | — |
| Almanac | 1.5.2 | release:1.5.2 | server | — |

## Upgrade decisions

**No mod version was changed.** Every locked version is either the newest 1.21.1+NeoForge stable or the newest mutually-compatible build:

- **JEI kept at beta `19.57.0.446`** instead of downgrading to stable `19.51.0.418`: FTB XMod Compat 21.1.12 declares its JEI integration optional-dep as `[19.53.0.425,)`. No stable ≥19.53 exists for 1.21.1, so the beta is the only version that keeps the FTB-Quests↔JEI integration alive. Verified loading on both sides.
- **In Control 10.3.0 (beta), MezzConfig 0.6.3 (beta), Common Storage Lib 0.0.10 (alpha)**: no release-channel build exists for 1.21.1 at all — these are the latest *and only* compatible builds.
- **Polymorph 1.1.0 / Rhino build.85**: newer beta exists; kept latest stable per policy.
- **Rejected as wrong-MC-version**: IC2CRE `ExpPreVersion-26.1.2.1` (MC 26.1.2), Building Gadgets 2 `1.4.x` (MC 26.1.2), FTB `2111.x`/`21.11.x` line (MC 1.21.11).
- **Absent libraries confirmed unneeded**: no jar declares Cloth Config, Curios, Accessories, Patchouli, EMI, or REI as required. Supplementaries/FramedBlocks Create integration and AE2 EMI integration are optional-only; no changes needed.
- Loader check: every resolved file is the `neoforge` loader build; no Forge/Fabric/Quilt artifacts in the lockfile.

## KubeJS API audit & migration

Checked against the installed jar `kubejs-neoforge-2101.7.2-build.377.jar` event registry:

| Old API (removed/renamed) | Current API | File | Evidence |
|---|---|---|---|
| `ItemEvents.tooltip(e => …)` — **event does not exist in 2101.7.2** | `ItemEvents.modifyTooltips(e => …)` | `tools/build-pack.mjs` → `kubejs/client_scripts/starforge_tooltips.js` | jar event-group table exposes `modifyTooltips`, `dynamicTooltips`; no `tooltip` |
| `e.add(item, Component)` — single component | `e.add(item, [Component, …])` — `ModifyItemTooltipsKubeEvent.add(Ingredient, List<Component>)` | same | method descriptor inspected in jar |

Other script APIs verified against the same jar — all current, no migration needed:

- `ServerEvents.recipes / tags('fluid') / loaded` — present; `e.shaped / e.shapeless / e.remove` live; runtime "recipe layer loaded" + fluid tags applied (95 tags, +68 objects).
- `ItemEvents.crafted` — present; `e.player / e.entity / e.item` fields confirmed on `ItemCraftedKubeEvent`.
- `StartupEvents.registry('item')` + builder `.texture()` — present; all 12 `modpack:*` items registered (registry dump verified).
- `Text.translate`, `JsonIO.read/write`, `Java.loadClass`, `Ingredient`, `Item.of` — all still bound by the built-in plugin.
- `ProgressiveStages.*` — provided by the ProgressiveStages KubeJS plugin; loaded server-side ("KubeJS compat active").
- No KubeJS 6 / MC 1.20.1 constructs remain (`onEvent`, `event.recipes`, `item.rightClicked` style registrations absent).

## Runtime verification (scratch copy of `run/server`, 68 server jars)

- Cold start: `Done (16.208s)` — all mods loaded (`neoforge mods` listed 78 entries incl. jar-in-jar submods).
- KubeJS: startup 2/2 scripts **0 errors**; server 5/5 scripts **0 errors**; no `Unknown event`.
- `/reload` via RCON: `Reloaded with no KubeJS errors!`; recipes + tags re-applied; IC2CRE and ProgressiveStages (8 stages) reload hooks fired.
- Graceful `stop`: all dimensions saved, no errors.

Known non-blocking warnings (pre-existing, not regressions):
- IC2CRE painter recipes use a custom `tools` JSON element → KubeJS recipe-schema warns and falls back to default (cosmetic; recipes still register).
- Creature Feature ships `extra_*` loot tables referencing sister Abnormals mods not installed (`caverns_and_chasms`, `oreganized`) → 4 loot-table parse warnings; base loot unaffected.
- 3 optional-integration mixin soft-skips (Controllable, Create backtank, JEI PacketRecipeTransfer targets absent) — expected without those mods.

## Not verified

- GUI client boot to main menu / in-world tooltip rendering (no client launched — avoids opening a game window; script syntax `node --check` validated and event/signature verified against the jar).
- HMCL / PCL import (not installed).

## Sources

- Modrinth API v2 `project/{slug}/version` (per-mod channels above)
- GitHub Releases: `BigFish520/IC2-CRE`, `BCCE-team/BuildCraft`
- FTB Maven: `maven.ftb.dev/releases/dev/ftb/mods/{artifact}/maven-metadata.xml`
- NeoForge Maven: `maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml`
- Jar metadata: `manifest/jar-deps.json` (extracted `neoforge.mods.toml` dependencies)
- KubeJS: installed jar class inspection (`dev.latvian.mods.kubejs.event.EventGroups`, `ModifyItemTooltipsKubeEvent`)

## Addendum — 2026-09-22 curio layer (100 enabled)

Two mods added; both resolved via `tools/fetch-mods.mjs --only`, hash-locked, and boot-verified on the dedicated server.

| Mod | Locked | Source / license | Side | External deps (from jar) |
|---|---|---|---|---|
| Curios API | 9.5.1+1.21.1 | Modrinth `curios`; LGPL-3.0-or-later | both | neoforge [21.1.72,) ✓ · minecraft [1.21,1.22) ✓ |
| Artifacts | 13.2.5 | Modrinth `artifacts`; MIT | both | neoforge [21.0.133-beta,) ✓ · minecraft 1.21.1 ✓ · **expandability 12.0.0 bundled** via `META-INF/jars/` (jarJar, MIT — Modrinth `X5dUUm4k`) |
| Sophisticated Backpacks | 1.21.1-3.26.3.2158 (existing) | — | both | native Curios `back` slot integration in jar — no ACL needed |

Findings:
- `tools/audit-deps.mjs` bug fixed: NeoForge 21 stores jarJar jars under `META-INF/jars/` (not only `jarjar/`); expandability now correctly recorded in `manifest/mod-ids.json` + `jar-deps.json`.
- Curios: `slots = []` pinned — the 11 default slots (incl. `back`) come from the mod itself. Artifacts adds head/necklace/belt/hands/feet curio types; no chest-slot usage → zero conflict with chest armor, Ad Astra space suits, or jet equipment. `enableAccessoriesCompat`/`enableTrinketsCompat` pinned `false` (mods absent).
- Keybind: Curios menu default `G` collides with TaCZ fire-select → unbound in `defaultoptions/keybindings.txt` (inventory button remains). Sophisticated Backpacks open key `B` has no conflict.
- Loot redistribution is a datapack-level `neoforge:add_table` GLM (`starforge:artifacts_tiers`) driven by `loot_table_id` conditions — no coordinate hardcoding, no tick listeners. 24 gated artifacts re-injected into planet-tier chest/boss tables; `eternal_steak` fully disabled (infinite food). Live-verified via RCON `loot insert`: `moon_boss` → `artifacts:warp_drive`, `rare_glacio` → `artifacts:crystal_heart`/`chorus_totem`.
- Note: ProgressiveStages' built-in Curios compat scans curio slots every tick (upstream behavior, pre-existing module) — flagged for the perf baseline; this layer adds no tick work itself.
- Server: `Done (1.725s)`, no new parse errors; client GUI slot/keybind interaction still pending a manual session.

## Addendum — 2026-09-22 default shader layer (101 enabled)

| Entry | Locked | Source / license | Kind | Notes |
|---|---|---|---|---|
| Iris | 1.8.14-beta.1+1.21.1-neoforge | Modrinth `iris`; LGPL-3.0-only | client mod | Beta exception justified below |
| MakeUp - Ultra Fast | 9.5e | Modrinth `izsIPI7a`; LGPL-3.0-or-later | client resource (`shaderpacks/`) | Default-on via `config/iris.properties` |

- **Why Iris beta**: Sodium 0.8.13 needs Iris ≥1.8.13; the only 1.21.1+NeoForge build is `1.8.14-beta.1`. Stable Iris 1.8.12 pairs with Sodium 0.6.13, which Supplementaries 3.9.9 declares `incompatible [0,0.8.12-beta.1)` — NeoForge blocks that combo at load, so no all-stable pair exists here.
- Shader pack is **not** a jar: it enters `modrinth.index.json` as a `shaderpacks/` file with `env server=unsupported` and its official CDN URL + sha1/sha512 — no third-party zip is committed to git. `sync-pack.mjs` skips `shaderpacks/` on the server.
- First-run profile: official `profile=low` + `REFLECTION_SLIDER=1` via `pack/shaderpacks/MakeUp-UltraFast-9.5e.zip.txt` (OptiFine/Iris per-pack options file).
- Iris jar metadata checked: `neoforge.mods.toml` declares only `embeddium` as incompatible; no hard Sodium dep (runtime pairing).
- Client GUI shader-on boot, shader compile log, TaCZ/Ad Astra dimension rendering: **pending real client verification** (see docs/performance.md).

## Addendum — 2026-09-23 furniture layer (100 enabled)

Incremental change: removed 4 mods, added 2. Lockfile, `mod-ids.json`, `jar-deps.json` regenerated; `audit-deps` closure re-verified over all 100 jars.

**Removed** (dependency check before removal — `manifest/jar-deps.json` showed these 4 had **no remaining dependents**: `fusion`, `supermartijn642corelib`, `supermartijn642configlib` were each required only by `rechiseled`; nothing required `rechiseled`):

| Mod | Was locked | Role |
|---|---|---|
| Rechiseled | 1.2.6 | content (chiseled block variants) |
| SuperMartijn642's Core Lib | 1.1.24a | library (Rechiseled only) |
| SuperMartijn642's Config Lib | 1.1.8 | library (Rechiseled only) |
| Fusion (Connected Textures) | 1.3.15b | library (Rechiseled only) |

**Added** — living/decoration layer for bases, industrial sites, stations and colonies; **no new tech tree** (furniture recipes are T0-open craft/decor, consistent with "building materials open from T0"):

| Mod | Locked | Source / license | Side | External deps (from jar) |
|---|---|---|---|---|
| Macaw's Furniture | 3.4.1 (`mcw-furniture-3.4.1-mc1.21.1neoforge.jar`, version `Z5V3Ps7S`) | Modrinth `dtWC90iB`; LicenseRef-ARR — manifest-URL distribution (same as Easy Villagers/CFB) | both | none declared in `neoforge.mods.toml` |
| ~~MDM (Modern Decorations Mod)~~ | 26.9 | **removed 2026-09-24** — replaced by Refurbished + Energized Furniture; see the 2026-09-24 addendum | — | — |

**Overlap audit** (MDM × Macaw's × Supplementaries — registry/recipe inspection of the locked jars; **superseded 2026-09-24** — MDM removed, replacement audit in the final addendum):

- **No recipe collisions**: MDM is 1 shaped (`furniture_parts`) + 264 `minecraft:stonecutting` recipes (1 furniture part → 1 piece); Macaw's is shaped vanilla-material recipes through its own intermediates (`cabinet_door`/`cabinet_drawer` = sticks + `#c:chests/wooden` + iron nugget; tag populated: chest, trapped_chest). No cross-mod output/ingredient collisions; Polymorph remains the conflict safety net.
- **No parallel material system**: MDM funnels every furniture recipe through `furniture_parts` (cobblestone + `#minecraft:planks` + iron nugget); Macaw's consumes vanilla logs/planks/slabs/sticks + `#c:chests/wooden`. Both already spend the pack's unified wood/iron/stone materials — no custom ingot/wood tier introduced, nothing to remap.
- **Storage overlap is cosmetic-tier, documented not merged**: MDM fridge/oven/wardrobe/dresser/nightstand and Macaw's wardrobe/drawer/cabinet/counter expose plain `IItemHandler` storage GUIs (verified in class strings — no smelting/processing logic; `GasStove`/`InductionCooker` are decoration-only `HorizontalFurnitureBlock`). Supplementaries `safe`/`jar`/`present`/`item_shelf` keep their distinct roles (secure/display/gift storage). Neither duplicates the Drawer→Sophisticated→AE2 storage progression; Cooking for Blockheads keeps the *functional* kitchen role (MDM/McW kitchen appliances are storage/decoration, no cooking logic).
- **Decor overlap accepted as variety**: lamps (Supplementaries stone/deepslate vs MDM modern), clocks, shelves — different material styles; no action.
- **KubeJS integration**: none required for function — overlap check produced no conflicts worth rewriting; only zh_cn assets were generated (below).

**i18n**: `tools/gen-mod-lang-zh.mjs` extended — MDM ships `en_us` only → full 274-key zh_cn generated; Macaw's bundled zh_cn misses the 3.4.x kitchen-sink/stripped-sink lines and the couch/chaise color set → 56 missing keys filled (wood prefixes read back from bundled zh so naming stays consistent). Output: `pack/kubejs/assets/{mdm,mcwfurnitures}/lang/zh_cn.json`. The `rechiseled` zh fallback + generator section removed with the mod.

**Runtime-verified 2026-09-23**: dedicated server booted to `Done (1.653s)` on Java 21 / NeoForge 21.1.251 — both mods loaded (`mcwfurnitures` 3.4.1, `mdm` 26.9, version check UP_TO_DATE), KubeJS 5/5 server scripts 0 errors/0 warnings, no `rechiseled`/`supermartijn642`/`fusion` mod IDs in the loaded mod list. The only ERROR lines are the 4 pre-existing Creature-Feature sister-mod loot-table misses and the pre-existing `modid:example` DataMapLoader noise (identical in the prior boot log). `registry-export/` refreshed from this boot: 8302 recipes, `mdm:` 265 items/264 blocks, `mcwfurnitures:` 654 items/652 blocks, zero stale IDs of the removed mods.

## Addendum — 2026-09-23 unification & cross-mod layer (103 enabled)

Three compat mods added (Modrinth-locked, deps resolved to existing mods only):

| Mod | Locked | Source / license | Side | Deps |
|---|---|---|---|---|
| Almost Unified | 1.21.1-1.4.2+neoforge | Modrinth `sdaSaQEz`; LicenseRef-ARR | both | none |
| Applied Cooking | 6.2.1 | Modrinth `BmMjyidG`; MIT | both | ae2, cooking-for-blockheads, balm |
| Applied Delight | 1.1.0 | Modrinth `GKLhL3bQ`; MIT | both | ae2, farmers-delight |

**Duplicate-material audit result**: steel ×4 (ad_astra/ic2cre/IE/RC), lead/tin/uranium/nickel/silver/bronze ingots ×2–3 each, plates ×3–4, rods ×2–3, dusts (sulfur/saltpeter/obsidian/ender/coal) ×2–3, coke ×2, raw materials and storage blocks mirrored. All `c:` tags already populated by the mods themselves; the gap was *output* divergence + untagged IC2CRE blocks + missing bucket subtags.

**Canonical outputs (server-verified, 0 non-canonical producers remain)**: IE for steel/lead/nickel/silver/uranium + all plates/rods + coke; IC2CRE for tin/bronze; AE2 for ender dust. Worldgen dedup via datapack `neoforge:add_features` overrides: IC2CRE lead off, RC lead/tin/nickel/silver off, IE uranium off — every material keeps ≥1 earth source (closure check: 0 dead chains for the 7 audited ingots).

**TaCZ ammo**: all 24 `gun_smith_table_crafting` recipes already consume `c:` tags natively — unified copper/iron flow through without edits. (Defense Turrets 已移除；弹药消耗由 TACZ Turrets 原生承担。)

**KubeJS↔AU boundary**: AU owns output unification at recipe-load; `starforge_unify.js` owns input-side `replaceInput` widening + 5 datapack recipe overrides for serializers neither can rewrite. No overlapping edits to the same recipe by both systems.

**Pending client verification**: EMI hidden-item dedup, CFB furniture inventory reads, Ad Astra flood fill through furniture, Applied Cooking/Delight behaviour, horde alert UX.

## Addendum — 2026-09-24 furniture/kitchen/energy/food layer (111 enabled)

Incremental change: removed MDM, added 6 mods. Lockfile, `mod-ids.json`, `jar-deps.json` regenerated; `audit-deps` + `check-closure` re-verified over all enabled jars. Dedicated server booted to `Done (1.724s)` — all six loaded, KubeJS 8/8 server scripts 0 errors/0 warnings, 9003 recipes exported, `mdm:` = 0 ids.

**Removed**

| Mod | Was locked | Role |
|---|---|---|
| MDM (Modern Decorations Mod) | 26.9 | furniture/decor — replaced by Refurbished |

**Added**

| Mod | Locked | Source / license | Side | External deps (from jar) |
|---|---|---|---|---|
| Framework | 0.13.11 (`framework-neoforge-1.21.1-0.13.11.jar`) | CurseForge (MrCrayfish); LGPL-2.1 | both | neoforge [21.1,) ✓ · minecraft [1.21.1,) ✓ |
| MrCrayfish's Furniture Mod: Refurbished | 1.0.22 (`refurbished_furniture-neoforge-1.21.1-1.0.22.jar`) | CurseForge (MrCrayfish); **code MIT / assets ARR** — manifest-URL distribution | both | framework req [0.13.10,) ✓0.13.11 · neoforge [21.1,) ✓ |
| Energized Furniture | 0.2.0 (`energizedfurniture-1.21.1-0.2.0.jar`) | CurseForge; LicenseRef-ARR | both | neoforge req [21.1.248,) ✓21.1.251 — **ships a template `neoforge.mods.toml`: `refurbished_furniture` is an *undeclared* bytecode dep** (transformer BE subclasses `ElectricityGeneratorBlockEntity`); closure check counts Refurbished as co-required |
| Engineers Delight | 2.0.0 (`engineers_delight-neoforge-1.21.1-2.0.0.jar`, modid `tmted`) | Modrinth; MPL-2.0 | both | minecraft [1.21.1,1.22) ✓ — IE×FD hookup is datapack recipes, no hard code dep |
| Immersive Cooking & Farming | 0.2.0-beta-1 (`immersivecooking-1.21.1-0.2.0-beta-1.jar`) | Modrinth `immersive-cooking-adoon` (akki697222); MIT | both | **immersiveengineering req [12.4.2-194,) — exact match** · farmersdelight/jei/vinery `mandatory=false`→NeoForge treats as **required** (server-verified: missing vinery = FML reject); all present |
| [Let's Do] Vinery | 1.5.3 (`letsdo-vinery-neoforge-1.5.3.jar`) | Modrinth `1DWmBJVA`; ARR | both | architectury req — already locked 13.0.11; chosen over 1.5.4 (released 5 days ago, under the freshness floor) |

**Overlap audit** (Refurbished × Macaw's × Supplementaries × CFB/FD — jar inspection):

- **No recipe collisions**: Refurbished furniture is produced by its own `workbench_constructing` recipes (445 entries, Workbench machine) + dye re-colouring shapeless recipes; appliances add `oven_baking/slicing/freezing/frying/heating/toasting/combining` processing types (68 food-processing entries). Macaw's remains shaped vanilla-material crafting. No cross-mod output/ingredient collisions; Polymorph remains the safety net.
- **Furniture material flow**: Refurbished consumes vanilla wood/iron/quartz through the Workbench; no parallel ingot/wood tier — nothing for Almost Unified to remap.
- **Storage**: Refurbished drawers/fridges/cabinetry are real `Container` BEs → listed in `cookingforblockheads:kitchen_item_providers` (113 rf + 440 mcw = 553 ids); non-storage appliances + sinks + cabinetry shells are `kitchen_connectors` (86 rf ids). Mailboxes, post boxes, recycle bins, plates deliberately excluded from providers.
- **Fluid containers**: Refurbished `kitchen_sink`/`basin`/`toilet`/`bath` expose `FluidContainer` (push/pull, 1000 mB bucket model) but no NeoForge capability — `starforge_compat` registers `Capabilities.FluidHandler.BLOCK` delegating to `push`/`pull`, so Supplementaries faucets/pipes interoperate.
- **Heat**: Refurbished ships native `farmersdelight:heat_sources` data for its light/dark stoves — Stove×FD compatibility is upstream, no pack-side work needed.
- **Electricity**: Refurbished runs its own electricity network (`IElectricityNode` graph). Energized Furniture's transformer is a native `ElectricityGeneratorBlockEntity` fed by FE → the FE→home-grid bridge is upstream-native, bounded by its generation rate; no pack-written converter, no FE↔RF loop possible.
- **Computer**: original apps (Paddle Ball, Home Control, Marketplace, Coin Miner) untouched; `starforge_compat` appends `Starforge Control` (power/stage/food/ammo/oxygen/colony telemetry) and `Security` (horde alarm, TaCZ turrets, guards) via public `Computer.installProgram` + client `Display.bind`, 20-tick cadence, bounded queries only, icons via per-namespace `program_icons.png` insertion order.
- **Food tiers**: Engineers Delight maps FD produce onto IE machines via native datapack recipes (cloche grow, metal press mince, squeezer juice/sauce, fermenter, mixer, bottler, sawmill — `tmted:*` recipes use real IE serializers). Immersive Cooking & Farming adds cookpot / food fermenter / food processor / grill multiblocks + recipe serializers for the high-throughput tier. Tier boundary: FD manual → Engineers Delight mid-scale IE → Immersive Cooking automation → AE2 logistics; no yield inflation, only throughput/automation.
- **i18n**: `gen-mod-lang-zh.mjs` rewritten — Refurbished ships `en_us` only → full 654-key zh_cn generated compositionally (wood/colour prefix × piece suffix); Energized 12, Immersive Cooking 53, Engineers Delight (`tmted`) 15 keys filled. MDM generator section removed.
- **Stage placement**: `electric_age` locks `ef_transformer`/`rf_computer`/`rf_generator`/`tmted_knife`; `heavy_industry_age` locks `ic_cookpot`/`ic_fermenter`/`ic_grill`/`ic_processor`. Furniture decor itself stays unlocked (building materials are T0-open).

**Pending client verification**: computer program install + display rendering + Security alarm toggle round-trip, fluid capability via a real faucet/pipe, CFB kitchen discovery against Refurbished containers, Energized FE→Watt flow, Immersive Cooking multiblock assemble/run/reload stability (beta version flagged).


## Addendum — 2026-09-24 unified logistics/energy: FastPipes (112 enabled)

Incremental change: **added FastPipes 1.3.7** (Modrinth `fast-pipes` `vLNEmWij`, file `fastpipes-1.21.1-1.3.7.jar`, sha1 `ee2fad8b08c0b122ea4d1a7630dc3791e9586706`, 621,646 B). No mods removed. Lockfile regenerated; `audit-deps`/`check-closure` re-verified. Dedicated server booted clean — 38 `fastpipes:*` items in the fresh registry export, `check-mapping` 472/472 semantic ids resolve.

**Role split now enforced**: FastPipes = default item/fluid/FE network; IE conveyors/fluid pipes = visible industrial lines; BuildCraft pipes = legacy shells (all 51 `buildcrafttransport:*_{item,fluid,power,fe}` recipes re-costed to "same-medium FastPipes pipe + classic material" via KubeJS SF-35 — quarry/pump/engine recipes untouched); Railcraft = long-distance freight; AE2 = digital logistics only.

**Runtime capability verification** (`starforge_captest.js` — real block placement, capability probes per side, ticked transfers):

- Item: vanilla chest → FastPipes item pipe (extractor attached via `NetworkManager.getPipe().getAttachmentManager().setAttachmentAndScanGraph`) → chest: items delivered per pull interval.
- Fluid: BuildCraft tank → fluid pipe → tank: 16,000 mB water moved, in = out.
- Energy: Ad Astra energizer (drainable FE buffer, 192,000 FE) → energy pipe (basic extractor) → IC2 electric furnace: source −18,238, sink +15,994, pipe buffer 994 — transfer sustained, no duplication.
- Per-side probes: IC2CRE batbox/generator/cable expose `EnergyStorage` on all six sides (native FE bridge — no converter added, per design); IE `capacitor_lv` exposes FE all sides but `canExtract=false` (receive-only through the cap); `connector_lv` exposes FE on its wired face only; Ad Astra `coal_generator`/`energizer` all sides; `etrionic_capacitor` none; AE2 `energy_acceptor`/`controller` all sides (a lone acceptor stores nothing without a live ME network — upstream semantics); AE2 `energy_cell` none; Energized `energy_transformer` all sides; BC `mj_dynamo` outputs FE top face only, `engine_fe` exposes no FE cap (BC's own pipe-flow path); Railcraft `charge_terminal`/`charge_motor` expose no FE cap — Charge joins the grid through `starforge_compat:charge_bridge` (official `ChargeBlock` node API; captest-measured FE→Charge and Charge→FE at exactly 1:1, 256 FE/t cap, FastPipes end-to-end both directions, redstone suppression, AUTO dead-zone, restart persistence all verified); Refurbished `kitchen_sink` FluidHandler verified on all six sides via the starforge_compat bridge; Refurbished `cooler` exposes no ItemHandler (not an automation container — upstream semantics).

**Energy conservation**: pipes transfer only; sampled link shows source-loss ≥ sink-gain + pipe buffer, no generation path. All conversions (FE↔MJ via BC's own dynamo/engine, FE→Watt via Energized transformer, IC2 native FE port at 4 FE = 1 EU) are one-way or upstream-native — no loop channels exist.

**Pending manual verification**: attachment GUI filter/priority/routing modes, IE visual line ↔ FastPipes backend hookup at production scale, chunk unload/reload and network re-scan behaviour.
