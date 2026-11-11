"use client";
// /activity/<ref>: one of your own runs (layout after ui_kits/website/Run.jsx:
// header, then the route and charts beside the splits). Headline numbers from
// run_summaries; the route, splits, heart rate, elevation, cadence and shoe
// from the run's full log in run_backups. A run that isn't yours, or isn't
// there, is "not found" either way.
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { Card, Icon } from "@/components/ds/core";
import { DateTile, StatTile } from "@/components/ds/content";
import { LineChart, SplitsTable, type Split } from "@/components/ds/data";
import { ErrorState, Skeleton } from "@/components/ds/feedback";
import { MapEmbed } from "@/components/ds/actions";
import { Breadcrumbs } from "@/components/ds/nav";
import { Banner } from "@/components/ds/overlays";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { useLoad } from "@/lib/profile";
import { istParts } from "@/lib/format";
import { duration, paceOf } from "@/lib/time";
import { chartSeries, loadActivity, logSeconds, num, projectRoute, runTitle, shapePoints, traceSeries, type ActivityResult } from "@/lib/activity";

export function ActivityPage({ runRef }: { runRef: string }) {
  return <RequireSignIn title="Sign in to see your run" body="Your runs, with their route, splits and charts, open here for you alone.">
    {auth => <Activity key={runRef + auth.uid} uid={auth.uid} runRef={runRef} />}
  </RequireSignIn>;
}

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--space-3)" } as const;
const fmt = (n: number, d = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: d });

