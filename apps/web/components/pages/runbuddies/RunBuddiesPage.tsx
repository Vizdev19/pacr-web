"use client";
// /runbuddies: Run buddies (open runs) on the web, after the app's
// app/run-buddies.tsx. Nearby (nearby_open_runs, only after "Use my
// location"), your runs (my_open_runs) and past runs (my_past_open_runs).
// /runbuddies?run=<ref> opens one run (RunDetail). Posting, chat and safety
// check-ins stay in the app.
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ds/core";
import { StatTile } from "@/components/ds/content";
import { EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { ChipSelect } from "@/components/ds/forms";
import { LoadMore, SegmentedControl } from "@/components/ds/nav";
import { Banner } from "@/components/ds/overlays";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import {
  NO_PROFILE, SUSPENDED, dayOffset, decodeRef, eligibility, forgetLocation, isIn, isWeekend, locate, myOpenRuns, myPastOpenRuns,
  nearbyOpenRuns, savedLocation, type Eligibility, type MyOpenRun, type OpenRunCard, type PastPage, type PastRun,
} from "@/lib/runbuddies";
import { AppBar, MyRunRow, OpenRunRow, PastRunRow, SafetyCard, runHref } from "./parts";
import { RunDetail } from "./RunDetail";

type Tab = "nearby" | "mine" | "past";

export function RunBuddiesPage({ runRef, past, tab }: { runRef: string | null; past: boolean; tab: Tab }) {
  return <RequireSignIn title="Sign in to find run buddies" body="Small runs with runners near you, at public places.">
    {auth => runRef ? <RunDetail id={decodeRef(runRef)} past={past} uid={auth.uid} /> : <Hub initial={tab} />}
  </RequireSignIn>;
}

const RADII = [{ id: "2", label: "2 km" }, { id: "3", label: "3 km" }, { id: "5", label: "5 km" }];

function Hub({ initial }: { initial: Tab }) {
  const [tab, setTab] = useState<Tab>(initial);
  const [now, setNow] = useState(0);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [mine, setMine] = useState<MyOpenRun[] | null>(null);
  const [mineFailed, setMineFailed] = useState(false);

  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([eligibility(), myOpenRuns()]).then(([e, m]) => {
      if (!alive) return;
      setElig(e); setNow(Date.now());
      if (m) { setMine(m); setMineFailed(false); } else setMineFailed(true);
    });
    return () => { alive = false; };
  }, [key]);

  const invites = (mine ?? []).filter(m => m.myStatus === "invited" && m.status === "open");
  const safetyDue = (mine ?? []).filter(m => m.safetyDue);
  const upcoming = (mine ?? []).filter(m => isIn(m.myStatus) || m.myStatus === "pending" || m.myStatus === "invited");

  return <div className="pw-container" style={{ paddingTop: 24, paddingBottom: 64 }}>
    <div className="sec-h"><div><h1 className="t-h1">Run buddies</h1>
      <p>Small runs for 2 to 5 runners at parks, lakes, tracks and landmarks near you. Join one here; post one in the app.</p></div></div>
    <div className="split">
      <div className="stack" style={{ gap: 16 }}>
        {elig?.suspended ? <Banner tone="error" title={SUSPENDED.title}>{SUSPENDED.body}</Banner>
          : elig && !elig.group ? <Banner tone="warning" title={NO_PROFILE.title}>{NO_PROFILE.body}</Banner> : null}
        {safetyDue.map(m => <Banner key={m.id} tone="warning" icon="shield-alert" title={`Back from ${m.title}?`}>Mark yourself safe in the pacr app, so nobody worries.</Banner>)}
        {invites.map(m => <Banner key={m.id} tone="info" icon="mail" title={`${m.hostName} invited you to run`}
          actions={<Button size="sm" href={runHref(m.id)}>See the invite</Button>}>{m.title}</Banner>)}
        <div className="only-md"><SafetyCard /></div>
        <SegmentedControl value={tab} onChange={v => setTab(v as Tab)} label="Run buddies"
          options={[{ id: "nearby", label: "Nearby" }, { id: "mine", label: upcoming.length ? `Your runs (${upcoming.length})` : "Your runs" }, { id: "past", label: "Past" }]} />
        {tab === "nearby" ? <Nearby now={now} />
          : tab === "mine" ? (mineFailed && !mine ? <ErrorState title="We couldn't load your runs" body="Check your connection, then try again." onRetry={() => setKey(k => k + 1)} />
            : !mine ? <div className="stack"><Skeleton variant="run" /><Skeleton variant="run" /></div>
            : upcoming.length ? <div className="stack">{upcoming.map(m => <MyRunRow key={m.id} m={m} now={now} />)}</div>
            : <EmptyState boxed icon="calendar-x" title="No buddy runs coming up." body="Join a run near you, or post one in the pacr app." action="See runs near you" onAction={() => setTab("nearby")} />)
          : <Past now={now} />}
        <div className="only-md"><AppBar /></div>
      </div>
      <aside className="stack sticky hide-md">
        <SafetyCard />
        <AppBar />
      </aside>
    </div>
  </div>;
}

