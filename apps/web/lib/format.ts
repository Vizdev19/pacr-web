// India-first formatting, per the design system's content rules:
// "Sat, 14 Nov · 6:00 am", "10 km", "5:42 /km", ₹ with Indian grouping.
// Runs and events are shown in Indian time; every pacr city is in IST.

export const TZ = "Asia/Kolkata";

type Parts = { dow: string; day: string; month: string; time: string; ymd: string };

export function istParts(iso: string | Date): Parts {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return {
    dow: p.weekday,
    day: p.day,
    // en-GB writes September as "Sept" in newer ICU; the design system uses three letters.
    month: p.month === "Sept" ? "Sep" : p.month,
    time: `${p.hour}:${p.minute} ${(p.dayPeriod || "").toLowerCase()}`.trim(),
    ymd,
  };
}

/** "Sat, 14 Nov · 6:00 am" */
export function whenLine(iso: string): string {
  const p = istParts(iso);
  return `${p.dow}, ${p.day} ${p.month} · ${p.time}`;
}

/** "Sat, 14 Nov" */
export function dayLine(iso: string | Date): string {
  const p = istParts(iso);
  return `${p.dow}, ${p.day} ${p.month}`;
}

export function istToday(): string {
  return istParts(new Date()).ymd;
}

export function km(n: number | string | null | undefined): string | null {
  if (n == null || n === "") return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v % 1 ? v.toFixed(1).replace(/\.0$/, "") : String(v);
}

/**
 * The app stores pace as a free label: "6:00", "6:00 /km", "6-7 min/km",
 * "All paces". A number-like pace gets the design's " /km"; words stay as
 * written.
 */
export function pace(label: string | null | undefined): string | null {
  const t = (label || "").trim();
  if (!t) return null;
  const bare = t.replace(/\s*(min)?\s*\/\s*km\s*$/i, "").trim();
  return /^\d/.test(bare) ? `${bare} /km` : t;
}

export function inr(minor: number): string {
  const n = minor / 100;
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 });
}

export function count(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
}
