"use client";
// One post on /feed and /feed/<ref>: the kit's PostCard on a list_home_feed
// row, drawn by the app's rules (src/components/feed/FeedPostCard.tsx):
//   - a run's ".4x5" feed card fills the 4:5 frame
//   - a recorded run's ".route" map fills it too, under the run's numbers
//   - any other run picture is an old 9:16 story, whole over a blur of itself
//   - a run with no picture shows its numbers and its route shape
// plus kudos (optimistic, double-tap gives), the liked-by line and the ⋮ menu
// with the sheets and dialogs behind it (usePostActions).
import { useEffect, useState } from "react";
import { Button } from "@/components/ds/core";
import { PostCard, type PostMenuItem } from "@/components/ds/content";
import { BottomSheet } from "@/components/ds/feedback";
import { Checkbox, FieldMessage, Input, Radio, RadioGroup } from "@/components/ds/forms";
import { Dialog, useToast } from "@/components/ds/overlays";
import { MentionText } from "@/components/site/MentionText";
import { plainMentions } from "@/lib/mentions";
import { ago, duration, paceOf } from "@/lib/time";
import {
  blockRunner, contextLine, deletePost, firstName, followerCount, hidePost, isFeedCardPath, isRouteMapPath, isStaff,
  likedLine, muteRunner, POST_REPORT_REASONS, postRef, removeFromSquad, report, runnerHref, setAudience, setKudos,
  setTitle, unhidePost, unmuteRunner, type FeedPost, type MySquad, type ReportReason, type Visibility,
} from "@/lib/feed";

/** The clock the cards' "2h" reads, ticking once a minute. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  return now;
}

export function FeedPostCard({ post, now, avatar, image, onKudos, menu, onMenu, commentHref }:
  { post: FeedPost; now: number; avatar?: string | null; image?: string | null; onKudos: (give: boolean) => void;
    menu?: PostMenuItem[]; onMenu?: (id: string) => void; commentHref?: string }) {
  const isRoute = isRouteMapPath(post.imagePath);
  const story = post.kind === "run" && !!post.imagePath && !isFeedCardPath(post.imagePath) && !isRoute;
  const ref = postRef(post.id);
  const run = post.kind === "run" && post.run && (isRoute || !post.imagePath) ? {
    distance: post.run.distanceKm.toFixed(2), duration: duration(post.run.durationSec), pace: paceOf(post.run.paceSecPerKm),
    route: post.imagePath ? null : post.route,
  } : null;
  const title = post.title ? plainMentions(post.title)
    : post.body ? null : post.kind === "photo" ? "Shared a photo" : post.kind === "run" ? "Shared a run" : null;
  return <PostCard
    author={{ name: post.authorName, avatar, href: runnerHref(post.authorHandle, post.authorId) }}
    href={`/feed/${ref}`} time={ago(post.createdAt, now)} context={[contextLine(post), post.place].filter(Boolean).join(" · ")}
    title={title} body={post.body ? <MentionText body={post.body} /> : null}
    photo={post.imagePath ? { src: image ?? "", mode: story && image ? "story" : "fill" } : null}
    photoAlt={post.kind === "run" ? `${firstName(post.authorName)}'s run` : undefined}
    run={run} kudos={post.likeCount} kudosGiven={post.likedByMe} likedLine={likedLine(post)}
    comments={post.commentCount} commentHref={commentHref ?? `/feed/${ref}`}
    onKudos={onKudos} menu={menu} onMenu={onMenu} />;
}

/** Kudos on or off, drawn at once and rolled back if the write fails. */
export function useKudos(uid: string, patch: (id: string, p: Partial<FeedPost>) => void) {
  const toast = useToast();
  return async (post: FeedPost, give: boolean) => {
    if (give === post.likedByMe) return;
    const step = (on: boolean) => patch(post.id, { likedByMe: on, likeCount: Math.max(0, post.likeCount + (on === post.likedByMe ? 0 : on ? 1 : -1)) });
    step(give);
    if (!(await setKudos(post.id, uid, give))) {
      step(!give);
      toast({ title: give ? "Kudos didn't go through" : "Couldn't take back kudos", message: "Check your connection and try again.", tone: "error" });
    }
  };
}

type Open =
  | { kind: "audience" | "rename" | "report" | "delete" | "block"; post: FeedPost }
  | { kind: "remove"; post: FeedPost; squad: MySquad }
  | null;

