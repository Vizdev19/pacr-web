"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Avatar, Badge, Button, DataTable, Dialog, EmptyState, GlassCard, IconButton, Input, Tabs } from "@/components/ds";
import { LoadError, RowsSkeleton, kMuted } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { ago, day, firstName } from "@/lib/format";
import { useLoad, useViewport } from "@/lib/hooks";
import { useHost } from "@/lib/host";

type Tab = "reports" | "banned" | "rules";

export function Moderation() {
  const { host } = useHost();
  if (host.kind !== "squad") return null;
  return <ModerationFor key={host.key} circleId={host.id} squadKey={host.key} squadName={host.name} />;
}

function ModerationFor({ circleId, squadKey, squadName }: { circleId: string; squadKey: string; squadName: string }) {
  const params = useSearchParams();
  const q = params.get("tab");
  const [tab, setTab] = useState<Tab>(q === "rules" ? "rules" : q === "banned" ? "banned" : "reports");
  const reports = useLoad(() => api.listReports(circleId), `reports:${squadKey}`);
  const bans = useLoad(async (): Promise<BanRow[]> => {
    const list = await api.listBans(circleId);
    const urls = await api.signedUrls("avatars", list.map(b => b.avatar_path));
    return list.map(b => ({ ...b, src: b.avatar_path ? urls.get(b.avatar_path) : undefined }));
  }, `bans:${squadKey}`);

  return (
    <div>
      <Tabs value={tab} onChange={v => setTab(v as Tab)} style={{ marginBottom: 14 }} tabs={[
        { value: "reports", label: "Reports", count: reports.status === "ready" ? reports.data.length : null },
        { value: "banned", label: "Banned", count: bans.status === "ready" ? bans.data.length : null },
        { value: "rules", label: "Rules & join questions" },
      ]} />
      {tab === "reports" ? <Reports circleId={circleId} squadName={squadName} x={reports} /> : tab === "banned" ? <Banned circleId={circleId} x={bans} /> : <Rules circleId={circleId} squadKey={squadKey} />}
    </div>
  );
}

// ── Reports ────────────────────────────────────────────────────────────────

// The app's reason codes and words (src/services/moderation.ts).
const REASONS: Record<string, string> = {
  harassment: "Harassment or bullying", spam: "Spam or a scam", hate: "Hate speech", sexual: "Sexual content",
  violence: "Violence or threats", self_harm: "Self-harm", other: "Something else",
  fake_activity: "Fake or inaccurate activity", inappropriate: "Inappropriate content",
};
const POST_REASONS: Record<string, string> = { spam: "Spam or misleading" };
function reasonLabel(r: api.Report): string {
  const known = (r.targetType === "post" ? POST_REASONS[r.reason] : undefined) ?? REASONS[r.reason];
  if (known) return known;
  const t = r.reason.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Reported";
}
const KIND: Record<api.ReportKind, string> = { post: "Post", comment: "Comment", message: "Chat message", user: "Runner" };

type Pending = { report: api.Report; kind: "remove" | "ban" };

