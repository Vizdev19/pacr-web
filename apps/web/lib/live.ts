"use client";

// /live?t=<token>: the watcher's page for a live-shared run, on get_live_run
// (migration 20261009120000 in the app repo). No session: the token in the
// query string IS the authorisation, and the RPC is the only way to read
// those tables at all. A null answer is every closed case at once (unknown,
// malformed, revoked); the server makes them identical on purpose.
//
// It is for someone slightly worried, on a phone, asking whether a person
// they love is OK. So the status line comes first and staleness is said in
// words; 'stale' and 'lost' are states the server computes, never inferred.
//
// The token must not leak: the page sets referrer no-referrer, and nothing
// here makes an outbound request that carries the URL. The map is drawn
// on the page (MapEmbed), with no tile provider.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MapPoint } from "@/components/ds/actions";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
export const POLL_VISIBLE_MS = 10_000; // the runner's phone pushes every ~10 s
export const POLL_HIDDEN_MS = 30_000;  // a backgrounded tab: keep it cheap
export const TERMINAL = new Set(["finished", "ended", "closed"]);

export type LiveState = "armed" | "live" | "paused" | "stale" | "lost" | "ended" | "finished" | "closed";
export type LiveRaw = {
  state: Exclude<LiveState, "closed">; runner: string | null; title?: string | null; started_at?: string | null;
  finished_at?: string | null; last_seen_at?: string | null; stale_sec?: number | null; distance_km?: number | null;
  elapsed_sec?: number | null; pace_sec_per_km?: number | null; last?: [number, number] | null; trail?: [number, number][] | null;
};

let client: SupabaseClient | null = null;
/** An anon client for the poll. Its own (in-memory) session store, so it never touches the runner's pacr.web.auth one. */
export function liveClient(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return client;
}

/** 41:08, 1:05:12. */
export function clock(sec: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** 5:42 for seconds per km, or undefined (the panel shows a dash). */
export function pace(secPerKm: number | null | undefined): string | undefined {
  const v = Number(secPerKm);
  if (!Number.isFinite(v) || v <= 0 || v > 3600) return undefined;
  const m = Math.floor(v / 60), s = Math.round(v % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

/** "20 s", "3 min", "1 h 5 min": seconds while it's seconds, minutes once it matters. */
export function span(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rem = m % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}

/** The words for each state: the overline, the headline and the line under it. */
export function copyFor(state: LiveState, runner: string | null, ageSec: number): { flag: string; headline: string; sub: string } {
  const name = runner || "A runner";
  const ago = `${span(ageSec)} ago`;
  switch (state) {
    case "armed": return { flag: "Link active", headline: `${name} hasn't started yet`, sub: "The link works. This page fills in once the run begins." };
    case "live": return { flag: `Live · updated ${ago}`, headline: `${name} is running`, sub: "Updating every few seconds, as long as the phone has signal." };
    case "paused": return { flag: `Paused · updated ${ago}`, headline: `${name} is paused`, sub: "A crossing, a water stop or a breather. The clock is stopped." };
    case "stale": return { flag: `Last update ${ago}`, headline: `No update for ${span(ageSec)}`, sub: "That's usually signal rather than trouble. The last known position is below." };
    case "lost": return { flag: `Last seen ${ago}`, headline: `No update for ${span(ageSec)}`, sub: `${name}'s phone has stopped reporting. It may have lost signal or run out of battery. The map shows where it last was.` };
    case "ended": return { flag: "No longer reporting", headline: "This run ended without finishing", sub: "The phone stopped reporting and the run was never saved. These are the last numbers it sent." };
    case "finished": return { flag: "Run complete", headline: `${name} finished`, sub: "Saved. This page stays as the record of it." };
    default: return { flag: "Link closed", headline: "This link isn't active", sub: "It may have been turned off, or it was never a run. Ask the runner for a new one." };
  }
}

/**
 * The trail (and the last fix, when it's newer) as 0–1 points for MapEmbed:
 * an equirectangular projection (longitude scaled by the cosine of the mean
 * latitude, north up), both axes divided by the same span so the shape keeps
 * its proportions.
 */
export function routeOf(d: LiveRaw): MapPoint[] {
  const ok = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));
  const P = (Array.isArray(d.trail) ? d.trail : []).filter(ok).map(p => [Number(p[0]), Number(p[1])] as [number, number]);
  if (ok(d.last)) {
    const [la, ln] = [Number(d.last[0]), Number(d.last[1])];
    const end = P[P.length - 1];
    if (!end || end[0] !== la || end[1] !== ln) P.push([la, ln]);
  }
  if (!P.length) return [];
  const k = Math.cos((P.reduce((s, p) => s + p[0], 0) / P.length) * Math.PI / 180);
  const xs = P.map(p => p[1] * k), ys = P.map(p => -p[0]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const size = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  if (!(size > 0)) return [[0.5, 0.5]];
  return P.map((_, i) => [(xs[i] - minX) / size, (ys[i] - minY) / size]);
}

/**
 * Where a route's last point lands in a 16:9 MapEmbed, so a pin can mark it.
 * The same fit MapEmbed does (components/ds/actions.tsx fitRoute: a 12%
 * margin, the shape's aspect kept); a lone point sits in the middle.
 */
export function endInFrame(route: MapPoint[]): { x: number; y: number } | null {
  if (!route.length) return null;
  if (route.length < 2) return { x: 0.5, y: 0.5 };
  const rw = 16, rh = 9, m = 0.12;
  const xs = route.map(p => p[0]), ys = route.map(p => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1e-6, h = Math.max(...ys) - minY || 1e-6;
  const s = Math.min((rw * (1 - 2 * m)) / w, (rh * (1 - 2 * m)) / h);
  const ox = (rw - w * s) / 2, oy = (rh - h * s) / 2;
  const [x, y] = route[route.length - 1];
  return { x: ((x - minX) * s + ox) / rw, y: ((y - minY) * s + oy) / rh };
}

/** Two or more distinct points: a line MapEmbed can draw. */
export const drawable = (route: MapPoint[]) => route.length > 1 && route.some(p => p[0] !== route[0][0] || p[1] !== route[0][1]);
