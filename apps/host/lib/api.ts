"use client";

// The dashboard's data layer. Every call runs in the browser as the signed-in
// host, against the same tables and RPCs the pacr app uses (pacr repo,
// src/services/squadScreen.ts, announcements.ts, moderation.ts, events.ts), so
// the database's own role checks decide what each person may see and do.
// Functions throw ApiError; `reason` is the database's error code
// ("not_owner", "squad_not_set_up", …) and failText() turns it into a sentence.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export class ApiError extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

const REASONS = [
  "not_owner", "not_allowed", "not_member", "banned", "women_only", "last_owner", "squad_not_set_up",
  "verified_rename_owner_only", "blocked_content", "leader_not_member", "too_many_places", "is_home",
  "checkin_closed", "unknown_code", "not_a_run", "cooldown", "already_verified", "hidden_beyond_squad",
  "squad_not_verified", "payout_account_required", "incomplete", "schedule_locked", "has_upcoming_events",
  "email_required", "rate_limited", "signed_out", "invalid_name", "places_unavailable", "places_limit",
] as const;

function reasonOf(message: string | undefined | null): string {
  const m = String(message ?? "");
  if (/jwt|PGRST301/i.test(m)) return "signed_out";
  return REASONS.find(r => m.includes(r)) ?? "error";
}

const FAIL: Record<string, string> = {
  not_owner: "Only the squad's owner or organisers can do that.",
  not_allowed: "That isn't part of your role here.",
  not_member: "You're not a member of this squad any more.",
  last_owner: "A squad needs an owner. Make someone else an owner first.",
  squad_not_set_up: "Add a description and a home base in Settings before scheduling runs.",
  too_many_places: "A squad can save 20 places. Remove one in Settings first.",
  is_home: "That’s the home base. Make another place home first.",
  invalid_name: "Give the place a name of up to 60 characters.",
  places_unavailable: "Place search isn’t available right now. You can still use the name as typed.",
  places_limit: "That’s a lot of searching for one day. Use the name as typed, or try again tomorrow.",
  verified_rename_owner_only: "Only the owner can rename a verified squad.",
  blocked_content: "That text isn't allowed. Try different words.",
  leader_not_member: "The run leader has to be a member of the squad.",
  checkin_closed: "Check-in is closed for this run.",
  unknown_code: "That code doesn't match a runner.",
  cooldown: "You asked recently. Try again later.",
  already_verified: "This squad is already verified.",
  hidden_beyond_squad: "That post is hidden in another squad too, so it can't be shown again from here.",
  squad_not_verified: "Only verified squads host events.",
  email_required: "Add an email to your pacr account first.",
  signed_out: "You've been signed out. Sign in again.",
  error: "We couldn't reach pacr just now. Nothing was changed.",
};
/** A sentence for a failure, in the design system's voice. */
export const failText = (e: unknown) => FAIL[e instanceof ApiError ? e.reason : "error"] ?? FAIL.error;

const sb = (): SupabaseClient => getSupabase();

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) {
    console.warn(`[host] ${fn} failed`, error.message);
    throw new ApiError(reasonOf(error.message));
  }
  return data as T;
}

type QueryResult<T> = { data: T | null; error: { message: string } | null };
async function rows<T>(what: string, q: PromiseLike<QueryResult<T[]>>): Promise<T[]> {
  const { data, error } = await q;
  if (error) {
    console.warn(`[host] ${what} failed`, error.message);
    throw new ApiError(reasonOf(error.message));
  }
  return data ?? [];
}
async function done(what: string, q: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await q;
  if (error) {
    console.warn(`[host] ${what} failed`, error.message);
    throw new ApiError(reasonOf(error.message));
  }
}

// ── Session ────────────────────────────────────────────────────────────────

export type Me = { id: string; name: string; handle: string | null; avatarPath: string | null; hasEmail: boolean };

/** The signed-in runner, or null when there is no session. */
export async function sessionMe(): Promise<Me | null> {
  const { data } = await sb().auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const { data: row } = await sb().from("users").select("display_name, handle, avatar_path").eq("id", user.id).maybeSingle();
  const r = row as { display_name: string | null; handle: string | null; avatar_path: string | null } | null;
  return { id: user.id, name: r?.display_name ?? "You", handle: r?.handle ?? null, avatarPath: r?.avatar_path ?? null, hasEmail: !!user.email };
}

export async function signOut(): Promise<void> {
  await sb().auth.signOut();
}

// ── Storage ────────────────────────────────────────────────────────────────

export type Bucket = "avatars" | "club-avatars" | "event-covers";

/**
 * Signed URLs for private storage paths (24 h, as the app's signedUrls.ts).
 * A runner's `preset:<key>` avatar is one of the app's built-in faces, not a
 * file, so it has no URL here and the Avatar falls back to initials.
 */
export async function signedUrls(bucket: Bucket, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const real = [...new Set(paths.filter((p): p is string => !!p && !p.startsWith("preset:")))];
  for (let i = 0; i < real.length; i += 100) {
    const { data } = await sb().storage.from(bucket).createSignedUrls(real.slice(i, i + 100), 86400);
    for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  }
  return out;
}

// ── Hosting: who you can host as ───────────────────────────────────────────