function Nearby({ now }: { now: number }) {
  // Only rendered in the browser (behind RequireSignIn), so sessionStorage is there.
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(() => savedLocation());
  const [locError, setLocError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [radius, setRadius] = useState("3");
  const [filter, setFilter] = useState("all");
  const [attempt, setAttempt] = useState(0);
  // The answer for one (place, radius, attempt); anything else is still loading.
  const [result, setResult] = useState<{ key: string; runs: OpenRunCard[] | null } | null>(null);
  const want = loc ? `${loc.lat},${loc.lng},${radius},${attempt}` : "";

  useEffect(() => {
    if (!loc) return;
    let alive = true;
    const k = `${loc.lat},${loc.lng},${radius},${attempt}`;
    nearbyOpenRuns(loc.lat, loc.lng, Number(radius)).then(r => { if (alive) setResult({ key: k, runs: r }); });
    return () => { alive = false; };
  }, [loc, radius, attempt]);
  const runs = result?.key === want ? result.runs : null;
  const failed = result?.key === want && result.runs === null;

  async function askLocation() {
    setLocating(true); setLocError(null);
    try { setLoc(await locate()); } catch (e) {
      const denied = (e as GeolocationPositionError)?.code === 1;
      setLocError(denied ? "Location is off for this site. Turn it on in your browser's site settings, then try again."
        : "We couldn't find where you are. Try again in a moment.");
    }
    setLocating(false);
  }

  const t = now || 0;
  const shown = useMemo(() => (runs ?? []).filter(r => {
    switch (filter) {
      case "today": return dayOffset(r.startsAt, t) === 0;
      case "tomorrow": return dayOffset(r.startsAt, t) === 1;
      case "weekend": return isWeekend(r.startsAt);
      case "one": return r.cap === 2;
      case "women": return r.womenOnly;
      default: return true;
    }
  }), [runs, filter, t]);

  if (!loc) return <EmptyState boxed icon="locate-fixed" title="See runs near you"
    body={locError ?? "We use your location once to find runs within a few km. Nobody sees where you are."}
    action={locating ? "Finding you" : "Use my location"} onAction={() => { if (!locating) void askLocation(); }} />;

  const filters = [
    { id: "all", label: "All" }, { id: "today", label: "Today" }, { id: "tomorrow", label: "Tomorrow" }, { id: "weekend", label: "Weekend" }, { id: "one", label: "1:1" },
    ...((runs ?? []).some(r => r.womenOnly) ? [{ id: "women", label: "Women only" }] : []),
  ];

  return <div className="stack" style={{ gap: 16 }}>
    <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
      <SegmentedControl size="sm" value={radius} onChange={setRadius} label="How far" options={RADII} />
      <Button variant="ghost" size="sm" icon="x" onClick={() => { forgetLocation(); setLoc(null); setResult(null); }}>Forget my location</Button>
    </div>
    <ChipSelect multi={false} scroll value={filter} onChange={v => setFilter(v[0] ?? "all")} options={filters} label="When" />
    {failed && !runs ? <ErrorState title="We couldn't load runs near you" body="Check your connection, then try again." onRetry={() => setAttempt(a => a + 1)} />
      : !runs ? <div className="stack"><Skeleton variant="run" /><Skeleton variant="run" /></div>
      : shown.length ? <>
        <span className="t-caption">{shown.length} {shown.length === 1 ? "run" : "runs"} within {radius} km · soonest first</span>
        <div className="stack">{shown.map(r => <OpenRunRow key={r.id} r={r} now={now} />)}</div>
      </>
      : filter !== "all" ? <EmptyState boxed icon="search-x" title="Nothing matches that filter." action="Show all runs" onAction={() => setFilter("all")} />
      : radius !== "5" ? <EmptyState boxed icon="calendar-x" title={`No one's posted a run within ${radius} km yet.`} body="Look a little further, or post a run in the pacr app and nearby runners can join you." action="Look within 5 km" onAction={() => setRadius("5")} />
      : <EmptyState boxed icon="calendar-x" title="No one's posted a run near you yet." body="Post a run in the pacr app and nearby runners can join you." action="Get the app" href="/download" />}
  </div>;
}

function Past({ now }: { now: number }) {
  const [page, setPage] = useState<PastPage | null>(null);
  const [runs, setRuns] = useState<PastRun[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    myPastOpenRuns(null).then(p => {
      if (!alive) return;
      if (p) { setPage(p); setRuns(p.runs); setFailed(false); } else setFailed(true);
    });
    return () => { alive = false; };
  }, [key]);

  async function more() {
    if (!page?.cursor) return;
    setBusy(true);
    const p = await myPastOpenRuns(page.cursor);
    setBusy(false);
    if (p) { setPage({ ...p, summary: page.summary }); setRuns(r => [...r, ...p.runs]); }
  }

  if (failed && !page) return <ErrorState title="We couldn't load your past runs" body="Check your connection, then try again." onRetry={() => setKey(k => k + 1)} />;
  if (!page) return <div className="stack"><Skeleton variant="run" /><Skeleton variant="run" /></div>;
  if (!runs.length) return <EmptyState boxed icon="footprints" title="No past buddy runs yet." body="Runs you host or join show up here afterwards, with the people you ran with." />;
  const s = page.summary;
  return <div className="stack" style={{ gap: 16 }}>
    {s ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--space-3)" }}>
      <StatTile size="sm" label="Runs" value={s.runs} />
      <StatTile size="sm" label="Hosted" value={s.hosted} />
      <StatTile size="sm" label="Runners met" value={s.people} />
      <StatTile size="sm" label="Showed up" value={s.showed + s.noShows ? `${s.showed} of ${s.showed + s.noShows}` : "—"} />
    </div> : null}
    <div className="stack">{runs.map(p => <PastRunRow key={p.id} p={p} now={now} />)}</div>
    <LoadMore onClick={() => void more()} loading={busy} hasMore={!!page.cursor} label="Show older runs" endLabel="That's every run" />
  </div>;
}
