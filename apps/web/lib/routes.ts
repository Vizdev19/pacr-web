"use client";
// /routes: the runner's saved routes and public routes near them, through the
// RPCs 20261108120000_public_routes.sql gives the app (the routes table has no
// policies; my_routes / nearby_public_routes / delete_route are the only way
// in). A route's line is a Google encoded polyline at 1e-5° (the app's
// encodeLine); it is drawn as a 0–1 shape and never printed. Start points are
// never shown: a start is often someone's front door.
import { getSupabase } from "./supabase";
import { signedUrls } from "./storage";
import { num, projectRoute } from "./activity";
import { faceOf } from "./avatars";

export type RouteKind = "loop" | "out-and-back" | "one-way";
export const KIND_LABEL: Record<RouteKind, string> = { loop: "Loop", "out-and-back": "Out and back", "one-way": "One way" };

export type Route = {
  id: string; name: string; shape: [number, number][] | null; distanceKm: number; elevGainM: number | null; kind: RouteKind;
  isPublic?: boolean; createdAt?: string; awayKm?: number | null; isMine?: boolean;
  creator?: { id: string; name: string; avatar: string | null } | null;
};

/** The app's decodeLine. */
export function decodeLine(line: string): { lat: number; lon: number }[] {
  const out: { lat: number; lon: number }[] = [];
  let i = 0, lat = 0, lon = 0;
  const value = (): number | null => {
    let shift = 0, result = 0, b: number;
    do {
      if (i >= line.length) return null;
      b = line.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < line.length) {
    const dLat = value(), dLon = value();
    if (dLat == null || dLon == null) break;
    lat += dLat; lon += dLon;
    out.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return out;
}

const kindOf = (k: unknown): RouteKind => (k === "loop" || k === "out-and-back" || k === "one-way" ? k : "one-way");

export async function getMyRoutes(): Promise<Route[]> {
  const { data, error } = await getSupabase().rpc("my_routes");
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(r => ({
    id: r.id, name: r.name, shape: projectRoute(decodeLine(r.line ?? "")), distanceKm: num(r.distance_km),
    elevGainM: r.elev_gain_m == null ? null : num(r.elev_gain_m), kind: kindOf(r.kind), isPublic: !!r.is_public, createdAt: r.created_at,
  }));
}

/** Public routes (and mine) starting within `radiusKm`, nearest first. */
export async function getNearbyRoutes(lat: number, lng: number, radiusKm: number): Promise<Route[]> {
  const { data, error } = await getSupabase().rpc("nearby_public_routes", { p_lat: lat, p_lng: lng, p_radius_km: radiusKm, p_limit: 60 });
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const faces = await signedUrls("avatars", rows.map(r => r.creator_avatar_path));
  return rows.map(r => ({
    id: r.id, name: r.name, shape: projectRoute(decodeLine(r.line ?? "")), distanceKm: num(r.distance_km),
    elevGainM: r.elev_gain_m == null ? null : num(r.elev_gain_m), kind: kindOf(r.kind),
    awayKm: r.away_km == null ? null : num(r.away_km), isMine: !!r.is_mine,
    creator: r.creator_id && r.creator_name ? { id: r.creator_id, name: r.creator_name, avatar: faceOf(r.creator_avatar_path ? faces.get(r.creator_avatar_path) : null, r.creator_avatar_path, r.creator_id) } : null,
  }));
}

/** True once the route is gone (false from the RPC means it already was). */
export async function deleteRoute(id: string): Promise<boolean> {
  const { error } = await getSupabase().rpc("delete_route", { p_id: id });
  return !error;
}

/** "2.3 km away", as the app's awayLabel. */
export function awayLabel(km: number | null | undefined): string | null {
  if (km == null) return null;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}
