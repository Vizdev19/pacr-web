"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { AvatarGroup, Avatar, Badge, Button, EmptyState, GlassCard, Icon, StatusTag, Tabs, DateTile } from "@/components/ds";
import { Meta, Toolbar, kMuted, kStrong, LoadError, RowsSkeleton } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { ago, dayTime, tile, time } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { encodeRef } from "@/lib/refs";
import { distanceText, who } from "./helpers";
import { ScheduleDialog } from "./ScheduleDialog";

export default function RunsList({ startNew }: { startNew: boolean }) {
  const { host } = useHost();
  const router = useRouter();
  const { phone } = useViewport();
  const [tab, setTab] = useState<"up" | "log">("up");
  const [scheduling, setScheduling] = useState(startNew);
  const owner = host.roleKey === "owner";
  const runs = useLoad(() => api.listRuns(host.id), `runs:${host.key}`);

  useEffect(() => { if (startNew) router.replace("/runs"); }, [startNew, router]);

  const open = (r: api.SquadRun) => { const ref = encodeRef(r.id); if (ref) router.push(`/runs?run=${ref}`); };
  const tabs = [{ value: "up", label: "Upcoming", count: runs.data?.length ?? null }, ...(owner ? [{ value: "log", label: "Run log" }] : [])];

  return (
    <div>
      <Toolbar>
        <Tabs value={owner ? tab : "up"} onChange={v => setTab(v === "log" ? "log" : "up")} tabs={tabs} style={{ flex: 1 }} />
        <Button icon="plus" onClick={() => setScheduling(true)}>Schedule run</Button>
      </Toolbar>

      {tab === "log" && owner ? <RunLog /> : runs.status === "loading" ? <RowsSkeleton rows={4} /> : runs.status === "error" ? (
        <LoadError what="runs" error={runs.error} onRetry={runs.reload} />
      ) : runs.data.length === 0 ? (
        <EmptyState icon="footprints" title="No runs scheduled" message="Members can RSVP as soon as you schedule one."
          action={{ label: "Schedule run", icon: "plus", onClick: () => setScheduling(true) }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {runs.data.map(r => {
            const t = tile(r.event_at);
            const dist = distanceText(r);
            const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(r); } };
            return (
              <GlassCard key={r.id} interactive padding={14} role="button" tabIndex={0} onClick={() => open(r)} onKeyDown={onKey}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <DateTile day={t.day} date={t.date} month={t.month} />
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ ...kStrong, fontSize: 15 }}>{r.title}</span>
                      {r.repeat_weekly ? <Badge tone="neutral" icon="repeat">Every week</Badge> : <Badge tone="neutral" variant="outline">One-off</Badge>}
                      {r.women_only ? <Badge tone="neutral">Women only</Badge> : null}
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
                      <Meta icon="clock">{time(r.event_at)}</Meta>
                      {r.meeting_point ? <Meta icon="map-pin">{r.meeting_point}</Meta> : <span style={{ color: "var(--warning-text)" }}><Meta icon="map-pin">No meeting place</Meta></span>}
                      {dist ? <Meta icon="route">{dist}</Meta> : null}
                      {r.pace_label ? <Meta icon="gauge">{r.pace_label}</Meta> : null}
                      {r.leader_name ? <Meta icon="flag">{r.leader_name}</Meta> : null}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: phone ? "100%" : undefined }}>
                    {(r.goers ?? []).length > 0 ? <AvatarGroup size={24} names={(r.goers ?? []).map(g => who(g.name))} /> : null}
                    <span style={{ ...kMuted, whiteSpace: "nowrap" }}>{r.going_count} going</span>
                  </div>
                  <Icon name="chevron-right" size={16} color="var(--text-muted)" />
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {scheduling ? <ScheduleDialog onClose={() => setScheduling(false)} onScheduled={() => { setScheduling(false); runs.reload(); }} /> : null}
    </div>
  );
}

/** Who scheduled and cancelled which runs: the squad's owner only. */
function RunLog() {
  const { host } = useHost();
  const log = useLoad(async () => {
    const rows = await api.runHistory(host.id);
    const urls = await api.signedUrls("avatars", rows.map(r => r.actor_avatar_path));
    return { rows, urls, now: Date.now() };
  }, `runlog:${host.key}`);
  if (log.status === "loading") return <RowsSkeleton rows={5} />;
  if (log.status === "error") return <LoadError what="the run log" error={log.error} onRetry={log.reload} />;
  const { rows, urls, now } = log.data;
  if (rows.length === 0) return <EmptyState icon="file-text" title="Nothing in the log yet" message="Runs your team schedules or cancels will be listed here." />;
  return (
    <GlassCard>
      {rows.map((r, i) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 0", borderTop: i ? "1px solid var(--border-subtle)" : 0 }}>
          <Avatar name={who(r.actor_name)} src={r.actor_avatar_path ? urls.get(r.actor_avatar_path) : undefined} size={30} />
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div style={{ ...kStrong, fontSize: 13 }}>{who(r.actor_name)}</div>
            <div style={kMuted}>{r.title} · {dayTime(r.event_at)}</div>
          </div>
          <StatusTag status={r.action === "cancelled" ? "Cancelled" : "Scheduled"} />
          <span style={{ ...kMuted, minWidth: 70, textAlign: "right" }}>{r.going_count} going</span>
          <span style={{ ...kMuted, minWidth: 80, textAlign: "right" }}>{ago(r.created_at, now)}</span>
        </div>
      ))}
    </GlassCard>
  );
}