export type SquadRole = "owner" | "organiser" | "run_leader" | "member";
export type HostSquad = {
  id: string; name: string; slug: string | null; avatar_path: string | null; role: SquadRole;
  verified: boolean; is_public: boolean; women_only: boolean; verification: string | null; members: number;
};
export type Organizer = {
  id: string; name: string; slug: string | null; bio: string | null; instagram: string | null;
  status: "pending" | "approved" | "rejected" | "suspended"; decided_at: string | null; decision_note: string | null;
  cooldown_until: string | null; avatar_path: string | null; events_count: number;
};
export type Hosting = { squads: HostSquad[]; organizer: Organizer | null; can_host: boolean };

export async function myHosting(): Promise<Hosting> {
  const d = await rpc<Partial<Hosting> | null>("my_hosting");
  return { squads: d?.squads ?? [], organizer: d?.organizer ?? null, can_host: !!d?.can_host };
}

// ── Squad: detail and settings ─────────────────────────────────────────────

export type JoinPolicy = "open" | "request" | "invite";
export type SquadDetail = {
  id: string; name: string; slug: string | null; invite_code: string | null; description: string | null;
  location: string | null; instagram: string | null; verified: boolean; has_coords: boolean;
  avatar_path: string | null; cover_path: string | null; member_count: number; join_policy: JoinPolicy;
  weekly_goal_km: number | null; women_only: boolean; rsvp_reminders: boolean; posting_mode: "all" | "owners_only";
  created_at: string; chat_enabled: boolean; rules: string[] | null; join_questions: string[] | null;
  my_role: SquadRole; organiser_name: string | null; pending_requests: number;
};

/** The squad as a member sees it, plus the staff counts. Null when you aren't a member. */
export const squadDetail = (circleId: string) => rpc<SquadDetail | null>("get_squad_detail", { p_circle_id: circleId });

export type SquadOverviewRow = {
  circle_id: string; name: string; role: SquadRole; member_count: number; weekly_goal_km: number | null;
  week_km: number; pending_requests: number; next_run_id: string | null; next_run_at: string | null;
  next_run_title: string | null; verified: boolean;
};
/** This week's totals for every squad you're in (the app's Squads tab). */
export const squadsOverview = (weekKey = currentWeekKey()) =>
  rpc<SquadOverviewRow[] | null>("my_squads_overview", { p_week_key: weekKey }).then(r => r ?? []);

/** The columns a squad's staff may change directly (circles_update_owner + the column grant). */
export type SquadPatch = Partial<{
  name: string; description: string; weekly_goal_km: number; rsvp_reminders: boolean; women_only: boolean;
  posting_mode: "all" | "owners_only"; rules: string[]; join_questions: string[]; chat_enabled: boolean;
}>;
export const updateSquad = (circleId: string, patch: SquadPatch) =>
  done("circles update", sb().from("circles").update(patch).eq("id", circleId));
// ── Squad photo and cover ──────────────────────────────────────────────────
// The app's clubAvatar.ts and squadCover.ts: both live in the private
// club-avatars bucket under "<circle id>/…" (the first folder is what the
// storage policies read: owners and organisers may write). The photo is a
// square saved at 512 px, the cover 5:2 at 1500 × 600, both JPEG. Upload a new
// file, point the squad at it, then remove the old one; if pointing fails, the
// new file is removed instead, so nothing is left stranded.

export type SquadImage = "photo" | "cover";
export const SQUAD_IMAGE: Record<SquadImage, { column: "avatar_path" | "cover_path"; prefix: string; aspect: number; out: { width: number; height: number } }> = {
  photo: { column: "avatar_path", prefix: "", aspect: 1, out: { width: 512, height: 512 } },
  cover: { column: "cover_path", prefix: "cover-", aspect: 5 / 2, out: { width: 1500, height: 600 } },
};
const CLUB_BUCKET = "club-avatars";

/** Point the squad at a file (or at nothing). RLS matches no row, without an error, for someone who isn't staff. */
async function setSquadImagePath(circleId: string, kind: SquadImage, path: string | null): Promise<void> {
  const { data, error } = await sb().from("circles").update({ [SQUAD_IMAGE[kind].column]: path }).eq("id", circleId).select("id");
  if (error) throw new ApiError(reasonOf(error.message));
  if (!data?.length) throw new ApiError("not_owner");
}
async function removeObject(path: string | null | undefined): Promise<void> {
  if (!path) return;
  try { await sb().storage.from(CLUB_BUCKET).remove([path]); } catch { /* best effort, as in the app */ }
}

