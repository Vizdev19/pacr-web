"use client";

// Run buddies (open runs) on the web, read and joined as the runner. App repo:
// 20261020120000_open_runs.sql (+ 20261021 profiles, 20261024 history,
// 20261030 review fixes, 20261122 no trust bar); the app's
// src/services/openRuns.ts and src/components/runBuddies/*.
//
// The server holds every rule: women-only runs are invisible to everyone
// else, 1:1 runs always need the host's approval, an approval run's place
// (and the host's note) is hidden until you're let in, names are "First L."
// until you've run together, blocks hide runs, and a suspension stops joining.
// This file only shapes rows and turns refusals into the app's words.
//
// Posting a run, the run chat, "I'm here", "I'm safe", the trusted contact
// and answering requests stay in the app.
import { getSupabase } from "./supabase";
import { signedUrls } from "./storage";
import { TZ } from "./format";
import { faceOf } from "./avatars";

export type Pace = "any" | "easy" | "steady" | "fast";
export type MyStatus = "host" | "accepted" | "pending" | "declined" | "left" | "removed" | "invited" | "invite_declined" | null;

export type Record_ = { hosted: number; joined: number; showed: number; noShows: number };

export type OpenRunCard = {
  id: string; title: string; startsAt: string; endsAt: string; distanceKm: number; pace: Pace; cap: number;
  approval: boolean; womenOnly: boolean; acceptedCount: number; myStatus: MyStatus; isExact: boolean;
  placeName: string | null; meetPoint: string | null; awayKm: number; hostId: string | null; hostName: string;
  hostAvatar: string | null; host: Record_; ranWith: number;
};

export type Person = Record_ & { userId: string; name: string; avatar: string | null; isHost: boolean; ranWith: number | null };

export type OpenRunDetail = {
  id: string; title: string; startsAt: string; endsAt: string; distanceKm: number; pace: Pace; cap: number;
  approval: boolean; womenOnly: boolean; status: "open" | "cancelled"; note: string | null; myStatus: MyStatus;
  isExact: boolean; placeName: string | null; placeAddress: string | null; meetPoint: string | null;
  googlePlaceId: string | null; lat: number | null; lng: number | null; hostId: string | null; chatClosesAt: string | null;
  acceptedCount: number; leaveIsLate: boolean; safetyCheck: boolean; safeAt: string | null; members: Person[];
  requests: number | null;
};

export type MyOpenRun = {
  id: string; title: string; startsAt: string; endsAt: string; status: "open" | "cancelled"; myStatus: MyStatus;
  placeName: string | null; cap: number; acceptedCount: number; pendingRequests: number; womenOnly: boolean;
  approval: boolean; hostName: string; hostAvatar: string | null; safetyDue: boolean;
};

export type PastRun = {
  id: string; title: string; startsAt: string; endsAt: string; distanceKm: number; pace: Pace; cap: number;
  womenOnly: boolean; isHost: boolean; outcome: "ran" | "left" | "cancelled"; placeName: string | null; departed: number;
  people: (Partial<Record_> & { userId: string; name: string; avatar: string | null; isHost: boolean })[];
  placeAddress?: string | null; meetPoint?: string | null; safetyDue?: boolean; canMark?: boolean;
};

export type PastSummary = { runs: number; hosted: number; showed: number; noShows: number; people: number };
export type PastPage = { runs: PastRun[]; summary: PastSummary | null; cursor: { startsAt: string; id: string } | null };

export type Eligibility = { suspended: boolean; emailRequired: boolean; group: boolean; oneToOne: boolean };

export type Fail = string;
export type Result<T> = { ok: true; value: T } | { ok: false; reason: Fail };

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v) || 0;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const numOrNull = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const pace = (v: unknown): Pace => (v === "easy" || v === "steady" || v === "fast" ? v : "any");
const rec = (x: Row): Record_ => ({ hosted: num(x.hosted), joined: num(x.joined), showed: num(x.showed), noShows: num(x.no_shows) });

// Every refusal the open-run RPCs raise (openRuns.ts FAILS).
const FAILS = [
  "women_only", "run_full", "run_closed", "run_not_found", "not_allowed", "account_too_new", "not_enough_runs", "suspended",
  "no_profile", "email_required", "host_limit", "blocked_terms", "too_long", "run_over", "is_host", "no_invite", "no_request",
  "host_cannot_leave", "not_in_run", "not_found",
];

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  try {
    const { data, error } = await getSupabase().rpc(fn, args);
    if (error) return { ok: false, reason: FAILS.find(f => error.message.includes(f)) ?? "error" };
    return { ok: true, value: data as T };
  } catch {
    return { ok: false, reason: "error" };
  }
}

