"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The same project and publishable key as the rest of pacr.life
// (js/config.js). Both are public by design; access is the signed-in user's,
// enforced by RLS and the RPCs.
// NEXT_PUBLIC_SUPABASE_URL is only for pointing a local build at a test server.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zrnoioagjnmetnzwneks.supabase.co";
const SUPABASE_KEY = "sb_publishable_Bx3sahSCZxbK3lvnWcOu4Q_aD__9yqZ";

let client: SupabaseClient | null = null;

/**
 * The browser client, set up exactly like js/supabase.js so the two share one
 * session: same storageKey in the same origin's localStorage. Signing in and
 * out happens on the static site (/signin and its header); this app only
 * reads the session.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        storageKey: "pacr.web.auth",
      },
    });
  }
  return client;
}

/** /signin on the static site, coming back to this page afterwards. */
export function signinHref(): string {
  const next = window.location.pathname + window.location.search;
  return `/signin?next=${encodeURIComponent(next)}`;
}

/**
 * Leave the dashboard for a page on the static site ("/", "/download",
 * "/host/new"): a full navigation, since those pages are outside this app's
 * basePath and the router would prefix them with /host.
 */
export function goSite(path: string): void {
  window.location.href = path;
}
