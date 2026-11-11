"use client";
// A post's thread on /feed/<ref>, like the app's CommentsThread
// (src/components/feed/Comments.tsx): top-level comments oldest first, each
// with its replies under it (one level; a reply to a reply joins the
// top-level comment), comment kudos, the Runner tag on the post author's
// words, Delete on your own and Report on everyone else's. The composer holds
// plain "@Name" text; suggestions are the members of the post's squads and
// serializeMentions turns the names into tokens when it's sent.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ds/core";
import { CommentComposer, CommentRow } from "@/components/ds/content";
import { EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { ChipSelect } from "@/components/ds/forms";
import { Dialog, useToast } from "@/components/ds/overlays";
import { MentionText } from "@/components/site/MentionText";
import { activeMentionQuery, countPlainMentions, insertMention, MAX_MENTIONS_PER_BODY, serializeMentions } from "@/lib/mentions";
import { useSigned } from "@/lib/storage";
import { ago } from "@/lib/time";
import {
  addComment, deleteComment, firstName, listComments, report, REPORT_REASONS, runnerHref, setCommentKudos, squadMembers,
  type FeedComment, type FeedPost, type Member, type ReportReason,
} from "@/lib/feed";
import { ReportSheet } from "./FeedPost";

export function Comments({ post, uid, me, now, onCount }:
  { post: FeedPost; uid: string; me: { name: string; avatarPath: string | null; avatar: string | null }; now: number; onCount: (delta: number) => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<FeedComment[] | null | "error">(null);
  const [retry, setRetry] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState("");
  const [caret, setCaret] = useState(0);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<FeedComment | null>(null);
  const [deleting, setDeleting] = useState<FeedComment | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    listComments(post.id, uid).then(r => { if (live) setRows(r ?? "error"); });
    return () => { live = false; };
  }, [post.id, uid, retry]);

  const squadKey = post.squadIds.join(",");
  useEffect(() => {
    let live = true;
    squadMembers(squadKey ? squadKey.split(",") : []).then(m => { if (live) setMembers(m.filter(x => x.userId !== uid)); });
    return () => { live = false; };
  }, [squadKey, uid]);

  const list = useMemo(() => Array.isArray(rows) ? rows : [], [rows]);
  const avatars = useSigned("avatars", list.map(c => c.authorAvatarPath));

  const query = activeMentionQuery(draft, caret);
  const suggestions = query === null || countPlainMentions(draft, members) >= MAX_MENTIONS_PER_BODY ? []
    : members.filter(m => m.displayName.toLowerCase().includes(query.toLowerCase())).slice(0, 5);

  const textarea = () => box.current?.querySelector("textarea") ?? null;
  const readCaret = () => { const t = textarea(); if (t) setCaret(t.selectionEnd ?? t.value.length); };
  const pick = (m: Member) => {
    const next = insertMention(draft, caret, m);
    setDraft(next.body); setCaret(next.caret);
    requestAnimationFrame(() => { const t = textarea(); if (t) { t.focus(); t.setSelectionRange(next.caret, next.caret); } });
  };
  const startReply = (c: FeedComment) => {
    setReplyTo({ id: c.parentId ?? c.id, name: c.isMine ? "yourself" : c.authorName });
    requestAnimationFrame(() => textarea()?.focus());
  };

  const patch = (id: string, p: Partial<FeedComment>) => setRows(r => Array.isArray(r) ? r.map(x => x.id === id ? { ...x, ...p } : x) : r);
  const kudos = async (c: FeedComment) => {
    const on = !c.likedByMe;
    patch(c.id, { likedByMe: on, likeCount: Math.max(0, c.likeCount + (on ? 1 : -1)) });
    if (!(await setCommentKudos(c.id, uid, on))) patch(c.id, { likedByMe: c.likedByMe, likeCount: c.likeCount });
  };
  const drop = (id: string) => {
    const n = list.filter(x => x.id === id || x.parentId === id).length;
    setRows(r => Array.isArray(r) ? r.filter(x => x.id !== id && x.parentId !== id) : r);
    onCount(-n);
  };

  const send = async () => {
    const typed = draft.trim();
    if (!typed || sending) return;
    setSending(true);
    const res = await addComment(post.id, uid, serializeMentions(typed, members), replyTo?.id ?? null);
    setSending(false);
    if (!res.ok) {
      toast(res.reason === "blocked"
        ? { title: "That won't post", message: "That word isn't welcome here. Edit it out and post again.", tone: "error" }
        : { title: "Your comment didn't post", message: "Check your connection and try again.", tone: "error" });
      return;
    }
    const added: FeedComment = { ...res.comment, authorName: me.name, authorAvatarPath: me.avatarPath, isPostAuthor: post.isMine };
    setRows(r => {
      const l = Array.isArray(r) ? r : [];
      if (!added.parentId) return [...l, added];
      let at = l.findIndex(x => x.id === added.parentId);
      if (at < 0) return [...l, added];
      while (at + 1 < l.length && l[at + 1].parentId === added.parentId) at++;
      return [...l.slice(0, at + 1), added, ...l.slice(at + 1)];
    });
    setDraft(""); setCaret(0); setReplyTo(null);
    onCount(1);
  };

  const confirmDelete = async (c: FeedComment) => {
    setBusy(true);
    const ok = await deleteComment(c.id);
    setBusy(false); setDeleting(null);
    if (!ok) { toast({ title: "Couldn't delete that comment", message: "Check your connection and try again.", tone: "error" }); return; }
    drop(c.id);
  };
  const sendReport = async (c: FeedComment, reason: ReportReason) => {
    const res = await report(uid, "comment", c.id, reason);
    if (res === "ok" || res === "already") {
      setReporting(null); drop(c.id);
      toast({ title: res === "ok" ? "Report sent" : "Already reported", message: res === "ok" ? "Thanks. That comment is hidden for you now." : "It stays hidden for you." });
      return true;
    }
    toast(res === "signin" ? { title: "Sign in again", message: "Sign in again to send a report.", tone: "error" } : { title: "Couldn't send that report", message: "Check your connection and try again.", tone: "error" });
    return false;
  };

  const repliesOf = (c: FeedComment) => list.filter(x => x.parentId === c.id).length;

  return <>
    <h2 className="t-h4" style={{ marginBottom: "var(--space-2)" }}>Comments{list.length ? ` · ${list.length}` : ""}</h2>
    {rows === null ? <Skeleton lines={3} />
      : rows === "error" ? <ErrorState title="Comments didn't load." body="Check your connection and try again." onRetry={() => { setRows(null); setRetry(x => x + 1); }} />
      : !list.length ? <EmptyState icon="message-circle" title="No comments yet." body={post.canReply ? "Say something nice about the run." : undefined} />
      : <div>{list.map(c => <CommentRow key={c.id} indent={!!c.parentId && list.some(x => x.id === c.parentId)}
          author={{ name: c.authorName, avatar: c.authorAvatarPath ? avatars.get(c.authorAvatarPath) ?? null : c.isMine ? me.avatar : null, href: runnerHref(null, c.authorId) }}
          time={ago(c.createdAt, now)} text={<MentionText body={c.body} />} tag={c.isPostAuthor ? "Runner" : undefined} hidden={c.hidden}
          kudos={c.likeCount} kudosGiven={c.likedByMe} onKudos={() => kudos(c)}
          onReply={post.canReply ? () => startReply(c) : undefined}
          own={c.isMine} onDelete={() => setDeleting(c)} onReport={() => setReporting(c)} />)}</div>}

    <div style={{ marginTop: "var(--space-4)" }} ref={box} onKeyUp={readCaret} onClick={readCaret}>
      {post.canReply ? <CommentComposer name={me.name} avatar={me.avatar} value={draft} busy={sending} onSubmit={send}
        placeholder={replyTo ? `Reply to ${firstName(replyTo.name)}` : "Add a comment"}
        replyingTo={replyTo?.name ?? null} onCancelReply={() => setReplyTo(null)}
        onChange={v => { setDraft(v); readCaret(); }}
        suggestions={suggestions.length ? <div style={{ marginBottom: "var(--space-2)" }}>
          <ChipSelect multi={false} label="Mention a squadmate" value={[]} options={suggestions.map(m => ({ id: m.userId, label: "@" + m.displayName }))}
            onChange={v => { const m = members.find(x => x.userId === v[0]); if (m) pick(m); }} /></div> : null} />
        : <p className="t-caption" style={{ margin: 0 }}>Replies are open to squadmates and followers.</p>}
    </div>

    {reporting ? <ReportSheet key={reporting.id} title="Report comment" reasons={REPORT_REASONS}
      sub={`Why are you reporting ${firstName(reporting.authorName)}'s comment? They won't know it was you.`}
      onClose={() => setReporting(null)} onSubmit={r => sendReport(reporting, r)} /> : null}
    <Dialog open={!!deleting} title="Delete this comment?" onClose={() => setDeleting(null)}
      actions={<><Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
        <Button variant="destructive" loading={busy} onClick={() => deleting && confirmDelete(deleting)}>Delete</Button></>}>
      <p className="t-body-s t-secondary" style={{ margin: 0 }}>{deleting && repliesOf(deleting) ? "Its replies go with it. This can't be undone." : "This can't be undone."}</p>
    </Dialog>
  </>;
}
