import type { ReportBucket } from "@/lib/api";

// Report periods in IST calendar days (pacr's time zone; lib/format shows
// everything in IST). Dates are "YYYY-MM-DD"; `to` is the day after the last.

export type PeriodKind = "week" | "month" | "year";
export type Period = {
  kind: PeriodKind;
  /** First day and the day after the last. */
  from: string; to: string;
  /** In the picker and on the sheet: "9–15 Nov 2026", "November 2026", "2026". */
  label: string;
  bucket: ReportBucket;
  /** The period isn't over yet: numbers so far, compared with the same days of the one before. */
  current: boolean;
  /** The same stretch of the period before, for comparisons. */
  prev: { from: string; to: string; label: string };
};

const DAY = 86400000;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const parseDay = (s: string) => { const [y, m, d] = s.split("-").map(Number); return utc(y, m - 1, d); };
const mon = (d: Date, long = false) => d.toLocaleString("en-IN", { month: long ? "long" : "short", timeZone: "UTC" });

/** Today in IST, as a UTC-midnight date. */
export function istToday(now = new Date()): Date {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)) p[x.type] = x.value;
  return utc(Number(p.year), Number(p.month) - 1, Number(p.day));
}
/** IST midnight of a day, as a timestamp: for filtering events by starts_at. */
export const istStart = (day: string) => Date.parse(`${day}T00:00:00+05:30`);

/** "9–15 Nov 2026", "28 Sep – 4 Oct 2026". */
function span(a: Date, lastDay: Date): string {
  const y = lastDay.getUTCFullYear();
  if (a.getUTCMonth() === lastDay.getUTCMonth()) return `${a.getUTCDate()}–${lastDay.getUTCDate()} ${mon(a)} ${y}`;
  return `${a.getUTCDate()} ${mon(a)} – ${lastDay.getUTCDate()} ${mon(lastDay)} ${y}`;
}

function make(kind: PeriodKind, from: Date, to: Date, prevFrom: Date, today: Date): Period {
  const current = to.getTime() > today.getTime();
  // In a period that's still running, compare with the same number of days of the one before.
  const elapsed = Math.round((addDays(today, 1).getTime() - from.getTime()) / DAY);
  const prevLen = Math.round((from.getTime() - prevFrom.getTime()) / DAY);
  const prevTo = current ? addDays(prevFrom, Math.min(elapsed, prevLen)) : from;
  const label = kind === "week" ? span(from, addDays(to, -1)) : kind === "month" ? `${mon(from, true)} ${from.getUTCFullYear()}` : String(from.getUTCFullYear());
  const prevLabel = kind === "week" ? "last week" : kind === "month" ? `${mon(prevFrom)} ${prevFrom.getUTCFullYear()}` : String(prevFrom.getUTCFullYear());
  return {
    kind, from: iso(from), to: iso(to), label, current,
    bucket: kind === "week" ? "day" : kind === "month" ? "week" : "month",
    prev: { from: iso(prevFrom), to: iso(prevTo), label: current ? `the same days of ${prevLabel}` : prevLabel },
  };
}

/** The periods a host can pick, newest first: 12 weeks (Monday to Sunday), 12 months, 3 years. */
export function periods(kind: PeriodKind, now = new Date()): Period[] {
  const t = istToday(now);
  if (kind === "week") {
    const monday = addDays(t, -((t.getUTCDay() || 7) - 1));
    return Array.from({ length: 12 }, (_, i) => {
      const from = addDays(monday, -7 * i);
      return make("week", from, addDays(from, 7), addDays(from, -7), t);
    });
  }
  if (kind === "month") {
    return Array.from({ length: 12 }, (_, i) => {
      const from = utc(t.getUTCFullYear(), t.getUTCMonth() - i, 1);
      return make("month", from, utc(from.getUTCFullYear(), from.getUTCMonth() + 1, 1), utc(from.getUTCFullYear(), from.getUTCMonth() - 1, 1), t);
    });
  }
  return Array.from({ length: 3 }, (_, i) => {
    const y = t.getUTCFullYear() - i;
    return make("year", utc(y, 0, 1), utc(y + 1, 0, 1), utc(y - 1, 0, 1), t);
  });
}

/** Chart labels for a period's buckets: "Mon", "1–7", "Jan". */
export function bucketLabel(p: Period, start: string): string {
  const d = parseDay(start);
  if (p.bucket === "day") return d.toLocaleString("en-IN", { weekday: "short", timeZone: "UTC" });
  if (p.bucket === "month") return mon(d);
  const last = addDays(d, 6).getTime() < parseDay(p.to).getTime() ? addDays(d, 6) : addDays(parseDay(p.to), -1);
  return `${d.getUTCDate()}–${last.getUTCDate()}`;
}
/** What one bucket is called in a sentence. */
export const bucketNoun = (p: Period) => (p.bucket === "day" ? "day" : p.bucket === "week" ? "week" : "month");
