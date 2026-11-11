"use client";
// /profile and /profile?r=<ref>: a runner's page, as the signed-in viewer may
// see it. Every read is the viewer's own session, so the RPCs and RLS decide:
//
//   get_runner_profile (latest body: 20261127120000_runner_instagram.sql)
//     header, counts, squads (shared, plus public clubs), and stats only for
//     yourself and squadmates. Null for anyone the viewer can't reach, which
//     the page shows as "Not visible" without saying whether the ref names
//     anybody.
//   run_summaries (RLS)   recent runs and the 12-week strip, self / squad only
//   list_runner_posts     posts the viewer may see, list_home_feed's shape
//   list_my_follows / list_runner_follows (20261128120000)   people
//   follows insert/delete  follow and unfollow, as js/follow.js did
//   post_likes upsert/delete  kudos, as the app's toggleLike
//   circles (members) / get_club_page (public clubs)  a squad's slug and photo
import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase";
import { signedUrls } from "./storage";
import { num } from "./activity";
import { istParts } from "./format";
import { faceOf } from "./avatars";

// ─── Loading (shared by the runner's pages) ─────────────────────────────────

/**
 * Run `fn` (a stable callback) and hold its answer. `data` is undefined while
 * it runs, `failed` when it threw; `retry` runs it again and `update` edits
 * the answer in place (a follow, a removed row). Readiness is matched to the
 * call that produced it, so nothing is reset synchronously inside an effect.
 */
export function useLoad<T>(fn: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [st, setSt] = useState<{ fn?: () => Promise<T>; attempt: number; data?: T; failed: boolean }>({ attempt: -1, failed: false });
  useEffect(() => {
    let alive = true;
    fn().then(data => { if (alive) setSt({ fn, attempt, data, failed: false }); }, () => { if (alive) setSt({ fn, attempt, failed: true }); });
    return () => { alive = false; };
  }, [fn, attempt]);
  const ready = st.fn === fn && st.attempt === attempt;
  const retry = useCallback(() => setAttempt(a => a + 1), []);
  const update = useCallback((f: (d: T) => T) => setSt(s => (s.data === undefined ? s : { ...s, data: f(s.data) })), []);
  return { data: ready ? st.data : undefined, failed: ready && st.failed, retry, update };
}

export type Relation = "self" | "squad" | "follow" | "public" | "run";

export type ProfileSquad = {
  id: string; name: string; role: "owner" | "member"; memberCount: number; isPublic: boolean;
  location: string | null; shared: boolean; verified: boolean;
};
export type Best = { label: string; timeSec: number; startedAt: string; neighborhood: string | null };
export type Stats = {
  lifetimeKm: number; lifetimeRuns: number;
  weeks: { weekKey: string; km: number; runs: number }[];
  year: { km: number; runs: number; timeSec: number; paceSecPerKm: number | null; elevM: number | null; longestKm: number | null };
  bests: Best[];
};
export type Profile = {
  id: string; name: string; avatar: string | null; handle: string | null; instagram: string | null;
  location: string | null; bio: string | null; tags: string[]; relation: Relation;
  followers: number; following: number; followsYou: boolean; followedByMe: boolean; postCount: number;
  squads: ProfileSquad[]; stats: Stats | null;
};

const orNull = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/** The runner, or null when they aren't visible to this viewer. Throws on a failed call. */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase().rpc("get_runner_profile", { p_user_id: userId });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any;
  if (!r) return null;
  const avatar = faceOf(r.avatar_path ? (await signedUrls("avatars", [r.avatar_path])).get(r.avatar_path) : null, r.avatar_path, r.id);
  const st = r.stats;
  return {
    id: r.id, name: r.display_name || "Runner", avatar, handle: r.handle ?? null, instagram: r.instagram ?? null,
    location: r.location ?? r.home_neighborhood ?? null, bio: r.bio ?? null,
    tags: Array.isArray(r.bio_tags) ? r.bio_tags.filter((t: unknown) => typeof t === "string") : [],
    relation: r.relation, followers: num(r.follower_count), following: num(r.following_count),
    followsYou: !!r.follows_you, followedByMe: !!r.followed_by_me, postCount: num(r.post_count),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    squads: ((r.squads ?? []) as any[]).map(q => ({
      id: q.id, name: q.name, role: q.role === "owner" ? "owner" as const : "member" as const, memberCount: num(q.member_count),
      isPublic: !!q.is_public, location: q.location ?? null, shared: !!q.shared, verified: !!q.verified,
    })),
    stats: st ? {
      lifetimeKm: num(st.lifetime_km), lifetimeRuns: num(st.lifetime_runs),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      weeks: ((st.weeks ?? []) as any[]).map(w => ({ weekKey: w.week_key, km: num(w.km), runs: num(w.runs) })),
      year: {
        km: num(st.year?.km), runs: num(st.year?.runs), timeSec: num(st.year?.time_sec),
        paceSecPerKm: orNull(st.year?.pace_sec_per_km), elevM: orNull(st.year?.elev_m), longestKm: orNull(st.year?.longest_km),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bests: ((st.bests ?? []) as any[]).map(b => ({ label: b.label, timeSec: num(b.time_sec), startedAt: b.started_at, neighborhood: b.neighborhood ?? null })),
    } : null,
  };
}

