"use client";
// /notifications: the app's notifications sheet (src/components/feed/Sheets.tsx)
// as a page, on list_notifications and mark_notifications_read. Grouped by
// day in IST; a row marks itself read, then opens what it's about.
import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { FEED_ON_WEB } from "@/lib/config";
import { Avatar, Badge, Button, Icon } from "@/components/ds/core";
import { EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { LoadMore } from "@/components/ds/nav";
import { useToast } from "@/components/ds/overlays";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { ago } from "@/lib/time";
import { ICON, PAGE, activityText, dayGroup, eventText, hrefOf, listNotifications, markRead, type Note } from "@/lib/notifications";

export function NotificationsPage() {
  return <RequireSignIn title="Sign in to see your notifications" body="Kudos, comments and squad news land here.">
    {() => <Inbox />}
  </RequireSignIn>;
}

function Inbox() {
  const toast = useToast();
  const [items, setItems] = useState<Note[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [now, setNow] = useState(0);

  const [key, setKey] = useState(0);

  useEffect(() => {
    let alive = true;
    listNotifications(null).then(page => {
      if (alive) { setItems(page); setMore(page.length === PAGE); setFailed(false); setNow(Date.now()); }
    }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [key]);

  async function loadMore() {
    if (!items?.length) return;
    setLoadingMore(true);
    try {
      const page = await listNotifications(items[items.length - 1].createdAt);
      const seen = new Set(items.map(x => x.id));
      setItems([...items, ...page.filter(x => !seen.has(x.id))]); setMore(page.length === PAGE);
    } catch { toast({ title: "Couldn't load more", message: "Check your connection and try again.", tone: "error" }); }
    setLoadingMore(false);
  }

  async function markAll() {
    const before = items;
    setItems(x => x && x.map(n => ({ ...n, unread: false })));
    if (!(await markRead(null))) { setItems(before); toast({ title: "Couldn't mark them read", message: "Check your connection and try again.", tone: "error" }); }
  }

  async function open(e: MouseEvent<HTMLAnchorElement>, n: Note, href: string) {
    if (!n.unread || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setItems(x => x && x.map(y => (y.id === n.id ? { ...y, unread: false } : y)));
    await Promise.race([markRead(n.ids), new Promise(r => setTimeout(r, 1500))]);
    window.location.href = href;
  }

  async function readOnly(n: Note) {
    if (!n.unread) return;
    setItems(x => x && x.map(y => (y.id === n.id ? { ...y, unread: false } : y)));
    await markRead(n.ids);
  }

  const groups = useMemo(() => {
    const out: { label: string; items: Note[] }[] = [];
    for (const n of items ?? []) {
      const label = dayGroup(n.createdAt, now);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(n); else out.push({ label, items: [n] });
    }
    return out;
  }, [items, now]);
  const anyUnread = (items ?? []).some(n => n.unread);

  return <div className="pw-container" style={{ paddingTop: 24, paddingBottom: 64, maxWidth: 720 }}>
    <div className="sec-h"><h1 className="t-h1">Notifications</h1>
      {anyUnread ? <Button variant="ghost" size="sm" icon="check-check" onClick={() => void markAll()}>Mark all read</Button> : null}</div>
    {failed && !items ? <ErrorState title="We couldn't load your notifications" body="Check your connection, then try again." onRetry={() => setKey(k => k + 1)} />
      : !items ? <div className="stack">{[0, 1, 2, 3].map(i => <Skeleton key={i} variant="runner" />)}</div>
      : !items.length ? <EmptyState boxed icon="bell" title="No notifications yet." body="Kudos, comments and squad news land here." action={FEED_ON_WEB ? "Go to your feed" : "Your squads"} href={FEED_ON_WEB ? "/feed" : "/squads"} />
      : <>
        {groups.map(g => <section key={g.label} className="block" aria-label={g.label} style={{ gap: 4, marginBottom: "var(--space-6)" }}>
          <h2 className="t-overline" style={{ margin: "0 0 4px" }}>{g.label}</h2>
          {g.items.map(n => <Row key={n.id} n={n} now={now} onOpen={open} onRead={readOnly} />)}
        </section>)}
        <LoadMore onClick={() => void loadMore()} loading={loadingMore} hasMore={more} label="Show older" endLabel="That's everything" />
      </>}
  </div>;
}

function Row({ n, now, onOpen, onRead }: { n: Note; now: number; onOpen: (e: MouseEvent<HTMLAnchorElement>, n: Note, href: string) => void; onRead: (n: Note) => void }) {
  const href = hrefOf(n);
  const who = n.actorName ?? (n.kind === "announcement" ? n.circleName : null) ?? n.annTitle ?? "pacr";
  const event = n.kind === "event_cancelled" || n.kind === "event_refunded";
  const [pre, title, post] = event ? eventText(n) : ["", "", ""];
  const text = event ? <>{pre}<b>{title}</b>{post}</>
    : n.kind === "announcement" ? <><b>{n.circleName ?? "Your squad"}</b> posted an announcement: <b>{n.annTitle || "Untitled"}</b>{n.annBody ? <span className="t-secondary"> · {n.annBody.length > 120 ? n.annBody.slice(0, 119) + "…" : n.annBody}</span> : null}</>
    : <><b>{n.actorName ?? "Someone"}</b> {activityText(n)}</>;
  const body = <>
    <Avatar name={who} src={n.actorAvatar} size={40} />
    <span style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
      <span style={{ display: "block" }}>{text}</span>
      <span className="t-caption" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name={ICON[n.kind] ?? "bell"} size={14} />{ago(n.createdAt, now)}</span>
    </span>
    {n.unread ? <Badge tone="accent" variant="solid" size="sm">New</Badge> : null}
  </>;
  const style: CSSProperties = { alignItems: "flex-start", background: n.unread ? "var(--surface-1)" : undefined };
  return href
    ? <a className="pw-listrow" href={href} style={style} onClick={e => onOpen(e, n, href)}>{body}</a>
    : <div className="pw-listrow" role={n.unread ? "button" : undefined} tabIndex={n.unread ? 0 : undefined} style={{ ...style, cursor: n.unread ? "pointer" : "default" }}
      onClick={() => onRead(n)} onKeyDown={e => { if (e.key === "Enter") onRead(n); }}>{body}</div>;
}
