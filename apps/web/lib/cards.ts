// Database rows → the design system's card props. Pictures go through the
// site's proxies (/s/<slug>/photo, /s/<slug>/cover, /e/<ref>/poster), whose
// URLs carry slugs and refs, never storage paths.
import type { RunCardProps, SquadCardProps } from "@/components/ds/content";
import { encodeRef } from "./refs";
import { dayLine, inr, istParts, istToday, km, pace, whenLine } from "./format";
import type { DirectoryRow, EventRow, RunRow } from "./types";

export const squadPhoto = (slug: string, has: boolean) => (has ? `/s/${slug}/photo` : null);
export const squadCover = (slug: string, has: boolean) => (has ? `/s/${slug}/cover` : null);
export const runHref = (slug: string, ref: string) => `/s/${slug}?run=${ref}`;

const POLICY = { open: "open", request: "ask", invite: "invite" } as const;

export function squadCard(r: DirectoryRow, cityName?: string): SquadCardProps {
  const next = r.next_runs?.[0];
  return {
    name: r.name, href: `/s/${r.slug}`, photo: squadPhoto(r.slug, r.has_photo), cover: squadCover(r.slug, r.has_cover),
    verified: r.verified, area: r.location, city: r.location && cityName && !r.location.includes(cityName) ? cityName : null,
    members: r.member_count, nextRun: next ? whenLine(next.starts_at) : null, womenOnly: r.women_only,
    policy: POLICY[r.join_policy] ?? null,
  };
}

export function runCard(r: RunRow): RunCardProps {
  const p = istParts(r.starts_at);
  return {
    title: r.title, squad: r.squad_name, squadVerified: r.squad_verified, dow: p.dow, day: p.day, month: p.month, time: p.time,
    today: p.ymd === istToday(), place: r.meeting_point, distance: km(r.distance_km), pace: pace(r.pace_label),
    leader: r.leader_name, goingCount: r.going_count, womenOnly: r.women_only,
    repeats: r.repeat_weekly ? `Every ${fullDay(r.starts_at)}` : null,
    href: r.projected ? `/s/${r.squad_slug}` : runHref(r.squad_slug, r.run_ref), showCta: false,
    note: r.projected ? "RSVPs open after this week's run" : undefined,
  };
}

function fullDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "long" }).format(new Date(iso));
}

/** "₹499 + fee and GST", "From ₹499 + fee and GST" or "Free", as the event page and the app show it. */
export function priceLine(e: EventRow): string {
  if (!e.is_paid || !e.min_price_minor) return "Free";
  return `From ${inr(e.min_price_minor)} + fee and GST`;
}

export function eventCard(e: EventRow) {
  const ref = encodeRef(e.id) ?? "";
  const kind = e.kind ? e.kind.charAt(0).toUpperCase() + e.kind.slice(1) : "Event";
  const status = e.sold_out ? "sold-out" as const : e.spots_left != null && e.spots_left > 0 && e.spots_left <= 10 ? "few-left" as const : null;
  return {
    title: e.title, type: kind, date: whenLine(e.starts_at), venue: e.place_name, price: priceLine(e), status,
    poster: e.cover_path ? `/e/${ref}/poster` : null, host: e.host?.name ?? null, href: `/e/${ref}`,
  };
}

export { dayLine };
