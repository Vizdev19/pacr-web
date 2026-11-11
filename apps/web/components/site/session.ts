"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { CITY_COOKIE } from "@/lib/config";
import type { HeaderUser } from "@/components/ds/nav";

/**
 * The signed-in runner, read from the session /signin stores (shared with
 * the static pages and /host). Null while signed out; the header falls back
 * to Sign in. Name and picture come from public.users under the runner's own
 * RLS.
 */
export function useSessionUser(): [HeaderUser | null, () => Promise<void>] {
  const [user, setUser] = useState<HeaderUser | null>(null);
  useEffect(() => {
    const sb = getSupabase();
    let alive = true;
    async function load(uid: string | undefined, email: string | undefined) {
      if (!uid) { if (alive) setUser(null); return; }
      const { data } = await sb.from("users").select("display_name, handle").eq("id", uid).maybeSingle();
      if (alive) setUser({ name: data?.display_name || email?.split("@")[0] || "You", handle: data?.handle ?? null });
    }
    sb.auth.getSession().then(({ data }) => load(data.session?.user.id, data.session?.user.email));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { load(s?.user.id, s?.user.email); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  const signOut = async () => { await getSupabase().auth.signOut(); setUser(null); };
  return [user, signOut];
}

export function rememberCity(id: string) {
  document.cookie = `${CITY_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