export type PostActionsProps = {
  uid: string;
  squads: MySquad[];
  /** The Squads tab's picked squad, for "Remove from squad". */
  pickedSquadId?: string | null;
  /** Gone from view: deleted, hidden, reported or removed. */
  drop: (postId: string) => void;
  restore: (postId: string) => void;
  dropAuthor: (authorId: string) => void;
  restoreAuthor: (authorId: string) => void;
  patch: (postId: string, p: Partial<FeedPost>) => void;
};

/** The ⋮ menu for a post, what each item does, and the sheets and dialogs it opens. */
export function usePostActions(a: PostActionsProps) {
  const toast = useToast();
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { setOpen(null); setBusy(false); };
  const fail = (title: string) => toast({ title, message: "Check your connection and try again.", tone: "error" });

  const staffSquad = (p: FeedPost): MySquad | null => {
    const mine = a.squads.filter(s => isStaff(s) && p.squadIds.includes(s.id));
    return mine.find(s => s.id === a.pickedSquadId) ?? mine[0] ?? null;
  };

  const items = (p: FeedPost): PostMenuItem[] => {
    const first = firstName(p.authorName);
    const copy: PostMenuItem[] = p.visibility === "public" ? [{ id: "copy", label: "Copy link", icon: "link" }] : [];
    if (p.isMine) return [
      { id: "audience", label: "Who can see", icon: "eye" },
      ...(p.kind === "run" ? [{ id: "rename", label: "Rename run", icon: "pencil" }] : []),
      ...copy, "-",
      { id: "delete", label: "Delete post", icon: "trash-2", danger: true },
    ];
    const staff = staffSquad(p);
    return [
      ...copy,
      { id: "hide", label: "Hide post", icon: "eye-off" },
      { id: "mute", label: `Mute ${first}`, icon: "volume-x" },
      ...(staff ? [{ id: "remove", label: staff.id === a.pickedSquadId ? "Remove from squad" : `Remove from ${staff.name}`, icon: "users-round" }] : []),
      "-",
      { id: "report", label: `Report ${first}'s post`, icon: "flag", danger: true },
      { id: "block", label: `Block ${first}`, icon: "ban", danger: true },
    ];
  };

  const select = async (p: FeedPost, id: string) => {
    const first = firstName(p.authorName);
    if (id === "copy") {
      try { await navigator.clipboard.writeText(`https://pacr.life/p/${postRef(p.id)}`); toast({ title: "Link copied" }); }
      catch { fail("Couldn't copy the link"); }
      return;
    }
    if (id === "hide") {
      a.drop(p.id);
      if (!(await hidePost(p.id, a.uid))) { a.restore(p.id); fail("Couldn't hide that post"); return; }
      toast({ title: "Post hidden", message: "You won't see it in your feed.", action: "Undo", onAction: async () => { if (await unhidePost(p.id, a.uid)) a.restore(p.id); } });
      return;
    }
    if (id === "mute") {
      a.dropAuthor(p.authorId);
      if (!(await muteRunner(a.uid, p.authorId))) { a.restoreAuthor(p.authorId); fail(`Couldn't mute ${first}`); return; }
      toast({ title: `Muted ${first}`, message: "Their posts won't show in your feed.", action: "Undo", onAction: async () => { if (await unmuteRunner(a.uid, p.authorId)) a.restoreAuthor(p.authorId); } });
      return;
    }
    if (id === "remove") { const s = staffSquad(p); if (s) setOpen({ kind: "remove", post: p, squad: s }); return; }
    if (id === "audience" || id === "rename" || id === "report" || id === "delete" || id === "block") setOpen({ kind: id, post: p });
  };

  const confirmDelete = async (p: FeedPost) => {
    setBusy(true);
    const ok = await deletePost(p.id);
    close();
    if (!ok) return fail("Couldn't delete that post");
    a.drop(p.id); toast({ title: "Post deleted" });
  };
  const confirmBlock = async (p: FeedPost) => {
    setBusy(true);
    const ok = await blockRunner(a.uid, p.authorId);
    close();
    if (!ok) return fail(`Couldn't block ${firstName(p.authorName)}`);
    a.dropAuthor(p.authorId); toast({ title: `Blocked ${firstName(p.authorName)}` });
  };
  const confirmRemove = async (p: FeedPost, s: MySquad) => {
    setBusy(true);
    const res = await removeFromSquad(p.id, s.id);
    close();
    if (!res) return fail(`Couldn't remove it from ${s.name}`);
    if (res === "deleted" || s.id === a.pickedSquadId) a.drop(p.id);
    else {
      const keep = p.squadIds.map((id, i) => [id, p.squadNames[i]] as const).filter(([id]) => id !== s.id);
      a.patch(p.id, { squadIds: keep.map(k => k[0]), squadNames: keep.map(k => k[1]) });
    }
    toast({ title: `Removed from ${s.name}` });
  };
  const sendReport = async (p: FeedPost, reason: ReportReason) => {
    const res = await report(a.uid, "post", p.id, reason);
    if (res === "ok" || res === "already") {
      close(); a.drop(p.id);
      toast({ title: res === "ok" ? "Report sent" : "Already reported", message: res === "ok" ? "Thanks. It's hidden for you now, and the squad owner has been told." : "It stays hidden for you." });
      return true;
    }
    toast(res === "signin" ? { title: "Sign in again", message: "Sign in again to send a report.", tone: "error" } : { title: "Couldn't send that report", message: "Check your connection and try again.", tone: "error" });
    return false;
  };

  const o = open;
  const ui = <>
    {o?.kind === "audience" ? <AudienceSheet key={o.post.id} post={o.post} uid={a.uid} squads={a.squads} onClose={close}
      onSaved={(visibility, ids) => { a.patch(o.post.id, { visibility, squadIds: ids, squadNames: ids.map(id => a.squads.find(s => s.id === id)?.name ?? "Squad") }); close(); toast({ title: "Saved", message: "Who can see it has changed." }); }} /> : null}
    {o?.kind === "rename" ? <RenameSheet key={o.post.id} post={o.post} onClose={close}
      onSaved={title => { a.patch(o.post.id, { title: title || null }); close(); toast({ title: "Run renamed" }); }} /> : null}
    {o?.kind === "report" ? <ReportSheet key={o.post.id} title="Report post" reasons={POST_REPORT_REASONS}
      sub={`Why are you reporting ${firstName(o.post.authorName)}'s post? They won't know it was you.`}
      onClose={close} onSubmit={r => sendReport(o.post, r)} /> : null}
    <Dialog open={o?.kind === "delete"} title="Delete this post?" onClose={close}
      actions={<><Button variant="secondary" onClick={close}>Cancel</Button><Button variant="destructive" loading={busy} onClick={() => o && confirmDelete(o.post)}>Delete post</Button></>}>
      <p className="t-body-s t-secondary" style={{ margin: 0 }}>It comes off your feed and every squad it&apos;s in. This can&apos;t be undone.</p>
    </Dialog>
    <Dialog open={o?.kind === "block"} title={o ? `Block ${o.post.authorName}?` : undefined} onClose={close}
      actions={<><Button variant="secondary" onClick={close}>Cancel</Button><Button variant="destructive" loading={busy} onClick={() => o && confirmBlock(o.post)}>Block</Button></>}>
      <p className="t-body-s t-secondary" style={{ margin: 0 }}>You won&apos;t see each other&apos;s posts or comments anywhere in pacr, and they won&apos;t be able to comment on or give kudos to yours. They aren&apos;t told. You can undo this in the pacr app.</p>
    </Dialog>
    <Dialog open={o?.kind === "remove"} title={o?.kind === "remove" ? `Remove from ${o.squad.name}?` : undefined} onClose={close}
      actions={<><Button variant="secondary" onClick={close}>Cancel</Button><Button variant="destructive" loading={busy} onClick={() => o?.kind === "remove" && confirmRemove(o.post, o.squad)}>Remove</Button></>}>
      <p className="t-body-s t-secondary" style={{ margin: 0 }}>{o?.kind === "remove" ? `Members of ${o.squad.name} won't see it any more. If that was the only place it was shared, it's deleted.` : null}</p>
    </Dialog>
  </>;

  return { items, select, ui };
}

