"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";
import { signinHref } from "./supabase";

export type Load<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: unknown };

/**
 * Load something when the component mounts and whenever `key` changes.
 * Returns the state, `reload()` to fetch again (keeping what's on screen until
 * the new data arrives) and `set()` to patch the data after an action.
 * A session the server no longer accepts goes to /signin and back.
 */
export function useLoad<T>(fn: () => Promise<T>, key: string): Load<T> & { reload: () => void; set: (next: T | ((cur: T) => T)) => void } {
  const [state, setState] = useState<{ key: string; load: Load<T> }>({ key, load: { status: "loading", data: null, error: null } });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });
  useEffect(() => {
    let live = true;
    fnRef.current().then(
      data => { if (live) setState({ key, load: { status: "ready", data, error: null } }); },
      error => {
        if (!live) return;
        if (error instanceof ApiError && error.reason === "signed_out") { window.location.replace(signinHref()); return; }
        setState({ key, load: { status: "error", data: null, error } });
      },
    );
    return () => { live = false; };
  }, [key, tick]);
  const reload = useCallback(() => setTick(t => t + 1), []);
  const set = useCallback((next: T | ((cur: T) => T)) => {
    setState(s => s.load.status === "ready"
      ? { key: s.key, load: { status: "ready", data: typeof next === "function" ? (next as (cur: T) => T)(s.load.data) : next, error: null } }
      : s);
  }, []);
  // A new key (another host, another run) shows loading at once, not the old data.
  const load: Load<T> = state.key === key ? state.load : { status: "loading", data: null, error: null };
  return { ...load, reload, set };
}

/** Window width bands of the design system's shell: phone < 720, tablet < 1100. */
export function useViewport(): { phone: boolean; tablet: boolean } {
  const [w, setW] = useState<number | null>(null);
  useEffect(() => {
    const f = () => setW(window.innerWidth);
    const raf = requestAnimationFrame(f);
    window.addEventListener("resize", f);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", f); };
  }, []);
  const width = w ?? 1440;
  return { phone: width < 720, tablet: width >= 720 && width < 1100 };
}