function Activity({ uid, runRef }: { uid: string; runRef: string }) {
  const fetchRun = useCallback(() => loadActivity(runRef, uid), [runRef, uid]);
  const { data, failed, retry } = useLoad<ActivityResult>(fetchRun);
  const res: ActivityResult | null = failed ? { kind: "error" } : data ?? null;

  const ok = res?.kind === "ok" ? res : null;
  const trace = useMemo(() => (ok?.log ? traceSeries(ok.log) : null), [ok]);
  const route = useMemo(() => (ok ? (ok.log?.route ? projectRoute(ok.log.route) : null) ?? shapePoints(ok.run.route_shape) : null), [ok]);
  useEffect(() => { if (ok) document.title = `${runTitle(ok.log?.title ?? ok.run.title, ok.run.started_at, ok.log?.type === "bike")} · pacr`; }, [ok]);

  if (!res) return <div className="pw-container pw-page"><Skeleton variant="run" /><div style={{ ...grid, marginTop: "var(--space-6)" }}><Skeleton variant="stat" /><Skeleton variant="stat" /><Skeleton variant="stat" /></div></div>;
  if (res.kind === "error") return <div className="pw-container sec"><ErrorState title="Couldn't load this run" body="Check your connection and try again." onRetry={retry} /></div>;
  if (res.kind === "notfound" || !ok) return <div className="pw-container sec">
    <ErrorState kind="notfound" title="We can't find that run" body="It may have been deleted, or it isn't one of your runs. A run opens here only for the runner who ran it." action="Go to your profile" href="/profile" />
  </div>;

  const { run, log, shoe } = ok;
  const ride = log?.type === "bike";
  const km = log?.distance != null && log.distance > 0 ? log.distance : num(run.distance_km);
  const sec = logSeconds(log, num(run.duration_sec));
  const paceSec = km >= 0.2 ? sec / km : null;
  const elev = log?.elevationGainM ?? run.elev_gain_m;
  const cadence = !ride && log?.steps && sec > 60 ? Math.round(log.steps / (sec / 60)) : null;
  const title = runTitle(log?.title ?? run.title, run.started_at, ride);
  const when = istParts(run.started_at);
  const from = log?.sourceLabel ? `From ${log.sourceLabel}` : null;

  const splits: Split[] = !ride && trace?.pace ? trace.splits.filter(s => s.pace > 0 && paceOf(s.pace)).map(s => ({
    km: s.dist > 0.95 ? s.n : (s.n - 1 + s.dist).toFixed(2), pace: paceOf(s.pace)!,
    elev: s.elev != null ? Math.round(s.elev) : null, hr: s.hr != null ? Math.round(s.hr) : null,
  })) : [];
  const pace = !ride && trace?.pace ? chartSeries(trace.pace, trace.km) : null;
  const hr = trace?.hr ? chartSeries(trace.hr, trace.km) : null;
  const el = trace?.el ? chartSeries(trace.el, trace.km) : null;

  return <div className="pw-container pw-page">
    <Breadcrumbs items={[{ label: "Your profile", href: "/profile" }, { label: title }]} />
    <div className="row" style={{ alignItems: "flex-start", gap: "var(--space-5)", flexWrap: "nowrap", marginTop: "var(--space-5)" }}>
      <DateTile dow={when.dow} day={when.day} month={when.month} time={when.time} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 className="t-h1" style={{ overflowWrap: "anywhere" }}>{title}</h1>
        {run.neighborhood || from ? <div className="pw-meta" style={{ marginTop: "var(--space-2)" }}>
          {run.neighborhood ? <span><Icon name="map-pin" size={15} />{run.neighborhood}</span> : null}
          {from ? <span><Icon name="watch" size={15} />{from}</span> : null}
        </div> : null}
      </div>
    </div>

    <div style={{ ...grid, marginTop: "var(--space-6)" }}>
      <StatTile label="Distance" value={km.toFixed(2)} unit="km" />
      <StatTile label="Time" value={duration(sec) ?? "—"} />
      {ride
        ? <StatTile label="Average speed" value={sec > 0 ? (km / (sec / 3600)).toFixed(1) : "—"} unit="km/h" />
        : <StatTile label="Average pace" value={paceOf(paceSec) ?? "—"} unit="/km" />}
      {elev != null ? <StatTile label="Elevation gain" value={`+${fmt(elev)}`} unit="m" /> : null}
      {log?.heartRate ? <StatTile label="Average heart rate" value={fmt(log.heartRate)} unit="bpm" /> : null}
      {log?.maxHeartRate ? <StatTile label="Max heart rate" value={fmt(log.maxHeartRate)} unit="bpm" /> : null}
      {cadence ? <StatTile label="Cadence" value={cadence} unit="spm" /> : null}
    </div>

    {!log ? <div style={{ marginTop: "var(--space-6)" }}><Banner tone="info" title="Only the summary is here">This run&apos;s full log hasn&apos;t reached pacr yet, so its splits and charts aren&apos;t either. Open the app while you&apos;re online and it backs the run up.</Banner></div> : null}

    <div className="split" style={{ marginTop: "var(--space-8)" }}>
      <div>
        <section className="block" aria-label="Route">
          <h2>Route</h2>
          {route ? <MapEmbed ratio="16:9" route={route} label={`Route of ${title}`} />
            : <Card><p className="t-body-s t-secondary" style={{ margin: 0 }}>{log ? "No route was recorded for this run." : "The route comes with the full log."}</p></Card>}
        </section>
        {pace ? <Chart title="Pace" note="Lower is faster"><LineChart data={pace.data} labels={pace.labels} invert format={v => paceOf(v) ?? ""} unit=" /km" /></Chart> : null}
        {hr ? <Chart title="Heart rate"><LineChart data={hr.data} labels={hr.labels} color="var(--data-3)" unit=" bpm" /></Chart> : null}
        {el ? <Chart title="Elevation"><LineChart data={el.data} labels={el.labels} color="var(--data-2)" unit=" m" /></Chart> : null}
      </div>
      <aside className="stack">
        {splits.length ? <section className="block" aria-label="Splits"><h2>Splits</h2><Card pad={false}><SplitsTable splits={splits} /></Card></section> : null}
        {shoe ? <section className="block" aria-label="Shoes"><h2>Shoes</h2>
          <Card href="/shoes"><div className="row" style={{ flexWrap: "nowrap", gap: "var(--space-3)" }}>
            <Icon name="footprints" /><div style={{ flex: 1, minWidth: 0 }}><b>{shoe.name}</b>{shoe.retired ? <div className="t-caption">Retired</div> : null}</div><Icon name="chevron-right" />
          </div></Card></section> : null}
      </aside>
    </div>
  </div>;
}

function Chart({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <section className="block" aria-label={title}>
    <div className="row" style={{ justifyContent: "space-between" }}><h2>{title}</h2>{note ? <span className="t-caption">{note}</span> : null}</div>
    <Card>{children}</Card>
  </section>;
}