// ─── Runs (self and squadmates: run_summaries RLS gives them every run) ─────

export type RunRow = {
  id: string; started_at: string; distance_km: number; duration_sec: number; pace_sec_per_km: number | null;
  neighborhood: string | null; title: string | null;
};

/** The latest runs, and every run in the 12 weeks the strip draws. */
export async function getRuns(userId: string, since: Date): Promise<{ recent: RunRow[]; window: RunRow[] }> {
  const sb = getSupabase();
  const cols = "id, started_at, distance_km, duration_sec, pace_sec_per_km, neighborhood, title";
  const [a, b] = await Promise.all([
    sb.from("run_summaries").select(cols).eq("user_id", userId).order("started_at", { ascending: false }).limit(5),
    sb.from("run_summaries").select(cols).eq("user_id", userId).gte("started_at", since.toISOString()).order("started_at", { ascending: false }).limit(1000),
  ]);
  if (a.error) throw new Error(a.error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = (rows: any[] | null): RunRow[] => (rows ?? []).map(r => ({
    id: r.id, started_at: r.started_at, distance_km: num(r.distance_km), duration_sec: num(r.duration_sec),
    pace_sec_per_km: orNull(r.pace_sec_per_km), neighborhood: r.neighborhood ?? null, title: r.title ?? null,
  }));
  return { recent: map(a.data), window: map(b.data) };
}

// ─── Weeks in IST ───────────────────────────────────────────────────────────

const DAY = 86400000;
/** Midnight UTC of the IST calendar day `d` falls on. */
export function istDay(d: Date | string): number {
  const [y, m, dd] = istParts(d).ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
}
/** ISO-8601 week key ("2026-W46") of an IST day, as the app's computeWeekKey. */
export function weekKey(dayUtc: number): string {
  const dt = new Date(dayUtc);
  const dow = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dow);
  const y0 = Date.UTC(dt.getUTCFullYear(), 0, 1);
  const wk = Math.ceil(((dt.getTime() - y0) / DAY + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}
/** Monday (IST) eleven weeks before this week's: the strip's first day. */
export function stripStart(now: number): number {
  const today = istDay(new Date(now));
  const dow = (new Date(today).getUTCDay() + 6) % 7;
  return today - dow * DAY - 77 * DAY;
}
/** 84 days of km, oldest first, and a label under every fourth week. */
export function stripDays(runs: RunRow[], start: number): { days: number[]; labels: string[] } {
  const days = Array.from({ length: 84 }, () => 0);
  for (const r of runs) {
    const i = Math.round((istDay(r.started_at) - start) / DAY);
    if (i >= 0 && i < 84) days[i] += r.distance_km;
  }
  const labels = Array.from({ length: 12 }, (_, w) => w % 4 ? "" : new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(start + w * 7 * DAY)));
  return { days: days.map(k => Math.round(k * 10) / 10), labels };
}

// ─── Posts ──────────────────────────────────────────────────────────────────

export type ProfilePost = {
  id: string; authorName: string; authorAvatar: string | null; title: string | null; body: string | null;
  image: string | null; imageMode: "fill" | "story"; createdAt: string; visibility: string; reason: string;
  squadNames: string[]; place: string | null;
  run: { distanceKm: number; durationSec: number; paceSecPerKm: number; route: [number, number][] | null } | null;
  likes: number; liked: boolean; likerNames: string[]; comments: number;
};
export type Cursor = { createdAt: string; id: string } | null;
const PAGE = 20;

/** One page of the runner's posts the viewer may see, newest first. */
export async function getPosts(userId: string, cursor: Cursor): Promise<{ posts: ProfilePost[]; cursor: Cursor }> {
  const { data, error } = await getSupabase().rpc("list_runner_posts", {
    p_user_id: userId, p_limit: PAGE, p_cursor_created_at: cursor?.createdAt ?? null, p_cursor_id: cursor?.id ?? null,
  });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const [imgs, faces] = await Promise.all([
    signedUrls("post-images", rows.map(r => r.image_path)),
    signedUrls("avatars", rows.map(r => r.author_avatar_path)),
  ]);
  const posts = rows.map((r): ProfilePost => {
    const isRun = r.distance_km != null;
    const path: string | null = r.image_path ?? null;
    // The app's picture tags: .4x5 run card and .route map fill the frame; an
    // untagged run picture is an old 9:16 story, shown over a blur.
    const tagged = !!path && /\.(4x5|route)\.(png|jpe?g)$/i.test(path);
    return {
      id: r.id, authorName: r.author_name || "Runner", authorAvatar: faceOf(r.author_avatar_path ? faces.get(r.author_avatar_path) : null, r.author_avatar_path, r.author_id),
      title: r.title ?? null, body: r.body ?? null, image: path ? imgs.get(path) ?? null : null,
      imageMode: isRun && path && !tagged ? "story" : "fill", createdAt: r.created_at, visibility: r.visibility ?? "circle",
      reason: r.reason ?? "public", squadNames: r.squad_names ?? [], place: r.place ?? null,
      run: isRun ? {
        distanceKm: num(r.distance_km), durationSec: num(r.duration_sec), paceSecPerKm: num(r.pace_sec_per_km),
        route: Array.isArray(r.route_shape) ? r.route_shape.filter((p: unknown) => Array.isArray(p)).map((p: number[]) => [p[0] / 1000, p[1] / 1000] as [number, number]) : null,
      } : null,
      likes: num(r.like_count), liked: !!r.liked_by_me, likerNames: Array.isArray(r.liker_names) ? r.liker_names : [], comments: num(r.comment_count),
    };
  });
  const last = rows[rows.length - 1];
  return { posts, cursor: rows.length === PAGE && last ? { createdAt: last.created_at, id: last.id } : null };
}

/** The app's liked-by line: "Ana, Theo and 16 others", "You and 3 others". */
export function likedLine(p: Pick<ProfilePost, "likes" | "liked" | "likerNames">): string | null {
  if (p.likes <= 0) return null;
  const first = (n: string) => n.trim().split(/\s+/)[0] || n;
  const names = [...(p.liked ? ["You"] : []), ...p.likerNames.map(first)];
  if (!names.length) return `${p.likes} kudos`;
  const rest = Math.max(0, p.likes - names.length);
  if (rest === 0) return names.length === 1 ? `Kudos from ${names[0]}` : `Kudos from ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Kudos from ${names.join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
}

/** Kudos on or off, as the app's toggleLike. */
export async function setKudos(postId: string, me: string, give: boolean): Promise<boolean> {
  const sb = getSupabase();
  const { error } = give
    ? await sb.from("post_likes").upsert({ post_id: postId, user_id: me }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    : await sb.from("post_likes").delete().eq("post_id", postId).eq("user_id", me);
  return !error;
}

// ─── Follows ────────────────────────────────────────────────────────────────

export type Person = { id: string; name: string; avatar: string | null; handle: string | null; place: string | null; followsYou: boolean };

/** Followers or following: mine through list_my_follows, theirs through list_runner_follows. */
export async function getPeople(subjectId: string, self: boolean, kind: "followers" | "following"): Promise<Person[]> {
  const sb = getSupabase();
  const { data, error } = self
    ? await sb.rpc("list_my_follows", { p_kind: kind })
    : await sb.rpc("list_runner_follows", { p_user_id: subjectId, p_kind: kind });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const faces = await signedUrls("avatars", rows.map(r => r.avatar_path));
  return rows.map(r => ({
    id: r.id, name: r.display_name || "Runner", avatar: faceOf(r.avatar_path ? faces.get(r.avatar_path) : null, r.avatar_path, r.id),
    handle: r.handle ?? null, place: r.location ?? r.home_neighborhood ?? null, followsYou: !!r.follows_you,
  }));
}

export type FollowResult = { ok: true } | { ok: false; reason: "email_required" | "error" };
/** js/follow.js's followUser: 23505 is already following; 42501 is the email gate. */
export async function follow(me: string, them: string): Promise<FollowResult> {
  const { error } = await getSupabase().from("follows").insert({ follower_id: me, followee_id: them });
  if (!error || error.code === "23505") return { ok: true };
  return { ok: false, reason: error.code === "42501" ? "email_required" : "error" };
}
export async function unfollow(me: string, them: string): Promise<boolean> {
  const { error } = await getSupabase().from("follows").delete().eq("follower_id", me).eq("followee_id", them);
  return !error;
}

// ─── Squads: slug and photo ─────────────────────────────────────────────────

export type SquadExtra = { slug: string | null; photo: string | null; policy: "open" | "ask" | "invite" | null; womenOnly: boolean };
const POLICY = { open: "open", request: "ask", invite: "invite" } as const;

/**
 * get_runner_profile names squads by id. A squad the viewer is in reads
 * straight from circles (circles_select_members); a public club they aren't
 * in only through get_club_page, which answers for public clubs.
 */
export async function squadExtras(squads: ProfileSquad[]): Promise<Map<string, SquadExtra>> {
  const sb = getSupabase();
  const out = new Map<string, SquadExtra>();
  const mine = squads.filter(s => s.shared).map(s => s.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];
  if (mine.length) {
    const { data } = await sb.from("circles").select("id, slug, avatar_path, join_policy, women_only").in("id", mine);
    rows.push(...(data ?? []));
  }
  const others = squads.filter(s => !s.shared && s.isPublic).slice(0, 12);
  const pages = await Promise.all(others.map(s => sb.rpc("get_club_page", { p_circle_id: s.id }).then(r => r.data, () => null)));
  for (const p of pages) if (p && p.id) rows.push(p);
  const photos = await signedUrls("club-avatars", rows.map(r => r.avatar_path));
  for (const r of rows) out.set(r.id, {
    slug: r.slug ?? null, photo: r.avatar_path ? photos.get(r.avatar_path) ?? null : null,
    policy: POLICY[r.join_policy as keyof typeof POLICY] ?? null, womenOnly: !!r.women_only,
  });
  return out;
}

/** "14 Nov 2025", in IST. */
export function dateLong(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
