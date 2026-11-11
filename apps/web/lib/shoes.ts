"use client";
// /shoes: the runner's pairs, read-only. The list is the app's user_data key
// pacr_shoes (`{ shoes: Shoe[] }`, pacr/src/services/shoes.ts via
// cloudState.ts). Writes stay in the app: they must follow cloudState's merge
// rules or they fight the phone.
//
// Km per pair is never stored: the app sums it from the run log (a run names
// its pair by WorkoutLog.shoeId), so this reads three fields of each run
// backup (owner-only) rather than whole logs. Photos are in the private
// shoe-photos bucket, "<user_id>/<random>.jpg" (20261109120000_shoe_photos.sql),
// signed here as the owner and never printed.
import { getSupabase } from "./supabase";
import { num, pairName, shoeList } from "./activity";

const DEFAULT_TARGET_KM = 650;
const NEAR_SHARE = 0.9;

export type ShoeView = {
  key: string; name: string; model: string | null; km: number; targetKm: number; runs: number;
  since: string | null; lastRun: string | null; retired: boolean; photo: string | null; wear: "near" | "done" | null;
};

type Usage = { km: number; runs: number; last: string | null };

/** Null when the run log couldn't be read: the pairs still show, without their km from runs. */
async function usageByPair(uid: string): Promise<Map<string, Usage> | null> {
  const sb = getSupabase();
  const out = new Map<string, Usage>();
  // Each row's log is whole-run JSON on the server; small pages keep every request quick.
  const PAGE = 250;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await sb.from("run_backups")
      .select("shoe:workout->>shoeId, dist:workout->>distance, kind:workout->>type, day:workout->>date")
      .eq("user_id", uid).not("workout->>shoeId", "is", null).range(from, from + PAGE - 1);
    if (error) return null;
    const rows = (data ?? []) as { shoe: string | null; dist: string | null; kind: string | null; day: string | null }[];
    for (const r of rows) {
      if (!r.shoe || r.kind !== "run") continue;
      const u = out.get(r.shoe) ?? { km: 0, runs: 0, last: null };
      u.km += num(r.dist); u.runs += 1;
      if (r.day && (!u.last || r.day > u.last)) u.last = r.day;
      out.set(r.shoe, u);
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Every pair, active ones first (most recently run in), then retired; `counted` is false when runs couldn't be added up. */
export async function getShoes(uid: string): Promise<{ shoes: ShoeView[]; counted: boolean }> {
  const sb = getSupabase();
  const { data, error } = await sb.from("user_data").select("value").eq("user_id", uid).eq("key", "pacr_shoes").maybeSingle();
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pairs = shoeList((data as { value?: unknown } | null)?.value) as any[];
  if (!pairs.length) return { shoes: [], counted: true };
  const counted = await usageByPair(uid);
  const usage = counted ?? new Map<string, Usage>();

  const paths = pairs.map(p => (typeof p.photo?.path === "string" ? p.photo.path as string : null)).filter((p): p is string => !!p);
  const photos = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await sb.storage.from("shoe-photos").createSignedUrls(paths, 60 * 60 * 6);
    for (const s of signed ?? []) if (s.signedUrl && s.path) photos.set(s.path, s.signedUrl);
  }

  const order = (p: { id: string; retiredAt?: number; addedAt?: number }) =>
    [p.retiredAt ? 1 : 0, -(usage.get(p.id)?.last ? Date.parse(usage.get(p.id)!.last!) : -1), -num(p.addedAt)];
  const sorted = [...pairs].sort((a, b) => {
    const x = order(a), y = order(b);
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  const shoes = sorted.map((p, i): ShoeView => {
    const u = usage.get(p.id);
    const target = num(p.targetKm) >= 100 ? num(p.targetKm) : DEFAULT_TARGET_KM;
    const km = Math.max(0, num(p.startKm)) + (u?.km ?? 0);
    const full = [p.brand, p.model].filter(Boolean).join(" ").trim();
    return {
      key: String(i), name: pairName(p), model: p.nickname?.trim() && full ? full : null, km, targetKm: target,
      runs: u?.runs ?? 0, since: typeof p.since === "string" ? p.since : null, lastRun: u?.last ?? null,
      retired: !!p.retiredAt, photo: p.photo?.path ? photos.get(p.photo.path) ?? null : null,
      wear: counted && km >= target ? "done" : counted && km >= target * NEAR_SHARE ? "near" : null,
    };
  });
  return { shoes, counted: !!counted };
}

/** "14 Mar 2026" from a YYYY-MM-DD day. */
export function ymdLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}
