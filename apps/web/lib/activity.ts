"use client";
// /activity/<ref>: one of the runner's own runs. The headline numbers come
// from run_summaries (RLS); the whole log (GPS trace, heart-rate curve,
// steps, shoe) from run_backups, which is owner-only by policy
// (20261017120000_run_backups.sql). The log is the app's WorkoutLog JSON
// verbatim (pacr/src/services/ai.ts); splits and the chart series are worked
// out here the way the app's run detail does (src/components/activity/geo.ts
// traceSeries), so the two show the same splits.
//
// Coordinates never reach the page as text: the route is flattened and
// projected into a 0–1 box for MapEmbed, nothing else.
import { getSupabase } from "./supabase";

// ─── Refs ───────────────────────────────────────────────────────────────────

const REF_RE = /^[A-Za-z0-9_-]{22}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A 22-character ref back to its uuid, or null. Used only for queries; the uuid is never rendered. */
export function decodeRef(ref: string | null | undefined): string | null {
  if (!ref || !REF_RE.test(ref)) return null;
  try {
    const bin = atob(ref.replace(/-/g, "+").replace(/_/g, "/"));
    if (bin.length !== 16) return null;
    let hex = "";
    for (let i = 0; i < 16; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    return UUID_RE.test(uuid) ? uuid : null;
  } catch {
    return null;
  }
}

// ─── The app's run log ──────────────────────────────────────────────────────

export type RoutePoint = { lat: number; lon: number; timestamp?: number; altitude?: number };
export type HeartRateSeries = { t0: number; stepSec: number; bpm: (number | null)[] };

/** The fields of the app's WorkoutLog this page reads. */
export type WorkoutLog = {
  id?: string; date?: string; type?: string;
  duration?: number; durationSec?: number; distance?: number;
  heartRate?: number; maxHeartRate?: number; elevationGainM?: number; steps?: number;
  route?: RoutePoint[]; hrSeries?: HeartRateSeries;
  title?: string; startedAt?: number; shoeId?: string; source?: string; sourceLabel?: string;
};

export type RunSummaryRow = {
  id: string; user_id: string; started_at: string; distance_km: number | string; duration_sec: number;
  pace_sec_per_km: number | string | null; neighborhood: string | null; title: string | null;
  elev_gain_m: number | null; client_log_id: string | null; route_shape: [number, number][] | null;
};

export type RunShoe = { name: string; retired: boolean };

export type ActivityResult =
  | { kind: "ok"; run: RunSummaryRow; log: WorkoutLog | null; shoe: RunShoe | null }
  | { kind: "notfound" }
  | { kind: "error" };

const SUMMARY_COLS = "id, user_id, started_at, distance_km, duration_sec, pace_sec_per_km, neighborhood, title, elev_gain_m, client_log_id, route_shape";

/**
 * The run behind a ref, if it is the viewer's own. Someone else's run (which
 * run_summaries may well return to a squadmate) reads as not found: this page
 * shows the full log, and that is the owner's alone.
 */
export async function loadActivity(ref: string, uid: string): Promise<ActivityResult> {
  const id = decodeRef(ref);
  if (!id) return { kind: "notfound" };
  const sb = getSupabase();
  const { data: run, error } = await sb.from("run_summaries").select(SUMMARY_COLS).eq("id", id).maybeSingle();
  if (error) return { kind: "error" };
  if (!run || (run as RunSummaryRow).user_id !== uid) return { kind: "notfound" };
  const row = run as RunSummaryRow;

  let log: WorkoutLog | null = null;
  if (row.client_log_id) {
    const { data } = await sb.from("run_backups").select("workout")
      .eq("user_id", uid).eq("client_log_id", row.client_log_id).maybeSingle();
    const w = (data as { workout?: unknown } | null)?.workout;
    if (w && typeof w === "object") log = w as WorkoutLog;
  }

  let shoe: RunShoe | null = null;
  if (log?.shoeId) {
    const { data } = await sb.from("user_data").select("value").eq("user_id", uid).eq("key", "pacr_shoes").maybeSingle();
    const pair = shoeList((data as { value?: unknown } | null)?.value).find(s => s.id === log!.shoeId);
    if (pair) shoe = { name: pairName(pair), retired: !!pair.retiredAt };
  }
  return { kind: "ok", run: row, log, shoe };
}

type RawShoe = { id: string; brand?: string; model?: string; nickname?: string; retiredAt?: number };
/** user_data.value for pacr_shoes: `{ shoes: [...] }`, or the same as a JSON string. */
export function shoeList(value: unknown): RawShoe[] {
  let v = value;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return []; } }
  const list = (v as { shoes?: unknown } | null)?.shoes;
  return Array.isArray(list) ? list.filter((s): s is RawShoe => !!s && typeof s === "object" && typeof (s as RawShoe).id === "string") : [];
}
/** What the app calls a pair: its nickname, else brand and model. */
export function pairName(s: { brand?: string; model?: string; nickname?: string }): string {
  return s.nickname?.trim() || [s.brand, s.model].filter(Boolean).join(" ").trim() || "Shoes";
}

