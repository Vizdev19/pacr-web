"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AudiencePicker, Button, Dialog, EmptyState, GlassCard, Icon, IconButton, Input, Switch } from "@/components/ds";
import { LoadError, RowsSkeleton, Toolbar, kMuted, kStrong, kTextarea } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { dayTime, num, plural } from "@/lib/format";
import { useLoad, useViewport } from "@/lib/hooks";
import { useHost } from "@/lib/host";

export function Messages() {
  const { host } = useHost();
  if (host.kind !== "squad") return null;
  return <MessagesFor key={host.key} circleId={host.id} squadKey={host.key} />;
}

function MessagesFor({ circleId, squadKey }: { circleId: string; squadKey: string }) {
  const { notify, notifyError } = useHost();
  const { phone } = useViewport();
  const router = useRouter();
  const params = useSearchParams();
  const [composing, setComposing] = useState(() => params.get("new") === "1");
  const [deleting, setDeleting] = useState<api.Announcement | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get("new") === "1") router.replace("/messages");
  }, [params, router]);

  const x = useLoad(async () => {
    const [announcements, detail, pinned] = await Promise.all([
      api.listAnnouncements(circleId), api.squadDetail(circleId), api.listPinned(circleId),
    ]);
    return { announcements, detail, pinned };
  }, `messages:${squadKey}`);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.deleteAnnouncement(deleting.id);
      notify("success", "Announcement deleted", `“${deleting.title}” is gone from the squad’s announcements.`);
      setDeleting(null);
      x.reload();
    } catch (e) {
      notifyError("Couldn’t delete", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Toolbar>
        <span style={{ ...kMuted, flex: 1 }}>Announcements go to every member as a push and sit in the squad’s announcements.</span>
        <Button icon="megaphone" onClick={() => setComposing(true)}>New announcement</Button>
      </Toolbar>
      {x.status === "loading" ? <RowsSkeleton rows={5} /> : x.status === "error" ? (
        <LoadError what="messages" error={x.error} onRetry={x.reload} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1.7fr) minmax(300px,1fr)", gap: 12, alignItems: "start" }}>
          <GlassCard flush title="Sent">
            {x.data.announcements.length === 0 ? (
              <div style={{ padding: 16 }}>
                <EmptyState icon="megaphone" title="No announcements yet" message="Tell the whole squad something once: rain plans, a new route, a change of start time."
                  action={{ label: "New announcement", icon: "megaphone", onClick: () => setComposing(true) }} />
              </div>
            ) : phone ? (
              <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {x.data.announcements.map(a => (
                  <div key={a.id} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border-default)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <span style={kStrong}>{a.title}</span>
                      <IconButton icon="trash-2" label="Delete" size="sm" onClick={() => setDeleting(a)} />
                    </div>
                    {a.body ? <div style={{ ...kMuted, marginTop: 4 }}>{snippet(a.body)}</div> : null}
                    <div style={{ ...kMuted, marginTop: 4 }}>{a.authorName ?? "A host"} · {dayTime(a.created_at)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pc-table-wrap"><table className="pc-table">
                <thead><tr><th>Announcement</th><th>From</th><th>When</th><th /></tr></thead>
                <tbody>
                  {x.data.announcements.map(a => (
                    <tr key={a.id}>
                      <td><span style={{ ...kStrong, display: "block" }}>{a.title}</span>{a.body ? <span style={kMuted}>{snippet(a.body)}</span> : null}</td>
                      <td>{a.authorName ?? "A host"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{dayTime(a.created_at)}</td>
                      <td style={{ textAlign: "right" }}><IconButton icon="trash-2" label="Delete" size="sm" onClick={() => setDeleting(a)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </GlassCard>
          <ChatCard circleId={circleId} detail={x.data.detail} pinned={x.data.pinned}
            onChat={chat => x.set(cur => ({ ...cur, detail: cur.detail ? { ...cur.detail, chat_enabled: chat } : cur.detail }))} reload={x.reload} />
        </div>
      )}

      <Composer open={composing} onClose={() => setComposing(false)} circleId={circleId} members={x.status === "ready" ? x.data.detail?.member_count ?? 0 : 0}
        onSent={() => { setComposing(false); x.reload(); }} />

      <Dialog open={!!deleting} onClose={() => (busy ? undefined : setDeleting(null))} icon="trash-2" tone="danger"
        title={`Delete “${deleting?.title ?? ""}”?`} description="It disappears from the squad’s announcements. Pushes already sent stay sent."
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>Keep it</Button><Button variant="danger" icon="trash-2" loading={busy} onClick={confirmDelete}>Delete announcement</Button></>} />
    </div>
  );
}

const snippet = (s: string) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > 90 ? `${t.slice(0, 90).trimEnd()}…` : t; };

function ChatCard({ circleId, detail, pinned, onChat, reload }: {
  circleId: string; detail: api.SquadDetail | null; pinned: api.PinnedMessage[]; onChat: (on: boolean) => void; reload: () => void;
}) {
  const { notify, notifyError } = useHost();
  const [busy, setBusy] = useState(false);
  const on = detail?.chat_enabled ?? false;

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      await api.updateSquad(circleId, { chat_enabled: next });
      onChat(next);
      notify("success", next ? "Chat turned on" : "Chat turned off");
    } catch (e) {
      notifyError("Couldn’t change the chat", e);
    } finally {
      setBusy(false);
    }
  }
  async function unpin(m: api.PinnedMessage) {
    try {
      await api.unpinMessage(m.id);
      notify("success", "Unpinned", "It’s off the top of the squad chat.");
      reload();
    } catch (e) {
      notifyError("Couldn’t unpin", e);
    }
  }

  return (
    <GlassCard title="Squad chat">
      <Switch checked={on} disabled={busy || !detail} onChange={toggle} label={on ? "Squad chat is on" : "Squad chat is off"} />
      <div style={{ height: 1, background: "var(--border-subtle)", margin: "14px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", ...kStrong, marginBottom: 8 }}>Pinned <span style={kMuted}>{pinned.length} of 3</span></div>
      {pinned.length === 0 ? (
        <div style={kMuted}>Nothing pinned. Press and hold a message in the app’s squad chat to pin it.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pinned.map(p => (
            <div key={p.id} style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--surface-panel)", font: "400 12px/1.4 var(--font-sans)", color: "var(--text-body)" }}>
              <Icon name="pin" size={13} style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{p.body}<span style={{ ...kMuted, display: "block", marginTop: 2 }}>by {p.authorName ?? "A runner"}</span></span>
              <IconButton icon="x" label="Unpin" size="sm" style={{ width: 22, height: 22 }} onClick={() => unpin(p)} />
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function Composer({ open, onClose, circleId, members, onSent }: { open: boolean; onClose: () => void; circleId: string; members: number; onSent: () => void }) {
  const { notify, notifyError } = useHost();
  const { phone } = useViewport();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await api.createAnnouncement(circleId, title, body);
      notify("success", "Announcement sent", `“${title.trim()}” · ${plural(members, "runner")}`);
      setTitle(""); setBody("");
      onSent();
    } catch (e) {
      notifyError("Couldn’t send", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} icon="megaphone" title="New announcement" width={880}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Not now</Button><Button icon="send" disabled={!title.trim()} loading={busy} onClick={send}>Send to {num(members)}</Button></>}>
      <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1.1fr) minmax(0,1fr)", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Title" placeholder="Rain plan for Saturday" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} />
          <label className="pc-field"><span className="pc-label">Message</span>
            <textarea rows={7} style={kTextarea} value={body} onChange={e => setBody(e.target.value)} placeholder="Add the details members need." /></label>
        </div>
        <div>
          <div className="pc-label" style={{ marginBottom: 8 }}>Audience</div>
          <AudiencePicker options={[{ id: "all", label: "Everyone in the squad", count: members, icon: "users" }]} value="all" />
          <div style={{ ...kMuted, marginTop: 8 }}>Every member gets a push and an inbox item.</div>
        </div>
      </div>
    </Dialog>
  );
}
