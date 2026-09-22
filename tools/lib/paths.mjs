// Shared path helpers. All tools resolve against the repo root (one level up
// from tools/lib/), never against the caller's cwd.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const p = (...segs) => path.join(ROOT, ...segs);

export const DIRS = {
  manifest: p('manifest'),
  mods: p('mods'),
  // Non-mod locked downloads (shaderpacks etc.) — gitignored via build/.
  resources: p('build', 'resources'),
  pack: p('pack'),
  runClient: p('run', 'client'),
  runServer: p('run', 'server'),
  dist: p('dist'),
};
