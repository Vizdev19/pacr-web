"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

/**
 * The browser client, set up exactly like js/supabase.js and the host
 * dashboard so all three share one session: same storageKey in the same
 * origin's localStorage. Signing in happens on /signin.
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
