// Runner faces: the app's 12 illustrated avatars, on the web.
//
// Ported from pacr/src/components/feed/defaultAvatars.ts and
// src/services/avatarPreset.ts (as the old site's js/avatars.js was). KEEP IN
// SYNC: the keys, their order and hashOf must match the app exactly, or a
// runner wears a different face here.
//
//   chosen     users.avatar_path = "preset:<key>": the runner picked one in the
//              app. It is never a Storage object; signedUrls() maps it here.
//   automatic  no photo and no choice: hashOf(user id) % 12. The id only picks
//              one of 12 pictures, so the URL says nothing about it.
//
// The files in public/assets/avatars are 256 px copies of the app's 512 px art.

const KEYS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const PREFIX = "preset:";
const artUrl = (key: string) => `/assets/avatars/pacr_avatar_${key}.png`;

/** The app's hash (activity/ui.ts hashOf): ×31 + char code, wrapped to int32. */
function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const isPresetPath = (p: string | null | undefined): p is string => typeof p === "string" && p.startsWith(PREFIX);

/** The art for a chosen avatar, or null for a photo path or an unknown key. */
export function chosenArt(path: string | null | undefined): string | null {
  if (!isPresetPath(path)) return null;
  const key = path.slice(PREFIX.length);
  return KEYS.includes(key) ? artUrl(key) : null;
}

/** The automatic face for a runner with no photo and no choice, or null without an id. */
export function autoArt(id: string | null | undefined): string | null {
  return id ? artUrl(KEYS[hashOf(String(id)) % KEYS.length]) : null;
}

/**
 * A runner's face, the way the app picks it: their photo or chosen avatar
 * (`signed`: the URL signedUrls() gave for their avatar_path), else, when they
 * have neither, their automatic face. With no id, null (initials).
 */
export function faceOf(signed: string | null | undefined, path: string | null | undefined, id: string | null | undefined): string | null {
  if (signed) return signed;
  if (path) return chosenArt(path);
  return autoArt(id);
}
