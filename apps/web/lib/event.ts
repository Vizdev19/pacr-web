// /e/<ref>: a shared event, on get_event (migration 20261130120000 and its
// wrappers through 20261210120000 in the app repo).
//
// The server reads it as anon: published public and link events answer,
// squad-only, draft and unknown ones come back null and all render the same
// "open it in pacr" state. A signed-in runner's browser reads it again with
// their own session for the booked state and the ticket types' ids, which
// only ever live in that browser's memory.
//
// The bottom half is the plumbing the three share pages (/e, /p, /u) have in
// common: ref decoding, the anon client, the picture proxy and the deep links.
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { PLAY_STORE_URL, SUPABASE_KEY, SUPABASE_URL } from "./config";
import { dayLine, inr, istParts, whenLine, zoneNote } from "./format";

// ─── get_event, as the RPC returns it ─────────────────────────────────────────

export type EventTierRaw = {
  id: string; name: string; price_minor: number; fee_minor: number; capacity: number | null;
  taken: number; sold_out: boolean; sales_close_at: string | null;
  /** pacr 20270124120000 (absent before it: every type is on sale). */
  sale_state?: string | null; sales_open_at?: string | null; opens_after_name?: string | null;
};
export type EventRaw = {
  id: string; kind: string; title: string; description: string | null; cover_path: string | null;
  course_map_path: string | null; starts_at: string; ends_at: string; timezone: string | null;
  /** Where the results are, set by the host once the event has started (pacr 20270123120000; absent before it). */
  results_url?: string | null;
  /** What the host asks for each ticket at booking (pacr 20270125120000; absent before it). */
  questions?: { required?: boolean }[] | null;
  place: { name: string | null; address: string | null; lat: number | null; lng: number | null; google_place_id: string | null } | null;
  meet_note: string | null; visibility: string; status: string; women_only: boolean; refund_note: string | null;
  is_paid: boolean; cancelled_at: string | null; cancel_reason: string | null;
  host: { kind?: string; id?: string; name?: string; slug?: string; verified?: boolean; is_public?: boolean } | null;
  tiers: EventTierRaw[] | null; going_count: number; distances_km: number[] | null; terrain: string | null;
  surface: string | null; schedule: { time?: string; label?: string; note?: string }[] | null;
  course_facts: { label?: string; value?: string }[] | null; faq: { q?: string; a?: string }[] | null;
  included: string[] | null; tags: string[] | null; min_age: number | null; gender: string | null;
  max_per_order: number | null;
  my_ticket: { order_status?: string; ticket_status?: string | null; tier_name?: string; qty?: number; checked_in_count?: number } | null;
  my_payment: { order_status?: string; hold_expires_at?: string | null } | null;
};

// ─── What the page draws: the same event with every id taken out ─────────────

export type TierView = {
  name: string; priceMinor: number; capacity: number | null; taken: number; soldOut: boolean; salesCloseAt: string | null;
  /** on_sale, or why not yet: on sale later (salesOpenAt), waiting for another type to sell out (opensAfterName), or closed. */
  saleState: "on_sale" | "not_open" | "waiting" | "closed";
  salesOpenAt: string | null; opensAfterName: string | null;
};
export type EventView = {
  ref: string; title: string; kind: string; typeLabel: string; description: string | null;
  poster: string | null; courseMap: string | null; startsAt: string; endsAt: string;
  /** The event's own time zone: its times are shown by that clock. */
  timezone: string | null;
  /** The host's results link: an https address, or null. */
  resultsUrl: string | null;
  /** How many details the host asks for each ticket. They are answered in the app. */
  questionCount: number;
  place: { name: string | null; address: string | null; lat: number | null; lng: number | null; placeId: string | null };
  meetNote: string | null; status: string; cancelled: boolean; cancelReason: string | null; womenOnly: boolean;
  refundNote: string | null; isPaid: boolean;
  host: { name: string; href: string | null; verified: boolean } | null;
  tiers: TierView[]; goingCount: number; distances: string | null; terrain: string | null;
  schedule: { time: string; label: string; note: string }[]; courseFacts: { label: string; value: string }[];
  faq: { q: string; a: string }[]; included: string[]; tags: string[]; minAge: number | null;
  gender: "all" | "women" | "men" | "women_nb"; maxPerOrder: number;
};

