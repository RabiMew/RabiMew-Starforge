// Run a child process; throw on non-zero exit. No shell wrapper — `node` and
// other .exe names resolve via PATH directly (avoids DEP0190 arg-escaping).
import { spawnSync } from 'node:child_process';
import { ROOT } from './paths.mjs';

export function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT, stdio: opts.quiet ? 'pipe' : 'inherit',
    encoding: 'utf8', ...opts,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`command failed (${r.status}): ${cmd} ${args.join(' ')}`);
  return r;
}

export const runNode = (script, args = [], opts) => run('node', [script, ...args], opts);
