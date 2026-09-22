// Unified release pipeline — one command builds and verifies everything:
//   node tools/release.mjs [--local]
//
//   validate-design -> build-pack -> fetch-mods --locked -> hash validation
//   -> audit-deps -> client sync -> server sync validation
//   -> package-client (.mrpack) -> package-server -> verify-release
//   -> dist/release-report.md
//
// Any failed step aborts the pipeline immediately — a release never ships
// looking green while a stage is broken. The report is written either way.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DIRS, p } from './lib/paths.mjs';
import { checkNode } from './lib/env.mjs';
import { runNode } from './lib/run.mjs';
import {
  loadLock, loadVersion, artifactStem, packVersionId,
  sideCounts, sideMods, CLIENT_ACCEPTS, EXPECTED,
} from './lib/manifest.mjs';
import { ensureLockedJars, backfillSha1 } from './lib/jars.mjs';

checkNode();
const withLocal = process.argv.includes('--local');
const started = new Date();
const steps = []; // {name, ok, ms, error?}

async function stage(name, fn) {
  const t0 = Date.now();
  console.log(`\n=== ${name}`);
  try {
    await fn();
    steps.push({ name, ok: true, ms: Date.now() - t0 });
    return true;
  } catch (e) {
    steps.push({ name, ok: false, ms: Date.now() - t0, error: e.message });
    console.error(`STEP FAILED: ${e.message}`);
    await finish();
    process.exit(1);
  }
}

let lock, version, stem, mrpackOk = false, serverOk = false, localOk = false;

await stage('validate-design', async () => runNode('tools/validate-design.mjs'));
await stage('build-pack', async () => runNode('tools/build-pack.mjs'));
await stage('export-quests', async () => runNode('tools/export-quests.mjs'));
await stage('fetch-mods (locked)', async () => runNode('tools/fetch-mods.mjs', ['--locked']));

await stage('hash validation', async () => {
  lock = loadLock();
  const { jars, errors } = await ensureLockedJars(lock, { downloadMissing: false });
  if (errors.length) throw new Error(errors.join('; '));
  const n = backfillSha1(lock, jars);
  console.log(`  ${jars.size} jars re-verified` + (n ? `, sha1 backfilled on ${n}` : ''));
});

await stage('dependency audit', async () => runNode('tools/audit-deps.mjs'));

await stage('client sync', async () => {
  runNode('tools/sync-mods.mjs', ['client']);
  runNode('tools/sync-pack.mjs', ['client']);
});
await stage('server sync validation', async () => {
  runNode('tools/sync-mods.mjs', ['server']);
  runNode('tools/sync-pack.mjs', ['server']);
});

await stage('client package (.mrpack)', async () => {
  runNode('tools/package-client.mjs');
  mrpackOk = true;
});
await stage('server package', async () => {
  runNode('tools/package-server.mjs');
  serverOk = true;
});
if (withLocal) {
  await stage('local test zip', async () => {
    runNode('tools/package-client.mjs', ['--local']);
    localOk = true;
  });
}
await stage('verify release', async () => runNode('tools/verify-release.mjs'));

async function finish() {
  lock ??= loadLock();
  version ??= loadVersion();
  stem ??= artifactStem(version);
  const counts = sideCounts(lock);
  const clientN = sideMods(lock, CLIENT_ACCEPTS).length;
  const serverN = sideMods(lock, ['both', 'server']).length;
  mkdirSync(DIRS.dist, { recursive: true });

  // mods that stayed on non-Modrinth primary URLs (from the client report)
  const clientReport = p('dist', 'client-package-report.md');
  const attention = existsSync(clientReport)
    ? [...readFileSync(clientReport, 'utf8').matchAll(/^- \*\*(.+?)\*\* (.+?) \(`(.+?)`\)/gm)]
        .map((m) => `- ${m[1]} ${m[2]} (\`${m[3]}\`)`)
    : [];

  const distFiles = existsSync(DIRS.dist) ? readdirSync(DIRS.dist).sort() : [];
  const lines = `# Starforge release report

- Pack: ${EXPECTED.name} / ${EXPECTED.nameZh}
- Version: \`${packVersionId(version)}\` (stem \`${stem}\`)
- Minecraft: ${lock.minecraft} · NeoForge: ${lock.neoforge_version} · Java: ${EXPECTED.java}
- Built: ${started.toISOString()}

## Mod counts

| side | mods |
| --- | --- |
| both | ${counts.both} |
| client | ${counts.client} |
| server | ${counts.server} |
| **client package set** | **${clientN}** (both+client) |
| **server set** | **${serverN}** (both+server) |

## Pipeline steps

| step | result | ms |
| --- | --- | --- |
${steps.map((s) => `| ${s.name} | ${s.ok ? 'PASS' : `FAIL — ${s.error}`} | ${s.ms} |`).join('\n')}

## Artifacts

- .mrpack: ${mrpackOk ? 'built' : 'not built'}
- server zip: ${serverOk ? 'built' : 'not built'}
- local test zip: ${localOk ? 'built (LOCAL TEST ONLY)' : 'not built'}
- dist/ contents:
${distFiles.map((f) => `  - ${f}`).join('\n')}

## Mods not entering .mrpack / needing manual attention

${attention.length ? attention.join('\n') : 'None — all client files resolved to fetchable official URLs.'}
(server-only mods are excluded by design; see dist/client-package-report.md for per-mod sources)

## Tests actually executed this run

${steps.map((s) => `- ${s.name}: ${s.ok ? 'PASS' : 'FAIL'}`).join('\n')}

## Not verified this run

- Real GUI client launch (requires an interactive launcher + display)
- Live dedicated-server boot against this exact artifact set
- Manual gameplay acceptance per docs/combat-benchmark.md
`;
  writeFileSync(p('dist', 'release-report.md'), lines);
  console.log('\nwrote dist/release-report.md');
}
await finish();
const failed = steps.filter((s) => !s.ok);
if (failed.length) process.exit(1);
console.log(`\nrelease pipeline complete: ${stem}`);