/** Upload a cropped JPEG as the squad's photo or cover. Returns the new storage path. */
export async function uploadSquadImage(circleId: string, kind: SquadImage, jpeg: Blob, previousPath: string | null): Promise<string> {
  const rand = `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 10)}`;
  const path = `${circleId}/${SQUAD_IMAGE[kind].prefix}${rand}.jpg`;
  const { error } = await sb().storage.from(CLUB_BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
  if (error) {
    console.warn("[host] squad image upload failed", error.message);
    throw new ApiError(reasonOf(error.message));
  }
  try {
    await setSquadImagePath(circleId, kind, path);
  } catch (e) {
    await removeObject(path);
    throw e;
  }
  await removeObject(previousPath);
  return path;
}

/** Clear the squad's photo or cover: the column first, then the file. */
export async function removeSquadImage(circleId: string, kind: SquadImage, previousPath: string | null): Promise<void> {
  await setSquadImagePath(circleId, kind, null);
  await removeObject(previousPath);
}

export const setJoinPolicy = (circleId: string, policy: JoinPolicy) =>
  rpc<unknown>("set_join_policy", { p_circle_id: circleId, p_policy: policy }).then(() => undefined);
/** Owner only. An empty handle clears it. */
export const setSquadInstagram = (circleId: string, handle: string) =>
  rpc<string | null>("set_squad_instagram", { p_circle_id: circleId, p_handle: handle });

export type Verification = {
  verified: boolean; verified_at: string | null; is_public: boolean; instagram: string | null; is_owner: boolean;
  request: { status: string; code?: string | null; instagram: string | null; owner_note: string | null; created_at: string; decided_at: string | null } | null;
  retry_at: string | null;
};
export const verificationStatus = (circleId: string) => rpc<Verification>("club_verification_status", { p_circle_id: circleId });
export const requestVerification = (circleId: string) => rpc<unknown>("request_club_verification", { p_circle_id: circleId });
export const cancelVerification = (circleId: string) => rpc<unknown>("cancel_club_verification", { p_circle_id: circleId });

// ── Members ────────────────────────────────────────────────────────────────

export type Segment = "New" | "Regulars" | "Slipping" | "Lapsed" | "Active";
export type Member = {
  userId: string; name: string; handle: string | null; avatarPath: string | null; role: SquadRole; title: string | null;
  joinedAt: string; isSelf: boolean;
  /** This week on pacr. */
  weekKm: number; weekRuns: number;
  /** Runs logged on pacr in the last 12 weeks, and when the last one was. */
  runs12: number; km12: number; lastRunAt: string | null;
  /** One cell per week, oldest first, last = this week: ran that week or not. */
  strip: number[];
  segment: Segment;
};

type MemberWeekRow = {
  user_id: string; display_name: string | null; avatar_path: string | null; role: SquadRole; joined_at: string;
  week_km: number | null; run_count: number | null; is_self: boolean; title: string | null;
};
export type RunSummary = { user_id: string; distance_km: number; started_at: string };

const WEEK_MS = 7 * 86400000;
/** Monday 00:00 (local) of the week `weeksAgo` weeks before this one. */
export function weekStart(weeksAgo = 0, now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() || 7) - 1) - weeksAgo * 7);
  return d;
}

/**
 * Runs the squad's members logged on pacr since `from` (run_summaries is
 * readable by co-members: it is what the app's leaderboard reads). Paged the
 * same way as the app's boardBatch.
 */
export async function runSummaries(userIds: string[], from: Date): Promise<RunSummary[]> {
  const ids = [...new Set(userIds)];
  const out: RunSummary[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    for (let page = 0; page < 20; page++) {
      const data = await rows<{ user_id: string; distance_km: number | string | null; started_at: string }>(
        "run_summaries",
        sb().from("run_summaries").select("id, user_id, distance_km, started_at").in("user_id", batch)
          .gte("started_at", from.toISOString()).order("id").range(page * 1000, page * 1000 + 999),
      );
      for (const r of data) out.push({ user_id: r.user_id, distance_km: Number(r.distance_km ?? 0), started_at: r.started_at });
      if (data.length < 1000) break;
    }
  }
  return out;
}

/** Where a member stands, from the runs they log on pacr (not from check-ins). */
export function segmentOf(m: { joinedAt: string; runs12: number; lastRunAt: string | null; strip: number[] }, now = Date.now()): Segment {
  const joinedDays = (now - new Date(m.joinedAt).getTime()) / 86400000;
  if (m.runs12 === 0) return joinedDays <= 30 ? "New" : "Lapsed";
  const sinceRun = m.lastRunAt ? (now - new Date(m.lastRunAt).getTime()) / 86400000 : Infinity;
  if (sinceRun > 56) return "Lapsed";
  if (sinceRun > 21) return "Slipping";
  return m.strip.slice(-4).filter(Boolean).length >= 3 ? "Regulars" : "Active";
}

export type Roster = { members: Member[]; runs: RunSummary[] };

/**
 * The squad's roster with 12 weeks of running: names, handles, roles, joined
 * dates, this week's km, a week-by-week strip and a segment for each member.
 */