const num = (v: unknown) => Number(v) || 0;
const numOrNull = (v: unknown) => (v == null || v === "" ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** A storage path's file name without its extension: the old pages' ?v= cache key. */
const version = (path: string) => encodeURIComponent(path.split("/").pop()!.replace(/\.\w+$/, ""));

export function eventView(e: EventRaw, ref: string): EventView {
  const h = e.host;
  const gender = e.gender === "women" || e.gender === "men" || e.gender === "women_nb" ? e.gender : e.women_only ? "women" : "all";
  return {
    ref, title: e.title, kind: e.kind, typeLabel: kindLabel(e.kind), description: e.description?.trim() || null,
    poster: e.cover_path ? `/e/${ref}/poster?v=${version(e.cover_path)}` : null,
    courseMap: e.course_map_path ? `/e/${ref}/course?v=${version(e.course_map_path)}` : null,
    startsAt: e.starts_at, endsAt: e.ends_at, timezone: e.timezone ?? null,
    resultsUrl: typeof e.results_url === "string" && /^https:\/\/\S+$/i.test(e.results_url) ? e.results_url : null,
    questionCount: Array.isArray(e.questions) ? e.questions.length : 0,
    place: {
      name: e.place?.name ?? null, address: e.place?.address ?? null,
      lat: e.place?.lat == null ? null : Number(e.place.lat), lng: e.place?.lng == null ? null : Number(e.place.lng),
      placeId: e.place?.google_place_id ?? null,
    },
    meetNote: e.meet_note?.trim() || null, status: e.status, cancelled: e.status === "cancelled" || !!e.cancelled_at,
    cancelReason: e.cancel_reason?.trim() || null, womenOnly: !!e.women_only, refundNote: e.refund_note?.trim() || null,
    isPaid: !!e.is_paid,
    host: h?.name ? {
      name: h.name,
      // A public squad has a page; an organiser and a private squad don't.
      href: h.kind === "squad" && h.is_public && h.slug ? `/s/${h.slug}` : null,
      verified: !!h.verified,
    } : null,
    tiers: (e.tiers ?? []).map(t => ({
      name: t.name, priceMinor: Math.max(0, num(t.price_minor)), capacity: numOrNull(t.capacity), taken: num(t.taken),
      soldOut: !!t.sold_out, salesCloseAt: t.sales_close_at ?? null,
      saleState: t.sale_state === "not_open" || t.sale_state === "waiting" || t.sale_state === "closed" ? t.sale_state : "on_sale",
      salesOpenAt: t.sales_open_at ?? null, opensAfterName: t.opens_after_name ?? null,
    })),
    goingCount: num(e.going_count),
    distances: (e.distances_km ?? []).map(Number).filter(n => n > 0).map(kmLabel).join(" · ") || null,
    terrain: e.terrain?.trim() || null,
    schedule: (e.schedule ?? []).map(x => ({ time: str(x.time), label: str(x.label), note: str(x.note) })).filter(x => x.time || x.label),
    courseFacts: (e.course_facts ?? []).map(x => ({ label: str(x.label), value: str(x.value) })).filter(x => x.label && x.value),
    faq: (e.faq ?? []).map(x => ({ q: str(x.q), a: str(x.a) })).filter(x => x.q),
    included: (e.included ?? []).filter((x): x is string => typeof x === "string" && !!x.trim()),
    tags: (e.tags ?? []).filter((x): x is string => typeof x === "string" && !!x.trim()),
    minAge: numOrNull(e.min_age), gender, maxPerOrder: Math.max(1, numOrNull(e.max_per_order) ?? 10),
  };
}

// ─── Labels (the app's src/services/events.ts) ───────────────────────────────

const KIND_LABEL: Record<string, string> = { run: "Run", race: "Race", workshop: "Workshop", social: "Social" };
export const kindLabel = (k: string) => KIND_LABEL[k] ?? "Event";

/** 5 → "5K", 21.1 → "Half", 0.8 → "800 m". */
export function kmLabel(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const r = Math.round(km * 10) / 10;
  if (Math.abs(r - 21.1) < 0.05) return "Half";
  if (Math.abs(r - 42.2) < 0.05) return "Marathon";
  return `${Number.isInteger(r) ? r : r.toFixed(1)}K`;
}

/** "₹499" / "₹99.50" / "Free". */
export const money = (minor: number) => (minor > 0 ? inr(minor) : "Free");

/** The bare price, only of tickets still on sale: "Free", "₹499 + fee and GST",
 *  "From ₹499 + fee and GST", "Free, or from ₹499 + fee and GST", "Sold out". */
export function priceLine(tiers: TierView[]): string | null {
  if (!tiers.length) return null;
  // A type that has stopped selling (an early bird past its last day) isn't
  // a price any more, whatever it has left: it would head the page and its
  // link preview with a price nobody can pay.
  const live = tiers.filter(t => t.saleState !== "closed");
  const prices = live.filter(t => !t.soldOut).map(t => t.priceMinor);
  if (!prices.length) return live.length || tiers.every(t => t.soldOut) ? "Sold out" : null;
  const min = Math.min(...prices), max = Math.max(...prices);
  if (max === 0) return "Free";
  const paid = `${inr(Math.min(...prices.filter(p => p > 0)))} + fee and GST`;
  return min === 0 ? `Free, or from ${paid}` : min === max ? paid : `From ${paid}`;
}

/** "Sat, 14 Nov · 6:00 am – 9:00 am", or the end's day too when it runs past midnight. */
export function eventWhen(startsAt: string, endsAt?: string | null, tz?: string | null): string {
  if (!endsAt || !(new Date(endsAt) > new Date(startsAt))) return whenLine(startsAt, tz);
  // By the clock at the event; a zone other than India's is named once, at the end.
  const a = istParts(startsAt, tz), b = istParts(endsAt, tz);
  const s = `${a.dow}, ${a.day} ${a.month} · ${a.time}`;
  return `${s} – ${a.ymd === b.ymd ? b.time : `${dayLine(endsAt, tz)} · ${b.time}`}${zoneNote(startsAt, tz)}`;
}

export const isOver = (e: { status: string; endsAt: string; startsAt: string }, now: number) =>
  e.status === "ended" || new Date(e.endsAt || e.startsAt).getTime() < now;

/** Seats left across the ticket types, when every one of them is capped. */
export function spotsLeft(tiers: TierView[]): number | null {
  if (!tiers.length || tiers.some(t => t.capacity == null)) return null;
  return tiers.reduce((n, t) => n + Math.max(0, (t.capacity ?? 0) - t.taken), 0);
}
export const tierLeft = (t: TierView) => (t.capacity == null ? null : Math.max(0, t.capacity - t.taken));

/** Who the host set the event for, when that's the runner's word rather than their profile's. */
export function whoFor(e: EventView): string[] {
  return [
    e.gender === "men" ? "men" : e.gender === "women_nb" ? "women and non-binary runners" : null,
    e.minAge != null ? `runners aged ${e.minAge} and over` : null,
  ].filter((x): x is string => !!x);
}

// ─── reserve_event_ticket's refusals (the app's eventFailCopy) ───────────────

const FAILS = [
  "not_allowed", "email_required", "not_found", "not_published", "event_cancelled", "event_over", "sales_closed",
  "sold_out", "already_have_ticket", "women_only", "not_member", "paid_not_supported", "too_many_holds",
  "invalid_qty", "not_enough_seats", "sales_paused", "sales_not_open",
] as const;
export type EventFail = (typeof FAILS)[number] | "error";
export const failOf = (message: string | undefined): EventFail => FAILS.find(f => (message ?? "").includes(f)) ?? "error";

export function failCopy(reason: EventFail): { title: string; body: string } {
  switch (reason) {
    case "sold_out": return { title: "Sold out", body: "Every spot has gone. Spots open up when people give theirs back, so check again later." };
    case "not_enough_seats": return { title: "Not enough spots left", body: "Pick fewer tickets. The count on the page is up to date now." };
    case "invalid_qty": return { title: "Too many tickets", body: "That's more than one booking can hold at this event. Pick fewer and try again." };
    case "already_have_ticket": return { title: "You're already in", body: "Your tickets are in Your tickets." };
    case "sales_closed": return { title: "Registration has closed", body: "The host isn't taking new entries any more." };
    case "sales_not_open": return { title: "Not on sale yet", body: "These tickets aren't on sale yet. The page says when they open." };
    case "event_over": return { title: "This event is over", body: "It has already started or finished." };
    case "event_cancelled": return { title: "This event was cancelled", body: "The host cancelled it." };
    case "women_only": return { title: "Women only", body: "This event is for women. Set your gender in your profile in the app if that's you." };
    case "not_member": return { title: "Squad members only", body: "Join the squad to get a ticket." };
    case "email_required": return { title: "Add an email first", body: "Events need an email on your account so the host can reach you. Add one in the app, then try again." };
    case "too_many_holds": return { title: "Let's give it a little while", body: "Spots at this event have been held for you a few times without a payment going through, so we can't hold another just yet. If money did leave your account, don't pay again: the ticket will turn up in Your tickets. Otherwise, try again in a couple of hours." };
    case "sales_paused": return { title: "Ticket sales are paused", body: "pacr has paused ticket sales for a short while. Nothing was charged. Please try again a little later." };
    case "paid_not_supported": return { title: "Buy this ticket in the app", body: "Paid checkout on the web is coming." };
    case "not_found": case "not_published": return { title: "We can't find that event", body: "It may have been removed, or it isn't open to you." };
    case "not_allowed": return { title: "You can't get a ticket here", body: "This event isn't taking tickets from your account." };
    default: return { title: "Something went wrong", body: "Check your connection and try again." };
  }
}

/** A seat's QR: the app's CHECKIN_QR_PREFIX + event_tickets.code (app/event-tickets.tsx). */
export const seatQr = (code: string) => `PACR1:${code}`;

// ─── Server reads ────────────────────────────────────────────────────────────

/**
 * The public read of one event, kept for 15 seconds and shared by everyone
 * who opens its link in that time: a link posted to a big group used to mean
 * one database read per visitor, all asking for the same thing. It is what
 * anyone signed out sees (get_event as anon carries nothing about a runner),
 * so sharing it shows nobody anything of someone else's. A signed-in visitor's
 * own ticket and the seats as they stand are read in the browser, as before.
 *
 * Two things are never kept. A failed read (thrown). And "no such event": a
 * link opened while the event was a draft would otherwise hand "nothing
 * here" to the first visitor after it is published, which is usually the
 * chat app fetching the link's preview.
 *
 * This cache hands back a copy past its 15 seconds while it fetches a new one
 * behind, so on a quiet page the first visitor after a gap would get whatever
 * the last one saw, however old: a cancelled event, an old price. A copy
 * older than a minute is not used; that visitor is read for directly.
 */
const NONE = "event_none";
const TOO_OLD_MS = 60_000;
const readPublic = async (id: string): Promise<EventRaw | null> => {
  const { data, error } = await anon().rpc("get_event", { p_event_id: id });
  if (error) throw new Error("event_read_failed");
  return (data as EventRaw | null) ?? null;
};
const publicEvent = unstable_cache(
  async (id: string): Promise<{ at: number; event: EventRaw }> => {
    const event = await readPublic(id);
    if (!event) throw new Error(NONE);
    return { at: Date.now(), event };
  },
  ["event-public-v2"],
  { revalidate: 15 },
);

/** get_event as anon, once per request (the page and its metadata share it), from the shared copy when it is fresh. */
export const loadEvent = cache(async (ref: string): Promise<{ ok: true; event: EventRaw | null } | { ok: false }> => {
  const id = decodeRef(ref);
  if (!id) return { ok: true, event: null };
  try {
    const kept = await publicEvent(id);
    if (Date.now() - kept.at <= TOO_OLD_MS) return { ok: true, event: kept.event };
    return { ok: true, event: await readPublic(id) };
  } catch (e) {
    if (e instanceof Error && e.message === NONE) return { ok: true, event: null };
    return { ok: false };
  }
});

// ─── Share-page plumbing (also used by lib/post.ts and lib/profilecard.ts) ───

export const SITE = "https://pacr.life";
export const APP_STORE_ID = "6804190286";
const REF_RE = /^[A-Za-z0-9_-]{22}$/;

/** A 22-character ref → its uuid, or null. The inverse of encodeRef (lib/refs.ts). Server only. */
export function decodeRef(ref: string): string | null {
  if (!REF_RE.test(ref)) return null;
  const hex = Buffer.from(ref, "base64url").toString("hex");
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function anon() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The app opens pacr://<path>; Android needs an intent:// that falls back to the Play Store. */
export function openInAppHref(path: string, ua: string): string {
  if (/Android/i.test(ua)) return `intent://${path}#Intent;scheme=pacr;package=life.pacr.app;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
  if (/iPhone|iPad|iPod/i.test(ua)) return `pacr://${path}`;
  return "/download";
}

// A runner who picked one of the app's avatars has "preset:<key>" as their
// avatar_path: the art in /assets/avatars, never a Storage object (js/avatars.js).
const AVATAR_KEYS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
export function presetArt(path: string | null | undefined): string | null {
  const key = typeof path === "string" && path.startsWith("preset:") ? path.slice(7) : null;
  return key && AVATAR_KEYS.includes(key) ? `/assets/avatars/pacr_avatar_${key}.png` : null;
}

const notFoundText = (body: string) => new Response(body, {
  status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=60" },
});

/** 302 to a preset avatar's art, cached like the old pages. */
export const redirectTo = (location: string) => new Response(null, {
  status: 302, headers: { Location: location, "Cache-Control": "public, s-maxage=600" },
});

/** A private picture, signed as anon for two minutes and passed through, so
 *  its storage path (which starts with a uuid) never reaches the page. */
export async function proxyImage(bucket: string, path: string | null | undefined, missing = "No photo"): Promise<Response> {
  if (!path) return notFoundText(missing);
  const { data } = await anon().storage.from(bucket).createSignedUrl(path, 120);
  if (!data?.signedUrl) return notFoundText(missing);
  const img = await fetch(data.signedUrl, { cache: "no-store" });
  if (!img.ok) return notFoundText(missing);
  return new Response(await img.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": img.headers.get("content-type") || "image/jpeg",
      // Short: a picture made private or removed should stop serving soon.
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
export { notFoundText };
