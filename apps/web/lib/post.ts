// /p/<ref>: a shared feed post, on get_post_card (migration 20261013120000 in
// the app repo) as anon. It answers only for PUBLIC posts; squad and
// followers posts, deleted, hidden and unknown ones all come back null and
// render the same "open it in pacr" state, so the page never says which.
// Run cards (a picture of a route) are never served: the RPC withholds them.
import { cache } from "react";
import { anon, decodeRef, presetArt } from "./event";
import { dayLine, istParts } from "./format";
import { duration, paceOf } from "./time";

export type PostCardRaw = {
  kind: string; title: string | null; badge: string | null; body: string | null; created_at: string | null;
  image_path: string | null; author_name: string | null; author_handle: string | null; author_avatar_path: string | null;
  like_count: number; comment_count: number;
  run: { distance_km: number | null; duration_sec: number | null; pace_sec_per_km: number | null } | null;
};

/** What the page draws: no paths, no ids. Pictures go through /p/<ref>/photo and /avatar. */
export type PostView = {
  ref: string; author: string; first: string; handle: string | null; avatar: string | null; date: string | null;
  title: string | null; headline: string; badge: string | null; body: string;
  run: { distance: string; duration: string | null; pace: string | null } | null;
  photo: string | null; kudos: number; comments: number;
};

export const loadPost = cache(async (ref: string): Promise<{ ok: true; post: PostCardRaw | null } | { ok: false }> => {
  const id = decodeRef(ref);
  if (!id) return { ok: true, post: null };
  const { data, error } = await anon().rpc("get_post_card", { p_post_id: id });
  return error ? { ok: false } : { ok: true, post: (data as PostCardRaw | null) ?? null };
});

// Belt and braces: the RPC already flattens "@[Name](uuid)" to "@Name".
const flatten = (body: string | null) => String(body ?? "").replace(/@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)/g, "@$1").trim();

/** "Sat, 14 Nov", with the year when it isn't this one. */
function postDate(iso: string): string {
  const y = istParts(iso).ymd.slice(0, 4);
  return y === istParts(new Date()).ymd.slice(0, 4) ? dayLine(iso) : `${dayLine(iso)} ${y}`;
}

export function postView(p: PostCardRaw, ref: string): PostView {
  const name = p.author_name?.trim() || "A runner";
  const km = Number(p.run?.distance_km) || 0;
  const sec = Number(p.run?.duration_sec) || 0;
  const pace = Number(p.run?.pace_sec_per_km) > 0 ? Number(p.run!.pace_sec_per_km) : sec > 0 && km > 0 ? sec / km : 0;
  const run = km > 0 ? { distance: km.toFixed(2), duration: duration(sec), pace: paceOf(pace) } : null;
  const title = p.title?.trim() || (run ? `${run.distance} km run` : null);
  return {
    ref, author: name, first: name.split(/\s+/)[0] || name, handle: p.author_handle || null,
    avatar: p.author_avatar_path ? presetArt(p.author_avatar_path) ?? `/p/${ref}/avatar` : null,
    date: p.created_at ? postDate(p.created_at) : null,
    title, headline: title || (p.kind === "photo" ? "A photo" : "A post"), badge: p.badge?.trim() || null,
    body: flatten(p.body), run, photo: p.image_path ? `/p/${ref}/photo` : null,
    kudos: Number(p.like_count) || 0, comments: Number(p.comment_count) || 0,
  };
}
