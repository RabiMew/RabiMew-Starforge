// Resolves .mrpack-compatible download URLs for locked mods.
//
// Rule: a file entry may point at any official host, but we prefer Modrinth's
// CDN because it is always allowed and hash-verified. For non-Modrinth sources
// (CurseForge CDN / GitHub Releases / FTB Maven) we query Modrinth's
// version_file API with the jar's sha512 — if the identical file exists there
// we use that URL as primary and keep the original as a fallback mirror.
// Identity is proven by sha512+sha1+size, never by filename.
import { fetchJson } from './download.mjs';

export const MRPACK_HOSTS = [
  /^https:\/\/cdn\.modrinth\.com\//,
  /^https:\/\/github\.com\//,
  /^https:\/\/maven\.ftb\.dev\//,
  /^https:\/\/maven\.neoforged\.net\//,
];

export function hostKind(url) {
  if (/^https:\/\/cdn\.modrinth\.com\//.test(url)) return 'modrinth_cdn';
  if (/^https:\/\/mediafilez\.forgecdn\.net\//.test(url)) return 'curseforge_cdn';
  if (/^https:\/\/github\.com\//.test(url)) return 'github_release';
  if (/^https:\/\/maven\.ftb\.dev\//.test(url)) return 'ftb_maven';
  return 'other';
}

// Look up a file on Modrinth by hash. Returns {url, sha1, sha512, size,
// filename} for the matching file, or null when absent / unreachable.
export async function modrinthFileBySha512(sha512) {
  let v;
  try {
    v = await fetchJson(`https://api.modrinth.com/v2/version_file/${sha512}?algorithm=sha512`);
  } catch {
    return null; // 404 = not on modrinth; network error = unknown, treated same
  }
  const f = (v.files ?? []).find((x) => x.hashes?.sha512 === sha512) ?? v.files?.[0];
  if (!f?.url) return null;
  return { url: f.url, sha1: f.hashes?.sha1 ?? null, sha512: f.hashes?.sha512 ?? null,
    size: f.size ?? null, filename: f.filename ?? null };
}

// Decide the downloads[] list for one locked mod + its jar facts.
// Returns {downloads, primary, kind, modrinthMirror, note} where `note`
// explains any deviation that belongs in the client package report.
export async function resolveDownloads(mod, jar /* {sha1, sha512, size} */) {
  const original = mod.download_url;
  const kind = mod.distribution ?? hostKind(original);
  const out = { downloads: [original], primary: original, kind, modrinthMirror: null, note: null };

  if (kind === 'modrinth_cdn') return out; // already ideal

  // Try to find the identical file on Modrinth.
  const hit = await modrinthFileBySha512(jar.sha512).catch(() => null);
  const identical = hit && hit.sha512 === jar.sha512 &&
    (hit.sha1 == null || hit.sha1 === jar.sha1) &&
    (hit.size == null || hit.size === jar.size);
  if (identical) {
    out.downloads = [hit.url, original];
    out.primary = hit.url;
    out.modrinthMirror = hit.url;
    out.note = `${kind} source; identical file found on Modrinth (hash-verified) — used as primary.`;
    return out;
  }

  if (kind === 'curseforge_cdn') {
    out.note = 'CurseForge CDN link; no identical Modrinth file found. ' +
      'Link is publicly fetchable but CurseForge redistribution terms apply — needs manual license check.';
  } else if (kind === 'ftb_maven') {
    out.note = 'FTB Maven (official) link; no identical Modrinth file found.';
  } else if (kind === 'github_release') {
    out.note = 'GitHub Releases (official) link; no identical Modrinth file found.';
  } else {
    out.note = `unrecognized source host; no identical Modrinth file found — manual review needed.`;
  }
  return out;
}
