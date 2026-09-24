# 打包与分发 / Packaging & Distribution

本文档说明 Starforge 的发布产物、双版本策略、许可证边界与安全校验方法。
打包实现见 `tools/package-client.mjs`、`tools/package-server.mjs`、`tools/package.mjs`。

## 发布产物总览

`node tools/release.mjs` 一次产出以下玩家/服主可用的文件（`dist/`）：

| 文件 | 受众 | 内容 |
| --- | --- | --- |
| `starforge-<channel>-<ver>.mrpack` | 海外 / 网络畅通玩家 | 标准版：除自研附属外不内嵌任何第三方 jar，安装时启动器按 `modrinth.index.json` 从官方地址下载并校验 sha1+sha512 |
| `starforge-<channel>-<ver>-cn.mrpack` | 中国大陆玩家 | 离线友好版：许可证明确允许再分发的文件直接内嵌在 `overrides/`；其余仍走官方下载。同一标准 mrpack 格式 |
| `starforge-<channel>-<ver>-server.zip` | 服主 | 源码+清单+安装脚本，无第三方 jar；`node tools/setup-server.mjs` 按 lockfile 固定 URL 下载校验 |
| `THIRD_PARTY_MODS.md` | 所有人 | 全部第三方文件的来源清单（名称/版本/文件名/许可证/项目地址/下载地址/SHA-256/SHA-512/两版各自处置方式与原因） |
| `SHA256SUMS.txt` | 所有人 | 各包内嵌文件的 sha256 清单（`sha256sum -c` 兼容） |
| `client-package-report.md` | 维护者 | 逐 Mod 来源解析、镜像替换、需人工确认项、lockfile 审计结果 |
| `release-report.md` | 维护者 | 流水线各阶段结果与产物清单 |

`-local.zip`（`--local` 产出）是开发者本机测试包，**永远不是发布物**。

## 双版本策略的理由

标准版体积小（<1 MB）、每个字节都能经 `modrinth.index.json` 的哈希回溯到
Modrinth / CurseForge / GitHub Releases / FTB Maven 官方来源，是默认推荐。

但中国大陆玩家导入时需要逐一访问境外 CDN/API：Modrinth CDN 与
`mediafilez.forgecdn.net` 在部分网络下缓慢或不可达。CN 版把**许可证允许
再分发**的文件（MIT/GPL/LGPL/AGPL/MPL/BSD/Unlicense 等约 70 个）直接随包
提供，导入时只剩约 40 个文件需要联网——主要是 All-Rights-Reserved 与
许可证待人工确认的 Mod（如 Sophisticated 系列、Xaero's、Sodium、AE2 等）。

**我们不会为消除启动器警告而乱来**：内嵌与否由许可证决定，不由"想让
Prism 不提示"决定。不能合法内嵌的 Mod 一律保留官方下载，绝不伪装来源、
绝不绕过哈希校验。

## 内嵌判定规则（tools/lib/license.mjs）

| 许可证类别 | 例子 | CN 版处置 |
| --- | --- | --- |
| permissive | MIT、GPL/LGPL/AGPL 全家、MPL-2.0、BSD、Unlicense、CC0 | 内嵌 |
| forbidden | All-Rights-Reserved、unknown/unknown-cf、无许可证 | 永不内嵌（除非 lockfile 有授权记录） |
| review | `LicenseRef-*` 自定义、CC-BY-NC-SA、see-repo | 默认不内嵌；`redistribution:"allow"` + `redistribution_note` 才内嵌 |

lockfile 每条目可显式标注 `redistribution: "allow"|"deny"` +
`redistribution_note`（依据说明）。`allow` 缺 note 会中止构建；
`deny` 可强制即使宽松许可也不内嵌（如作者要求只走平台下载）。

## 构建期自动检查（tools/lib/lockcheck.mjs）

`package-client.mjs`、`package.mjs`、`release.mjs`（首个阶段）与
`verify-release.mjs` 都会执行审计，fatal 项直接中止：

- 重复的 key / 文件名 / sha512（同一文件被锁定两次 = 重复 Mod）
- 启用条目缺许可证、缺 download_url、缺 size/sha256/sha512
- 未知来源主机（`distribution` 缺失且 URL 不在已知官方域名内）
- `redistribution:"allow"` 但没有 `redistribution_note`
- `pack/` 中出现 jar、可执行文件、`mods/`、`libraries/`、`saves/` 等
  非整合包自有内容；`shaderpacks|resourcepacks|datapacks|tacz/` 下的 zip
  归档必须走带来源记录的 files[]/embed 通道
- 标准版中平台可下载的 Mod 无 `embed_reason` 却被内嵌

警告级（写入 `dist/client-package-report.md`，不中止）：
- `distribution` 未声明但可由 URL 推断
- 版本号未体现在文件名中（数字令牌比对）
- jar 内 `mods.toml` 字面版本与锁定版本不一致
- review 类许可证（CN 版将保留远程下载）与非常规 overrides 顶层目录

## 安装方式（三启动器通用）

Prism Launcher / HMCL / PCL 均原生支持 `.mrpack`：新建实例 → 导入/从文件
安装 → 选择 `.mrpack`。标准版与 CN 版流程完全一致。

### Prism 的"未托管 Mod"提示

CN 版导入时 Prism 可能列出几十个"未在 Modrinth/CurseForge 托管"的 Mod。
**这是针对本地随包 jar 的通用安全提醒，不是病毒检测**：内嵌 jar 在打包时
已对 lockfile 做过 size+SHA-256+SHA-512 校验，与官方文件逐字节一致。
点击确认继续即可。

### 自行校验（可选）

```sh
# 把 .mrpack 当 zip 解开，取出 SHA256SUMS.txt 放进实例 .minecraft/
cd .minecraft
sha256sum -c SHA256SUMS.txt        # Windows 可用 Git Bash / WSL
# 或 PowerShell 逐文件：Get-FileHash -Algorithm SHA256 <path>
```

## GitHub Release 流程

1. 确认 `manifest/version.json` 版本号已递增。
2. `node tools/release.mjs` —— 全绿才继续；报告落在 `dist/release-report.md`。
3. 检查 `dist/client-package-report.md` 的"需人工确认"清单（CurseForge CDN
   无 Modrinth 镜像的条目等），确认可接受。
4. 创建 Release 并上传产物：

```sh
gh release create v<version>-<channel> \
  dist/starforge-<channel>-<ver>.mrpack \
  dist/starforge-<channel>-<ver>-cn.mrpack \
  dist/starforge-<channel>-<ver>-server.zip \
  dist/THIRD_PARTY_MODS.md dist/SHA256SUMS.txt \
  dist/client-package-report.md dist/release-report.md \
  --title "Starforge <version> (<channel>)" --notes-file < notes.md
```

5. Release notes 需写明两版区别：标准版 = 全量官方下载（网络畅通/海外
   玩家），CN 版 = 许可允许的文件内嵌（大陆玩家，一次下载基本装完）。

## overrides/ 边界

`pack/` → `overrides/` 只承载整合包自有内容：`config/`、`kubejs/`、
`shaderpacks/*.txt` 预设、任务书与本地化。第三方 jar 只能通过 lockfile
声明 + 内嵌通道进入 `overrides/mods/`；资源归档（光影 zip、枪包 zip）
同理走 `overrides/<原路径>` 且必须许可证允许。
