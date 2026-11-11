// Runner faces: the app's 12 illustrated avatars, in the host dashboard (same as pacr-admin lib/faces.ts).
//
// Ported from pacr src/components/feed/defaultAvatars.ts + src/services/avatarPreset.ts
// (and pacr.life js/avatars.js). KEEP IN SYNC: the keys, their order and hashOf
// must match the app exactly, or a runner wears a different face here.
//
//   photo      users.avatar_path is a Storage object in "avatars": signed per request.
//   chosen     users.avatar_path = "preset:<key>": the runner picked one in the app.
//   automatic  no avatar_path at all: hashOf(user id) % 12. The id only picks one
//              of 12 pictures, so the URL says nothing about it.
//
// public/avatars holds 256 px copies of the app's 512 px art, served under the
// app's basePath (/host).

const KEYS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const PREFIX = "preset:";

const art = (key: string) => `/host/avatars/pacr_avatar_${key}.png`;

/** The app's hash (activity/ui.ts hashOf): ×31 + char code, wrapped to int32. */
function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const isPreset = (path: string | null | undefined): path is string => !!path && path.startsWith(PREFIX);

/** The art for a chosen avatar, or null for a photo path or an unknown key. */
export function presetArt(path: string | null | undefined): string | null {
  if (!isPreset(path)) return null;
  const key = path.slice(PREFIX.length);
  return KEYS.includes(key) ? art(key) : null;
}

/** The automatic face for a runner without a photo. */
export const autoArt = (id: string) => art(KEYS[hashOf(id) % KEYS.length]);

/**
 * What to draw for a runner: their photo (already signed), else the face they
 * chose, else, when they have no avatar at all, their automatic face. A photo
 * that couldn't be signed gives null, so the row shows initials: a cartoon over
 * somebody's real photo would be wrong.
 */
export function faceSrc(id: string | null | undefined, path: string | null | undefined, signed: Map<string, string>): string | null {
  if (path) return isPreset(path) ? presetArt(path) : signed.get(path) ?? null;
  return id ? autoArt(id) : null;
}
