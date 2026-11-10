"use client";

import { useMemo, useState } from "react";
import { EmptyState, GlassCard, Skeleton, Tabs } from "@/components/ds";
import { kMuted, LoadError, RowsSkeleton } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { useHost } from "@/lib/host";
import { useLoad } from "@/lib/hooks";
import { SquadInsights } from "./SquadInsights";
import { SponsorReport } from "./SponsorReport";
import type { Computed, Loaded } from "./types";

const WEEK_MS = 7 * 86400000;

export function Insights() {
  const { host } = useHost();
  const [tab, setTab] = useState<"squad" | "sponsor">("squad");

  const d = useLoad(async (): Promise<Loaded | null> => {
    if (host.kind !== "squad") return null;
    const now = Date.now();
    const [roster, detail, overview, runs, events] = await Promise.all([
      api.memberRoster(host.id),
      api.squadDetail(host.id),
      api.squadsOverview(),
      api.listRuns(host.id),
      api.hostedEvents(true),
    ]);
    const faces = await api.signedUrls("avatars", roster.members.map(m => m.avatarPath));
    const starts = Array.from({ length: 12 }, (_, i) => api.weekStart(11 - i, new Date(now)).getTime());
    return {
      now, roster, detail, weekKm: overview.find(o => o.circle_id === host.id)?.week_km ?? 0,
      upcoming: runs, faces, starts,
      events: events.filter(e => e.host?.kind === host.kind && e.host?.id === host.id),
    };
  }, `insights:${host.key}`);

  const c = useMemo<Computed | null>(() => {
    if (d.status !== "ready" || !d.data) return null;
    const { roster, starts, now } = d.data;
    const km = Array.from({ length: 12 }, () => 0);
    const runCount = Array.from({ length: 12 }, () => 0);
    const who: Set<string>[] = Array.from({ length: 12 }, () => new Set<string>());
    for (const r of roster.runs) {
      const i = Math.floor((new Date(r.started_at).getTime() - starts[0]) / WEEK_MS);
      if (i < 0 || i > 11) continue;
      km[i] += r.distance_km;
      runCount[i] += 1;
      who[i].add(r.user_id);
    }
    return { km, runCount, active: who.map(s => s.size), who, now };
  }, [d]);

  if (host.kind !== "squad") {
    return <EmptyState variant="locked" title="Insights are for squads" message="They are built from the runs a squad’s members log on pacr." />;
  }
  if (d.status === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <GlassCard><Skeleton width="100%" height={72} /></GlassCard>
        <RowsSkeleton rows={4} />
      </div>
    );
  }
  if (d.status === "error") return <LoadError what="insights" error={d.error} onRetry={d.reload} />;
  const data = d.data;
  if (!data || !c) return null;

  const { roster } = data;
  if (roster.members.length === 0 || roster.runs.length === 0) {
    return (
      <EmptyState icon="chart-column" title="No runs logged yet"
        message="Insights appear once members log runs on pacr. They are built from those runs, not from group-run check-ins." style={{ padding: "56px 24px" }} />
    );
  }

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 12 }}>
        <Tabs value={tab} onChange={v => setTab(v as "squad" | "sponsor")} style={{ marginBottom: 8 }}
          tabs={[{ value: "squad", label: "Squad insights" }, { value: "sponsor", label: "Sponsor report" }]} />
        <div style={kMuted}>From the runs your members log on pacr, last 12 weeks.</div>
      </div>
      {tab === "squad" ? <SquadInsights data={data} c={c} /> : <SponsorReport data={data} c={c} />}
    </div>
  );
}
