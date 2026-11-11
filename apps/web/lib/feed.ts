"use client";
// The signed-in feed (/feed and /feed/<ref>), read and written with the
// runner's own session: RLS and the RPCs decide what they see and may do.
// Mirrors the app's src/services/feed.ts and moderation.ts (same tables,
// columns and RPC arguments) so a post behaves the same on both.
//
//   list_home_feed     a page of All / Following / Squads (keyset cursor)
//   feed_post_extras   the author's handle and the run's route shape per post
//   get_feed_post      one post, empty when it isn't visible to you
//   list_post_likers   everyone who gave kudos (the post page)
//   list_post_comments the thread; post_comments / comment_likes for writes
//
// Ids stay in memory: links carry refs (encodeRef), handles or slugs.
import { getSupabase } from "./supabase";
import { encodeRef } from "./refs";
import type { MapPoint } from "@/components/ds/actions";

export type Visibility = "circle" | "followers" | "public";
export type Scope = "all" | "following" | "squads";
export type Reason = "mine" | "squad" | "following" | "public";

export type FeedPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarPath: string | null;
  authorHandle: string | null;
  kind: "text" | "run" | "photo";
  title: string | null;
  body: string | null;
  imagePath: string | null;
  createdAt: string;
  visibility: Visibility;
  run: { distanceKm: number; durationSec: number; paceSecPerKm: number } | null;
  place: string | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  likerNames: string[];
  followedByMe: boolean;
  reason: Reason;
  /** The viewer's squads the post went to, paired with squadNames. */
  squadIds: string[];
  squadNames: string[];
  canReply: boolean;
  /** 0–1 points, from run_summaries.route_shape (0–1000). */
  route: MapPoint[] | null;
  isMine: boolean;
};

export type Cursor = { createdAt: string; id: string };
export const PAGE = 20;

