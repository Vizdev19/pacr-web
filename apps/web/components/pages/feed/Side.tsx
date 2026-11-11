"use client";
// The feed's side column (ui_kits/website/Feed.jsx): Your week from the
// runner's own run_summaries (Mon–Sun in India), and each of their squads'
// next run from my_squads_overview, linked to /s/<slug>?run=<ref>.
import { useEffect, useState } from "react";
import { Card, Icon } from "@/components/ds/core";
import { StatTile } from "@/components/ds/content";
import { BarChart } from "@/components/ds/data";
import { Skeleton } from "@/components/ds/feedback";
import { whenLine } from "@/lib/format";
import { nextRuns, yourWeek, type MySquad, type NextRun } from "@/lib/feed";

type Week = Awaited<ReturnType<typeof yourWeek>>;

export function YourWeek({ uid }: { uid: string }) {
  const [w, setW] = useState<Week | undefined>(undefined);
  useEffect(() => { let live = true; yourWeek(uid).then(r => { if (live) setW(r); }); return () => { live = false; }; }, [uid]);
  const km = w ? (w.km % 1 ? w.km.toFixed(1) : String(w.km)) : "0";
  return <Card>
    <h3 className="t-h4" style={{ marginBottom: "var(--space-3)" }}>Your week</h3>
    {w === undefined ? <Skeleton variant="stat" />
      : w === null ? <p className="t-caption" style={{ margin: 0 }}>Your runs didn&apos;t load. Refresh to try again.</p>
      : <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
          <StatTile flat size="sm" label="Distance" value={km} unit="km" />
          <StatTile flat size="sm" label="Runs" value={String(w.runs)} />
        </div>
        <div style={{ marginTop: "var(--space-3)" }}><BarChart height={90} data={w.days} labels={["M", "T", "W", "T", "F", "S", "S"]} highlight={w.today} /></div>
        {w.runs === 0 ? <p className="t-caption" style={{ margin: "var(--space-2) 0 0" }}>No runs yet this week. Runs you record in the app show up here.</p> : null}
      </>}
  </Card>;
}

export function NextRuns({ squads, cityId, cityName }: { squads: MySquad[] | null; cityId: string; cityName: string }) {
  const [runs, setRuns] = useState<NextRun[] | null | undefined>(undefined);
  useEffect(() => {
    if (!squads?.length) return;
    let live = true;
    nextRuns(squads).then(r => { if (live) setRuns(r); });
    return () => { live = false; };
  }, [squads]);
  return <Card>
    <h3 className="t-h4" style={{ marginBottom: "var(--space-1)" }}>Your squads&apos; next runs</h3>
    {squads && !squads.length ? <p className="t-caption" style={{ margin: 0 }}>Join a squad to see its runs here. <a href={`/clubs/${cityId}`}>See squads in {cityName}</a></p>
      : runs === undefined ? <Skeleton lines={3} />
      : runs === null ? <p className="t-caption" style={{ margin: 0 }}>Runs didn&apos;t load. Refresh to try again.</p>
      : !runs.length ? <p className="t-caption" style={{ margin: 0 }}>None of your squads has a run on the calendar yet.</p>
      : runs.slice(0, 5).map(r => <a key={r.ref} href={`/s/${r.slug}?run=${r.ref}`} className="row"
        style={{ padding: "var(--space-3) 0", textDecoration: "none", color: "inherit", flexWrap: "nowrap", borderTop: "1px solid var(--border-subtle)" }}>
        <Icon name="calendar" size={18} />
        <div style={{ flex: 1, minWidth: 0 }}><b className="t-body-s">{r.title}</b><div className="t-caption">{whenLine(r.at)} · {r.squad}</div></div>
        <Icon name="chevron-right" size={16} />
      </a>)}
  </Card>;
}
