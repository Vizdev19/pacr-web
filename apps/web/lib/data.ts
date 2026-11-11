import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { CITY_COOKIE, DEFAULT_CITY, SUPABASE_KEY, SUPABASE_URL } from "./config";
import type { City, DirectoryRow, EventRow, RunRow, SiteStats } from "./types";

// Server reads for the public pages, as anon: the same rows any visitor's
// browser could fetch (migration 20261223120000_web_directory.sql in the app
// repo, plus city_events). Nothing here is privileged.
function anon() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await anon().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export const getCities = () => rpc<City[]>("list_cities");
export const getSiteStats = async () => (await rpc<SiteStats[]>("site_stats"))[0] ?? null;

export function getDirectory(city: string | null, opts: { query?: string; limit?: number; offset?: number } = {}) {
  return rpc<DirectoryRow[]>("directory_clubs", {
    p_city: city, p_query: opts.query || null, p_tz: "Asia/Kolkata", p_limit: opts.limit ?? 24, p_offset: opts.offset ?? 0,
  });
}

export function getCityRuns(city: string | null, days = 7, limit = 100) {
  return rpc<RunRow[]>("city_runs", { p_city: city, p_window_days: days, p_tz: "Asia/Kolkata", p_limit: limit });
}

export function getCityEvents(city: string | null, limit = 100) {
  return rpc<EventRow[]>("city_events", { p_city: city, p_limit: limit });
}

/** The visitor's city: the cookie the city picker sets, else Bengaluru. */
export async function cookieCity(): Promise<string> {
  const c = (await cookies()).get(CITY_COOKIE)?.value;
  return c && /^[a-z0-9-]{2,40}$/.test(c) ? c : DEFAULT_CITY;
}

/** The request's clock, read once on the server and handed to client components so both render the same days. */
export function requestTime(): number {
  return Date.now();
}