function Reports({ circleId, squadName, x }: { circleId: string; squadName: string; x: ReturnType<typeof useLoad<api.Report[]>> }) {
  const { me, notify, notifyError, refreshCounts } = useHost();
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const drop = (r: api.Report) => { x.set(cur => cur.filter(y => y.key !== r.key)); refreshCounts(); };

  async function keep(r: api.Report) {
    setBusy(r.key);
    try {
      await api.resolveReports(r.openReportIds, "dismissed");
      notify("neutral", "Kept", "The reports are closed.");
      drop(r);
    } catch (e) { notifyError("Couldn’t keep it", e); } finally { setBusy(null); }
  }
  async function run() {
    if (!pending) return;
    const { report: r, kind } = pending;
    setBusy(r.key);
    try {
      if (kind === "remove") {
        await api.removeReported(r, circleId);
        await api.resolveReports(r.openReportIds, "actioned");
        notify("success", "Removed", r.targetType === "post" ? "It’s off the squad’s feed." : "It’s deleted.");
      } else if (r.authorId) {
        if (r.targetType !== "user") await api.removeReported(r, circleId);
        await api.removeMember(circleId, r.authorId, true);
        await api.resolveReports(r.openReportIds, "actioned");
        notify("danger", `${r.authorName ?? "The runner"} banned`, "They can’t see or rejoin the squad.");
      }
      setPending(null);
      drop(r);
    } catch (e) {
      notifyError(kind === "ban" ? "Couldn’t ban" : "Couldn’t remove", e);
    } finally { setBusy(null); }
  }

  if (x.status === "loading") return <RowsSkeleton rows={3} />;
  if (x.status === "error") return <LoadError what="reports" error={x.error} onRetry={x.reload} />;
  if (!x.data.length) return <EmptyState variant="done" title="No reports waiting" message="When members report a post, comment or chat message it lands here." />;

  const p = pending?.report;
  const thing = p ? (p.targetType === "post" ? "post" : p.targetType === "comment" ? "comment" : p.targetType === "message" ? "message" : "profile") : "";
  const name = p?.authorName ?? "this runner";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {x.data.map(r => (
        <GlassCard key={r.key} padding={16}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="red" icon="flag">{r.reportCount} {r.reportCount === 1 ? "report" : "reports"}</Badge>
                <Badge tone="neutral">{reasonLabel(r)}</Badge>
                <span style={kMuted}>{KIND[r.targetType]} · {ago(r.createdAt)}</span>
                {r.hidden ? <Badge tone="neutral" variant="outline">Already hidden</Badge> : null}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12, padding: 12, borderRadius: 10, background: "var(--surface-panel)" }}>
                <Avatar name={r.authorName ?? "A runner"} size={28} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "500 13px var(--font-sans)", color: "var(--text-strong)" }}>{r.authorName ?? "A runner"}</div>
                  {r.body && r.body.trim() ? (
                    <div style={{ font: "400 13px/1.45 var(--font-sans)", color: "var(--text-body)", marginTop: 2, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{r.body}</div>
                  ) : (
                    <div style={{ ...kMuted, marginTop: 2 }}>{r.isMedia ? "Photo or run post. Open it in the app to see it." : "No text"}</div>
                  )}
                </div>
              </div>
              {r.note ? <div style={{ ...kMuted, marginTop: 8 }}>Note from a reporter: {r.note}</div> : null}
            </div>
            <div style={{ display: "flex", gap: 6, alignSelf: "center", flexWrap: "wrap" }}>
              <Button size="sm" variant="secondary" disabled={busy === r.key} onClick={() => keep(r)}>Keep</Button>
              {r.targetType !== "user" ? <Button size="sm" icon="trash-2" disabled={busy === r.key} onClick={() => setPending({ report: r, kind: "remove" })}>Remove</Button> : null}
              {r.authorId && r.authorId !== me.id ? <Button size="sm" variant="danger" icon="ban" disabled={busy === r.key} onClick={() => setPending({ report: r, kind: "ban" })}>Ban author</Button> : null}
            </div>
          </div>
        </GlassCard>
      ))}

      <Dialog open={!!pending} onClose={() => (busy ? undefined : setPending(null))} icon={pending?.kind === "ban" ? "ban" : "trash-2"} tone="danger"
        title={pending?.kind === "ban" ? `Ban ${name}?` : `Remove this ${thing}?`}
        description={pending?.kind === "ban"
          ? `They’re removed from ${squadName} and can’t see or rejoin it.${p?.targetType !== "user" ? ` Their reported ${thing} is removed too.` : ""}`
          : p?.targetType === "post" ? "It leaves the squad’s feed. Members can’t see it here any more." : `It’s deleted for everyone in the squad.`}
        footer={<>
          <Button variant="ghost" disabled={!!busy} onClick={() => setPending(null)}>{pending?.kind === "ban" ? `Keep ${firstName(p?.authorName)}` : "Keep it"}</Button>
          <Button variant="danger" icon={pending?.kind === "ban" ? "ban" : "trash-2"} loading={!!busy} onClick={run}>{pending?.kind === "ban" ? `Ban ${firstName(p?.authorName)}` : "Remove"}</Button>
        </>} />
    </div>
  );
}

// ── Banned ─────────────────────────────────────────────────────────────────

type BanRow = api.Ban & { src?: string };

