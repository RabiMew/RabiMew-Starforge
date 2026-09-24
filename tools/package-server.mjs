// Builds the dedicated-server package:
//   dist/starforge-<channel>-<version>-server.zip
// Contains everything needed to bootstrap a server from a clean unzip:
//   manifest/ pack/ tools/ docs/ design/ localization/ registry-export/
//   LICENSE README.md SERVER_README.md
// Third-party jars are NOT redistributed — the recipient runs
// `node tools/setup-server.mjs`, which downloads every locked mod from its
// pinned official URL and verifies hashes.
// Usage: node tools/package-server.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DIRS, ROOT, p } from './lib/paths.mjs';
import { checkNode } from './lib/env.mjs';
import { loadLock, loadVersion, artifactStem, packVersionId, enabledMods, EXPECTED } from './lib/manifest.mjs';
import { enabledResources } from './lib/resources.mjs';
import { createZip } from './lib/zip.mjs';
import { thirdPartyModsMd } from './lib/license.mjs';

checkNode();
const lock = loadLock();
const version = loadVersion();
const stem = artifactStem(version);
mkdirSync(DIRS.dist, { recursive: true });

const INCLUDE_DIRS = ['manifest', 'pack', 'tools', 'docs', 'design', 'localization', 'registry-export', 'compat'];
const INCLUDE_FILES = ['README.md', 'LICENSE'];

const SKIP_DIRS = new Set(['build', 'node_modules']); // gitignored build outputs

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(full);
    } else yield full;
  }
}

const entries = [];
for (const dir of INCLUDE_DIRS) {
  const abs = p(dir);
  if (!existsSync(abs)) continue;
  for (const f of walk(abs)) {
    if (f.endsWith('.jar')) { console.error(`refusing to embed jar: ${f}`); process.exit(1); }
    entries.push({ name: path.relative(ROOT, f).replace(/\\/g, '/'), data: readFileSync(f) });
  }
}
for (const f of INCLUDE_FILES) {
  const abs = p(f);
  if (existsSync(abs)) entries.push({ name: f, data: readFileSync(abs) });
}

const serverReadme = `# ${EXPECTED.name} / ${EXPECTED.nameZh} — dedicated server

Version: ${packVersionId(version)} · Minecraft ${EXPECTED.minecraft} · NeoForge ${EXPECTED.neoforge} · Java ${EXPECTED.java}
Author: ${EXPECTED.author} · Project home: this GitHub repository

## Requirements

- Node.js >= 20
- **Java 21** (Temurin 21 recommended). If \`java\` on PATH is a different
  version, set \`STARFORGE_JAVA\` to the java 21 executable — the setup script
  also auto-detects common JDK install locations.

## Install

    node tools/setup-server.mjs

This will:
- verify Java 21
- download + install the NeoForge ${EXPECTED.neoforge} dedicated server into run/server/
- download every locked mod from manifest/locked-mods.json pinned URLs and
  verify size + SHA-256 + SHA-512 (+SHA-1 when present)
- sync pack/ configs and KubeJS scripts into run/server/
- write eula.txt and a baseline server.properties

## Start

    cd run/server
    java @user_jvm_args.txt @libraries/net/neoforged/neoforge/${EXPECTED.neoforge}/win_args.txt nogui

(on Linux/macOS use unix_args.txt)

## Security notes — read before opening to the internet

- The generated server.properties sets \`online-mode=false\`. **This is a
  development/testing default only.** Any public server MUST switch to
  \`online-mode=true\` — offline mode disables account authentication.
- RCON is enabled for dev tooling with the sample password \`starforge\`.
  Change \`rcon.password\` to a unique secret before exposing port 25575, or
  disable RCON entirely on a public server.
- Review whitelist.json / ops.json before going public.

## License

Original pack content is MIT (see LICENSE). Third-party mods keep their own
licenses and are fetched from official sources at install time rather than
redistributed inside this zip.
`;
entries.push({ name: 'SERVER_README.md', data: Buffer.from(serverReadme, 'utf8') });
// Provenance manifest: no jars are redistributed, but the recipient should be
// able to audit every source the setup script will hit.
entries.push({ name: 'THIRD_PARTY_MODS.md', data: Buffer.from(thirdPartyModsMd({
  packName: `${EXPECTED.name} / ${EXPECTED.nameZh}`,
  versionId: packVersionId(version), minecraft: EXPECTED.minecraft, neoforge: EXPECTED.neoforge,
  variants: [],
  rows: [
    ...enabledMods(lock).map((m) => ({ entry: m, type: 'mod' })),
    ...enabledResources(lock).map((r) => ({ entry: r, type: r.type ?? 'resource' })),
  ],
}), 'utf8') });

const out = p('dist', `${stem}-server.zip`);
writeFileSync(out, createZip(entries));
console.log(`wrote ${out} (${entries.length} entries, no third-party jars)`);