export async function memberRoster(circleId: string): Promise<Roster> {
  const week = await rpc<MemberWeekRow[] | null>("squad_members_week", { p_circle_id: circleId, p_week_key: currentWeekKey() });
  const list = week ?? [];
  const ids = list.map(m => m.user_id);
  const from = weekStart(11);
  // 200 ids to a request, as the app batches them: a big squad's ids don't fit in one URL.
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) batches.push(ids.slice(i, i + 200));
  const [handleBatches, runs] = await Promise.all([
    Promise.all(batches.map(b => rows<{ id: string; handle: string | null }>("users", sb().from("users").select("id, handle").in("id", b)))),
    runSummaries(ids, from),
  ]);
  const handles = handleBatches.flat();
  const handleOf = new Map(handles.map(h => [h.id, h.handle]));
  const byUser = new Map<string, RunSummary[]>();
  for (const r of runs) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  const members = list.map((m): Member => {
    const mine = byUser.get(m.user_id) ?? [];
    const strip = Array.from({ length: 12 }, () => 0);
    let last: string | null = null;
    let km12 = 0;
    for (const r of mine) {
      const idx = Math.floor((new Date(r.started_at).getTime() - from.getTime()) / WEEK_MS);
      if (idx >= 0 && idx < 12) strip[idx] = 1;
      km12 += r.distance_km;
      if (!last || r.started_at > last) last = r.started_at;
    }
    const base = {
      userId: m.user_id, name: m.display_name ?? "Runner", handle: handleOf.get(m.user_id) ?? null,
      avatarPath: m.avatar_path, role: m.role, title: m.title, joinedAt: m.joined_at, isSelf: m.is_self,
      weekKm: Number(m.week_km ?? 0), weekRuns: Number(m.run_count ?? 0),
      runs12: mine.length, km12, lastRunAt: last, strip,
    };
    return { ...base, segment: segmentOf(base) };
  });
  return { members, runs };
}

export type MemberLite = { userId: string; name: string; avatarPath: string | null; role: SquadRole; joinedAt: string; isSelf: boolean };
/** Names and roles only (no run history): for pickers such as a run's leader. */
export async function membersLite(circleId: string): Promise<MemberLite[]> {
  const week = await rpc<MemberWeekRow[] | null>("squad_members_week", { p_circle_id: circleId, p_week_key: currentWeekKey() });
  return (week ?? []).map(m => ({ userId: m.user_id, name: m.display_name ?? "Runner", avatarPath: m.avatar_path, role: m.role, joinedAt: m.joined_at, isSelf: m.is_self }));
}
/** owner 3, organiser 2, run_leader 1, member 0: staff may only act on people ranked below them. */
export const roleRank = (role: SquadRole | null | undefined) => ({ owner: 3, organiser: 2, run_leader: 1, member: 0 }[role ?? "member"] ?? -1);

/** organiser | run_leader | member. Making an owner is a separate invite, in the app. */
export const setMemberRole = (circleId: string, userId: string, role: Exclude<SquadRole, "owner">) =>
  rpc<void>("set_member_role", { p_circle_id: circleId, p_user_id: userId, p_role: role });
/** Remove a member; with `ban` they also can't see or rejoin the squad. */
export const removeMember = (circleId: string, userId: string, ban = false) =>
  rpc<void>("remove_member", { p_circle_id: circleId, p_user_id: userId, p_ban: ban });

export type Ban = { user_id: string; display_name: string | null; avatar_path: string | null; created_at: string };
export const listBans = (circleId: string) => rpc<Ban[] | null>("list_bans", { p_circle_id: circleId }).then(r => r ?? []);
export const unbanMember = (circleId: string, userId: string) =>
  rpc<void>("unban_member", { p_circle_id: circleId, p_user_id: userId });

// ── Join requests ──────────────────────────────────────────────────────────

export type JoinRequest = {
  user_id: string; display_name: string | null; avatar_path: string | null; created_at: string;
  /** Runs they logged on pacr in the last 30 days. */
  runs_30d: number;
  /** How many of the squad's members they follow. */
  follows_in_squad: number;
  answers: { q: string; a: string }[] | null;
  /** The squad asks questions but this request came from an app too old to answer them. */
  old_app: boolean;
};
export const listJoinRequests = (circleId: string) =>
  rpc<JoinRequest[] | null>("list_join_requests", { p_circle_id: circleId }).then(r => r ?? []);
export const answerJoinRequest = (circleId: string, userId: string, approve: boolean) =>
  rpc<boolean>(approve ? "approve_join_request" : "decline_join_request", { p_circle_id: circleId, p_user_id: userId });

// ── Runs ───────────────────────────────────────────────────────────────────
// A run is a squad_announcements row with rsvp = true and an event_at. A
// weekly run is ONE row whose event_at moves on a week after each run, so a
// run has no capacity, can't be edited, and only its next date exists.

export type Goer = { id: string; name: string | null; avatar_path: string | null };
export type SquadRun = {
  id: string; circle_id: string; circle_name: string; author_id: string; title: string; event_at: string;
  meeting_point: string | null; distance_km: number | null; pace_label: string | null; repeat_weekly: boolean;
  going_count: number; going_by_me: boolean;
  /** At most 4 from list_squad_runs; the full list from getRun. */
  goers: Goer[] | null;
  meeting_lat: number | null; meeting_lng: number | null; google_place_id: string | null;
  circle_slug: string | null; women_only: boolean; leader_id: string | null; leader_name: string | null; leader_title: string | null;
};
export type SquadRunDetail = SquadRun & {
  my_role: SquadRole | null; can_cancel: boolean; checkin_open: boolean; checked_in_by_me: boolean; can_check_in: boolean;
};

/** Upcoming runs (and, for people who can check in, runs up to 12 h past their start). */
export const listRuns = (circleId: string, limit = 60) =>
  rpc<SquadRun[] | null>("list_squad_runs", { p_circle_id: circleId, p_limit: limit }).then(r => r ?? []);
