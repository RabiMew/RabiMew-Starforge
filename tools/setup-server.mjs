// Bootstraps a dedicated Starforge server from a clean checkout:
//   1. verify Java 21
//   2. download + run the NeoForge installer into run/server (if needed)
//   3. fetch locked mod jars + sync them into run/server/mods
//   4. sync the pack overlay (configs, kubejs)
//   5. accept EULA + write baseline server.properties
// Usage: node tools/setup-server.mjs
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkNode, findJava21 } from './lib/env.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = (...args) => {
  const r = spawnSync(args[0], args.slice(1), { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`command failed: ${args.join(' ')}`);
};

// 1. Node + Java 21 (STARFORGE_JAVA -> PATH -> installed JDK scan)
checkNode();
const javaExe = findJava21();
console.log('java 21 ok');

// 2. NeoForge dedicated server
const meta = JSON.parse(readFileSync(path.join(root, 'manifest/locked-mods.json'), 'utf8'));
const nfVer = meta.neoforge_version ?? '21.1.251';
const serverDir = path.join(root, 'run/server');
const argsFile = path.join(serverDir, `libraries/net/neoforged/neoforge/${nfVer}/win_args.txt`);
if (!existsSync(argsFile)) {
  mkdirSync(serverDir, { recursive: true });
  const installer = path.join(serverDir, `neoforge-${nfVer}-installer.jar`);
  if (!existsSync(installer)) {
    const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${nfVer}/neoforge-${nfVer}-installer.jar`;
    console.log('downloading neoforge installer...');
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    writeFileSync(installer, buf);
  }
  console.log('installing neoforge server (patch step takes a few minutes)...');
  run(javaExe, '-jar', installer, '--installServer', serverDir);
}
if (!existsSync(argsFile)) throw new Error('neoforge install did not produce win_args.txt');
console.log('neoforge server ok');

// 3-4. mods + pack (lockfile-pinned downloads; never re-resolves versions)
run('node', 'tools/fetch-mods.mjs', '--locked');
run('node', 'tools/sync-mods.mjs', 'server');
run('node', 'tools/sync-pack.mjs', 'server');

// 5. eula + baseline properties (keep an existing file's other keys)
writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true\n');
const propsPath = path.join(serverDir, 'server.properties');
let props = existsSync(propsPath) ? readFileSync(propsPath, 'utf8') : '';
const set = (k, val) => {
  props = new RegExp(`^${k}=`, 'm').test(props)
    ? props.replace(new RegExp(`^${k}=.*`, 'm'), `${k}=${val}`)
    : props + `\n${k}=${val}`;
};
set('online-mode', 'false'); // dev alpha; set true for public deployment
set('enable-rcon', 'true');
set('rcon.password', 'starforge');
set('rcon.port', '25575');
writeFileSync(propsPath, props.trimStart());

const jvmArgs = path.join(serverDir, 'user_jvm_args.txt');
if (!existsSync(jvmArgs)) writeFileSync(jvmArgs, '-Xmx6G\n-Xms6G\n');

console.log('\nDone. Start the server with:');
console.log(`  cd run/server`);
console.log(`  "${javaExe}" @user_jvm_args.txt @libraries/net/neoforged/neoforge/${nfVer}/win_args.txt nogui`);
