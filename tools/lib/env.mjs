// Environment checks: Node >= 20 (fetch/structuredClone) and a Java 21
// executable. Java resolution order: $STARFORGE_JAVA -> `java` on PATH ->
// well-known JDK install roots (Temurin/Adoptium, Microsoft, Zulu, Corretto,
// Liberica, Oracle, macOS JVMs, Linux /usr/lib/jvm). Returns the absolute
// java path or exits with instructions — callers never guess.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    console.error(`need Node.js >= 20 (got ${process.versions.node})`);
    process.exit(1);
  }
  return process.versions.node;
}

function javaMajor(exe) {
  const v = spawnSync(exe, ['-version'], { encoding: 'utf8' });
  if (v.error) return null;
  const m = (v.stderr + v.stdout).match(/version "(\d+)/);
  return m ? Number(m[1]) : null;
}

function* candidateJavas() {
  if (process.env.STARFORGE_JAVA) yield process.env.STARFORGE_JAVA;
  yield 'java';
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  const roots = process.platform === 'win32'
    ? [
        'C:/Program Files/Eclipse Adoptium',
        'C:/Program Files/Microsoft',
        'C:/Program Files/Zulu',
        'C:/Program Files/Amazon Corretto',
        'C:/Program Files/BellSoft',
        'C:/Program Files/Java',
      ]
    : process.platform === 'darwin'
      ? ['/Library/Java/JavaVirtualMachines']
      : ['/usr/lib/jvm'];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      const bin = process.platform === 'darwin'
        ? path.join(root, dir, 'Contents/Home/bin', exe)
        : path.join(root, dir, 'bin', exe);
      if (existsSync(bin)) yield bin;
    }
  }
}

// Locate a Java 21 executable. Prefers $STARFORGE_JAVA / PATH, then scans
// installed JDKs. Dies with exit 1 when nothing qualifies.
export function findJava21() {
  const tried = [];
  for (const exe of candidateJavas()) {
    const major = javaMajor(exe);
    tried.push(`${exe} -> ${major ?? 'n/a'}`);
    if (major === 21) {
      if (exe !== 'java') console.log(`java 21: ${exe}`);
      return exe;
    }
  }
  console.error('need Java 21; none found. Tried:');
  for (const t of tried) console.error(`  ${t}`);
  console.error('Install Temurin 21 or set STARFORGE_JAVA to a java 21 binary.');
  process.exit(1);
}