/* ── Who can see this (the app's AudienceSheet) ── */

type Who = "public" | "followers" | "circle" | "only";
const whoOf = (v: Visibility, ids: string[]): Who => v === "circle" && ids.length === 0 ? "only" : v;

function AudienceSheet({ post, uid, squads, onClose, onSaved }:
  { post: FeedPost; uid: string; squads: MySquad[]; onClose: () => void; onSaved: (v: Visibility, ids: string[]) => void }) {
  const start = whoOf(post.visibility, post.squadIds);
  const [who, setWho] = useState<Who>(start);
  const [sel, setSel] = useState<string[]>(post.squadIds);
  const [followers, setFollowers] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let live = true; followerCount(uid).then(n => { if (live) setFollowers(n); }); return () => { live = false; }; }, [uid]);

  // Squads I can post in, plus any it's already in.
  const list = squads.filter(s => s.postingMode === "all" || isStaff(s) || post.squadIds.includes(s.id));
  const picked = sel.map(id => squads.find(s => s.id === id)?.name).filter(Boolean) as string[];
  const also = picked.length ? ` · also in ${picked.join(" and ")}` : "";
  const rows: [Who, string, string][] = [
    ["public", "Public", "Anyone on pacr" + also],
    ["followers", "Followers", (followers == null ? "Your followers" : `Your ${followers} follower${followers === 1 ? "" : "s"}`) + also],
    ["circle", "Squads", list.length ? "Only the squads you pick" : "You're not in a squad yet"],
    ["only", "Only you", "Nobody else sees it"],
  ];
  const noSquad = who === "circle" && sel.length === 0;
  const same = sel.length === post.squadIds.length && sel.every(id => post.squadIds.includes(id));
  const unchanged = who === start && (who === "only" || same);
  const canSave = !busy && !noSquad && !unchanged;

  const save = async () => {
    if (!canSave) return;
    const visibility: Visibility = who === "only" ? "circle" : who;
    const ids = who === "only" ? [] : sel;
    setBusy(true); setFailed(false);
    const ok = await setAudience(post.id, visibility, ids);
    setBusy(false);
    if (!ok) { setFailed(true); return; }
    onSaved(visibility, ids);
  };

  return <BottomSheet open title="Who can see this" onClose={onClose}
    footer={<Button block onClick={save} disabled={!canSave} loading={busy}>{noSquad ? "Pick a squad" : "Save"}</Button>}>
    <p className="t-body-s t-secondary" style={{ marginTop: 0 }}>Changes who sees it from now on. A squad you add gets it in its feed.</p>
    <div role="radiogroup" aria-label="Who can see this">
      {rows.map(([k, label, sub]) => <div key={k}>
        <Radio name="who" value={k} label={label} description={sub} checked={who === k} disabled={k === "circle" && !list.length} onChange={() => setWho(k)} />
        {who === k && k !== "only" && list.length ? <div style={{ paddingLeft: "var(--space-8)", paddingBottom: "var(--space-2)" }}>
          {k !== "circle" ? <div className="t-caption">Also post in these squads</div> : null}
          {list.map(s => <Checkbox key={s.id} label={s.name} checked={sel.includes(s.id)}
            onChange={on => setSel(x => on ? [...x, s.id] : x.filter(y => y !== s.id))} />)}
        </div> : null}
      </div>)}
    </div>
    {failed ? <FieldMessage tone="error">Couldn&apos;t save. Check your connection and try again.</FieldMessage> : null}
  </BottomSheet>;
}

