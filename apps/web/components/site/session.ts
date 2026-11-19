"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { signedUrls } from "@/lib/storage";
import { CITY_COOKIE } from "@/lib/config";
import type { HeaderUser } from "@/components/ds/nav";
import { faceOf } from "@/lib/avatars";

// Pages a new account can read before it has a name: /signin's own step and
// the documents its "By continuing you agree" line links to.
const BEFORE_PROFILE = ["/signin", "/terms", "/privacy", "/community-rules"];

/**
 * The signed-in runner for the header, read from the session /signin stores
 * (shared with /host). Null while signed out. Name, handle and picture come
 * from public.users under the runner's own RLS. A session with no row is a
 * sign-up that stopped before its name: it goes back to /signin to finish,
 * then returns here (a failed lookup isn't that answer, so it stays).
 */
export function useSessionUser(): [HeaderUser | null, () => Promise<void>] {
  const [user, setUser] = useState<HeaderUser | null>(null);
  useEffect(() => {
    const sb = getSupabase();
    let alive = true;
    async function load(uid: string | undefined, email: string | undefined) {
      if (!uid) { if (alive) setUser(null); return; }
      const { data, error } = await sb.from("users").select("display_name, handle, avatar_path").eq("id", uid).maybeSingle();
      const path = window.location.pathname;
      if (!error && !data && !BEFORE_PROFILE.some(p => path === p || path.startsWith(p + "/"))) {
        window.location.replace(`/signin?next=${encodeURIComponent(path + window.location.search)}`);
        return;
      }
      const avatar = faceOf(data?.avatar_path ? (await signedUrls("avatars", [data.avatar_path])).get(data.avatar_path) : null, data?.avatar_path, uid);
      if (alive) setUser({ name: data?.display_name || email?.split("@")[0] || "You", handle: data?.handle ?? null, avatar });
    }
    sb.auth.getSession().then(({ data }) => load(data.session?.user.id, data.session?.user.email));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { load(s?.user.id, s?.user.email); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  const signOut = async () => { await getSupabase().auth.signOut(); setUser(null); };
  return [user, signOut];
}

/** Unread notifications for the bell, refreshed when the tab comes back into view. */
export function useUnread(signedIn: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    const load = async () => {
      const { data } = await getSupabase().rpc("count_unread_notifications");
      if (alive && typeof data === "number") setN(data);
    };
    load();
    const vis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pacr:notifications-read", load);
    return () => { alive = false; document.removeEventListener("visibilitychange", vis); window.removeEventListener("pacr:notifications-read", load); };
  }, [signedIn]);
  return signedIn ? n : 0;
}

export function rememberCity(id: string) {
  document.cookie = `${CITY_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
