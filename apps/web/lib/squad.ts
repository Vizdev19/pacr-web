// The squad share page (/s/<slug>) and its run view (?run=<ref>), the
// replacement for pacr.life's api/squad.mjs.
//
// Data is get_club_page (latest body: 20261113120000_squad_cover.sql in the
// app repo): as anon on the server for the first render and the link preview,
// then again in the browser with the runner's session for is_member,
// requested, banned and going_by_me. Strangers see what the app shows them:
// counts, the schedule, the organiser, never members' names.
//
// Nothing that reaches the page carries an id: the squad is its slug, a run is
// a 22-character ref, pictures go through /s/<slug>/photo and /cover with a
// ?v= hash of the storage path (the path starts with the squad's uuid).
//
// This file is used on both sides (no node: imports): the server page, the
// route handlers and the client views.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import { eventCard } from "./cards";
import { encodeRef } from "./refs";
import type { EventRow } from "./types";

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const CODE_RE = /^[a-z0-9]{4,16}$/;
export const REF_RE = /^[A-Za-z0-9_-]{22}$/;

export const SITE = "https://pacr.life";
export const ANDROID_PACKAGE = "life.pacr.app";
export const APP_STORE_ID = "6804190286";

/** A slug as squad.mjs accepted it, lowercased; null when it can't be one. */
export function cleanSlug(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").toLowerCase();
  return SLUG_RE.test(s) && s.length <= 48 ? s : null;
}

/** An organiser's invite code, lowercased; null when it isn't one. */
export function cleanInvite(raw: string | string[] | null | undefined): string | null {
  const s = String(Array.isArray(raw) ? raw[0] : raw ?? "").toLowerCase();
  return CODE_RE.test(s) ? s : null;
}

/** A run ref that decodes to a uuid; null otherwise. */
export function cleanRunRef(raw: string | string[] | null | undefined): string | null {
  const s = String(Array.isArray(raw) ? raw[0] : raw ?? "");
  return decodeRef(s) ? s : null;
}

/** 22-character ref → uuid, or null. Same as decodeRef in squad.mjs. */
export function decodeRef(ref: string): string | null {
  if (!REF_RE.test(ref)) return null;
  let bin: string;
  try {
    bin = atob(ref.replace(/-/g, "+").replace(/_/g, "/") + "==");
  } catch {
    return null;
  }
  if (bin.length !== 16) return null;
  let hex = "";
  for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** "?invite=…&run=…", in that order, as the app's runLink builds it. */
export function squadQuery(invite: string | null, runRef: string | null): string {
  const q = [invite ? `invite=${invite}` : null, runRef ? `run=${runRef}` : null].filter(Boolean).join("&");
  return q ? `?${q}` : "";
}

/** ISO week key ("2026-W46") of today in India, for get_club_page's week_km. */
export function weekKey(d = new Date()): string {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const [y, m, day] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  const wk = Math.ceil(((t.getTime() - y0) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

/** "?v=<8 chars>" from a storage path, the same hash squad.mjs used, so a new
 *  upload is a new picture URL and an old one stays cached. */
export async function version(path: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(path)));
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return "?v=" + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 8);
}

// ─── Rows ────────────────────────────────────────────────────────────────────

export type Policy = "open" | "request" | "invite";

/** get_club_page's run, as the RPC returns it. Holds a uuid: never pass it to a client component as is. */
export type RawRun = {
  id: string; title: string; event_at: string; meeting_point: string | null; distance_km: number | string | null;
  pace_label: string | null; repeat_weekly: boolean; women_only: boolean; meeting_lat: number | null; meeting_lng: number | null;
  google_place_id: string | null; leader_name: string | null; leader_title: string | null; going_count: number | string; going_by_me: boolean;
};
/** get_club_page's result. Holds uuids and storage paths: server and in-memory only. */
export type RawClub = {
  id: string; name: string; slug: string; description: string | null; location: string | null; instagram: string | null;
  avatar_path: string | null; cover_path: string | null; home_address: string | null; home_lat: number | null; home_lng: number | null;
  home_google_place_id: string | null; verified: boolean; member_count: number | string; join_policy: Policy; is_member: boolean;
  women_only: boolean; rules: string[] | null; join_questions: string[] | null; banned: boolean; requested: boolean; created_at: string;
  organiser_name: string | null; runs: RawRun[] | null; follow_count: number | string | null;
  people: { id: string; name: string | null; i_follow: boolean; is_owner: boolean }[] | null;
};

/** A run as the page holds it: a ref, never the id. */
export type SquadRun = {
  ref: string; title: string; startsAt: string; meetingPoint: string | null; lat: number | null; lng: number | null; placeId: string | null;
  distanceKm: number | null; paceLabel: string | null; repeatWeekly: boolean; womenOnly: boolean; leaderName: string | null;
  leaderTitle: string | null; goingCount: number; goingByMe: boolean;
};
/** A squad as the page holds it: slug, picture URLs through the proxies, no ids or paths. */
export type Squad = {
  slug: string; name: string; description: string | null; location: string | null; instagram: string | null; verified: boolean;
  memberCount: number; joinPolicy: Policy; womenOnly: boolean; rules: string[]; joinQuestions: string[];
  homeAddress: string | null; homeLat: number | null; homeLng: number | null; homePlaceId: string | null;
  photo: string | null; cover: string | null; organiserName: string | null; createdAt: string | null; runs: SquadRun[];
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const numOrNull = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
const placeId = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]+$/.test(v) ? v : null);

