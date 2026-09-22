// Shared fetch helpers with the pack's User-Agent.
export const HEADERS = { 'User-Agent': 'RabiMew-Starforge/modpack-dev (github.com/RabiMew/RabiMew-Starforge)' };

export async function fetchBuffer(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function fetchJson(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}
