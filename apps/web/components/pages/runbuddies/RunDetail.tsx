"use client";
// /runbuddies?run=<ref>: one open run, after the app's RunSheet
// (src/components/runBuddies/RunSheet.tsx) on get_open_run. Join or ask to
// join with request_open_run, take a request back or leave with
// leave_open_run, answer an invite with respond_open_run_invite, report with
// report_open_run — the app's own calls. ?past=1 opens a run that's over
// (get_past_open_run). Chat, "I'm here" and "I'm safe" stay in the app.
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Icon, TrustTag } from "@/components/ds/core";
import { DateTile, RunnerRow } from "@/components/ds/content";
import { DirectionsLink, PlaceMap } from "@/components/ds/actions";
import { EmptyState, Skeleton } from "@/components/ds/feedback";
import { TextArea } from "@/components/ds/forms";
import { Breadcrumbs } from "@/components/ds/nav";
import { Banner, Dialog, useToast } from "@/components/ds/overlays";
import { istParts, whenLine } from "@/lib/format";
import {
  NO_PROFILE, PACE_LABEL, SUSPENDED, eligibility, failCopy, firstName, getOpenRun, getPastOpenRun, isIn, kmLabel, leaveOpenRun,
  requestOpenRun, respondInvite, showUpLine, type Eligibility, type OpenRunDetail, type PastRun,
} from "@/lib/runbuddies";
import { AppBar, ReportDialog, RuleTags, SafetyCard, StatusTag, personHref } from "./parts";

type Loaded = { run: OpenRunDetail | null; old: PastRun | null; elig: Eligibility | null; now: number };

export function RunDetail({ id, past, uid }: { id: string | null; past: boolean; uid: string }) {
  const [state, setState] = useState<Loaded | null>(null);
  const [key, setKey] = useState(0);
  const reload = useCallback(() => setKey(k => k + 1), []);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      if (past) {
        const old = await getPastOpenRun(id);
        if (old) { if (alive) setState({ run: null, old, elig: null, now: Date.now() }); return; }
      }
      const [run, elig] = await Promise.all([getOpenRun(id), eligibility()]);
      // A run that's over leaves get_open_run's reach for some viewers: try its past page.
      const old = !run && !past ? await getPastOpenRun(id) : null;
      if (alive) setState({ run, old, elig, now: Date.now() });
    })();
    return () => { alive = false; };
  }, [id, past, key]);

  if (id && !state) return <div className="pw-container pw-page"><Skeleton variant="run" /><Skeleton lines={4} /></div>;
  if (state?.old) return <PastView p={state.old} />;
  if (!state?.run) return <div className="pw-container pw-page" style={{ maxWidth: 720 }}>
    <EmptyState icon="calendar-x" title="This run isn't available any more" body="It may have been cancelled, or it isn't open to you." action="See runs near you" href="/runbuddies" />
  </div>;
  return <LiveView r={state.run} elig={state.elig} now={state.now} uid={uid} reload={reload} />;
}

function Head({ iso, title, now, children }: { iso: string; title: string; now: number; children?: React.ReactNode }) {
  const p = istParts(iso);
  return <div className="row" style={{ alignItems: "flex-start", gap: 18, flexWrap: "nowrap" }}>
    <DateTile dow={p.dow} day={p.day} month={p.month} time={p.time} today={!!now && p.ymd === istParts(new Date(now)).ymd} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <h1 className="t-h1" style={{ margin: "0 0 6px" }}>{title}</h1>
      <div className="t-secondary" style={{ marginBottom: 10 }}>{whenLine(iso)}</div>
      <div className="pw-tags">{children}</div>
    </div>
  </div>;
}