/* eslint-disable @typescript-eslint/no-explicit-any */
function shape(raw: unknown): MapPoint[] | null {
  if (!Array.isArray(raw)) return null;
  const pts = raw.filter((p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(p => [p[0] / 1000, p[1] / 1000] as MapPoint);
  return pts.length > 1 ? pts : null;
}

function toPost(r: any, uid: string, extra?: { author_handle?: string | null; route_shape?: unknown }): FeedPost {
  return {
    id: r.id,
    authorId: r.author_id,
    authorName: r.author_name ?? "Runner",
    authorAvatarPath: r.author_avatar_path ?? null,
    authorHandle: extra?.author_handle ?? r.author_handle ?? null,
    kind: r.kind,
    title: r.title ?? null,
    body: r.body ?? null,
    imagePath: r.image_path ?? null,
    createdAt: r.created_at,
    visibility: (r.visibility ?? "circle") as Visibility,
    run: r.distance_km != null
      ? { distanceKm: Number(r.distance_km), durationSec: Number(r.duration_sec) || 0, paceSecPerKm: Number(r.pace_sec_per_km) || 0 }
      : null,
    place: r.place ?? null,
    likeCount: Number(r.like_count) || 0,
    commentCount: Number(r.comment_count) || 0,
    likedByMe: !!r.liked_by_me,
    likerNames: r.liker_names ?? [],
    followedByMe: !!r.followed_by_me,
    reason: r.reason as Reason,
    squadIds: r.squad_ids ?? [],
    squadNames: r.squad_names ?? [],
    canReply: !!r.can_reply,
    route: shape(extra ? extra.route_shape : r.route_shape),
    isMine: r.author_id === uid,
  };
}

/** One page of list_home_feed, with handles and route shapes. Null on error. */
export async function listFeed(scope: Scope, uid: string, opts: { circleId?: string | null; cursor?: Cursor | null } = {}):
  Promise<{ posts: FeedPost[]; cursor: Cursor | null } | null> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("list_home_feed", {
    p_scope: scope, p_limit: PAGE,
    p_cursor_created_at: opts.cursor?.createdAt ?? null, p_cursor_id: opts.cursor?.id ?? null,
    p_circle_id: opts.circleId ?? null,
  });
  if (error) return null;
  const rows = (data ?? []) as any[];
  const extras = new Map<string, any>();
  if (rows.length) {
    // A missing extras call only costs links and route lines, not the page.
    const { data: ex } = await sb.rpc("feed_post_extras", { p_post_ids: rows.map(r => r.id) });
    for (const e of (ex ?? []) as any[]) extras.set(e.post_id, e);
  }
  const last = rows[rows.length - 1];
  return {
    posts: rows.map(r => toPost(r, uid, extras.get(r.id) ?? { author_handle: null, route_shape: null })),
    cursor: rows.length === PAGE && last ? { createdAt: last.created_at, id: last.id } : null,
  };
}

/** One post, or null when it isn't visible to you; "error" when the call failed. */
export async function getFeedPost(id: string, uid: string): Promise<FeedPost | null | "error"> {
  const { data, error } = await getSupabase().rpc("get_feed_post", { p_post_id: id });
  if (error) return "error";
  const r = ((data ?? []) as any[])[0];
  return r ? toPost(r, uid) : null;
}

/* ── Pictures ── */

/** A run's 4:5 feed card, uploaded as "<uid>/<rand>.4x5.jpg". */
export const isFeedCardPath = (p: string | null) => !!p && /\.4x5\.(png|jpe?g)$/i.test(p);
/** A recorded run's route on a map, "<uid>/<rand>.route.jpg". */
export const isRouteMapPath = (p: string | null) => !!p && /\.route\.(png|jpe?g)$/i.test(p);

/* ── Text the card derives from a post ── */

export const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

/** The app's liked-by line, as "Kudos from Arjun and 12 others". */
export function likedLine(p: Pick<FeedPost, "likeCount" | "likedByMe" | "likerNames">): string {
  if (p.likeCount <= 0) return "Be the first to give kudos";
  const names = [...(p.likedByMe ? ["you"] : []), ...p.likerNames.map(firstName)];
  if (!names.length) return `${p.likeCount} kudos`;
  const rest = Math.max(0, p.likeCount - names.length);
  const list = rest === 0
    ? (names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names[names.length - 1])
    : `${names.join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
  return "Kudos from " + list;
}

/** "Only you", "Followers", "Public", for my own post with no squads. */
export function audienceLabel(visibility: Visibility, squadCount: number): string {
  if (visibility === "public") return "Public";
  if (visibility === "followers") return "Followers";
  return squadCount ? "Squads" : "Only you";
}

/** The card's context line: the squads it's in, else how it reached you. */
export function contextLine(p: FeedPost): string {
  if (p.squadNames.length) return p.squadNames.length > 2 ? `${p.squadNames.slice(0, 2).join(", ")} and ${p.squadNames.length - 2} more` : p.squadNames.join(", ");
  if (p.isMine) return audienceLabel(p.visibility, 0);
  return p.reason === "following" ? "Following" : "Public";
}

/** /u/<handle>, else /profile?r=<ref>. */
export function runnerHref(handle: string | null, id: string | null): string | undefined {
  if (handle) return `/u/${handle}`;
  const r = id ? encodeRef(id) : null;
  return r ? `/profile?r=${r}` : undefined;
}

export function postRef(id: string): string { return encodeRef(id) ?? ""; }

/** A 22-character ref back to its uuid, or null for anything else. */
export function refToUuid(ref: string): string | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(ref)) return null;
  let bin: string;
  try { bin = atob(ref.replace(/-/g, "+").replace(/_/g, "/") + "=="); } catch { return null; }
  if (bin.length !== 16) return null;
  const hex = Array.from(bin, c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return encodeRef(id) === ref ? id : null;
}

/* ── Kudos ── */

export async function setKudos(postId: string, uid: string, on: boolean): Promise<boolean> {
  const t = getSupabase().from("post_likes");
  const { error } = on
    ? await t.upsert({ post_id: postId, user_id: uid }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    : await t.delete().eq("post_id", postId).eq("user_id", uid);
  return !error;
}

export type Liker = { name: string; avatarPath: string | null; handle: string | null; ref: string; isMe: boolean };
export async function listLikers(postId: string, limit = 100): Promise<Liker[] | null> {
  const { data, error } = await getSupabase().rpc("list_post_likers", { p_post_id: postId, p_limit: limit });
  if (error) return null;
  return ((data ?? []) as any[]).map(r => ({ name: r.name ?? "Runner", avatarPath: r.avatar_path ?? null, handle: r.handle ?? null, ref: r.user_ref, isMe: !!r.is_me }));
}

/* ── My own posts ── */

export async function setAudience(postId: string, visibility: Visibility, circleIds: string[]): Promise<boolean> {
  const { error } = await getSupabase().rpc("set_post_audience", { p_post_id: postId, p_visibility: visibility, p_targets: [...new Set(circleIds)] });
  return !error;
}

export async function setTitle(postId: string, title: string): Promise<"ok" | "blocked" | "error"> {
  const { error } = await getSupabase().rpc("set_post_title", { p_post_id: postId, p_title: title.trim().slice(0, 80) });
  return !error ? "ok" : (error.message || "").includes("blocked_content") ? "blocked" : "error";
}

export async function deletePost(postId: string): Promise<boolean> {
  const { data, error } = await getSupabase().from("posts").delete().eq("id", postId).select("id");
  return !error && !!data?.length;
}

/** Squad staff: take the post out of their squad (deletes it when that was its last place). */
export async function removeFromSquad(postId: string, circleId: string): Promise<"removed" | "deleted" | null> {
  const { data, error } = await getSupabase().rpc("remove_post_from_circle", { p_post_id: postId, p_circle_id: circleId });
  return error ? null : data === "deleted" ? "deleted" : "removed";
}

/* ── Keeping the feed safe ── */

export async function hidePost(postId: string, uid: string): Promise<boolean> {
  const { error } = await getSupabase().from("post_hides").upsert({ user_id: uid, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
  return !error;
}
export async function unhidePost(postId: string, uid: string): Promise<boolean> {
  const { error } = await getSupabase().from("post_hides").delete().eq("user_id", uid).eq("post_id", postId);
  return !error;
}

export async function muteRunner(uid: string, other: string): Promise<boolean> {
  const { error } = await getSupabase().from("user_mutes").upsert({ muter_id: uid, muted_id: other }, { onConflict: "muter_id,muted_id", ignoreDuplicates: true });
  return !error;
}
export async function unmuteRunner(uid: string, other: string): Promise<boolean> {
  const { error } = await getSupabase().from("user_mutes").delete().eq("muter_id", uid).eq("muted_id", other);
  return !error;
}

export async function blockRunner(uid: string, other: string): Promise<boolean> {
  const { error } = await getSupabase().from("user_blocks").upsert({ blocker_id: uid, blocked_id: other }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  return !error;
}

export type ReportReason = "spam" | "harassment" | "hate" | "sexual" | "violence" | "self_harm" | "other" | "fake_activity" | "inappropriate";
/** The app's report sheet for a post (moderation.ts POST_REPORT_REASONS). */
export const POST_REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or misleading" },
  { value: "fake_activity", label: "Fake or inaccurate activity" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
];
/** …and for a comment (REPORT_REASONS). */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam or a scam" },
  { value: "hate", label: "Hate speech" },
  { value: "sexual", label: "Sexual content" },
  { value: "violence", label: "Violence or threats" },
  { value: "self_harm", label: "Self-harm" },
  { value: "other", label: "Something else" },
];

/** content_reports; circle_id is stamped by the server. Reporting hides it for you. */
export async function report(uid: string, target: "post" | "comment", targetId: string, reason: ReportReason): Promise<"ok" | "already" | "signin" | "error"> {
  const { error } = await getSupabase().from("content_reports").insert({ reporter_id: uid, target_type: target, target_id: targetId, reason, note: null });
  if (!error) return "ok";
  if (error.code === "23505") return "already";
  if (error.code === "42501") return "signin";
  return "error";
}

/* ── Comments ── */

export type FeedComment = {
  id: string; parentId: string | null; authorId: string; authorName: string; authorAvatarPath: string | null;
  body: string; createdAt: string; isMine: boolean; hidden: boolean; likeCount: number; likedByMe: boolean; isPostAuthor: boolean;
};

/** The thread in reading order: each top-level comment, then its replies; replies whose parent is gone go last. */
export async function listComments(postId: string, uid: string): Promise<FeedComment[] | null> {
  const { data, error } = await getSupabase().rpc("list_post_comments", { p_post_id: postId });
  if (error) return null;
  const rows: FeedComment[] = ((data ?? []) as any[]).slice(0, 200).map(r => ({
    id: r.id, parentId: r.parent_id ?? null, authorId: r.author_id, authorName: r.author_name ?? "Runner",
    authorAvatarPath: r.author_avatar_path ?? null, body: r.body, createdAt: r.created_at, isMine: r.author_id === uid,
    hidden: !!r.hidden, likeCount: Number(r.like_count) || 0, likedByMe: !!r.liked_by_me, isPostAuthor: !!r.is_post_author,
  }));
  return threadOrder(rows);
}

export function threadOrder(rows: FeedComment[]): FeedComment[] {
  const tops = rows.filter(c => !c.parentId);
  const known = new Set(tops.map(c => c.id));
  const byParent = new Map<string, FeedComment[]>();
  for (const c of rows) if (c.parentId && known.has(c.parentId)) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  const orphans = rows.filter(c => c.parentId && !known.has(c.parentId));
  return [...tops.flatMap(c => [c, ...(byParent.get(c.id) ?? [])]), ...orphans];
}

/** A comment or a reply (a reply to a reply attaches to its top-level comment, server side too). */
export async function addComment(postId: string, uid: string, body: string, parentId: string | null): Promise<{ ok: true; comment: FeedComment } | { ok: false; reason: "blocked" | "error" }> {
  const text = body.trim();
  if (!text || text.length > 1000) return { ok: false, reason: "error" };
  const { data, error } = await getSupabase().from("post_comments")
    .insert({ post_id: postId, author_id: uid, body: text, parent_id: parentId })
    .select("id, parent_id, created_at, body").single();
  if (error || !data) return { ok: false, reason: (error?.message || "").includes("blocked_content") ? "blocked" : "error" };
  const d = data as any;
  return { ok: true, comment: { id: d.id, parentId: d.parent_id ?? null, authorId: uid, authorName: "You", authorAvatarPath: null, body: d.body, createdAt: d.created_at, isMine: true, hidden: false, likeCount: 0, likedByMe: false, isPostAuthor: false } };
}

export async function deleteComment(id: string): Promise<boolean> {
  const { data, error } = await getSupabase().from("post_comments").delete().eq("id", id).select("id");
  return !error && !!data?.length;
}

export async function setCommentKudos(id: string, uid: string, on: boolean): Promise<boolean> {
  const t = getSupabase().from("comment_likes");
  const { error } = on
    ? await t.upsert({ comment_id: id, user_id: uid }, { onConflict: "comment_id,user_id", ignoreDuplicates: true })
    : await t.delete().eq("comment_id", id).eq("user_id", uid);
  return !error;
}

export type Member = { userId: string; displayName: string };
/** @mention suggestions: members of the post's squads, read under RLS like the app's listMembers. */
export async function squadMembers(circleIds: string[]): Promise<Member[]> {
  if (!circleIds.length) return [];
  const { data } = await getSupabase().from("memberships").select("user_id, users(display_name)")
    .in("circle_id", circleIds).order("joined_at", { ascending: true }).limit(200);
  const seen = new Map<string, Member>();
  for (const r of (data ?? []) as any[]) {
    const name = r.users?.display_name;
    if (name && !seen.has(r.user_id)) seen.set(r.user_id, { userId: r.user_id, displayName: name });
  }
  return [...seen.values()];
}

/* ── Me: squads, followers, profile ── */

export type MySquad = { id: string; name: string; slug: string; role: "owner" | "organiser" | "run_leader" | "member"; postingMode: "all" | "owners_only" };
export const isStaff = (s: MySquad) => s.role === "owner" || s.role === "organiser";

export async function mySquads(uid: string): Promise<MySquad[]> {
  const { data } = await getSupabase().from("memberships").select("circle_id, role, circles(name, slug, posting_mode)")
    .eq("user_id", uid).order("joined_at", { ascending: true });
  return ((data ?? []) as any[]).filter(r => r.circles).map(r => ({
    id: r.circle_id, name: r.circles.name, slug: r.circles.slug, role: r.role ?? "member",
    postingMode: r.circles.posting_mode === "owners_only" ? "owners_only" : "all",
  }));
}

export async function followerCount(uid: string): Promise<number | null> {
  const { count, error } = await getSupabase().from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", uid);
  return error ? null : count ?? 0;
}

export async function myProfile(uid: string): Promise<{ name: string; avatarPath: string | null }> {
  const { data } = await getSupabase().from("users").select("display_name, avatar_path").eq("id", uid).maybeSingle();
  return { name: (data as any)?.display_name || "You", avatarPath: (data as any)?.avatar_path ?? null };
}

/* ── The side column ── */

const IST_MS = 5.5 * 3600 * 1000;
const DAY_MS = 86400 * 1000;

/** Monday 00:00 in India, as an instant. */
export function istWeekStart(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_MS);
  const dow = (ist.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - dow) - IST_MS);
}

/** The app's ISO week key ("2026-W46") for today in India. */
export function istWeekKey(now = new Date()): string {
  const ist = new Date(now.getTime() + IST_MS);
  const t = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** My runs this week (Mon–Sun, India): km per day and the count. */
export async function yourWeek(uid: string): Promise<{ days: number[]; km: number; runs: number; today: number } | null> {
  const start = istWeekStart();
  const { data, error } = await getSupabase().from("run_summaries").select("started_at, distance_km")
    .eq("user_id", uid).gte("started_at", start.toISOString()).lt("started_at", new Date(start.getTime() + 7 * DAY_MS).toISOString()).limit(200);
  if (error) return null;
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const r of (data ?? []) as any[]) {
    const i = Math.floor((new Date(r.started_at).getTime() - start.getTime()) / DAY_MS);
    if (i >= 0 && i < 7) days[i] += Number(r.distance_km) || 0;
  }
  const km = days.reduce((a, b) => a + b, 0);
  return { days: days.map(d => Math.round(d * 10) / 10), km, runs: (data ?? []).length, today: Math.floor((Date.now() - start.getTime()) / DAY_MS) };
}

export type NextRun = { squad: string; slug: string; ref: string; title: string; at: string };
/** Each of my squads' next run (my_squads_overview), soonest first, linked by slug and ref. */
export async function nextRuns(squads: MySquad[]): Promise<NextRun[] | null> {
  const { data, error } = await getSupabase().rpc("my_squads_overview", { p_week_key: istWeekKey() });
  if (error) return null;
  const slug = new Map(squads.map(s => [s.id, s.slug]));
  return ((data ?? []) as any[])
    .filter(r => r.next_run_id && r.next_run_at && slug.get(r.circle_id))
    .map(r => ({ squad: r.name, slug: slug.get(r.circle_id)!, ref: encodeRef(r.next_run_id) ?? "", title: r.next_run_title || "Squad run", at: r.next_run_at }))
    .filter(r => r.ref)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export type SquadMeta = { weekPosts: number; nextAt: string | null; nextTitle: string | null };
/** squad_feed_meta: per squad of mine, posts in the last 7 days and the next announced run. */
export async function squadMeta(): Promise<Map<string, SquadMeta>> {
  const { data } = await getSupabase().rpc("squad_feed_meta");
  return new Map(((data ?? []) as any[]).map(r => [r.circle_id, { weekPosts: Number(r.week_post_count) || 0, nextAt: r.next_event_at ?? null, nextTitle: r.next_event_title ?? null }]));
}
/* eslint-enable @typescript-eslint/no-explicit-any */
