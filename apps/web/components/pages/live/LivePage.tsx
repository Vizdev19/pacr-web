"use client";
// /live?t=<token>: LiveRunPanel on get_live_run, polled like js/live.js:
// every 10 s while the tab is in view, every 30 s behind, at once when it
// comes back, and not at all once the run is finished, ended or closed. A
// failed fetch keeps what's on screen; the server ages it into 'stale'.
//
// LiveRunPanel draws 'live' and 'finished'. Its head says "Running now" with
// a pulsing dot, which would be untrue for a paused, stale, lost or ended run,
// so those use the same card (its pw-live classes) with words that match.
import { useEffect, useState, type ReactNode } from "react";
import { MapEmbed } from "@/components/ds/actions";
import { LiveRunPanel } from "@/components/ds/content";
import { Avatar, Badge, Card, Icon, TrustTag } from "@/components/ds/core";
import { EmptyState, Skeleton } from "@/components/ds/feedback";
import { Banner } from "@/components/ds/overlays";
import {
  POLL_HIDDEN_MS, POLL_VISIBLE_MS, TERMINAL, TOKEN_RE, clock, copyFor, drawable, endInFrame, liveClient, pace, routeOf, span,
  type LiveRaw, type LiveState,
} from "@/lib/live";

type Snap = { d: LiveRaw; at: number };

export function LivePage({ token }: { token: string | null }) {
  const valid = !!token && TOKEN_RE.test(token);
  const [snap, setSnap] = useState<Snap | null | "closed">(valid ? null : "closed");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!valid) return;
    let alive = true, done = false, busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      clearTimeout(timer);
      if (!alive || done || busy) return;
      busy = true;
      try {
        const { data, error } = await liveClient().rpc("get_live_run", { p_token: token });
        if (error) throw error;
        if (!alive) return;
        if (!data) { done = true; setSnap("closed"); return; }
        const d = data as LiveRaw;
        if (TERMINAL.has(d.state)) done = true;
        setSnap({ d, at: Date.now() });
      } catch {
        // Keep the last position on screen rather than an error.
      } finally {
        busy = false;
      }
      if (alive && !done) timer = setTimeout(tick, document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
    };
    // A tab coming back to the front refreshes now, not in 30 s.
    const vis = () => { if (!document.hidden) void tick(); };
    timer = setTimeout(tick, 0);
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearTimeout(timer); document.removeEventListener("visibilitychange", vis); };
  }, [token, valid]);

  // "Last updated 20 s ago" keeps counting between polls.
  const state: LiveState | null = snap === "closed" ? "closed" : snap ? snap.d.state : null;
  const counting = state === "live" || state === "paused" || state === "stale" || state === "lost";
  useEffect(() => {
    if (!counting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [counting]);

  if (snap === null) return <div className="pw-reading pw-page"><div className="stack" style={{ gap: "var(--space-4)" }}>
    <span className="t-overline">Loading</span><h1 className="t-h1">Opening the link</h1><Skeleton variant="stat" /></div></div>;

  if (snap === "closed") {
    const c = copyFor("closed", null, 0);
    return <div className="pw-reading sec"><EmptyState icon="clock" title={c.headline} body={c.sub} action="Get pacr" href="/download" /></div>;
  }

  const { d, at } = snap;
  const age = (Number(d.stale_sec) || 0) + Math.max(0, (now - at) / 1000);
  const c = copyFor(d.state, d.runner, age);
  const runner = d.runner || "A runner";
  const degraded = d.state === "stale" || d.state === "lost" || d.state === "ended";
  const route = routeOf(d);
  const stats = { distance: (Number(d.distance_km) || 0).toFixed(2), time: clock(d.elapsed_sec), pace: pace(d.pace_sec_per_km) };

  return <div className="pw-reading pw-page"><div className="stack" style={{ gap: "var(--space-5)" }}>
    <div className="stack" style={{ gap: "var(--space-2)" }}>
      <span className="t-overline">{c.flag}</span>
      <h1 className="t-h1">{c.headline}</h1>
      {d.title ? <div><Badge icon="route">{d.title}</Badge></div> : null}
      {!degraded ? <p className="t-secondary" style={{ margin: 0 }}>{c.sub}</p> : null}
    </div>
    {degraded ? <Banner tone={d.state === "lost" ? "error" : "warning"} icon={d.state === "ended" ? "flag" : "wifi-off"}>{c.sub}</Banner> : null}

    {d.state === "armed" ? null
      : d.state === "finished" ? <LiveRunPanel runner={runner} state="finished" route={drawable(route) ? route : null} {...stats} />
      : d.state === "live" && drawable(route) ? <LiveRunPanel runner={runner} state="live" route={route} updated={`${span(age)} ago`} {...stats} />
      : <Held state={d.state} runner={runner} route={route} age={age} {...stats} />}

    <Banner tone="neutral" icon="shield-alert"><b>{runner}</b> shared this link from pacr. It updates only while their phone has a connection, and it stops working the moment they turn it off. This page doesn&apos;t notify anyone and isn&apos;t an emergency service.</Banner>
  </div></div>;
}

const HELD: Partial<Record<LiveState, { sub: (age: number) => string; tag: ReactNode; pin: string; upd: (age: number) => string }>> = {
  live: { sub: () => "Running now", tag: <TrustTag kind="live" />, pin: "Here now", upd: a => `Last updated ${span(a)} ago` },
  paused: { sub: () => "Paused", tag: <Badge icon="clock">Paused</Badge>, pin: "Paused here", upd: a => `Last updated ${span(a)} ago` },
  stale: { sub: a => `No update for ${span(a)}`, tag: <Badge tone="warning" icon="wifi-off">No update</Badge>, pin: "Last known position", upd: a => `Last updated ${span(a)} ago` },
  lost: { sub: () => "Phone stopped reporting", tag: <Badge tone="danger" icon="wifi-off">Not reporting</Badge>, pin: "Last seen here", upd: a => `Last seen ${span(a)} ago` },
  ended: { sub: () => "Stopped reporting", tag: <Badge>Ended</Badge>, pin: "Last known position", upd: () => "The last numbers it sent" },
};

/** LiveRunPanel's card for the states it has no words for, with the last position pinned. */
function Held({ state, runner, route, age, distance, time, pace }: { state: LiveState; runner: string; route: ReturnType<typeof routeOf>; age: number; distance: string; time: string; pace?: string }) {
  const h = HELD[state] ?? HELD.ended!;
  const end = endInFrame(drawable(route) ? route : route.slice(0, 1));
  return <Card pad={false} className="pw-live">
    <div className="pw-live__head"><Avatar name={runner} size={40} /><div style={{ flex: 1, lineHeight: 1.3 }}><b>{runner}</b><div className="t-caption">{h.sub(age)}</div></div>{h.tag}</div>
    {end ? <MapEmbed route={drawable(route) ? route : null} ratio="16:9" radius={0} label={h.pin} pins={[{ x: end.x, y: end.y, label: h.pin, active: true }]} /> : null}
    <div className="pw-live__stats"><div><span className="t-caption">Distance</span><b>{distance}<small className="t-caption"> km</small></b></div><div><span className="t-caption">Time</span><b>{time}</b></div><div><span className="t-caption">Pace</span><b>{pace ?? "—"}<small className="t-caption"> /km</small></b></div></div>
    <div className="pw-live__upd"><Icon name="clock" size={15} />{h.upd(age)}</div>
  </Card>;
}
