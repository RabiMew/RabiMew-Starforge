// Builds a distributable Alpha archive into dist/. Third-party mod jars are
// NOT included (license-safe): recipients run tools/setup-server.mjs, which
// downloads every jar from its official source per manifest/locked-mods.json.
// Usage: node tools/package.mjs [name]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(path.join(root, 'manifest/locked-mods.json'), 'utf8'));
const name = process.argv[2] ?? `starforge-alpha-mc${lock.minecraft}-nf${lock.neoforge_version}`;
const dist = path.join(root, 'dist');
mkdirSync(dist, { recursive: true });
const rel = `dist/${name}.zip`; // relative: bsdtar parses "C:\..." as a remote host
const out = path.join(root, rel);
if (existsSync(out)) rmSync(out);

const include = ['manifest', 'pack', 'tools', 'docs', 'design', 'localization',
  'registry-export', 'README.md', 'LICENSE'];

// bsdtar (Windows 10+ / macOS / Linux) creates a zip when the name ends in .zip
execFileSync('tar', ['-acf', rel, ...include], { cwd: root, stdio: 'inherit' });
console.log(`wrote ${out}`);