// ─── Numbers ────────────────────────────────────────────────────────────────

export const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Active seconds: the exact count when the log has it, else whole minutes. */
export function logSeconds(w: WorkoutLog | null, fallback: number): number {
  if (!w) return fallback;
  if (w.durationSec != null && w.durationSec > 0) return w.durationSec;
  if (w.duration != null && w.duration > 0) return w.duration * 60;
  return fallback;
}

/** "Morning run" for a run that was never named, from its IST start. */
export function runTitle(title: string | null | undefined, startedAt: string | number, ride = false): string {
  if (title?.trim()) return title.trim();
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date(startedAt)));
  return `${h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening"} ${ride ? "ride" : "run"}`;
}

// ─── Geometry ───────────────────────────────────────────────────────────────

function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000, r = (d: number) => (d * Math.PI) / 180;
  const sLat = Math.sin(r(b.lat - a.lat) / 2), sLon = Math.sin(r(b.lon - a.lon) / 2);
  const h = sLat * sLat + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * sLon * sLon;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function validPoints(route: RoutePoint[] | undefined): RoutePoint[] {
  return (route ?? []).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

function downsample<T>(pts: T[], max: number): T[] {
  if (pts.length <= max) return pts;
  const stride = Math.ceil(pts.length / max);
  const out = pts.filter((_, i) => i % stride === 0);
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Lat/lon → a 0–1 box: lon corrected by cos(lat), y growing south, the long
 * side spanning 0–1 and the aspect kept. A shape with no place or scale.
 */
export function projectRoute(points: { lat: number; lon: number }[], max = 400): [number, number][] | null {
  const pts = downsample(points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)), max);
  if (pts.length < 2) return null;
  const mid = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
  const k = Math.cos((mid * Math.PI) / 180);
  const F = pts.map(p => [p.lon * k, -p.lat] as [number, number]);
  const xs = F.map(p => p[0]), ys = F.map(p => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  if (!(span > 0)) return null;
  return F.map(([x, y]) => [(x - minX) / span, (y - minY) / span]);
}

/** run_summaries.route_shape (ints in a 0–1000 box) → 0–1 points. */
export function shapePoints(shape: unknown): [number, number][] | null {
  if (!Array.isArray(shape)) return null;
  const P = shape.filter((p): p is [number, number] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([x, y]) => [x / 1000, y / 1000] as [number, number]);
  return P.length >= 2 ? P : null;
}

// ─── The trace as series (the app's traceSeries) ────────────────────────────

/** The app's heartRateAt: a bpm at wall-clock `at`, bridging gaps under a minute. */
function heartRateAt(series: HeartRateSeries, at: number): number | null {
  const x = (at - series.t0) / 1000 / series.stepSec - 0.5;
  const reach = Math.max(1, Math.round(60 / series.stepSec));
  let lo = Math.floor(x), hi = lo + 1;
  while (lo >= 0 && series.bpm[lo] == null && Math.floor(x) - lo < reach) lo--;
  while (hi < series.bpm.length && series.bpm[hi] == null && hi - Math.ceil(x) < reach) hi++;
  const a = lo >= 0 ? series.bpm[lo] : null, b = hi < series.bpm.length ? series.bpm[hi] : null;
  if (a != null && b != null) return a + (b - a) * Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  if (a != null && x - lo <= reach) return a;
  if (b != null && hi - x <= reach) return b;
  return null;
}

export type TraceSplit = { n: number; dist: number; pace: number; elev: number | null; hr: number | null };
export type Trace = {
  km: number;
  /** sec/km per sample; null without timestamps. */
  pace: number[] | null;
  /** metres above sea level per sample; null without altitude. */
  el: number[] | null;
  /** bpm per sample; null without a heart-rate curve covering most of the run. */
  hr: number[] | null;
  splits: TraceSplit[];
};

const DN = 200;
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const smooth = (a: number[], wd: number) => a.map((_, i) => {
  let s = 0, c = 0;
  for (let j = Math.max(0, i - wd); j <= Math.min(a.length - 1, i + wd); j++) { s += a[j]; c++; }
  return s / c;
});
function fillGaps(a: (number | undefined)[]): number[] {
  const out = a.map(v => (typeof v === "number" && Number.isFinite(v) ? v : NaN));
  let prev = -1;
  for (let i = 0; i < out.length; i++) {
    if (Number.isNaN(out[i])) continue;
    for (let k = prev + 1; k < i; k++) out[k] = prev < 0 ? out[i] : out[prev] + ((out[i] - out[prev]) * (k - prev)) / (i - prev);
    prev = i;
  }
  for (let k = prev + 1; k < out.length; k++) out[k] = prev < 0 ? 0 : out[prev];
  return out;
}

/**
 * The trace resampled to evenly spaced distance steps, with moving-time pace,
 * smoothed elevation and heart rate per step, and splits on exact km
 * boundaries. Distances are in the run's logged km, so splits agree with the
 * headline distance. Ported from the app's traceSeries.
 */
export function traceSeries(w: WorkoutLog): Trace | null {
  const pts = validPoints(w.route);
  if (pts.length < 2) return null;
  const rawD = [0], rawT = [0];
  const hasTime = pts.every(p => typeof p.timestamp === "number");
  for (let i = 1; i < pts.length; i++) {
    const dm = haversineM(pts[i - 1], pts[i]);
    rawD.push(rawD[i - 1] + dm);
    if (hasTime) {
      const dt = Math.max(0, (pts[i].timestamp! - pts[i - 1].timestamp!) / 1000);
      rawT.push(rawT[i - 1] + (dt > 10 && dm / dt < 0.5 ? 0 : dt));
    }
  }
  const D = rawD[rawD.length - 1];
  if (!(D > 50)) return null;

  const alts = pts.map(p => p.altitude);
  const hasAlt = alts.filter(a => typeof a === "number" && Number.isFinite(a)).length >= pts.length * 0.5;
  const altArr = hasAlt ? smooth(fillGaps(alts), 3) : null;

  const kmTotal = (w.distance ?? 0) > 0.05 ? w.distance! : D / 1000;
  const dScale = D / (kmTotal * 1000);
  const tTotal = hasTime ? rawT[rawT.length - 1] : 0;
  const tScale = tTotal > 0 ? logSeconds(w, tTotal) / tTotal : 1;

  let j = 0;
  const at = (dm: number) => {
    if (dm <= 0) j = 0;
    while (j < rawD.length - 2 && rawD[j + 1] < dm) j++;
    const f = Math.max(0, Math.min(1, (dm - rawD[j]) / (rawD[j + 1] - rawD[j] || 1)));
    const lerp = (a: number, b: number) => a + (b - a) * f;
    return {
      t: hasTime ? lerp(rawT[j], rawT[j + 1]) * tScale : 0,
      wall: hasTime ? lerp(pts[j].timestamp!, pts[j + 1].timestamp!) : 0,
      alt: altArr ? lerp(altArr[j], altArr[j + 1]) : 0,
    };
  };

  const samples = Array.from({ length: DN }, (_, i) => at((i / (DN - 1)) * D));
  const km = kmTotal, dKm = km / (DN - 1);
  const cum = hasTime ? samples.map(s => s.t) : null;
  const el = altArr ? samples.map(s => s.alt) : null;

  let hr: number[] | null = null;
  if (hasTime && w.hrSeries?.bpm?.length) {
    const raw = samples.map(s => heartRateAt(w.hrSeries!, s.wall));
    if (raw.filter(v => v != null).length >= DN * 0.6) {
      let last = raw.find((v): v is number => v != null)!;
      hr = smooth(raw.map(v => (v != null ? (last = v) : last)), 2);
    }
  }

  let pace: number[] | null = null;
  if (cum && cum[DN - 1] > 0) {
    const raw = cum.map((_, i) => {
      const a = Math.max(0, i - 2), b = Math.min(DN - 1, i + 2);
      return Math.max(150, Math.min(1200, (cum[b] - cum[a]) / ((b - a) * dKm)));
    });
    pace = smooth(raw, 2);
  }

  const splits: TraceSplit[] = [];
  const nK = Math.ceil(km - 0.05);
  for (let s = 0; s < nK; s++) {
    const a = s, b = Math.min(km, s + 1);
    if (b - a < 0.05) break;
    const A = at(a * 1000 * dScale), B = at(b * 1000 * dScale);
    const i0 = Math.round((a / km) * (DN - 1)), i1 = Math.round((b / km) * (DN - 1));
    splits.push({
      n: s + 1, dist: b - a,
      pace: hasTime ? (B.t - A.t) / (b - a) : 0,
      elev: altArr ? B.alt - A.alt : null,
      hr: hr ? mean(hr.slice(i0, i1 + 1)) : null,
    });
  }
  return { km, pace, el, hr, splits };
}

/** A series cut to `n` points for a chart, with km labels at round steps. */
export function chartSeries(values: number[], km: number, n = 80): { data: number[]; labels: string[] } {
  const step = km > 30 ? 10 : km > 15 ? 5 : km > 6 ? 2 : 1;
  const data: number[] = [], labels: string[] = [];
  let next = step;
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / (n - 1)) * (values.length - 1));
    data.push(values[idx]);
    const at = (i / (n - 1)) * km;
    if (at >= next && next < km - 0.3) { labels.push(`${next} km`); next += step; } else labels.push("");
  }
  return { data, labels };
}
