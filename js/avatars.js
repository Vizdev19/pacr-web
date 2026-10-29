// ─────────────────────────────────────────────────────────────────────────────
// Runner faces — the app's 12 illustrated avatars, on the web.
//
// Ported from pacr/src/components/feed/defaultAvatars.ts and
// src/services/avatarPreset.ts. KEEP IN SYNC: the keys, their order and
// hashOf must match the app exactly, or a runner wears a different face here.
//
//   chosen     users.avatar_path = "preset:<key>" — the runner picked one in
//              the app. Never a Storage object; signedUrlsFor maps it here.
//   automatic  no photo and no choice: hashOf(user id) % 12. The id only
//              picks one of 12 pictures, so the URL says nothing about it.
//
// The files in /assets/avatars are 256 px copies of the app's 512 px art.
// ─────────────────────────────────────────────────────────────────────────────

import { esc, initials, signedUrlsFor } from './supabase.js';

const KEYS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const PREFIX = 'preset:';

const artUrl = key => `/assets/avatars/pacr_avatar_${key}.png`;

/** The app's hash (activity/ui.ts hashOf): ×31 + char code, wrapped to int32. */
function hashOf(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const isPresetPath = p => typeof p === 'string' && p.startsWith(PREFIX);

/** The art for a chosen avatar, or null for a photo path / unknown key. */
export function chosenArtUrl(path) {
  if (!isPresetPath(path)) return null;
  const key = path.slice(PREFIX.length);
  return KEYS.includes(key) ? artUrl(key) : null;
}

/** The automatic face for a runner without a photo, or null without an id. */
export function autoArtUrl(id) {
  return id ? artUrl(KEYS[hashOf(String(id)) % KEYS.length]) : null;
}

/**
 * A runner's face as HTML: their photo or chosen avatar (`url`, already
 * signed — signedUrlsFor turns a chosen one into its art), else their
 * automatic face, else initials.
 */
export function faceHtml(name, url, id) {
  const src = url || autoArtUrl(id);
  return src ? `<img src="${esc(src)}" alt="">` : esc(initials(name));
}

/**
 * Faces for a page of runners in one query: id → photo / chosen-art URL, or
 * '' for a runner with neither (their automatic face). A runner whose row RLS
 * hides from us (a stranger on Discover) is absent, and keeps initials: we
 * can't tell "no photo" from "can't see it", and a cartoon over somebody's
 * real photo would be wrong.
 */
export async function facesFor(sb, ids) {
  const out = new Map();
  const unique = [...new Set((ids ?? []).filter(Boolean))];
  if (!sb || unique.length === 0) return out;
  try {
    const { data } = await sb.from('users').select('id, avatar_path').in('id', unique);
    const signed = await signedUrlsFor(sb, 'avatars', (data ?? []).map(u => u.avatar_path).filter(Boolean));
    for (const u of data ?? []) out.set(u.id, (u.avatar_path && signed.get(u.avatar_path)) || '');
  } catch {
    // Initials all round — the page works without faces.
  }
  return out;
}

/** faceHtml for a runner looked up with facesFor. */
export function faceFrom(faces, id, name) {
  return faces.has(id) ? faceHtml(name, faces.get(id), id) : esc(initials(name));
}
