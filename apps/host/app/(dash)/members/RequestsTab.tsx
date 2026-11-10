"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Button, Checkbox, EmptyState, GlassCard } from "@/components/ds";
import { answerJoinRequest, listJoinRequests, signedUrls, type JoinRequest } from "@/lib/api";
import { ago, plural } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad } from "@/lib/hooks";
import { kMuted, kStrong, LoadError, RowsSkeleton, Toolbar } from "@/components/shell/kit";

export default function RequestsTab() {
  const { host, notify, notifyError, refreshCounts } = useHost();
  const router = useRouter();
  const x = useLoad(async () => {
    const list = await listJoinRequests(host.id);
    const urls = await signedUrls("avatars", list.map(r => r.avatar_path));
    return { list, urls, now: Date.now() };
  }, `requests:${host.key}`);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  if (x.status === "loading") return <RowsSkeleton rows={4} />;
  if (x.status === "error") return <LoadError what="join requests" error={x.error} onRetry={x.reload} />;
  const { list, urls, now } = x.data;
  if (!list.length) {
    return (
      <EmptyState variant="done" title="No join requests waiting" message="New requests show up here with answers to your join questions."
        action={{ label: "Edit join questions", variant: "secondary", onClick: () => router.push("/moderation?tab=rules") }} />
    );
  }

  const picked = list.filter(r => sel[r.user_id]);
  const nameOf = (r: JoinRequest) => r.display_name ?? "Runner";

  const act = async (targets: JoinRequest[], approve: boolean) => {
    if (!targets.length) return;
    setBusy(true);
    const done: string[] = [];
    try {
      for (const r of targets) {
        await answerJoinRequest(host.id, r.user_id, approve);
        done.push(r.user_id);
      }
      if (targets.length === 1) {
        notify(approve ? "success" : "neutral", approve ? "Member approved" : "Request declined",
          approve ? `${nameOf(targets[0])} joined ${host.name}.` : "They can ask again later.");
      } else {
        notify(approve ? "success" : "neutral", approve ? `${targets.length} members approved` : `${targets.length} requests declined`,
          approve ? `They joined ${host.name}.` : "They can ask again later.");
      }
    } catch (e) {
      notifyError(approve ? "Couldn’t approve" : "Couldn’t decline", e);
    } finally {
      if (done.length) {
        x.set(d => ({ ...d, list: d.list.filter(r => !done.includes(r.user_id)) }));
        setSel({});
        refreshCounts();
      }
      setBusy(false);
    }
  };

  return (
    <div>
      <Toolbar>
        <Checkbox
          label={`Select all ${list.length}`}
          checked={picked.length === list.length}
          indeterminate={picked.length > 0 && picked.length < list.length}
          onChange={v => setSel(v ? Object.fromEntries(list.map(r => [r.user_id, true])) : {})}
        />
        <div style={{ flex: 1 }} />
        <Button variant="secondary" size="sm" disabled={!picked.length || busy} onClick={() => act(picked, false)}>Decline {picked.length || ""}</Button>
        <Button size="sm" icon="check-check" disabled={!picked.length || busy} loading={busy} onClick={() => act(picked, true)}>Approve {picked.length || ""}</Button>
      </Toolbar>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 10 }}>
        {list.map(r => {
          const bits = [
            ago(r.created_at, now),
            r.runs_30d > 0 ? `${plural(r.runs_30d, "run")} in the last 30 days` : "",
            r.follows_in_squad > 0 ? `follows ${plural(r.follows_in_squad, "member")}` : "",
          ].filter(Boolean);
          const answers = r.answers ?? [];
          return (
            <GlassCard key={r.user_id} padding={16} style={{ outline: sel[r.user_id] ? "1.5px solid var(--ink-900)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Checkbox checked={!!sel[r.user_id]} onChange={v => setSel(s => ({ ...s, [r.user_id]: v }))} />
                <Avatar name={nameOf(r)} src={(r.avatar_path && urls.get(r.avatar_path)) || undefined} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={kStrong}>{nameOf(r)}</div>
                  <div style={kMuted}>{bits.join(" · ")}</div>
                </div>
              </div>
              {answers.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, padding: 12, borderRadius: 10, background: "var(--surface-panel)" }}>
                  {answers.map((a, i) => (
                    <div key={i}>
                      <div style={kMuted}>{a.q}</div>
                      <div style={{ font: "400 13px/1.4 var(--font-sans)", color: "var(--text-strong)", marginTop: 2 }}>{a.a}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {r.old_app ? <div style={{ ...kMuted, marginTop: 10 }}>Sent from an older app, before your join questions.</div> : null}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Button variant="secondary" style={{ flex: 1 }} disabled={busy} onClick={() => act([r], false)}>Decline</Button>
                <Button icon="check" style={{ flex: 1 }} disabled={busy} onClick={() => act([r], true)}>Approve</Button>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