async function avatars(paths: unknown[]): Promise<(p: unknown) => string | null> {
  const m = await signedUrls("avatars", paths.map(str));
  return p => { const s = str(p); return s ? m.get(s) ?? null : null; };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function nearbyOpenRuns(lat: number, lng: number, radiusKm: number): Promise<OpenRunCard[] | null> {
  const res = await rpc<Row[]>("nearby_open_runs", { p_lat: lat, p_lng: lng, p_radius_km: radiusKm });
  if (!res.ok || !Array.isArray(res.value)) return null;
  const url = await avatars(res.value.map(r => r.host_avatar_path));
  return res.value.map(r => ({
    id: String(r.id), title: String(r.title ?? ""), startsAt: String(r.starts_at), endsAt: String(r.ends_at),
    distanceKm: num(r.distance_km), pace: pace(r.pace), cap: num(r.cap), approval: !!r.approval, womenOnly: !!r.women_only,
    acceptedCount: num(r.accepted_count), myStatus: (str(r.my_status) as MyStatus) ?? null, isExact: !!r.is_exact,
    placeName: str(r.place_name), meetPoint: str(r.meet_point), awayKm: num(r.away_km), hostId: str(r.host_id),
    hostName: str(r.host_name) ?? "Runner", hostAvatar: url(r.host_avatar_path),
    host: { hosted: num(r.host_hosted), joined: 0, showed: num(r.host_showed), noShows: num(r.host_no_shows) }, ranWith: num(r.ran_with),
  }));
}

export async function getOpenRun(id: string): Promise<OpenRunDetail | null> {
  const res = await rpc<Row>("get_open_run", { p_run_id: id });
  if (!res.ok || !res.value) return null;
  const r = res.value;
  const members = (Array.isArray(r.members) ? r.members : []) as Row[];
  const url = await avatars(members.map(m => m.avatar_path));
  const me = (r.me ?? null) as Row | null;
  return {
    id: String(r.id), title: String(r.title ?? ""), startsAt: String(r.starts_at), endsAt: String(r.ends_at),
    distanceKm: num(r.distance_km), pace: pace(r.pace), cap: num(r.cap), approval: !!r.approval, womenOnly: !!r.women_only,
    status: r.status === "cancelled" ? "cancelled" : "open", note: str(r.note), myStatus: (str(r.my_status) as MyStatus) ?? null,
    isExact: !!r.is_exact, placeName: str(r.place_name), placeAddress: str(r.place_address), meetPoint: str(r.meet_point),
    googlePlaceId: str(r.google_place_id), lat: numOrNull(r.lat), lng: numOrNull(r.lng), hostId: str(r.host_id),
    chatClosesAt: str(r.chat_closes_at), acceptedCount: num(r.accepted_count),
    leaveIsLate: !!me?.leave_is_late, safetyCheck: !!me?.safety_check, safeAt: str(me?.safe_at),
    members: members.map(m => ({
      userId: String(m.user_id), name: str(m.name) ?? "Runner", avatar: faceOf(url(m.avatar_path), str(m.avatar_path), String(m.user_id)), isHost: !!m.is_host,
      ranWith: m.ran_with == null ? null : num(m.ran_with), ...rec(m),
    })),
    requests: Array.isArray(r.requests) ? r.requests.length : null,
  };
}

export async function myOpenRuns(): Promise<MyOpenRun[] | null> {
  const res = await rpc<Row[]>("my_open_runs", {});
  if (!res.ok || !Array.isArray(res.value)) return null;
  const url = await avatars(res.value.map(r => r.host_avatar_path));
  return res.value.map(r => ({
    id: String(r.id), title: String(r.title ?? ""), startsAt: String(r.starts_at), endsAt: String(r.ends_at),
    status: r.status === "cancelled" ? "cancelled" : "open", myStatus: (str(r.my_status) as MyStatus) ?? null,
    placeName: str(r.place_name), cap: num(r.cap), acceptedCount: num(r.accepted_count), pendingRequests: num(r.pending_requests),
    womenOnly: !!r.women_only, approval: !!r.approval, hostName: str(r.host_name) ?? "Runner", hostAvatar: url(r.host_avatar_path),
    safetyDue: !!r.safety_due,
  }));
}

const PAST_PAGE = 30;

function pastRow(r: Row, url: (p: unknown) => string | null, detail: boolean): PastRun {
  const people = (Array.isArray(r.people) ? r.people : []) as Row[];
  return {
    id: String(r.id), title: String(r.title ?? ""), startsAt: String(r.starts_at), endsAt: String(r.ends_at),
    distanceKm: num(r.distance_km), pace: pace(r.pace), cap: num(r.cap), womenOnly: !!r.women_only, isHost: !!r.is_host,
    outcome: r.outcome === "left" || r.outcome === "cancelled" ? r.outcome : "ran", placeName: str(r.place_name), departed: num(r.departed),
    people: people.map(p => ({ userId: String(p.user_id), name: str(p.name) ?? "Runner", avatar: faceOf(url(p.avatar_path), str(p.avatar_path), String(p.user_id)), isHost: !!p.is_host, ...(detail ? rec(p) : {}) })),
    ...(detail ? { placeAddress: str(r.place_address), meetPoint: str(r.meet_point), safetyDue: !!r.safety_due, canMark: !!r.can_mark } : {}),
  };
}

export async function myPastOpenRuns(cursor: { startsAt: string; id: string } | null): Promise<PastPage | null> {
  const res = await rpc<Row>("my_past_open_runs", { p_before_start: cursor?.startsAt ?? null, p_before_id: cursor?.id ?? null, p_limit: PAST_PAGE });
  if (!res.ok || !res.value) return null;
  const rows = (Array.isArray(res.value.runs) ? res.value.runs : []) as Row[];
  const url = await avatars(rows.flatMap(r => ((Array.isArray(r.people) ? r.people : []) as Row[]).map(p => p.avatar_path)));
  const runs = rows.map(r => pastRow(r, url, false));
  const s = res.value.summary as Row | null | undefined;
  const last = runs[runs.length - 1];
  return {
    runs,
    summary: s ? { runs: num(s.runs), hosted: num(s.hosted), showed: num(s.showed), noShows: num(s.no_shows), people: num(s.people) } : null,
    cursor: runs.length === PAST_PAGE && last ? { startsAt: last.startsAt, id: last.id } : null,
  };
}

export async function getPastOpenRun(id: string): Promise<PastRun | null> {
  const res = await rpc<Row>("get_past_open_run", { p_run_id: id });
  if (!res.ok || !res.value) return null;
  const people = (Array.isArray(res.value.people) ? res.value.people : []) as Row[];
  return pastRow(res.value, await avatars(people.map(p => p.avatar_path)), true);
}

export async function eligibility(): Promise<Eligibility | null> {
  const res = await rpc<Row>("open_run_eligibility", {});
  if (!res.ok || !res.value) return null;
  const e = res.value;
  return {
    suspended: !!e.suspended, emailRequired: !!e.email_required,
    group: !!(e.group as Row | undefined)?.ok, oneToOne: !!(e.one_to_one as Row | undefined)?.ok,
  };
}

// ─── Joining (the app's calls, unchanged) ───────────────────────────────────

/** Join an auto-join run or ask to join an approval run: 'accepted' or 'pending'. */
export const requestOpenRun = (runId: string, note?: string) =>
  rpc<"accepted" | "pending">("request_open_run", { p_run_id: runId, p_note: note?.trim() || null });

/** Leave a run, or take back a request. */
export const leaveOpenRun = (runId: string) => rpc<Row>("leave_open_run", { p_run_id: runId });

export const respondInvite = (runId: string, accept: boolean) =>
  rpc<string>("respond_open_run_invite", { p_run_id: runId, p_accept: accept });

export type ReportReason = "unsafe" | "harassment" | "no_show" | "spam" | "other";
export const REPORT_REASONS: [ReportReason, string][] = [
  ["unsafe", "Felt unsafe"], ["harassment", "Harassment"], ["no_show", "Didn't show"], ["spam", "Spam"], ["other", "Other"],
];

export const reportOpenRun = (a: { runId: string; reason: ReportReason; userId: string | null; note: string }) =>
  rpc<null>("report_open_run", { p_run_id: a.runId, p_reason: a.reason, p_user_id: a.userId, p_message_id: null, p_note: a.note.trim() || null });

// ─── Words ──────────────────────────────────────────────────────────────────

/** What to say when the server turns something down (the app's copy.ts). */
const COPY: Record<string, string> = {
  women_only: "This run is for women.",
  run_full: "That run just filled up.",
  run_closed: "That run has already started.",
  run_not_found: "That run isn't available any more.",
  not_allowed: "The host didn't add you to this run.",
  suspended: "Open runs are paused for your account. Contact support@pacr.life.",
  no_profile: "Finish setting up your profile in the app, then try again.",
  email_required: "Sign in again to do that.",
  blocked_terms: "That has a word pacr doesn't allow.",
  too_long: "That's a bit long.",
  host_cannot_leave: "Cancel the run in the app instead.",
  run_over: "This run has finished.",
  no_invite: "That invite isn't open any more.",
  not_found: "Couldn't send that report.",
};
export const failCopy = (reason: Fail) => COPY[reason] ?? "Couldn't do that. Check your connection and try again.";

export const SUSPENDED = {
  title: "Open runs are paused for your account",
  body: "People you ran with raised a concern. Email support@pacr.life and we'll look into it.",
};
export const NO_PROFILE = {
  title: "Open runs aren't available yet",
  body: "Finish setting up your profile in the app, then try again. If this keeps happening, email support@pacr.life.",
};

export const PACE_LABEL: Record<Pace, string> = { any: "Any pace", easy: "Easy · 6:00+ /km", steady: "Steady · 5:15 /km", fast: "Fast · 4:30 /km" };

/** "Showed up 7 of 7", or "New to pacr" before any finished run. */
export function showUpLine(r: Pick<Record_, "showed" | "noShows">): string {
  const of = r.showed + r.noShows;
  return of ? `Showed up ${r.showed} of ${of}` : "New to pacr";
}

/** The run card's host line: "Hosted 6 · showed up 10 of 10". */
export function hostLine(r: Record_): string {
  const of = r.showed + r.noShows;
  if (!of) return "New to pacr";
  return r.hosted ? `Hosted ${r.hosted} · showed up ${r.showed} of ${of}` : `Showed up ${r.showed} of ${of}`;
}

export const kmLabel = (km: number) => `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || "The host";
export const isIn = (s: MyStatus) => s === "host" || s === "accepted";

/** A 22-character ref back to a uuid, in the browser. Null when it isn't one. */
export function decodeRef(ref: string | null | undefined): string | null {
  if (!ref || !/^[A-Za-z0-9_-]{22}$/.test(ref)) return null;
  try {
    const bin = atob(ref.replace(/-/g, "+").replace(/_/g, "/") + "==");
    if (bin.length !== 16) return null;
    let hex = "";
    for (let i = 0; i < 16; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}

/** Days from today in IST: 0 today, 1 tomorrow. */
export function dayOffset(iso: string, now: number): number {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return Math.round((Date.parse(f.format(new Date(iso))) - Date.parse(f.format(new Date(now)))) / 86400000);
}

export const isWeekend = (iso: string) => {
  const d = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short" }).format(new Date(iso));
  return d === "Sat" || d === "Sun";
};

// ─── Where you are, only after "Use my location" ────────────────────────────
// Kept for this tab only (sessionStorage, ~100 m), so opening a run and coming
// back doesn't ask again. Never sent anywhere but nearby_open_runs.

const LOC_KEY = "pacr.runbuddies.loc";

export function savedLocation(): { lat: number; lng: number } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(LOC_KEY) || "null");
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? { lat: v.lat, lng: v.lng } : null;
  } catch {
    return null;
  }
}

export function forgetLocation() {
  try { sessionStorage.removeItem(LOC_KEY); } catch { /* storage blocked */ }
}

export function locate(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { reject(new Error("unsupported")); return; }
    navigator.geolocation.getCurrentPosition(p => {
      const at = { lat: Math.round(p.coords.latitude * 1000) / 1000, lng: Math.round(p.coords.longitude * 1000) / 1000 };
      try { sessionStorage.setItem(LOC_KEY, JSON.stringify(at)); } catch { /* storage blocked */ }
      resolve(at);
    }, e => reject(e), { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 });
  });
}