export function toRun(r: RawRun): SquadRun {
  const lat = numOrNull(r.meeting_lat), lng = numOrNull(r.meeting_lng);
  const pinned = lat != null && lng != null;
  return {
    ref: encodeRef(r.id) ?? "", title: r.title, startsAt: r.event_at, meetingPoint: r.meeting_point ?? null,
    lat: pinned ? lat : null, lng: pinned ? lng : null, placeId: pinned ? placeId(r.google_place_id) : null,
    distanceKm: numOrNull(r.distance_km), paceLabel: r.pace_label ?? null, repeatWeekly: !!r.repeat_weekly, womenOnly: !!r.women_only,
    leaderName: r.leader_name ?? null, leaderTitle: r.leader_title ?? null, goingCount: num(r.going_count), goingByMe: !!r.going_by_me,
  };
}

export function toSquad(c: RawClub, pics: { photo: string | null; cover: string | null }): Squad {
  const lat = numOrNull(c.home_lat), lng = numOrNull(c.home_lng);
  const pinned = lat != null && lng != null;
  return {
    slug: c.slug, name: c.name, description: c.description?.trim() || null, location: c.location?.trim() || null,
    instagram: c.instagram && /^[a-z0-9._]{1,30}$/.test(c.instagram) ? c.instagram : null, verified: !!c.verified,
    memberCount: num(c.member_count), joinPolicy: c.join_policy === "request" || c.join_policy === "invite" ? c.join_policy : "open",
    womenOnly: !!c.women_only, rules: strings(c.rules), joinQuestions: strings(c.join_questions),
    homeAddress: c.home_address?.trim() || null, homeLat: pinned ? lat : null, homeLng: pinned ? lng : null,
    homePlaceId: pinned ? placeId(c.home_google_place_id) : null, photo: pics.photo, cover: pics.cover,
    organiserName: c.organiser_name ?? null, createdAt: c.created_at ?? null,
    runs: (c.runs ?? []).map(toRun).filter(r => r.ref),
  };
}