export async function getRun(runId: string): Promise<SquadRunDetail | null> {
  const d = await rpc<SquadRunDetail[] | SquadRunDetail | null>("get_squad_run", { p_run_id: runId });
  return Array.isArray(d) ? d[0] ?? null : d;
}
/** When each runner RSVP'd (readable by any member of the run's squad). */
export const runRsvps = (runId: string) =>
  rows<{ user_id: string; created_at: string }>(
    "announcement_rsvps", sb().from("announcement_rsvps").select("user_id, created_at").eq("announcement_id", runId));

export type RunDraft = {
  title: string; eventAt: Date; distanceKm: number; paceLabel: string; meetingPoint: string; placeId: string | null;
  repeatWeekly: boolean; womenOnly: boolean; leaderId: string | null;
};
/** Schedule a run (run leader and up). Members get a push; RSVPs open at once. */
export async function scheduleRun(circleId: string, d: RunDraft): Promise<void> {
  const { data } = await sb().auth.getSession();
  const user = data.session?.user;
  if (!user) throw new ApiError("signed_out");
  if (!user.email) throw new ApiError("email_required");
  await done("schedule run", sb().from("squad_announcements").insert({
    circle_id: circleId, author_id: user.id, title: d.title.trim(), event_at: d.eventAt.toISOString(), rsvp: true,
    distance_km: Math.round(d.distanceKm * 10) / 10, pace_label: d.paceLabel.trim() || null,
    meeting_point: d.meetingPoint.trim() || null, place_id: d.placeId, repeat_weekly: d.repeatWeekly,
    women_only: d.womenOnly, leader_id: d.leaderId ?? user.id,
  }));
}
/** Cancel a run: everyone going gets a push and it leaves the calendar. A weekly run stops repeating. */
export const cancelRun = (runId: string) => rpc<void>("cancel_squad_run", { p_run_id: runId });

// ── Places: the squad's home base and saved meeting places ─────────────────
// The app's squadScreen.ts (circle_places, 20261014120000 + 20261028120000):
// run leaders and up save places (up to 20), owners and organisers remove
// them, and only the owner picks the home base, which is what Near you
// measures from and what a squad needs before it can schedule runs.

export type Place = { id: string; name: string; address: string | null; lat: number | null; lng: number | null; google_place_id: string | null; is_home: boolean };
export const listPlaces = (circleId: string) => rpc<Place[] | null>("list_circle_places", { p_circle_id: circleId }).then(r => r ?? []);
export const MAX_PLACES = 20;

export type PlaceDraft = { name: string; address: string | null; lat: number | null; lng: number | null; googlePlaceId: string | null };
/** Save a place, or get back the one already saved for that Google place. */
export async function addPlace(circleId: string, d: PlaceDraft): Promise<Place> {
  const r = await rpc<Omit<Place, "is_home"> | Omit<Place, "is_home">[] | null>("add_circle_place", {
    p_circle_id: circleId, p_name: d.name.trim(), p_address: d.address, p_lat: d.lat, p_lng: d.lng, p_google_place_id: d.googlePlaceId,
  });
  const row = Array.isArray(r) ? r[0] : r;
  if (!row?.id) throw new ApiError("error");
  return { id: row.id, name: row.name, address: row.address ?? null, lat: row.lat ?? null, lng: row.lng ?? null, google_place_id: row.google_place_id ?? null, is_home: false };
}
/** Remove a saved place (owners and organisers). Runs that met there keep the name. */
export const removePlace = (placeId: string) => rpc<void>("remove_circle_place", { p_place_id: placeId });
/** Make a saved place the home base (the owner only). */
export const setHomePlace = (circleId: string, placeId: string) => rpc<unknown>("set_home_place", { p_circle_id: circleId, p_place_id: placeId });

/** Google Maps at the place's pin (Maps URLs: no key). Null without a pin. */
export function mapsUrl(p: { lat: number | null; lng: number | null; google_place_id?: string | null }): string | null {
  if (p.lat == null || p.lng == null) return null;
  const q = `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}${p.google_place_id ? `&query_place_id=${encodeURIComponent(p.google_place_id)}` : ""}`;
}

// Google search goes through the app's `places` edge function, so the Google
// key stays on the server (the app's places.ts). The keystrokes and the
// details call for the place picked share a session token, which Google
// bills as one session; each runner gets 300 calls a day.

export type PlaceSuggestion = { placeId: string; main: string; secondary: string; distanceKm?: number | null; kind?: string | null };
export type PickedPlace = { placeId: string; name: string; address: string; lat: number; lng: number };

export function newPlacesSession(): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => abc[b % abc.length]).join("");
}

async function places<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().functions.invoke("places", { body });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    console.warn(`[host] places ${String(body.action)} failed`, status ?? error.message);
    throw new ApiError(status === 503 ? "places_unavailable" : status === 429 ? "places_limit" : status === 403 ? "email_required" : status === 401 ? "signed_out" : "error");
  }
  return data as T;
}
export const searchPlaces = (input: string, session: string, near: { lat: number; lng: number } | null) =>
  places<{ suggestions?: PlaceSuggestion[] }>({ action: "autocomplete", input, sessionToken: session, near: near ?? undefined }).then(r => r.suggestions ?? []);