function Banned({ circleId, x }: { circleId: string; x: ReturnType<typeof useLoad<BanRow[]>> }) {
  const { notify, notifyError } = useHost();
  const { phone } = useViewport();
  const [busy, setBusy] = useState<string | null>(null);

  async function unban(b: BanRow) {
    setBusy(b.user_id);
    try {
      await api.unbanMember(circleId, b.user_id);
      notify("success", "Unbanned", `${b.display_name ?? "The runner"} can find and join the squad again.`);
      x.set(cur => cur.filter(y => y.user_id !== b.user_id));
    } catch (e) { notifyError("Couldn’t unban", e); } finally { setBusy(null); }
  }

  if (x.status === "loading") return <RowsSkeleton rows={3} />;
  if (x.status === "error") return <LoadError what="banned runners" error={x.error} onRetry={x.reload} />;
  if (!x.data.length) return <EmptyState variant="done" title="Nobody is banned" message="Runners you ban from a report or the member list show up here." />;
  const who = (b: BanRow) => <span style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}><Avatar name={b.display_name ?? "A runner"} src={b.src} size={28} /><span>{b.display_name ?? "A runner"}</span></span>;
  return (
    <GlassCard flush>
      {phone ? (
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {x.data.map(b => (
            <div key={b.user_id} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
              <div style={{ minWidth: 0 }}>{who(b)}<div style={{ ...kMuted, marginTop: 4 }}>Banned {day(b.created_at)}</div></div>
              <Button size="sm" variant="secondary" loading={busy === b.user_id} onClick={() => unban(b)}>Unban</Button>
            </div>
          ))}
        </div>
      ) : (
        <DataTable rows={x.data} rowKey="user_id" columns={[
          { key: "name", header: "Runner", render: who },
          { key: "when", header: "Banned", render: b => day(b.created_at) },
          { key: "x", header: "", align: "right", render: b => <Button size="sm" variant="secondary" loading={busy === b.user_id} onClick={() => unban(b)}>Unban</Button> },
        ]} />
      )}
    </GlassCard>
  );
}

// ── Rules & join questions ─────────────────────────────────────────────────

function Rules({ circleId, squadKey }: { circleId: string; squadKey: string }) {
  const x = useLoad(() => api.squadDetail(circleId), `rules:${squadKey}`);
  if (x.status === "loading") return <RowsSkeleton rows={3} />;
  if (x.status === "error") return <LoadError what="rules" error={x.error} onRetry={x.reload} />;
  if (!x.data) return <EmptyState variant="locked" title="Rules aren’t available" message="You’re not a member of this squad any more." />;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 12, alignItems: "start" }}>
      <ListCard circleId={circleId} field="rules" title="Squad rules" subtitle="Shown when someone joins" initial={x.data.rules ?? []} max={5} maxLen={140}
        addLabel="Add rule" placeholder="Every pace is welcome" saveLabel="Save rules" savedTitle="Rules saved" savedMsg="Members see the update next time they open the squad." />
      <ListCard circleId={circleId} field="join_questions" title="Join questions" subtitle="Answers appear on every join request" initial={x.data.join_questions ?? []} max={3} maxLen={120}
        addLabel="Add question" placeholder="Your usual pace?" saveLabel="Save questions" savedTitle="Questions saved" savedMsg="New join requests include the answers." />
    </div>
  );
}

function ListCard({ circleId, field, title, subtitle, initial, max, maxLen, addLabel, placeholder, saveLabel, savedTitle, savedMsg }: {
  circleId: string; field: "rules" | "join_questions"; title: string; subtitle: string; initial: string[]; max: number; maxLen: number;
  addLabel: string; placeholder: string; saveLabel: string; savedTitle: string; savedMsg: string;
}) {
  const { notify, notifyError } = useHost();
  const [items, setItems] = useState<string[]>(initial);
  const [saved, setSaved] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const clean = items.map(s => s.trim()).filter(Boolean);
  const dirty = JSON.stringify(clean) !== JSON.stringify(saved);

  async function save() {
    setBusy(true);
    try {
      await api.updateSquad(circleId, { [field]: clean });
      setSaved(clean);
      setItems(clean);
      notify("success", savedTitle, savedMsg);
    } catch (e) { notifyError("Couldn’t save", e); } finally { setBusy(false); }
  }

  return (
    <GlassCard title={title} subtitle={subtitle}
      actions={<Button size="sm" variant="secondary" icon="plus" disabled={items.length >= max} onClick={() => setItems(l => [...l, ""])}>{addLabel}</Button>}>
      {items.length === 0 ? <div style={kMuted}>Nothing added yet.</div> : items.map((v, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 32px", gap: 8, alignItems: "center", padding: "5px 0" }}>
          <Input size="sm" value={v} maxLength={maxLen} placeholder={placeholder} aria-label={`${title} ${i + 1}`}
            onChange={e => setItems(l => l.map((y, j) => (j === i ? e.target.value : y)))} />
          <IconButton icon="x" label="Remove" size="sm" onClick={() => setItems(l => l.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span style={kMuted}>{items.length} of {max}</span>
        <Button size="sm" loading={busy} disabled={!dirty} onClick={save}>{saveLabel}</Button>
      </div>
    </GlassCard>
  );
}
