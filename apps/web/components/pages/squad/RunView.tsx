"use client";
// /s/<slug>?run=<ref>: ui_kits/website/Run.jsx on one of get_club_page's
// runs. RSVP is the app's own write (announcement_rsvps). While the runner is
// going and staff have check-in open (my_run_checkin), "Show my check-in QR"
// shows the code the app shows: "PACR1:" + my_checkin_code(), re-reading
// my_run_checkin every few seconds so the scan lands as "You're checked in".
import { useEffect, useState } from "react";
import { Button, Card, Icon, IconButton, TrustTag, VerifiedMark } from "@/components/ds/core";
import { DateTile, RunCard } from "@/components/ds/content";
import { DirectionsLink, PlaceMap, QRBlock } from "@/components/ds/actions";
import { BottomSheet, EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { Breadcrumbs } from "@/components/ds/nav";
import { Banner } from "@/components/ds/overlays";
import { istParts, km, pace, TZ, whenLine } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { decodeRef, type Squad, type SquadRun } from "@/lib/squad";
import { InviteBanner, JoinAction, runCardProps, type JoinState } from "./parts";

/** What the app puts in a runner's check-in QR (squadScreen.ts CHECKIN_QR_PREFIX). */
const CHECKIN_QR_PREFIX = "PACR1:";
const POLL_MS = 4000;

export type RunViewProps = {
  squad: Squad; run: SquadRun | null; today: string; signedIn: boolean; authLoading: boolean; invited: boolean;
  onGetApp: () => void;
  joinState: JoinState; busy: boolean; onJoin: () => void; signin: string; appHref: string; squadHref: string; runHref: (ref: string) => string;
  /** False for a women-only run when the runner's profile says they aren't a woman. */
  canRsvp: (r: SquadRun) => boolean; onRsvp: (r: SquadRun) => void; onShare: () => void; canShare: boolean; myName: string | null;
};

type Checkin = { open: boolean; checkedIn: boolean };

async function myRunCheckin(ref: string): Promise<Checkin | null> {
  const id = decodeRef(ref);
  if (!id) return null;
  const { data, error } = await getSupabase().rpc("my_run_checkin", { p_run_id: id });
  if (error || !data || typeof data !== "object") return null;
  const d = data as { open?: boolean; checked_in?: boolean };
  return { open: !!d.open, checkedIn: !!d.checked_in };
}

function fullDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long" }).format(new Date(iso));
}