export async function placeDetails(placeId: string, session: string): Promise<PickedPlace> {
  const r = await places<{ place?: PickedPlace }>({ action: "details", placeId, sessionToken: session });
  if (!r.place) throw new ApiError("error");
  return r.place;
}

export type RunCheckins = {
  title: string; event_at: string; circle_id: string; open: boolean; changed_at: string | null; changed_by_name: string | null;
  people: { user_id: string; name: string | null; avatar_path: string | null; going: boolean; checked_in_at: string | null }[];
};
/** Who's going and who's checked in, for the run's current date only. */
export const runCheckins = (runId: string) => rpc<RunCheckins>("list_run_checkins", { p_run_id: runId });
/** Open or close check-in (closes by itself 12 h after opening). */
export const setRunCheckin = (runId: string, open: boolean) =>
  rpc<{ open: boolean; changed_at: string }>("set_squad_run_checkin", { p_run_id: runId, p_open: open });
export const undoCheckIn = (runId: string, userId: string) => rpc<void>("undo_check_in", { p_run_id: runId, p_user_id: userId });

export type RunLogRow = {
  id: string; action: "scheduled" | "cancelled"; actor_id: string | null; actor_name: string | null;
  actor_avatar_path: string | null; title: string; event_at: string; meeting_point: string | null; going_count: number; created_at: string;
};
/** Who scheduled and cancelled which runs. The squad's owner only. */
export const runHistory = (circleId: string, limit = 100) =>
  rpc<RunLogRow[] | null>("squad_run_history", { p_circle_id: circleId, p_limit: limit }).then(r => r ?? []);

// ── Announcements and chat ─────────────────────────────────────────────────

export type Announcement = { id: string; title: string; body: string | null; created_at: string; author_id: string; authorName: string | null };
type AnnouncementRow = { id: string; title: string; body: string | null; created_at: string; author_id: string; author: { display_name: string | null } | { display_name: string | null }[] | null };
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function listAnnouncements(circleId: string, limit = 50): Promise<Announcement[]> {
  const data = await rows<AnnouncementRow>(
    "announcements",
    sb().from("squad_announcements")
      .select("id, title, body, created_at, author_id, author:users!squad_announcements_author_id_fkey(display_name)")
      .eq("circle_id", circleId).is("event_at", null).order("created_at", { ascending: false }).limit(limit),
  );
  return data.map(a => ({ id: a.id, title: a.title, body: a.body, created_at: a.created_at, author_id: a.author_id, authorName: one(a.author)?.display_name ?? null }));
}
/** Post to the whole squad (owner and organisers). Every member gets a push and an inbox item. */
export async function createAnnouncement(circleId: string, title: string, body: string): Promise<void> {
  const { data } = await sb().auth.getSession();
  const user = data.session?.user;
  if (!user) throw new ApiError("signed_out");
  if (!user.email) throw new ApiError("email_required");
  await done("announcement", sb().from("squad_announcements").insert({
    circle_id: circleId, author_id: user.id, title: title.trim(), body: body.trim() || null, event_at: null, rsvp: false,
  }));
}
export const deleteAnnouncement = (id: string) =>
  done("delete announcement", sb().from("squad_announcements").delete().eq("id", id));

export type PinnedMessage = { id: string; body: string; pinned_at: string; authorName: string | null };
type PinnedRow = { id: string; body: string; pinned_at: string; author: { display_name: string | null } | { display_name: string | null }[] | null };
/** Up to three messages pinned in the squad chat. */
export async function listPinned(circleId: string): Promise<PinnedMessage[]> {
  const data = await rows<PinnedRow>(
    "pinned",
    sb().from("squad_messages").select("id, body, pinned_at, author:users!squad_messages_author_id_fkey(display_name)")
      .eq("circle_id", circleId).not("pinned_at", "is", null).order("pinned_at", { ascending: false }).limit(3),
  );
  return data.map(m => ({ id: m.id, body: plainMentions(m.body), pinned_at: m.pinned_at, authorName: one(m.author)?.display_name ?? null }));
}
export const unpinMessage = (messageId: string) => rpc<string>("pin_squad_message", { p_message_id: messageId, p_pin: false });

// Bodies carry mention tokens, "@[Name](user id)". People read "@Name"; the id
// must never reach the screen (the app's utils/mentions.ts plainMentions).
const MENTION_RE = /@\[([^\]\n]{1,64})\]\(([^)\s]{0,80})\)/g;
export const plainMentions = (body: string | null | undefined) => String(body ?? "").replace(MENTION_RE, "@$1");

// ── Moderation ─────────────────────────────────────────────────────────────

export type ReportKind = "post" | "comment" | "message" | "user";
export type Report = {
  /** Stable key for the reported thing. */
  key: string; targetType: ReportKind; targetId: string; reason: string; note: string | null; createdAt: string;
  reportCount: number; openReportIds: string[]; body: string | null; authorId: string | null; authorName: string | null;
  hidden: boolean; isMedia: boolean;
};
type ReportRow = { id: string; target_type: ReportKind; target_id: string; reason: string; note: string | null; status: string; created_at: string; snapshot: string | null };
type TargetRow = { id: string; body: string | null; kind?: string | null; author_id: string | null; hidden_at?: string | null; author: { display_name: string | null } | { display_name: string | null }[] | null };