function LiveView({ r, elig, now, uid, reload }: { r: OpenRunDetail; elig: Eligibility | null; now: number; uid: string; reload: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [reporting, setReporting] = useState(false);

  const host = r.members.find(m => m.isHost) ?? null;
  const hostFirst = host ? firstName(host.name) : "The host";
  const hosting = r.myStatus === "host";
  const inRun = isIn(r.myStatus);
  const full = r.acceptedCount >= r.cap;
  const started = !!now && now >= Date.parse(r.startsAt);
  const ok = !elig || (r.cap === 2 ? elig.oneToOne : elig.group);
  const locked = !!elig && !ok && !inRun && r.myStatus !== "pending" && r.myStatus !== "invited";
  const open = Math.max(0, r.cap - r.acceptedCount);
  const place = [r.placeName, r.placeAddress].filter(Boolean).join(", ");

  async function act<T>(call: () => Promise<{ ok: true; value: T } | { ok: false; reason: string }>, done: (v: T) => string) {
    setBusy(true);
    const res = await call();
    setBusy(false);
    if (!res.ok) toast({ title: failCopy(res.reason), tone: "error" });
    else toast({ title: done(res.value) });
    reload();
  }

  const cta = (where: string) => {
    if (r.status === "cancelled") return <><Button block size="lg" disabled>This run was cancelled</Button><span className="t-caption">The run chat stays open in the app for a day.</span></>;
    if (hosting) return <><div><TrustTag kind="organiser">You&apos;re hosting</TrustTag></div>
      {r.requests ? <b>{r.requests} {r.requests === 1 ? "request is" : "requests are"} waiting</b> : null}
      <span className="t-caption">Answer requests, chat and cancel the run in the pacr app.</span></>;
    if (r.myStatus === "pending") return <><div><TrustTag kind="request-sent" /></div>
      <Button block variant="secondary" loading={busy} onClick={() => void act(() => leaveOpenRun(r.id), () => "Request cancelled")}>Cancel request</Button>
      <span className="t-caption">Waiting for {hostFirst} to approve. The exact spot is shared after.</span></>;
    if (r.myStatus === "accepted") return <><div><TrustTag kind="going">You&apos;re going</TrustTag></div>
      <Button block variant="secondary" disabled={started} onClick={() => setLeaving(true)}>Leave this run</Button>
      <span className="t-caption">{started ? "This run has started." : r.leaveIsLate ? "Leaving now counts as a no-show." : "Use the run chat in the app to plan the meet-up."}</span></>;
    if (r.myStatus === "invited") return <><div><Badge tone="accent" icon="mail">{hostFirst} invited you</Badge></div>
      <Button block size="lg" loading={busy} disabled={locked} onClick={() => void act(() => respondInvite(r.id, true), () => `You're in · ${hostFirst} has been notified`)}>Accept invite</Button>
      <Button block variant="ghost" disabled={busy} onClick={() => void act(() => respondInvite(r.id, false), () => `Declined. ${hostFirst} can't invite you again for 30 days.`)}>Decline</Button></>;
    if (r.myStatus === "declined" || r.myStatus === "removed") return <><Button block size="lg" disabled>Not available</Button><span className="t-caption">{hostFirst} didn&apos;t add you to this run.</span></>;
    if (started) return <><Button block size="lg" disabled>This run has started</Button></>;
    if (locked) return <><Button block size="lg" disabled>Not available</Button><span className="t-caption">{elig?.suspended ? "Open runs are paused for your account." : "Finish setting up your profile in the app to join runs."}</span></>;
    if (full) return <><Button block size="lg" disabled>Group is full</Button><span className="t-caption">Spots open up if someone drops out.</span></>;
    return <>
      {r.approval ? <TextArea id={`note-${where}`} label={`Note for ${hostFirst}`} optional rows={2} maxLength={140} value={note} onChange={e => setNote(e.target.value)} placeholder="Your usual pace, or how you found the run" /> : null}
      <Button block size="lg" loading={busy} onClick={() => void act(() => requestOpenRun(r.id, note), v => v === "accepted" ? `You're in · ${hostFirst} has been notified` : `Request sent to ${hostFirst}`)}>
        {r.approval ? `Ask to join ${hostFirst}` : `Join ${hostFirst}`}</Button>
      <span className="t-caption">{r.cap === 2 ? `1:1 run · ${hostFirst} approves who joins`
        : r.womenOnly ? "Only women runners can see and join this run"
        : r.approval ? `${hostFirst} approves who joins · exact spot shared after`
        : `${hostFirst} gets notified when you join`}</span>
    </>;
  };

  return <div className="pw-container" style={{ paddingTop: 16, paddingBottom: 64 }}>
    <Breadcrumbs items={[{ label: "Run buddies", href: "/runbuddies" }, { label: r.title }]} />
    <div className="split" style={{ marginTop: 20 }}>
      <div className="stack" style={{ gap: 20 }}>
        <Head iso={r.startsAt} title={r.title} now={now}>
          {r.status === "cancelled" ? <TrustTag kind="cancelled" /> : null}
          <RuleTags womenOnly={r.womenOnly} cap={r.cap} approval={r.approval} hosting={hosting} />
          <StatusTag s={r.myStatus} />
        </Head>
        {elig?.suspended && !inRun ? <Banner tone="error" title={SUSPENDED.title}>{SUSPENDED.body}</Banner>
          : locked ? <Banner tone="warning" title={NO_PROFILE.title}>{NO_PROFILE.body}</Banner> : null}
        {r.womenOnly ? <Banner tone="info" icon="shield-check" title="Women-only run">Only women runners can see and join this run.</Banner> : null}
        {r.cap === 2 && !hosting ? <Banner tone="info" icon="users" title="1:1 run">{hostFirst} approves who joins. Text your plan to someone you trust from the pacr app before you go.</Banner> : null}
        {r.safetyCheck && !r.safeAt && inRun && now >= Date.parse(r.endsAt) ? <Banner tone="warning" icon="shield-alert" title="Back from your run?">Mark yourself safe in the pacr app, so nobody worries.</Banner> : null}

        <div className="only-md"><Card><div className="stack">{cta("top")}</div></Card></div>

        <div className="block">
          {r.isExact && r.lat != null && r.lng != null ? <PlaceMap lat={r.lat} lng={r.lng} label={r.placeName} /> : null}
          <dl className="dl">
            <dt><Icon name={r.isExact ? "map-pin" : "lock"} size={17} />Meet</dt>
            <dd>{r.isExact ? <>{place || "Shown in the app"}{r.meetPoint ? <div className="t-caption">{r.meetPoint}</div> : null}</>
              : <>Spot shared on approval<div className="t-caption">{r.myStatus === "pending" ? `Waiting for ${hostFirst} to approve` : `${hostFirst} approves who joins`} · the exact spot shows after</div></>}</dd>
            <dt><Icon name="clock" size={17} />When</dt><dd>{whenLine(r.startsAt)}</dd>
            <dt><Icon name="route" size={17} />Distance</dt><dd className="num">{kmLabel(r.distanceKm)}</dd>
            <dt><Icon name="gauge" size={17} />Pace</dt><dd>{PACE_LABEL[r.pace]}</dd>
            <dt><Icon name="users-round" size={17} />Runners</dt><dd className="num">{r.acceptedCount} of {r.cap}</dd>
          </dl>
          {r.isExact && (r.lat != null || place) ? <DirectionsLink lat={r.lat} lng={r.lng} placeId={r.googlePlaceId} address={place} /> : null}
          {r.note ? <p className="t-secondary" style={{ margin: 0 }}>&ldquo;{r.note}&rdquo; · {hostFirst}</p> : null}
        </div>

        <div className="block">
          <h2>Who&apos;s running</h2>
          <div>{r.members.map(m => <RunnerRow key={m.userId} name={m.name} avatar={m.avatar} href={personHref(m.userId)} isYou={m.userId === uid}
            sub={m.userId === uid ? (m.isHost ? "Host" : "Joined") : `${m.isHost ? "Host · " : ""}${showUpLine(m)}${m.ranWith ? ` · ran together ${m.ranWith}×` : ""}`} />)}</div>
          {open > 0 && r.status === "open" ? <span className="t-caption">{open} open {open === 1 ? "spot" : "spots"}{r.womenOnly ? " for women runners nearby" : ""}</span> : null}
          {!inRun ? <span className="t-caption"><Icon name="lock" size={13} /> Run chat opens once you&apos;re in the group.</span> : null}
        </div>
      </div>

      <aside className="stack sticky">
        <Card className="hide-md"><div className="stack">{cta("side")}</div></Card>
        <AppBar title={inRun ? "Chat and check in from the app" : "Post a run in the app"} sub={inRun ? "Run chat, I'm here and I'm safe are in pacr." : "Posting, run chat and safety check-ins are in pacr."} />
        <SafetyCard />
        {!hosting && host ? <Button variant="ghost" size="sm" icon="flag" onClick={() => setReporting(true)} style={{ alignSelf: "flex-start" }}>Report this run</Button> : null}
      </aside>
    </div>

    <Dialog open={leaving} onClose={() => setLeaving(false)} title="Leave this run?"
      actions={<><Button variant="secondary" onClick={() => setLeaving(false)}>Stay</Button>
        <Button variant="destructive" loading={busy} onClick={() => { setLeaving(false); void act(() => leaveOpenRun(r.id), () => "You left the run"); }}>{r.leaveIsLate ? "Leave anyway" : "Leave"}</Button></>}>
      <p style={{ margin: 0 }}>{r.leaveIsLate ? "Leaving less than 2 hours before the start counts as a no-show." : `${hostFirst} and the group get a note that you left.`}</p>
    </Dialog>
    {host ? <ReportDialog open={reporting} onClose={() => setReporting(false)} runId={r.id} people={[{ userId: host.userId, name: host.name }]} defaultUser={host.userId} /> : null}
  </div>;
}

function PastView({ p }: { p: PastRun }) {
  const [reporting, setReporting] = useState(false);
  const place = [p.placeName, p.placeAddress].filter(Boolean).join(", ");
  return <div className="pw-container" style={{ paddingTop: 16, paddingBottom: 64 }}>
    <Breadcrumbs items={[{ label: "Run buddies", href: "/runbuddies?tab=past" }, { label: p.title }]} />
    <div className="split" style={{ marginTop: 20 }}>
      <div className="stack" style={{ gap: 20 }}>
        <Head iso={p.startsAt} title={p.title} now={0}>
          {p.outcome === "cancelled" ? <TrustTag kind="cancelled" /> : p.outcome === "left" ? <Badge>You left</Badge> : <Badge tone="success" icon="check">Ran</Badge>}
          {p.isHost ? <TrustTag kind="organiser">Hosted</TrustTag> : null}
          {p.womenOnly ? <TrustTag kind="women-only" /> : null}
        </Head>
        {p.safetyDue ? <Banner tone="warning" icon="shield-alert" title="Back from your run?">Mark yourself safe in the pacr app, so nobody worries.</Banner> : null}
        <dl className="dl">
          {place ? <><dt><Icon name="map-pin" size={17} />Met</dt><dd>{place}{p.meetPoint ? <div className="t-caption">{p.meetPoint}</div> : null}</dd></> : null}
          <dt><Icon name="route" size={17} />Distance</dt><dd className="num">{kmLabel(p.distanceKm)}</dd>
          <dt><Icon name="gauge" size={17} />Pace</dt><dd>{PACE_LABEL[p.pace]}</dd>
        </dl>
        <div className="block">
          <h2>{p.outcome === "ran" ? "Who you ran with" : "Who was in"}</h2>
          {p.people.length ? <div>{p.people.map(x => <RunnerRow key={x.userId} name={x.name} avatar={x.avatar} href={personHref(x.userId)}
            sub={`${x.isHost ? "Host · " : ""}${showUpLine({ showed: x.showed ?? 0, noShows: x.noShows ?? 0 })}`} />)}</div>
            : <span className="t-secondary">{p.departed ? "The others in this run have since left pacr." : "Nobody else was in this run."}</span>}
          {p.canMark ? <span className="t-caption">Say who showed up from the pacr app, until a week after the run. Only used for show-up records.</span> : null}
        </div>
      </div>
      <aside className="stack sticky">
        <AppBar title="Follow and mark who showed up" sub="Show-up marks and follows are in the pacr app." />
        <SafetyCard />
        {p.outcome !== "cancelled" ? <Button variant="ghost" size="sm" icon="flag" onClick={() => setReporting(true)} style={{ alignSelf: "flex-start" }}>Something felt wrong?</Button> : null}
      </aside>
    </div>
    <ReportDialog open={reporting} onClose={() => setReporting(false)} runId={p.id} people={p.people.map(x => ({ userId: x.userId, name: x.name }))}
      defaultUser={p.people.length === 1 ? p.people[0].userId : null} />
  </div>;
}
