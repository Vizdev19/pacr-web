import type { HostedEvent, SquadRun } from "@/lib/api";
import { ymd } from "@/lib/format";

// Calendar days are plain "YYYY-MM-DD" strings (the IST day, as lib/format
// groups them); arithmetic goes through UTC so it never shifts.

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const ms = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const str = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => str(ms(s) + n * DAY);
export const addMonths = (s: string, n: number) => {
  const d = new Date(ms(s));
  return str(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
};
export const monthStart = (s: string) => `${s.slice(0, 7)}-01`;
/** 0 = Monday … 6 = Sunday. */
export const dowMon = (s: string) => (new Date(ms(s)).getUTCDay() + 6) % 7;
export const weekStartOf = (s: string) => addDays(s, -dowMon(s));
export const dayNum = (s: string) => Number(s.slice(8, 10));
export const monthLabel = (s: string) => `${MONTHS_LONG[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
export const weekLabel = (start: string) => {
  const end = addDays(start, 6);
  const a = `${dayNum(start)}${start.slice(5, 7) === end.slice(5, 7) ? "" : ` ${MONTHS[Number(start.slice(5, 7)) - 1]}`}`;
  return `${a} – ${dayNum(end)} ${MONTHS[Number(end.slice(5, 7)) - 1]} ${end.slice(0, 4)}`;
};
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Hour and minute in IST. */
export function hm(iso: string): { h: number; m: number } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (t: string) => Number(p.find(x => x.type === t)?.value ?? 0);
  return { h: get("hour"), m: get("minute") };
}

export type CalItem = {
  key: string;
  kind: "run" | "event";
  /** The moment, ISO. */
  at: string;
  /** The IST day. */
  day: string;
  title: string;
  run: SquadRun | null;
  event: HostedEvent | null;
  /** A later week of a weekly run: not a row of its own yet. */
  projected: boolean;
  repeating: boolean;
};

/**
 * Runs and events on the days from `from` to `to` (inclusive). A weekly run is
 * one row with its next date, so it is repeated onto the same weekday and time
 * of each later week; past dates aren't kept by the backend and aren't invented.
 */
export function itemsBetween(runs: SquadRun[], events: HostedEvent[], from: string, to: string): CalItem[] {
  const out: CalItem[] = [];
  for (const r of runs) {
    const base = new Date(r.event_at).getTime();
    for (let k = 0; k < 400; k++) {
      const at = new Date(base + k * 7 * DAY).toISOString();
      const day = ymd(at);
      if (day > to) break;
      if (day >= from) out.push({ key: `${r.id}:${k}`, kind: "run", at, day, title: r.title, run: r, event: null, projected: k > 0, repeating: r.repeat_weekly });
      if (!r.repeat_weekly) break;
    }
  }
  for (const e of events) {
    const day = ymd(e.starts_at);
    if (day >= from && day <= to) out.push({ key: `e:${e.id}`, kind: "event", at: e.starts_at, day, title: e.title, run: null, event: e, projected: false, repeating: false });
  }
  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime() || a.title.localeCompare(b.title));
}