/** The squad's open reports, one entry per reported post, comment or chat message (the app's listCircleReports). */
export async function listReports(circleId: string): Promise<Report[]> {
  const reports = await rows<ReportRow>(
    "content_reports",
    sb().from("content_reports").select("id, target_type, target_id, reason, note, status, created_at, snapshot")
      .eq("circle_id", circleId).eq("status", "open").order("created_at", { ascending: false }).limit(200),
  );
  if (!reports.length) return [];
  const idsOf = (t: ReportKind) => reports.filter(r => r.target_type === t).map(r => r.target_id);
  const postIds = idsOf("post"), commentIds = idsOf("comment"), messageIds = idsOf("message");
  const none = Promise.resolve([] as TargetRow[]);
  const [posts, comments, messages, all, targets] = await Promise.all([
    postIds.length ? rows<TargetRow>("posts", sb().from("posts").select("id, body, kind, author_id, hidden_at, author:users!posts_author_id_fkey(display_name)").in("id", postIds)) : none,
    commentIds.length ? rows<TargetRow>("post_comments", sb().from("post_comments").select("id, body, author_id, hidden_at, author:users!post_comments_author_id_fkey(display_name)").in("id", commentIds)) : none,
    messageIds.length ? rows<TargetRow>("squad_messages", sb().from("squad_messages").select("id, body, author_id, author:users!squad_messages_author_id_fkey(display_name)").in("id", messageIds)) : none,
    rows<{ id: string; target_id: string; status: string }>("report counts", sb().from("content_reports").select("id, target_id, status").eq("circle_id", circleId).in("target_id", reports.map(r => r.target_id))),
    postIds.length ? rows<{ post_id: string; hidden_at: string | null }>("post_targets", sb().from("post_targets").select("post_id, hidden_at").eq("circle_id", circleId).in("post_id", postIds)) : Promise.resolve([]),
  ]);
  const hiddenHere = new Set(targets.filter(t => t.hidden_at).map(t => t.post_id));
  const byId = new Map<string, TargetRow & { isPost: boolean }>();
  for (const p of posts) byId.set(p.id, { ...p, isPost: true });
  for (const c of comments) byId.set(c.id, { ...c, isPost: false });
  for (const m of messages) byId.set(m.id, { ...m, isPost: false });
  const count = new Map<string, number>(), open = new Map<string, string[]>();
  for (const r of all) {
    count.set(r.target_id, (count.get(r.target_id) ?? 0) + 1);
    if (r.status === "open") open.set(r.target_id, [...(open.get(r.target_id) ?? []), r.id]);
  }
  const seen = new Set<string>();
  const out: Report[] = [];
  for (const r of reports) {
    const key = `${r.target_type}:${r.target_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = byId.get(r.target_id);
    const body = t?.body ?? (r.target_type === "message" ? r.snapshot : null);
    out.push({
      key, targetType: r.target_type, targetId: r.target_id, reason: r.reason, note: r.note, createdAt: r.created_at,
      reportCount: count.get(r.target_id) ?? 1, openReportIds: open.get(r.target_id) ?? [r.id],
      body: body == null ? null : plainMentions(body), authorId: t?.author_id ?? null,
      authorName: one(t?.author)?.display_name ?? null, hidden: !!t?.hidden_at || hiddenHere.has(r.target_id),
      isMedia: !!t && t.isPost && !!t.kind && t.kind !== "text",
    });
  }
  return out;
}
/** How many things are waiting in the report queue. */
export async function countOpenReports(circleId: string): Promise<number> {
  const data = await rows<{ target_type: string; target_id: string }>(
    "open reports", sb().from("content_reports").select("target_type, target_id").eq("circle_id", circleId).eq("status", "open").limit(200));
  return new Set(data.map(r => `${r.target_type}:${r.target_id}`)).size;
}
/** Close reports as "actioned" (something was done) or "dismissed" (kept). */
export async function resolveReports(ids: string[], status: "actioned" | "dismissed"): Promise<void> {
  for (const id of ids) await rpc<unknown>("resolve_content_report", { p_report_id: id, p_status: status });
}
/** Take the reported thing down from this squad: a post leaves the squad's feed, a comment or chat message is deleted. */
export async function removeReported(r: Report, circleId: string): Promise<void> {
  if (r.targetType === "post") await rpc<string>("remove_post_from_circle", { p_post_id: r.targetId, p_circle_id: circleId });
  else if (r.targetType === "comment") await done("delete comment", sb().from("post_comments").delete().eq("id", r.targetId));
  else if (r.targetType === "message") await done("delete message", sb().from("squad_messages").delete().eq("id", r.targetId));
}

// ── Events ─────────────────────────────────────────────────────────────────

export type EventStatus = "draft" | "published" | "cancelled" | "ended";
export type HostedEvent = {
  id: string; title: string; kind: string; starts_at: string; ends_at: string | null; timezone: string | null;
  status: EventStatus; visibility: "public" | "squad" | "link"; cover_path: string | null; place_name: string | null;
  is_paid: boolean; host: { kind: "squad" | "organizer"; id: string; name: string } | null;
  capacity: number | null; sold: number; checked_in: number; checkin_open: boolean;
};
/** Every event you host or co-host, across all your squads and your organizer account. */
export const hostedEvents = (includePast = true) =>
  rpc<HostedEvent[] | null>("my_hosted_events", { p_include_past: includePast }).then(r => r ?? []);

export type Attendee = {
  user_id: string; name: string | null; avatar_path: string | null; tier_name: string | null; ticket_status: string;
  checked_in_at: string | null; registered_at: string; total_minor: number | null; refund_status: string | null;
  ticket_id: string; seq: number; qty: number;
};
/** One row per seat: who holds it, its tier and whether it's checked in. */
export const eventAttendees = (eventId: string) =>
  rpc<Attendee[] | null>("list_event_attendees", { p_event_id: eventId }).then(r => r ?? []);

export type EventSales = {
  tiers: { name: string; price_minor: number; capacity: number | null; sold: number; refunded: number }[];
  sold: number; ticket_gross_minor: number; ticket_refunded_minor: number; net_minor: number; fee_minor: number; gst_minor: number;
  refunds_open: number; payout_ready: boolean;
  payout: { status: string; hold_reason: string | null; net_minor: number; paid_at: string | null; reference: string | null } | null;
};
/** Sales for one event. The event's host only (not co-hosts). */
export const eventSales = (eventId: string) => rpc<EventSales>("event_sales_summary", { p_event_id: eventId });

export type Payout = {
  event_id: string; title: string; starts_at: string; tickets: number; ticket_gross_minor: number; ticket_refunded_minor: number;
  net_minor: number; status: "pending" | "hold" | "paid" | "void"; hold_reason: string | null; paid_at: string | null; reference: string | null;
};
/** One payout line per event for a squad or organizer account. */
export const myPayouts = (kind: "squad" | "organizer", hostId: string) =>
  rpc<Payout[] | null>("my_payouts", { p_host_kind: kind, p_host_id: hostId }).then(r => r ?? []);

export type PayoutAccount = { ready: boolean; can_edit: boolean; account: Record<string, string | null> | null };
/** The payout account on file, masked. */
export const payoutAccount = (kind: "squad" | "organizer", hostId: string) =>
  rpc<PayoutAccount>("my_payout_account", { p_host_kind: kind, p_host_id: hostId });

export type EventPricing = { paid_allowed: boolean; fee_bps: number; gst_bps: number };
/** pacr's fee (5%) and the GST on it (18%), as the database has them. */
export const eventPricing = () => rpc<EventPricing>("event_pricing");

// ── Sponsor report ─────────────────────────────────────────────────────────

export type ReportBucket = "day" | "week" | "month";
export type ReportPoint = { start: string; km: number; runs: number; active: number; joined: number; group_runs: number; checkins: number };
export type ReportRun = { run_id: string; at: string; title: string; going: number | null; checked_in: number; first_timers: number };
export type SquadReport = {
  from: string; to: string; bucket: ReportBucket; tz: string;
  series: ReportPoint[];
  running: {
    km: number; runs: number; active: number; duration_sec: number; avg_km: number | null; avg_pace_sec: number | null; longest_km: number | null;
    bands: { under_5: number; k5: number; k10: number; half: number; full: number };
  };
  /** Current members only: leaving isn't recorded, so there is no churn. */
  members: { now: number; at_start: number; at_end: number; joined: number };
  group_runs: {
    held: number; checkins: number; first_timers: number; unique: number; cancelled: number;
    /** Going and checked in over the runs that used check-in and kept a going count (null when none). */
    going: number | null; going_checked_in: number | null;
    runs: ReportRun[];
  };
  engagement: { posts: number; kudos: number; comments: number; messages: number; chatters: number };
  top_runners: { name: string; runs: number; km: number }[];
};
/**
 * A squad's numbers for [from, to) (IST calendar days, `to` exclusive), in
 * day, 7-day or month buckets. Owners and organisers. Runs count only while
 * the runner was a member; turnout comes from QR check-ins, and the going
 * count of a weekly run's past date exists only from 20261221 on.
 */
export const squadReport = (circleId: string, from: string, to: string, bucket: ReportBucket) =>
  rpc<SquadReport>("squad_report", { p_circle_id: circleId, p_from: from, p_to: to, p_bucket: bucket, p_tz: "Asia/Kolkata" }).then(r => ({
    ...r,
    series: r.series.map(p => ({ ...p, km: Number(p.km) })),
    running: { ...r.running, km: Number(r.running.km), avg_km: r.running.avg_km == null ? null : Number(r.running.avg_km),
      avg_pace_sec: r.running.avg_pace_sec == null ? null : Number(r.running.avg_pace_sec),
      longest_km: r.running.longest_km == null ? null : Number(r.running.longest_km) },
    top_runners: r.top_runners.map(t => ({ ...t, km: Number(t.km) })),
  }));

// ── Weeks ──────────────────────────────────────────────────────────────────

/** ISO week key in local time, "2026-W46": the app's computeWeekKey. */
export function weekKeyOf(d: Date): string {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 4 - (t.getDay() || 7));
  const yearStart = new Date(t.getFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
export const currentWeekKey = () => weekKeyOf(new Date());
/** "W46" from a date: chart labels. */
export const weekLabel = (d: Date) => weekKeyOf(d).slice(5);
