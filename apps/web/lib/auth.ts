"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "./supabase";

export type Auth = { status: "loading" | "signed-out" | "signed-in"; uid: string | null; email: string | null };

/**
 * The runner's session, from the same localStorage key /signin and /host use.
 * Pages that need a runner render <RequireSignIn> while status isn't
 * "signed-in"; the server never sees the session.
 */
export function useAuth(): Auth {
  const [a, setA] = useState<Auth>({ status: "loading", uid: null, email: null });
  useEffect(() => {
    const sb = getSupabase();
    let alive = true;
    const set = (uid?: string | null, email?: string | null) => { if (alive) setA(uid ? { status: "signed-in", uid, email: email ?? null } : { status: "signed-out", uid: null, email: null }); };
    sb.auth.getSession().then(({ data }) => set(data.session?.user.id, data.session?.user.email));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => set(s?.user.id, s?.user.email));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return a;
}

/** /signin, coming back to this page afterwards. */
export function signinHref(next?: string): string {
  const here = next ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  return `/signin?next=${encodeURIComponent(here)}`;
}