export function RunView(p: RunViewProps) {
  const { squad: s, run: r, joinState } = p;
  const member = joinState === "member";
  const going = !!r?.goingByMe && member;
  const [checkin, setCheckin] = useState<Checkin | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null | "loading">("loading");
  const ref = r?.ref ?? null;

  // Is check-in open? Asked once the runner is going; staff open it at the meeting point.
  useEffect(() => {
    if (!ref || !going) return;
    let live = true;
    void myRunCheckin(ref).then(c => { if (live) setCheckin(c); });
    return () => { live = false; };
  }, [ref, going]);

  // While the QR is up: my code, and a re-read of my check-in every few seconds.
  useEffect(() => {
    if (!qrOpen || !ref) return;
    let live = true;
    void getSupabase().rpc("my_checkin_code").then(({ data }) => {
      if (live) setQr(typeof data === "string" && data ? CHECKIN_QR_PREFIX + data : null);
    }, () => { if (live) setQr(null); });
    const t = setInterval(() => { void myRunCheckin(ref).then(c => { if (live && c) setCheckin(c); }); }, POLL_MS);
    return () => { live = false; clearInterval(t); };
  }, [qrOpen, ref]);

  const others = s.runs.filter(x => x.ref !== r?.ref);
  const otherCards = others.map(x => <RunCard key={x.ref} {...runCardProps(x, { today: p.today, squadWomenOnly: s.womenOnly, href: p.runHref(x.ref), showCta: false })} />);

  if (!r) return <div className="pw-container" style={{ paddingTop: "var(--space-12)", paddingBottom: "var(--space-16)", maxWidth: "var(--grid-reading)" }}>
    <Breadcrumbs items={[{ label: s.name, href: p.squadHref }, { label: "Run" }]} />
    <div style={{ marginTop: "var(--space-6)" }}>
      <EmptyState icon="calendar-x" title="This run is no longer on the calendar"
        body={others.length || s.runs.length ? `It has finished, or the organisers took it off. Here are ${s.name}'s next runs.` : `It has finished, or the organisers took it off. ${s.name} has no other runs on the calendar right now.`}
        action={`See ${s.name}`} href={p.squadHref} />
    </div>
    {s.runs.length ? <div className="stack">{s.runs.map(x => <RunCard key={x.ref} {...runCardProps(x, { today: p.today, squadWomenOnly: s.womenOnly, href: p.runHref(x.ref), showCta: false })} />)}</div> : null}
  </div>;

  const t = istParts(r.startsAt);
  const dist = km(r.distanceKm);
  const paceText = pace(r.paceLabel);
  const pinned = r.lat != null && r.lng != null;
  const allowed = p.canRsvp(r);
  const showQr = going && !!checkin?.open;
  const n = r.goingCount;
  const leader = r.leaderName ? (r.leaderTitle ? `${r.leaderName} · ${r.leaderTitle}` : r.leaderName) : null;

  const rsvpButton = (size: "md" | "lg") => {
    if (p.authLoading || (p.signedIn && joinState === "loading")) return <Button size={size} block loading>RSVP</Button>;
    if (!p.signedIn) return <Button size={size} block icon="smartphone" onClick={p.onGetApp}>{size === "lg" ? "RSVP in the pacr app" : "RSVP in the app"}</Button>;
    if (!member) return <JoinAction state={joinState} policy={s.joinPolicy} signin={p.signin} onJoin={p.onJoin} onGetApp={p.onGetApp} busy={p.busy} block />;
    if (!allowed && !going) return <Button size={size} block variant="secondary" icon="shield-check" disabled>Women only</Button>;
    return <Button size={size} block variant={going ? "secondary" : "primary"} className="pw-rsvp" aria-pressed={going} icon={going ? "check" : "calendar-plus"} onClick={() => p.onRsvp(r)}>{going ? "Going" : "RSVP"}</Button>;
  };
  const rsvpNote = !p.signedIn ? "RSVP is free, in the pacr app."
    : !member ? (joinState === "banned" ? null : `Join ${s.name} to RSVP to its runs.`)
    : !allowed && !going ? "This run is for women, by the squad's rules in the app."
    : going ? null : "RSVP is free.";

  return <div className="pw-container" style={{ paddingTop: "var(--space-4)", paddingBottom: "var(--space-16)" }}>
    <Breadcrumbs items={[{ label: s.name, href: p.squadHref }, { label: r.title }]} />
    {p.invited && !member && joinState !== "banned" ? <div style={{ marginTop: "var(--space-4)" }}><InviteBanner name={s.name} signedIn={p.signedIn} appHref={p.appHref} /></div> : null}
    <div className="split" style={{ marginTop: "var(--space-5)" }}>
      <div>
        <div className="row" style={{ alignItems: "flex-start", gap: "var(--space-4)", flexWrap: "nowrap" }}>
          <DateTile dow={t.dow} day={t.day} month={t.month} time={t.time} today={t.ymd === p.today} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={p.squadHref} className="row t-body-s" style={{ textDecoration: "none", color: "var(--text-secondary)", gap: "var(--space-1)" }}><b>{s.name}</b>{s.verified ? <VerifiedMark size={15} /> : null}</a>
            <h1 className="t-h1" style={{ margin: "var(--space-1) 0 var(--space-3)" }}>{r.title}</h1>
            <div className="pw-tags">
              {r.womenOnly ? <TrustTag kind="women-only" /> : null}
              <TrustTag kind="repeats">{r.repeatWeekly ? `Every ${fullDay(r.startsAt)}` : "One-off run"}</TrustTag>
              {going ? <TrustTag kind="going" /> : null}
            </div>
          </div>
          {p.canShare ? <IconButton icon="share-2" label="Share run" variant="secondary" onClick={p.onShare} /> : null}
        </div>
        {r.womenOnly ? <div style={{ marginTop: "var(--space-5)" }}><Banner tone="info" title="Women-only run">Everyone can see this run. Only women can RSVP, by the squad&apos;s rules in the app.</Banner></div> : null}
        <div className="block" style={{ marginTop: "var(--space-8)" }}>
          {pinned || r.meetingPoint ? <>
            <PlaceMap lat={r.lat} lng={r.lng} label={r.meetingPoint} />
            <div><DirectionsLink address={r.meetingPoint} lat={r.lat} lng={r.lng} placeId={r.placeId} /></div>
          </> : null}
          <dl className="dl">
            {r.meetingPoint ? <><dt><Icon name="map-pin" size={17} />Meet</dt><dd>{r.meetingPoint}</dd></> : null}
            <dt><Icon name="clock" size={17} />When</dt><dd>{whenLine(r.startsAt)}</dd>
            {dist ? <><dt><Icon name="route" size={17} />Distance</dt><dd className="num">{dist} km</dd></> : null}
            {paceText ? <><dt><Icon name="gauge" size={17} />Pace</dt><dd className="num">{paceText}</dd></> : null}
            {leader ? <><dt><Icon name="flag" size={17} />Run leader</dt><dd>{leader}</dd></> : null}
          </dl>
        </div>
        {others.length ? <div className="block"><h2>{s.name}&apos;s other runs</h2><div className="stack">{otherCards}</div></div> : null}
      </div>

      <aside className="stack sticky">
        <Card className="hide-md"><div className="stack">
          <span className="t-body-s"><b className="num">{n}</b> going</span>
          {rsvpButton("lg")}
          {going && pinned ? <DirectionsLink address={r.meetingPoint} lat={r.lat} lng={r.lng} placeId={r.placeId} /> : null}
          {rsvpNote ? <span className="t-caption">{rsvpNote}{!p.signedIn ? <> Already on pacr? <a href={p.signin}>Sign in</a>.</> : null}</span> : null}
        </div></Card>
        {showQr ? <Card><div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
          {checkin?.checkedIn ? <TrustTag kind="checked-in" /> : <TrustTag kind="checkin-open" />}
          <b>{checkin?.checkedIn ? "You're checked in" : "Check-in is open"}</b>
          <Button block icon="qr-code" onClick={() => { setQr("loading"); setQrOpen(true); }}>Show my check-in QR</Button>
        </div></Card> : null}
      </aside>
    </div>

    <div className="only-md mbar" style={{ bottom: p.signedIn ? "var(--tabbar-h)" : 0, zIndex: 31 }}>
      <div><b className="num">{n} going</b><div className="t-caption">{t.dow}, {t.time}{dist ? ` · ${dist} km` : ""}</div></div>
      <div style={{ flex: "none" }}>{showQr ? <Button block icon="qr-code" onClick={() => { setQr("loading"); setQrOpen(true); }}>My QR</Button> : rsvpButton("md")}</div>
    </div>

    <BottomSheet open={qrOpen} onClose={() => setQrOpen(false)} title="Check-in QR">
      <div className="stack" style={{ alignItems: "center", textAlign: "center", gap: "var(--space-3)" }}>
        {checkin?.checkedIn
          ? <><TrustTag kind="checked-in" size="lg" /><b>You&apos;re checked in</b><span className="t-caption">Have a good run.</span></>
          : qr === "loading" ? <Skeleton variant="ticket" />
          : qr ? <QRBlock large size={240} value={qr} refCode={p.myName ? p.myName.toUpperCase() : undefined} brightnessHint />
          : <ErrorState title="Your code didn't load" body="Check your connection and try again." onRetry={() => { setQrOpen(false); setTimeout(() => { setQr("loading"); setQrOpen(true); }, 0); }} />}
        <b>{r.title} · {t.time}</b>
        <span className="t-caption">Show this to {r.leaderName ?? "your run leader"} at the start.</span>
      </div>
    </BottomSheet>
  </div>;
}
