"use client";
// /settings: what the web may show or change about the runner's account.
//   users (own row)          name and handle, read-only (edited in the app)
//   retract_my_posts         "Make all my posts squad-only", the one privacy
//                            control the old profile page had (20260909120000)
//   user_blocks              the blocked list and Unblock, as the app's
//                            moderation.ts (select / delete own rows)
//   garmin_connections, whoop_connections   connected or not (owner-read RLS)
// Account deletion is not called from here: it lives in the app.
import { getSupabase } from "./supabase";
import { signedUrls } from "./storage";
import { faceOf } from "./avatars";

export async function getAccount(uid: string): Promise<{ name: string | null; handle: string | null }> {
  const { data, error } = await getSupabase().from("users").select("display_name, handle").eq("id", uid).maybeSingle();
  if (error) throw new Error(error.message);
  return { name: data?.display_name ?? null, handle: data?.handle ?? null };
}

/** How many posts went back to squad-only, or null on failure. */
export async function retractMyPosts(): Promise<number | null> {
  const { data, error } = await getSupabase().rpc("retract_my_posts");
  return error ? null : Number(data) || 0;
}

export type Blocked = { id: string; name: string; avatar: string | null; since: string };

/** Everyone I've blocked, newest first. A runner I can no longer read is still listed, so they can be unblocked. */
export async function getBlocked(): Promise<Blocked[]> {
  const { data, error } = await getSupabase().from("user_blocks")
    .select("blocked_id, created_at, blocked:users!user_blocks_blocked_id_fkey(display_name, avatar_path)")
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const one = (b: unknown) => (Array.isArray(b) ? b[0] : b) as { display_name?: string; avatar_path?: string } | null;
  const faces = await signedUrls("avatars", rows.map(r => one(r.blocked)?.avatar_path));
  return rows.map(r => {
    const u = one(r.blocked);
    return { id: r.blocked_id, name: u?.display_name || "Blocked runner", avatar: faceOf(u?.avatar_path ? faces.get(u.avatar_path) : null, u?.avatar_path, r.blocked_id), since: r.created_at };
  });
}

export async function unblock(me: string, them: string): Promise<boolean> {
  const { data, error } = await getSupabase().from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", them).select("blocked_id");
  return !error && !!data?.length;
}

/** Undo an unblock: insert-or-nothing, as the app's blockUser (user_blocks has no UPDATE policy). */
export async function block(me: string, them: string): Promise<boolean> {
  const { error } = await getSupabase().from("user_blocks")
    .upsert({ blocker_id: me, blocked_id: them }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  return !error;
}

export type Connection = { connected: boolean; since: string | null; needsReauth: boolean } | null;

/** Garmin and WHOOP: a row means connected. Null when the table couldn't be read. */
export async function getConnections(uid: string): Promise<{ garmin: Connection; whoop: Connection }> {
  const sb = getSupabase();
  const read = async (table: string): Promise<Connection> => {
    const { data, error } = await sb.from(table).select("connected_at, needs_reauth").eq("user_id", uid).maybeSingle();
    if (error) return null;
    return data ? { connected: true, since: data.connected_at ?? null, needsReauth: !!data.needs_reauth } : { connected: false, since: null, needsReauth: false };
  };
  const [garmin, whoop] = await Promise.all([read("garmin_connections"), read("whoop_connections")]);
  return { garmin, whoop };
}
