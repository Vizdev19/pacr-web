// India-first formatting, per the design system's content rules:
// "Sat, 14 Nov · 6:00 am", "10 km", "5:42 /km", ₹ with Indian grouping.
// Runs are shown in Indian time: every pacr city is in IST. An event is shown
// by the clock at the event (its own time zone), and a zone other than
// India's is named beside the time, since the page can't know where its
// reader is.

export const TZ = "Asia/Kolkata";

type Parts = { dow: string; day: string; month: string; time: string; ymd: string };

/** A zone the server knows; anything else is read as India's. */
function zoneOr(tz: string | null | undefined): string {
  if (!tz || tz === TZ) return TZ;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return TZ;
  }
}

/** "" for India; otherwise the zone's offset at that moment, " GMT+4". */
export function zoneNote(iso: string | Date, tz?: string | null): string {
  const zone = zoneOr(tz);
  if (zone === TZ || zone === "Asia/Calcutta") return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  // Worked out from the clock, not asked of the browser by name: older Safari
  // and Chrome throw on the option that would name it, and the server and the
  // browser must write the same thing.
  try {
    const p: Record<string, number> = {};
    for (const x of new Intl.DateTimeFormat("en-GB", {
      timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(d)) p[x.type] = Number(x.value);
    const off = Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute) - Math.floor(d.getTime() / 60000) * 60000) / 60000);
    if (!Number.isFinite(off)) return "";
    const a = Math.abs(off), m = a % 60;
    return off === 0 ? " GMT" : ` GMT${off < 0 ? "-" : "+"}${Math.floor(a / 60)}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
  } catch {
    return "";
  }
}

export function istParts(iso: string | Date, tz?: string | null): Parts {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const zone = zoneOr(tz);
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return {
    dow: p.weekday,
    day: p.day,
    // en-GB writes September as "Sept" in newer ICU; the design system uses three letters.
    month: p.month === "Sept" ? "Sep" : p.month,
    time: `${p.hour}:${p.minute} ${(p.dayPeriod || "").toLowerCase()}`.trim(),
    ymd,
  };
}

/** "Sat, 14 Nov · 6:00 am"; with an event's zone, by the clock there ("… · 6:00 am GMT+4" outside India). */
export function whenLine(iso: string, tz?: string | null): string {
  const p = istParts(iso, tz);
  return `${p.dow}, ${p.day} ${p.month} · ${p.time}${zoneNote(iso, tz)}`;
}

/** "Sat, 14 Nov" */
export function dayLine(iso: string | Date, tz?: string | null): string {
  const p = istParts(iso, tz);
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
