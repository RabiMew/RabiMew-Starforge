// Deterministic 63-bit hex ids for FTB Quests objects.
// Id = sha256("ftbquests/<type>:<path>")[0..8] masked to 63 bits, uppercase hex.
// The type+path namespacing prevents collisions between chapters, quests,
// tasks, rewards and manual pages that share a local name.
import { createHash } from 'node:crypto';

const MASK63 = 0x7fffffffffffffffn;

export function hexId(type, p) {
  const h = createHash('sha256').update(`ftbquests/${type}:${p}`).digest();
  const v = BigInt('0x' + h.subarray(0, 8).toString('hex')) & MASK63;
  return v.toString(16).toUpperCase().padStart(16, '0');
}
