// An event's times are times at the event: the editor's date and time fields
// are read in the event's own time zone, not the browser's, so a host fixing
// an event from another country never moves it. (The pacr app draws event
// times the same way: src/utils/eventTime.ts.)
//
// A "wall" time is what a clock at the event shows: a date and a time of day.
// Pure arithmetic on Intl's answer for the zone's offset at that moment.

export const DEFAULT_ZONE = "Asia/Kolkata";

/** A clock reading at the event: `date` is YYYY-MM-DD, `time` is HH:MM (24 h). Either may be "" while typing. */
export type Wall = { date: string; time: string };

const formatters = new Map<string, Intl.DateTimeFormat | null>();

/** Minutes east of UTC in `zone` at `at`; null when the browser doesn't know the zone. */
export function zoneOffsetMin(at: Date, zone: string): number | null {
  let f = formatters.get(zone);
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat("en-US", {
        timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch {
      f = null;
    }
    formatters.set(zone, f);
  }
  if (!f) return null;
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(at)) p[x.type] = Number(x.value);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  const off = Math.round((wall - Math.floor(at.getTime() / 1000) * 1000) / 60000);
  return Number.isFinite(off) && Math.abs(off) <= 16 * 60 ? off : null;
}

/** Whether the browser can work in this zone. */
export const zoneKnown = (zone: string) => zoneOffsetMin(new Date(), zone) !== null;

/** India's zone goes by two names (browsers still say "Asia/Calcutta"): one of them here. */
const canon = (zone: string) => (zone === "Asia/Calcutta" ? DEFAULT_ZONE : zone);

/** The browser's own zone, or India's when it won't say. */
export function browserZone(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return z && zoneKnown(z) ? canon(z) : DEFAULT_ZONE;
  } catch {
    return DEFAULT_ZONE;
  }
}

const two = (n: number) => String(n).padStart(2, "0");

/** The moment as a clock in `zone` reads it. */
export function wallOf(at: Date | string, zone: string): Wall {
  const d = typeof at === "string" ? new Date(at) : at;
  const off = zoneOffsetMin(d, zone) ?? zoneOffsetMin(d, DEFAULT_ZONE) ?? 330;
  const s = new Date(d.getTime() + off * 60000);
  return {
    // Four digits always: a year typed one key at a time passes through 0002, 0020 and 0202.
    date: `${String(s.getUTCFullYear()).padStart(4, "0")}-${two(s.getUTCMonth() + 1)}-${two(s.getUTCDate())}`,
    time: `${two(s.getUTCHours())}:${two(s.getUTCMinutes())}`,
  };
}

/** The moment a clock in `zone` shows this date and time; null while either is missing or unreadable. */
export function instantOf(w: Wall | null | undefined, zone: string): Date | null {
  if (!w) return null;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w.date);
  const t = /^(\d{2}):(\d{2})/.exec(w.time);
  if (!d || !t) return null;
  const asUtc = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  if (!Number.isFinite(asUtc)) return null;
  // The offset depends on the moment, and the moment on the offset: two passes
  // settle it everywhere but inside a clock change, where the later reading wins.
  let off = zoneOffsetMin(new Date(asUtc), zone) ?? 330;
  off = zoneOffsetMin(new Date(asUtc - off * 60000), zone) ?? off;
  return new Date(asUtc - off * 60000);
}

/** A date a host could mean for an event (not one half-typed into a date field, like year 0202). */
export const plausibleWall = (w: Wall | null | undefined) => !!w && /^\d{4}-\d{2}-\d{2}$/.test(w.date) && w.date >= "2000-01-01" && /^\d{2}:\d{2}/.test(w.time);

/** "GMT+5:30", "GMT", "GMT-3". */
export function offsetName(offsetMin: number): string {
  if (offsetMin === 0) return "GMT";
  const a = Math.abs(offsetMin);
  const m = a % 60;
  return `GMT${offsetMin < 0 ? "-" : "+"}${Math.floor(a / 60)}${m ? `:${two(m)}` : ""}`;
}

/** "India (IST, GMT+5:30)" / "Dubai (GMT+4)": a zone as a host reads it. */
export function zoneLabel(zone: string, at: Date = new Date()): string {
  const off = zoneOffsetMin(at, zone);
  const gmt = off == null ? "" : offsetName(off);
  if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") return `India (IST, ${gmt})`;
  const city = zone.split("/").pop()!.replace(/_/g, " ");
  return gmt ? `${city} (${gmt})` : city;
}

/** "IST" for India, else "GMT+4": the short name beside a time. */
export function zoneShort(zone: string, at: Date = new Date()): string {
  if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") return "IST";
  const off = zoneOffsetMin(at, zone);
  return off == null ? "" : offsetName(off);
}

const COMMON = [
  "Asia/Kolkata", "Asia/Colombo", "Asia/Kathmandu", "Asia/Dhaka", "Asia/Dubai", "Asia/Singapore", "Asia/Bangkok",
  "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Australia/Sydney",
];

/** The zones the editor offers: the event's own and the browser's first, then the usual ones. */
export function zoneChoices(...first: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const z of [...first, ...COMMON]) if (z && !out.some(o => canon(o) === canon(z)) && zoneKnown(z)) out.push(z);
  return out;
}

/** "Sat 14 Nov 2026, 6:00 am" as a clock in `zone` reads it. */
export function wallText(at: Date | string, zone: string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return "";
  const z = zoneKnown(zone) ? zone : DEFAULT_ZONE;
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-IN", {
    timeZone: z, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(d)) p[x.type] = x.value;
  return `${p.weekday} ${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} ${(p.dayPeriod ?? "").toLowerCase()}`;
}
