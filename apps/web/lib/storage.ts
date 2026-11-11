"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "./supabase";

// Pictures in private buckets, signed as the viewer (storage policies decide
// what they may see). Signed URLs are cached for the page's life so a feed of
// 20 posts by 6 people signs each picture once.
//   avatars        users.avatar_path
//   post-images    posts.image_path
//   club-avatars   circles.avatar_path / cover_path (public squads also have /s/<slug>/photo)
//   event-covers   events.cover_path (public events also have /e/<ref>/poster)

export type Bucket = "avatars" | "post-images" | "club-avatars" | "event-covers";
const cache = new Map<string, string>();
const TTL = 60 * 60 * 6;

export async function signedUrls(bucket: Bucket, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const want = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  const todo = want.filter(p => { const hit = cache.get(bucket + "/" + p); if (hit) out.set(p, hit); return !hit; });
  if (todo.length) {
    const { data } = await getSupabase().storage.from(bucket).createSignedUrls(todo, TTL);
    for (const r of data ?? []) if (r.signedUrl && r.path) { cache.set(bucket + "/" + r.path, r.signedUrl); out.set(r.path, r.signedUrl); }
  }
  return out;
}

/** Signed URLs for a list of paths; re-signs when the list changes. */
export function useSigned(bucket: Bucket, paths: (string | null | undefined)[]): Map<string, string> {
  const key = paths.filter(Boolean).join("|");
  const [m, setM] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let alive = true;
    if (!key) return;
    signedUrls(bucket, key.split("|")).then(r => { if (alive) setM(r); });
    return () => { alive = false; };
  }, [bucket, key]);
  return m;
}
