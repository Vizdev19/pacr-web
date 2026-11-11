"use client";
// The signed-in half of /s/<slug>: get_club_page again with the runner's
// session (is_member, requested, banned, going_by_me, people they follow),
// their role from memberships, their gender from runner_gender (the one the
// women-only triggers read), and get_invite_preview for an invite link.
// Ids and storage paths stay in this hook's memory; the views get refs,
// slugs and picture URLs.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, type Auth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { signedUrls } from "@/lib/storage";
import {
  fetchClub, fetchSquadEvents, squadEventCards, toSquad, type RawClub, type Squad, type SquadEventCard,
} from "@/lib/squad";

export type Gender = "female" | "male" | "other" | null | undefined;

/** What get_invite_preview tells an invited runner about a hidden squad. */
export type InvitePreview = {
  name: string; slug: string; photo: string | null; verified: boolean; memberCount: number; womenOnly: boolean;
  rules: string[]; isMember: boolean; banned: boolean;
};

export type Viewer = {
  /** Session data has arrived (or there's no session). */
  ready: boolean;
  isMember: boolean; requested: boolean; banned: boolean;
  role: "owner" | "organiser" | "run_leader" | "member" | null;
  /** From runner_gender; undefined when it couldn't be read. */
  gender: Gender;
  name: string | null;
  followNames: string[]; followCount: number;
  /** get_invite_preview for ?invite=; null when there's none or the code is dead. */
  preview: InvitePreview | null;
};

const EMPTY: Viewer = {
  ready: false, isMember: false, requested: false, banned: false, role: null, gender: undefined, name: null,
  followNames: [], followCount: 0, preview: null,
};
const SIGNED_OUT: Viewer = { ...EMPTY, ready: true };

export function useSquad({ slug, invite, initial, events: initialEvents }:
  { slug: string; invite: string | null; initial: Squad | null; events: SquadEventCard[] }) {
  const auth: Auth = useAuth();
  const [squad, setSquad] = useState<Squad | null>(initial);
  const [events, setEvents] = useState(initialEvents);
  const [viewer, setViewer] = useState<Viewer>(EMPTY);
  // The squad's id, for request_to_join and list_squad_events. Never rendered.
  const circleId = useRef<string | null>(null);
  const pics = useRef({ photo: initial?.photo ?? null, cover: initial?.cover ?? null });

  const load = useCallback(async (uid: string) => {
    const sb = getSupabase();
    const [raw, pv, gender, me] = await Promise.all([
      fetchClub(sb, slug).catch(() => null),
      invite ? sb.rpc("get_invite_preview", { p_code: invite }).then(r => (r.error ? null : r.data), () => null) : Promise.resolve(null),
      sb.from("runner_gender").select("gender").eq("user_id", uid).maybeSingle()
        .then(r => (r.error ? undefined : ((r.data?.gender as Gender) ?? null)), () => undefined),
      sb.from("users").select("display_name").eq("id", uid).maybeSingle().then(r => (r.data?.display_name as string | null) ?? null, () => null),
    ]);
    const club = raw as RawClub | null;
    let role: Viewer["role"] = null;
    if (club) {
      circleId.current = club.id;
      if (club.is_member) {
        const { data } = await sb.from("memberships").select("role").eq("circle_id", club.id).eq("user_id", uid).maybeSingle();
        role = (data?.role as Viewer["role"]) ?? "member";
      }
      // A public squad keeps its proxied pictures; a hidden one (only its
      // members get here) is signed as the runner.
      if (!initial && (club.avatar_path || club.cover_path)) {
        const urls = await signedUrls("club-avatars", [club.avatar_path, club.cover_path]).catch(() => new Map<string, string>());
        pics.current = { photo: club.avatar_path ? urls.get(club.avatar_path) ?? null : null, cover: club.cover_path ? urls.get(club.cover_path) ?? null : null };
      }
      setSquad(toSquad(club, pics.current));
      // Members also see members-only events.
      if (club.is_member) {
        const rows = await fetchSquadEvents(sb, club.id).catch(() => null);
        if (rows) setEvents(squadEventCards(rows, club.name));
      }
    }
    let preview: InvitePreview | null = null;
    if (pv && typeof pv === "object") {
      const p = pv as { id: string; name: string; slug: string; avatar_path: string | null; verified: boolean; member_count: number; women_only: boolean; rules: string[] | null; is_member: boolean; banned: boolean };
      circleId.current ??= p.id;
      const photo = club ? pics.current.photo
        : p.avatar_path ? (await signedUrls("club-avatars", [p.avatar_path]).catch(() => new Map<string, string>())).get(p.avatar_path) ?? null : null;
      preview = {
        name: p.name, slug: p.slug, photo, verified: !!p.verified, memberCount: Number(p.member_count) || 0, womenOnly: !!p.women_only,
        rules: Array.isArray(p.rules) ? p.rules.filter(r => typeof r === "string" && r.trim()) : [], isMember: !!p.is_member, banned: !!p.banned,
      };
    }
    const people = Array.isArray(club?.people) ? club.people : [];
    setViewer({
      ready: true,
      isMember: !!(club?.is_member || preview?.isMember),
      requested: !!club?.requested,
      banned: !!(club?.banned || preview?.banned),
      role, gender, name: me,
      followNames: people.filter(p => p.i_follow && p.name).map(p => p.name as string),
      followCount: Number(club?.follow_count) || 0,
      preview,
    });
  }, [slug, invite, initial]);

  useEffect(() => {
    if (auth.status === "signed-in" && auth.uid) void load(auth.uid);
  }, [auth.status, auth.uid, load]);

  const reload = useCallback(async () => { if (auth.uid) await load(auth.uid); }, [auth.uid, load]);

  // Signed out (or signed out since): the public data, no viewer.
  const out = auth.status === "signed-out";

  /** Flip my RSVP on one run in place (idempotent: no double count). */
  const patchRun = useCallback((ref: string, on: boolean) => setSquad(s => s && {
    ...s,
    runs: s.runs.map(r => (r.ref !== ref || r.goingByMe === on ? r : { ...r, goingByMe: on, goingCount: Math.max(0, r.goingCount + (on ? 1 : -1)) })),
  }), []);

  return {
    auth, squad: out ? initial : squad, events: out ? initialEvents : events, viewer: out ? SIGNED_OUT : viewer,
    circleId, reload, patchRun, setViewer,
  };
}
