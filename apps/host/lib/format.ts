// Formats from the design system's voice rules (readme: CONTENT FUNDAMENTALS):
// Indian grouping `₹2,41,300`, paise only where money is exact, `Sat 14 Nov`,
// `6:00 am`, `6:00 /km`, `412 / 450`, a middle dot between metadata. Times
// are shown in IST, where pacr runs.

const TZ = "Asia/Kolkata";

function parts(d: Date, o: Intl.DateTimeFormatOptions) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...o }).formatToParts(d)) out[p.type] = p.value;
  return out;
}
const yearOf = (d: Date) => parts(d, { year: "numeric" }).year;
const withYear = (d: Date, now: Date) => (yearOf(d) !== yearOf(now) ? ` ${yearOf(d)}` : "");

/** "DR" for "Dawn Riders": the app's Avatar fallback. */
export function initials(name: string | null | undefined): string {
  const p = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/** "Arjun" from "Arjun Rao". */
export const firstName = (name: string | null | undefined) => String(name ?? "").trim().split(/\s+/)[0] || "there";

/** 1240 → "1,240"; 241300 → "2,41,300". */
export const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-IN");
/** One decimal at most: distances. */
export const km = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });
/** "₹2,41,300" from rupees. */
export const inr = (rupees: number) => `₹${Math.round(rupees).toLocaleString("en-IN")}`;
/** "₹2,171.70" from rupees: exact money. */
export const inr2 = (rupees: number) =>
  `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** From paise: "₹499", or "₹528.44" when there are paise. */
export const paise = (p: number) => (p % 100 === 0 ? inr(p / 100) : inr2(p / 100));
export const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

/** "Sat 14 Nov" (the year added outside this year). */
export function day(iso: string | Date, now = new Date()): string {
  const d = new Date(iso);
  const p = parts(d, { weekday: "short", day: "numeric", month: "short" });
  return `${p.weekday} ${p.day} ${p.month}${withYear(d, now)}`;
}
/** "6:00 am". */
export function time(iso: string | Date): string {
  const p = parts(new Date(iso), { hour: "numeric", minute: "2-digit", hour12: true });
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? "").toLowerCase()}`;
}
/** "Sat 14 Nov, 6:00 am". */
export const dayTime = (iso: string | Date, now = new Date()) => `${day(iso, now)}, ${time(iso)}`;
/** "Mar 2024": joined dates. */
export function monthYear(iso: string | Date): string {
  const p = parts(new Date(iso), { month: "short", year: "numeric" });
  return `${p.month} ${p.year}`;
}
/** The pieces a DateTile shows: { day: "Sat", date: 14, month: "Nov" }. */
export function tile(iso: string | Date): { day: string; date: number; month: string } {
  const p = parts(new Date(iso), { weekday: "short", day: "numeric", month: "short" });
  return { day: p.weekday, date: Number(p.day), month: p.month };
}
/** YYYY-MM-DD of a moment in IST: grouping by day. */
export function ymd(iso: string | Date): string {
  const p = parts(new Date(iso), { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

/** "12 min ago", "3 h ago", "yesterday", "26 days ago", then the date. */
export function ago(iso: string | Date, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "yesterday";
  if (d < 35) return `${d} days ago`;
  if (d < 70) return `${Math.floor(d / 7)} weeks ago`;
  return day(iso, new Date(now));
}

/** "in 17 hours", "tomorrow", "in 3 days". */
export function until(iso: string | Date, now = Date.now()): string {
  const s = (new Date(iso).getTime() - now) / 1000;
  if (s <= 0) return "now";
  if (s < 3600) return `in ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `in ${Math.round(s / 3600)} hours`;
  const d = Math.round(s / 86400);
  return d === 1 ? "tomorrow" : `in ${d} days`;
}

// The four squad roles in public.role_rank: owner 3, organiser 2, run_leader 1,
// member 0. Hosting starts at run leader.
const ROLE_LABELS: Record<string, string> = {
  owner: "Squad owner",
  organiser: "Organiser",
  run_leader: "Run leader",
  member: "Member",
};
/** A membership role as people read it: "run_leader" → "Run leader". */
export const roleLabel = (role: string | null | undefined) => ROLE_LABELS[String(role ?? "")] ?? "";
