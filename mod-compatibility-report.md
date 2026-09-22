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

Keybind delivery: `pack/config/defaultoptions/keybindings.txt` — only fires on factory-default mappings, so updating the pack never resets player-customized keys. Full mapping table and the duplicate-key audit are in `docs/compatibility.md`.

Known limitation (verified, not hidden): JEI 19.57 stores `overlayEnabled` only in memory (`ClientToggleState` bytecode; no config key exists) — hiding the JEI sidebar requires Ctrl+O per session. Immersive Petroleum reservoir `/place feature` deadlocks chunk gen → watchdog kill; natural generation unaffected (details in `docs/compatibility.md` §实测记录）.

## Method

- Queried Modrinth API per project with `loaders=["neoforge"]`, `game_versions=["1.21.1"]`; selected the newest version **per release channel** and compared against `manifest/locked-mods.json`.
- Non-Modrinth sources checked at their origin: GitHub Releases (IC2CRE, BuildCraft CE), FTB Maven metadata (`maven.ftb.dev`), and Modrinth mirrors for the CurseForge-sourced files (Immersive Petroleum, Defense Turrets, Jade Addons, Let Me Despawn; Building Gadgets 2 has no Modrinth project — CurseForge page checked).
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
| Defense Turrets | 1.2.0 | 1.2.0 (Modrinth mirror latest release) | both | — |
| In Control! | 1.21-10.3.0 | beta:1.21-10.3.0 — **no release channel exists for 1.21.1** | both | lostcities opt, kubejs opt |
| ProgressiveStages | 3.0.5 | release:3.0.5 | both | emi/jei opt, ftbteams/ftbquests opt |
| KubeJS | 2101.7.2-build.377 | release:2101.7.2-build.377 | both | rhino req [2101.2.7-build.81,) ✓build.85; jei opt [19.25.0.322,) |
| FTB Quests | 2101.1.36 | 2101.1.36 (FTB Maven latest 2101.x) | both | architectury req [13.0.8,) ✓13.0.11; ftblibrary req [2101.1.36,) ✓; ftbteams req [2101.1.9,) ✓ |
| Farmer's Delight | 1.21.1-1.3.4 | release:1.3.4 | both | crafttweaker opt (absent) |
| Cooking for Blockheads | 21.1.24 | release:21.1.24 | both | balm req [21.0.39,) ✓21.0.65 |
| Rechiseled | 1.2.6 | release:1.2.6 | both | supermartijn642corelib req, supermartijn642configlib req, fusion req — all satisfied |
| FramedBlocks | 10.6.1 | release:10.6.1 | both | all optional (create/jei/emi/ae2…) |
| Supplementaries | 1.21.1-3.9.9 | release:3.9.9 | both | moonlight req [1.21-3.6.4,) ✓3.6.8; **incompatible: farmersdelight<1.3.0** (have 1.3.4 ✓), **sodium<0.8.12-beta.1** (have 0.8.13 ✓) |
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
| Sodium (NeoForge) | 0.8.13 | release:0.8.13 | client | incompatible: embeddium (not installed ✓) |
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
| SuperMartijn642 Core | 1.1.24a | release:1.1.24a | both | — |
| SuperMartijn642 Config | 1.1.8 | release:1.1.8 | both | — |
| Fusion | 1.3.15b | release:1.3.15b | both | — |
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
