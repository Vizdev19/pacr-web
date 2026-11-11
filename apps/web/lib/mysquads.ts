"use client";

// Your squads, read as the runner: my_squads_overview (app repo:
// 20261106120000_squad_announcements_chat.sql), the same list as the app's
// Squads tab. It returns circle ids, not slugs, so the slugs come from
// circles (RLS lets a member read their own squads' rows) and pictures are
// signed as the runner from club-avatars. Ids never leave this file.
import { getSupabase } from "./supabase";
import { signedUrls } from "./storage";
import { TZ } from "./format";

export type Role = "owner" | "organiser" | "run_leader" | "member";

export type MySquad = {
  slug: string; name: string; photo: string | null; role: Role; members: number; location: string | null;
  verified: boolean; muted: boolean; pendingRequests: number; unreadPosts: number; unreadChat: number;
  nextRunAt: string | null; nextRunTitle: string | null;
};

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v) || 0;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const role = (v: unknown): Role => (v === "owner" || v === "organiser" || v === "run_leader" ? v : "member");

/** The ISO week the app keys run_summaries by ("2026-W46"), for today in IST. */
export function weekKey(now = new Date()): string {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const start = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - start) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function mySquads(): Promise<MySquad[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("my_squads_overview", { p_week_key: weekKey() });
  if (error) throw new Error(error.message);
  const rows = (data as Row[]) ?? [];
  if (!rows.length) return [];
  const ids = rows.map(r => String(r.circle_id));
  const [slugs, photos] = await Promise.all([
    sb.from("circles").select("id, slug").in("id", ids),
    signedUrls("club-avatars", rows.map(r => str(r.avatar_path))),
  ]);
  const slugOf = new Map<string, string>(((slugs.data as Row[]) ?? []).map(c => [String(c.id), String(c.slug)]));
  return rows.flatMap(r => {
    const slug = slugOf.get(String(r.circle_id));
    if (!slug) return [];
    const path = str(r.avatar_path);
    return [{
      slug, name: String(r.name ?? ""), photo: path ? photos.get(path) ?? null : null, role: role(r.role),
      members: num(r.member_count), location: str(r.location), verified: !!r.verified, muted: !!r.muted,
      pendingRequests: num(r.pending_requests), unreadPosts: num(r.unread_posts), unreadChat: num(r.unread_chat),
      nextRunAt: str(r.next_run_at), nextRunTitle: str(r.next_run_title),
    }];
  });
}
