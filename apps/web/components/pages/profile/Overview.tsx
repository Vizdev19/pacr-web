"use client";
// The Overview tab, for yourself and squadmates only (get_runner_profile
// sends stats to no one else, and run_summaries' RLS shows a follower only
// the runs behind posts they can see, so a chart from it would be wrong).
// Totals are the server's aggregates; the strip and recent runs read
// run_summaries for the last 12 weeks.
import { useEffect, useState, type ReactNode } from "react";
import { Card, Icon } from "@/components/ds/core";
import { DateTile, StatTile } from "@/components/ds/content";
import { ActivityStrip } from "@/components/ds/data";
import { EmptyState, Skeleton } from "@/components/ds/feedback";
import { istParts } from "@/lib/format";
import { encodeRef } from "@/lib/refs";
import { duration, paceOf } from "@/lib/time";
import { runTitle } from "@/lib/activity";
import { getRuns, istDay, stripDays, stripStart, weekKey, type RunRow, type Stats } from "@/lib/profile";

const fmt = (n: number, d = 1) => n.toLocaleString("en-IN", { maximumFractionDigits: d });
export const statGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "var(--space-3)" } as const;

export function Overview({ subjectId, isMe, stats, aside }: { subjectId: string; isMe: boolean; stats: Stats; aside: ReactNode }) {
  const [runs, setRuns] = useState<{ recent: RunRow[]; window: RunRow[]; start: number; now: number } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const now = Date.now(), start = stripStart(now);
    getRuns(subjectId, new Date(start - 86400000)).then(r => { if (alive) setRuns({ ...r, start, now }); }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [subjectId]);

  const thisKey = runs ? weekKey(istDay(new Date(runs.now))) : null;
  const lastKey = runs ? weekKey(istDay(new Date(runs.now - 7 * 86400000))) : null;
  const wk = stats.weeks.find(w => w.weekKey === thisKey) ?? { km: 0, runs: 0 };
  const prev = stats.weeks.find(w => w.weekKey === lastKey) ?? { km: 0, runs: 0 };
  const diff = wk.km - prev.km;
  const strip = runs ? stripDays(runs.window, runs.start) : null;
  const total12 = strip ? strip.days.reduce((a, b) => a + b, 0) : 0;
  const y = stats.year;

  return <div className="split">
    <div>
      <section className="block" aria-label="This week">
        <h2>This week</h2>
        {runs ? <div style={statGrid}>
          <StatTile label="Distance" value={fmt(wk.km)} unit="km" delta={prev.km || wk.km ? `${diff >= 0 ? "+" : "-"}${fmt(Math.abs(diff))} km` : null} />
          <StatTile label="Runs" value={wk.runs} />
          <StatTile label="Lifetime" value={fmt(stats.lifetimeKm, 0)} unit="km" delta={null} />
          <StatTile label="Runs logged" value={stats.lifetimeRuns.toLocaleString("en-IN")} />
        </div> : <div style={statGrid}><Skeleton variant="stat" /><Skeleton variant="stat" /></div>}
      </section>

      <section className="block" aria-label="This year">
        <h2>{new Date().getFullYear()} so far</h2>
        {y.runs ? <div style={statGrid}>
          <StatTile label="Distance" value={fmt(y.km)} unit="km" />
          <StatTile label="Runs" value={y.runs.toLocaleString("en-IN")} />
          <StatTile label="Time" value={fmt(y.timeSec / 3600, 0)} unit="h" />
          {y.paceSecPerKm ? <StatTile label="Average pace" value={paceOf(y.paceSecPerKm) ?? "—"} unit="/km" /> : null}
          {y.elevM != null ? <StatTile label="Elevation gain" value={fmt(y.elevM, 0)} unit="m" /> : null}
          {y.longestKm ? <StatTile label="Longest run" value={fmt(y.longestKm)} unit="km" /> : null}
        </div> : <p className="t-body-s t-secondary" style={{ margin: 0 }}>{isMe ? "No runs this year yet. Runs you record in the app land here once they sync." : "No runs this year yet."}</p>}
      </section>

      <section className="block" aria-label="Last 12 weeks">
        <h2>Last 12 weeks</h2>
        <Card>{strip ? <><ActivityStrip days={strip.days} labels={strip.labels} />
          <p className="t-caption" style={{ margin: "var(--space-3) 0 0" }}>{total12 > 0 ? `${fmt(total12)} km over 12 weeks. Each square is a day.` : "No runs in the last 12 weeks."}</p></>
          : failed ? <p className="t-body-s t-secondary" style={{ margin: 0 }}>Couldn&apos;t load these runs. Refresh to try again.</p> : <Skeleton lines={3} />}</Card>
      </section>

      <section className="block" aria-label="Recent runs">
        <h2>Recent runs</h2>
        {!runs ? (failed ? null : <><Skeleton variant="run" /><Skeleton variant="run" /></>)
          : runs.recent.length ? <div className="stack">{runs.recent.map(r => <RunRowCard key={r.id} r={r} link={isMe} />)}</div>
          : <EmptyState boxed icon="footprints" title={isMe ? "No runs yet." : "No runs have synced yet."} body={isMe ? "Record a run in the app and it shows up here once it syncs." : undefined} />}
      </section>
    </div>
    <aside className="stack sticky">{aside}</aside>
  </div>;
}

function RunRowCard({ r, link }: { r: RunRow; link: boolean }) {
  const p = istParts(r.started_at);
  const pace = paceOf(r.pace_sec_per_km ?? (r.distance_km > 0 ? r.duration_sec / r.distance_km : null));
  const line = [`${r.distance_km.toFixed(2)} km`, duration(r.duration_sec), pace ? `${pace} /km` : null, r.neighborhood].filter(Boolean).join(" · ");
  return <Card href={link ? `/activity/${encodeRef(r.id) ?? ""}` : undefined}>
    <div className="row" style={{ flexWrap: "nowrap", gap: "var(--space-4)" }}>
      <DateTile size="sm" dow={p.dow} day={p.day} month={p.month} time={p.time} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{runTitle(r.title, r.started_at)}</b>
        <div className="t-body-s t-secondary num">{line}</div>
      </div>
      {link ? <Icon name="chevron-right" /> : null}
    </div>
  </Card>;
}
