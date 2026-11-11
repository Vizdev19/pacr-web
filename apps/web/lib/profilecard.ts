// /u/<handle>: a runner's public card, on get_profile_card (migration
// 20261012120000 in the app repo) as anon. Name, @handle, picture, bio, tags,
// location and follower count, for any runner who picked a handle (that is
// the opt-in). Runs and stats stay in the app with their squads. An unknown
// handle and a cleared one render the same "nobody here" page.
import { cache } from "react";
import { anon, presetArt } from "./event";

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export type ProfileCardRaw = {
  display_name: string | null; handle: string; avatar_path: string | null; bio: string | null; bio_tags: string[] | null;
  location: string | null; follower_count: number; joined_at: string | null;
};

/** What the page draws: the picture goes through /u/<handle>/photo, never a storage path. */
export type ProfileView = {
  name: string; first: string; handle: string; avatar: string | null; bio: string | null; tags: string[];
  location: string | null; followers: number; joined: string | null;
};

/** "/u/@Ravi" and "/u/RAVI" are ravi, as the old page read them; null when it can't be a handle. */
export function cleanHandle(raw: string): string | null {
  let h = raw;
  try { h = decodeURIComponent(raw); } catch { /* keep it as it came */ }
  h = h.replace(/^@/, "").toLowerCase();
  return HANDLE_RE.test(h) ? h : null;
}

export const loadProfile = cache(async (handle: string): Promise<{ ok: true; runner: ProfileCardRaw | null } | { ok: false }> => {
  const { data, error } = await anon().rpc("get_profile_card", { p_handle: handle });
  return error ? { ok: false } : { ok: true, runner: (data as ProfileCardRaw | null) ?? null };
});

const MONTH = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", month: "short", year: "numeric" });

export function profileView(r: ProfileCardRaw): ProfileView {
  const name = r.display_name?.trim() || r.handle;
  return {
    name, first: name.split(/\s+/)[0] || name, handle: r.handle,
    avatar: r.avatar_path ? presetArt(r.avatar_path) ?? `/u/${r.handle}/photo` : null,
    bio: r.bio?.trim() || null,
    tags: (r.bio_tags ?? []).filter((t): t is string => typeof t === "string" && !!t.trim()),
    location: r.location?.trim() || null,
    followers: Number(r.follower_count) || 0,
    joined: r.joined_at ? MONTH.format(new Date(r.joined_at)) : null,
  };
}

/** 1.2k / 12k, as the old card counted. */
export function shortCount(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
