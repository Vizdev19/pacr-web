// pacr.life/zones: heart-rate and pace zones from age (or max HR) and one race
// time. Pure maths, no data: the page runs it in the browser as people type.
//
// These numbers must match the "easy runs are too fast" reel and the half
// marathon PDF: Easy = 65–75% of max HR and 60–90 s/km slower than half
// marathon pace. Don't change them without changing those too.

export const HM_KM = 21.0975;
const RIEGEL = 1.06;

export const RACES = [
  { km: 5, label: "5K" },
  { km: 10, label: "10K" },
  { km: HM_KM, label: "Half marathon" },
  { km: 42.195, label: "Marathon" },
] as const;

export const DEFAULTS = { age: "30", max: "", d: String(HM_KM), t: "2:00:00" };
export type ZoneForm = typeof DEFAULTS;

type Pace = { kind: "plus"; from: number; to: number } | { kind: "times"; from: number; to: number } | { kind: "5k" };
export type ZoneDef = { n: number; name: string; lo: number; hi: number; pace: Pace; color: string; use: string };

// Colours are the design system's colour-blind-safe data roles, picked to sit
// close to the brief's zone colours (blue, green, grey, amber, red-orange).
export const ZONES: ZoneDef[] = [
  { n: 1, name: "Recovery", lo: 0.55, hi: 0.65, pace: { kind: "plus", from: 90, to: 120 }, color: "var(--data-6)", use: "Warm-ups, cool-downs and very easy days." },
  { n: 2, name: "Easy", lo: 0.65, hi: 0.75, pace: { kind: "plus", from: 60, to: 90 }, color: "var(--data-3)", use: "Most of your running. Easy runs and long runs." },
  { n: 3, name: "The grey zone", lo: 0.75, hi: 0.85, pace: { kind: "plus", from: 15, to: 55 }, color: "var(--data-8)", use: "Steady, medium effort. Avoid it on easy days." },
  { n: 4, name: "Threshold", lo: 0.85, hi: 0.9, pace: { kind: "times", from: 0.955, to: 0.97 }, color: "var(--data-2)", use: "Comfortably hard. Cruise intervals." },
  { n: 5, name: "Hard", lo: 0.9, hi: 1, pace: { kind: "5k" }, color: "var(--data-4)", use: "4×4s, hill repeats, 30/30s. A few words at most." },
];

export const MSG = {
  age: "Enter an age between 12 and 90.",
  max: "Max heart rate should be a number between 120 and 230.",
  time: "Enter your race time as h:mm:ss, like 2:00:00 or 55:30.",
  pace: "That time works out to an unusual pace. Check the race distance and time.",
};

/** "2:00:00" or "55:30" → seconds; null if it isn't a valid race time. */
export function parseTime(s: string): number | null {
  const v = s.trim();
  if (!/^\d+(:\d{1,2}){1,2}$/.test(v)) return null;
  const parts = v.split(":").map(Number);
  const [h, m, sec] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  if (sec > 59 || (parts.length === 3 && m > 59)) return null;
  const total = h * 3600 + m * 60 + sec;
  return total > 0 ? total : null;
}

/** Seconds per km → "5:41", rounded to the nearest second. */
export function fmtPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const riegel = (t: number, from: number, to: number) => t * Math.pow(to / from, RIEGEL);

export type ZoneRow = ZoneDef & { bpm: [number, number]; paceText: string };
export type ZoneResult = { maxHr: number; maxEntered: boolean; hmPace: number; zones: ZoneRow[] };
export type ZoneErrors = Partial<Record<"age" | "max" | "time" | "pace", string>>;

export function raceKm(d: string): number {
  const n = Number(d);
  return RACES.find(r => Math.abs(r.km - n) < 1e-6)?.km ?? HM_KM;
}

/** The whole calculation: either errors, or the five zones. */
export function calculate(f: ZoneForm): { errors: ZoneErrors } | { result: ZoneResult } {
  const errors: ZoneErrors = {};
  const maxRaw = f.max.trim();
  const maxEntered = maxRaw !== "";
  const max = Number(maxRaw);
  if (maxEntered && !(Number.isFinite(max) && max >= 120 && max <= 230)) errors.max = MSG.max;
  const age = Number(f.age.trim());
  // Age only matters when there's no max heart rate to use instead.
  if (!maxEntered && !(f.age.trim() !== "" && Number.isFinite(age) && age >= 12 && age <= 90)) errors.age = MSG.age;
  const km = raceKm(f.d);
  const t = parseTime(f.t);
  if (t == null) errors.time = MSG.time;
  else if (t / km < 150 || t / km > 720) errors.pace = MSG.pace;
  if (Object.keys(errors).length || t == null) return { errors };

  const maxHr = maxEntered ? Math.round(max) : Math.round(208 - 0.7 * age);
  const hmPace = riegel(t, km, HM_KM) / HM_KM;
  const fivePace = riegel(t, km, 5) / 5;
  const zones = ZONES.map(z => {
    const p = z.pace;
    const paceText = p.kind === "5k" ? `${fmtPace(fivePace)} or faster`
      : p.kind === "plus" ? `${fmtPace(hmPace + p.from)}–${fmtPace(hmPace + p.to)}`
      : `${fmtPace(hmPace * p.from)}–${fmtPace(hmPace * p.to)}`;
    return { ...z, bpm: [Math.round(maxHr * z.lo), Math.round(maxHr * z.hi)] as [number, number], paceText };
  });
  return { result: { maxHr, maxEntered, hmPace, zones } };
}