/** The proxied picture URLs of a public squad, versioned by path. */
export async function proxiedPictures(c: Pick<RawClub, "slug" | "avatar_path" | "cover_path">) {
  return {
    photo: c.avatar_path ? `/s/${c.slug}/photo${await version(c.avatar_path)}` : null,
    cover: c.cover_path ? `/s/${c.slug}/cover${await version(c.cover_path)}` : null,
  };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** get_club_page by slug, as whoever `sb` is. Null for a hidden squad, nothing, or a failure. */
export async function fetchClub(sb: SupabaseClient, slug: string): Promise<RawClub | null> {
  const { data, error } = await sb.rpc("get_club_page", { p_circle_id: null, p_slug: slug, p_week_key: weekKey(), p_lat: null, p_lng: null });
  if (error || !data || typeof data !== "object") return null;
  return data as RawClub;
}

/** list_squad_events' row (20261210120000). */
export type SquadEventRow = {
  id: string; title: string; kind: string; starts_at: string; ends_at: string; timezone: string | null; place_name: string | null;
  cover_path: string | null; status: string; visibility: string; is_paid: boolean; min_price_minor: number | null; sold_out: boolean;
  going_count: number; going_by_me: boolean;
};
export async function fetchSquadEvents(sb: SupabaseClient, circleId: string): Promise<SquadEventRow[]> {
  const { data, error } = await sb.rpc("list_squad_events", { p_circle_id: circleId, p_include_past: false });
  return error || !Array.isArray(data) ? [] : (data as SquadEventRow[]);
}

/** list_squad_events rows → EventCard props (poster through /e/<ref>/poster, link /e/<ref>). */
export function squadEventCards(rows: SquadEventRow[], squadName: string) {
  return rows.map(e => eventCard({
    id: e.id, title: e.title, kind: e.kind, starts_at: e.starts_at, ends_at: e.ends_at, timezone: e.timezone,
    place_name: e.place_name, cover_path: e.cover_path, host: { name: squadName }, is_paid: e.is_paid,
    min_price_minor: e.min_price_minor, sold_out: e.sold_out, going_count: e.going_count, women_only: false,
    spots_left: null, city_id: null,
  } satisfies EventRow));
}
export type SquadEventCard = ReturnType<typeof squadEventCards>[number];

/** A club-avatars object's bytes through a short-lived signed URL (the anon
 *  key may sign a public squad's pictures). Null when it can't be read. */
export async function pictureBytes(path: string | null): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  if (!path) return null;
  const { data } = await anonClient().storage.from("club-avatars").createSignedUrl(path, 120);
  if (!data?.signedUrl) return null;
  const img = await fetch(data.signedUrl, { cache: "no-store" });
  if (!img.ok) return null;
  return { bytes: await img.arrayBuffer(), type: img.headers.get("content-type") || "image/jpeg" };
}

/** squad.mjs's notFound(): a short text 404 the edge keeps for a minute. */
export function notFoundText(body: string): Response {
  return new Response(body, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=60" } });
}

/** /s/<slug>/photo and /cover: the squad's tile or cover, proxied as anon, so
 *  the storage path (which starts with the squad's uuid) never leaves the server. */
export async function pictureResponse(rawSlug: string, column: "avatar_path" | "cover_path"): Promise<Response> {
  const slug = cleanSlug(rawSlug);
  if (!slug) return notFoundText("No photo");
  const club = await fetchClub(anonClient(), slug).catch(() => null);
  const file = await pictureBytes(club?.[column] ?? null).catch(() => null);
  if (!file) return notFoundText("No photo");
  return new Response(file.bytes, {
    status: 200,
    headers: { "Content-Type": file.type, "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}

// ─── Words ───────────────────────────────────────────────────────────────────

export const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** "AR" for a squad tile or the card when there's no picture. */
export function initialsOf(name: string): string {
  const words = String(name).split(/\s+/).filter(w => /^[A-Za-z0-9]/.test(w));
  const raw = words.length > 1 ? words.map(w => w[0]).join("") : String(name).replace(/[^A-Za-z0-9]/g, "");
  return raw.slice(0, 2).toUpperCase() || "P";
}

/** pacr://s/<slug>?… for the app, or Android's intent:// that falls back to the Play Store. */
export function appLink(slug: string, query: string, android: boolean): string {
  const path = `s/${slug}${query}`;
  if (!android) return `pacr://${path}`;
  return `intent://${path}#Intent;scheme=pacr;package=${ANDROID_PACKAGE};S.browser_fallback_url=`
    + encodeURIComponent(`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`) + ";end";
}