/* ── Rename run (the app's TitleSheet, same 60-character cap) ── */

function RenameSheet({ post, onClose, onSaved }: { post: FeedPost; onClose: () => void; onSaved: (title: string) => void }) {
  const [text, setText] = useState(post.title ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<"blocked" | "error" | null>(null);
  const next = text.trim();
  const canSave = !busy && next.length > 0 && next !== (post.title ?? "").trim();
  const save = async () => {
    if (!canSave) return;
    setBusy(true); setFailed(null);
    const res = await setTitle(post.id, next);
    setBusy(false);
    if (res !== "ok") { setFailed(res); return; }
    onSaved(next);
  };
  return <BottomSheet open title="Rename run" onClose={onClose}
    footer={<Button block onClick={save} disabled={!canSave} loading={busy}>Save</Button>}>
    <p className="t-body-s t-secondary" style={{ marginTop: 0 }}>The new name shows on this post. To rename the run itself, use the app.</p>
    <form onSubmit={e => { e.preventDefault(); save(); }}>
      <Input label="Run name" value={text} maxLength={60} autoFocus placeholder="Name your run"
        onChange={e => { setText(e.target.value); setFailed(null); }}
        error={failed === "blocked" ? "That name can't be posted. Try another." : failed === "error" ? "Couldn't save. Check your connection and try again." : undefined} />
    </form>
  </BottomSheet>;
}

/* ── Report (post or comment) ── */

export function ReportSheet({ title, sub, reasons, onClose, onSubmit }:
  { title: string; sub: string; reasons: { value: ReportReason; label: string }[]; onClose: () => void; onSubmit: (r: ReportReason) => Promise<boolean> }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => { if (!reason || busy) return; setBusy(true); const ok = await onSubmit(reason); if (!ok) setBusy(false); };
  return <BottomSheet open title={title} onClose={onClose}
    footer={<Button block variant="destructive" onClick={send} disabled={!reason} loading={busy}>Send report</Button>}>
    <p className="t-body-s t-secondary" style={{ marginTop: 0 }}>{sub}</p>
    <RadioGroup name="reason" label="Reason" value={reason ?? ""} onChange={v => setReason(v as ReportReason)}
      options={reasons.map(r => ({ value: r.value, label: r.label }))} />
  </BottomSheet>;
}
