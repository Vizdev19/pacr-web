"use client";

// The notifications inbox, read as the runner (app repo:
// 20261216120000_event_pushes_inbox_deletion.sql for list_notifications,
// 20261004120000_feed_redesign.sql for mark_notifications_read). Sentences
// follow the app's notifications sheet (src/components/feed/Sheets.tsx).
//
// list_notifications folds a day's kudos on one post into one row; marking
// that row read marks every id it stands for. It returns circle ids, not
// slugs, so links to a squad look the slug up in circles, which RLS lets a
// runner read for squads they're in. An invite to a squad they're not in has
// no readable slug, so that row doesn't link (it doesn't open anything in the
// app either).
import { getSupabase } from "./supabase";
import { signedUrls } from "./storage";
import { encodeRef } from "./refs";
import { dayLine, istParts } from "./format";
import { plainMentions } from "./mentions";
import { money } from "./tickets";
import { faceOf } from "./avatars";

export type Kind = "kudos" | "comment" | "reply" | "mention" | "follow" | "invite" | "announcement" | "join_request"
  | "join_approved" | "owner_invite" | "owner_accepted" | "role_changed" | "run_cancelled" | "event_cancelled" | "event_refunded";

export type Note = {
  id: string; ids: string[]; kind: Kind; createdAt: string; unread: boolean;
  actorId: string | null; actorName: string | null; actorAvatar: string | null; othersCount: number;
  postId: string | null; postTitle: string | null; commentBody: string | null;
  circleId: string | null; circleName: string | null; circleSlug: string | null;
  annTitle: string | null; annBody: string | null; annAt: string | null;
  eventId: string | null; refundMinor: number;
};

export const PAGE = 40;

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

export async function listNotifications(before: string | null): Promise<Note[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("list_notifications", { p_limit: PAGE, p_before: before });
  if (error) throw new Error(error.message);
  const rows = (data as Row[]) ?? [];
  const circles = [...new Set(rows.map(r => str(r.circle_id)).filter((x): x is string => !!x))];
  const [avatars, slugs] = await Promise.all([
    signedUrls("avatars", rows.map(r => str(r.actor_avatar_path))),
    circles.length ? sb.from("circles").select("id, slug").in("id", circles) : Promise.resolve({ data: [] as Row[] }),
  ]);
  const slugOf = new Map<string, string>(((slugs.data as Row[]) ?? []).map(c => [String(c.id), String(c.slug)]));
  return rows.map(r => {
    const kind = String(r.kind) as Kind;
    const path = str(r.actor_avatar_path);
    const circle = str(r.circle_id);
    return {
      id: String(r.id), ids: Array.isArray(r.ids) ? (r.ids as string[]) : [String(r.id)], kind, createdAt: String(r.created_at),
      unread: !!r.unread, actorId: str(r.actor_id), actorName: str(r.actor_name), actorAvatar: faceOf(path ? avatars.get(path) : null, path, str(r.actor_id)),
      othersCount: Number(r.others_count) || 0, postId: str(r.post_id), postTitle: str(r.post_title), commentBody: str(r.comment_body),
      circleId: circle, circleName: str(r.circle_name), circleSlug: circle ? slugOf.get(circle) ?? null : null,
      annTitle: str(r.ann_title), annBody: str(r.ann_body), annAt: str(r.ann_event_at),
      eventId: kind === "event_cancelled" || kind === "event_refunded" ? str(r.event_id) : null,
      refundMinor: Number(r.refund_minor) || 0,
    };
  });
}

/** Null marks everything read. */
export async function markRead(ids: string[] | null): Promise<boolean> {
  const { error } = await getSupabase().rpc("mark_notifications_read", { p_ids: ids });
  if (!error) window.dispatchEvent(new Event("pacr:notifications-read"));
  return !error;
}

export const ICON: Record<Kind, string> = {
  kudos: "heart", comment: "message-circle", reply: "reply", mention: "at-sign", follow: "user-plus", invite: "mail",
  announcement: "megaphone", join_request: "door-open", join_approved: "user-check", owner_invite: "crown",
  owner_accepted: "crown", role_changed: "star", run_cancelled: "calendar-x", event_cancelled: "ban", event_refunded: "indian-rupee",
};

const squadHref = (n: Note) => (n.circleSlug ? `/s/${n.circleSlug}` : null);

/** Where a row goes. Never a uuid: posts and events by ref, squads by slug. */
export function hrefOf(n: Note): string | null {
  switch (n.kind) {
    case "kudos": case "comment": case "reply": case "mention":
      return n.postId ? `/feed/${encodeRef(n.postId)}` : squadHref(n);
    case "follow":
      return n.actorId ? `/profile?r=${encodeRef(n.actorId)}` : null;
    case "join_request": case "owner_invite": case "owner_accepted":
      return "/host";
    case "event_cancelled": case "event_refunded":
      return n.eventId ? `/e/${encodeRef(n.eventId)}` : null;
    default:
      return squadHref(n);
  }
}

/** The app's "Sat 15 Nov" in a sentence. */
const dateLabel = (iso: string) => dayLine(iso).replace(",", "");

function quoted(body: string | null): string {
  const s = body ? plainMentions(body) : "";
  return s ? `: "${s.length > 80 ? s.slice(0, 79) + "…" : s}"` : "";
}

/** What follows the actor's name, as the app's sheet says it. */
export function activityText(n: Note): string {
  switch (n.kind) {
    case "kudos":
      return n.othersCount > 0 ? `and ${n.othersCount} other${n.othersCount === 1 ? "" : "s"} gave kudos to your run.` : "gave kudos to your run.";
    case "comment": return `commented${quoted(n.commentBody)}`;
    case "reply": return `replied${quoted(n.commentBody)}`;
    case "mention": return `mentioned you${quoted(n.commentBody)}`;
    case "follow": return "started following you.";
    case "invite": return `invited you to join ${n.circleName ?? "a squad"}.`;
    case "join_request": return `asked to join ${n.circleName ?? "your squad"}.`;
    case "join_approved": return `approved you. You're in ${n.circleName ?? "the squad"}.`;
    case "owner_invite": return `invited you to co-own ${n.circleName ?? "their squad"}. Open it to accept.`;
    case "owner_accepted": return `is now a co-owner of ${n.circleName ?? "your squad"}.`;
    case "role_changed": return `gave you a new role in ${n.circleName ?? "the squad"}.`;
    case "run_cancelled":
      return `cancelled ${n.annTitle || "a run"}${n.annAt ? ` (${dateLabel(n.annAt)})` : ""} in ${n.circleName ?? "your squad"}.`;
    default: return "";
  }
}

/** Event rows read as a sentence about the event: [before, bold title, after]. */
export function eventText(n: Note): [string, string, string] {
  const title = n.annTitle || "An event";
  const back = n.refundMinor > 0 ? money(n.refundMinor) : null;
  if (n.kind === "event_cancelled") {
    return ["", title, `${n.annAt ? ` (${dateLabel(n.annAt)})` : ""} was cancelled.${back ? ` Your ${back} is on its way back.` : ""}`];
  }
  return back ? [`${back} for `, title, " is on its way back to you."] : ["Your payment for ", title, " is being refunded."];
}

/** "Today", "Yesterday", "Sat, 14 Nov" in IST. */
export function dayGroup(iso: string, now: number): string {
  const d = istParts(iso).ymd;
  if (d === istParts(new Date(now)).ymd) return "Today";
  if (d === istParts(new Date(now - 86400000)).ymd) return "Yesterday";
  return dayLine(iso);
}
