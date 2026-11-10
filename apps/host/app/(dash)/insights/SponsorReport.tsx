"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { BarChart, Button, Checkbox, GlassCard } from "@/components/ds";
import { kMuted } from "@/components/shell/kit";
import { weekLabel } from "@/lib/api";
import { day, km as fmtKm, num } from "@/lib/format";
import { useHost } from "@/lib/host";
import { sum, type Computed, type Loaded } from "./types";

type Sec = "community" | "running" | "top" | "upcoming" | "events";

/** A4 at 96 px per inch: the sheet is laid out at print size and scaled down on screen. */
const A4_W = 794, A4_H = 1123;

/** Scale that fits an A4-wide sheet into the stage's width (never above 1). */
function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = () => setScale(Math.min(1, el.clientWidth / A4_W));
    m();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(m) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); };
  }, []);
  return { ref, scale };
}

export function SponsorReport({ data, c }: { data: Loaded; c: Computed }) {
  const { host } = useHost();
  const [sec, setSec] = useState<Record<Sec, boolean>>({ community: true, running: true, top: true, upcoming: true, events: true });
  const tog = (k: Sec) => (v: boolean) => setSec(s => ({ ...s, [k]: v }));
  const { ref: fitRef, scale } = useFit();
  const { detail, starts, now } = data;
  const name = detail?.name ?? host.name;
  const labels = starts.map(s => weekLabel(new Date(s)));

  const activeAll = new Set<string>();
  c.who.forEach(s => s.forEach(u => activeAll.add(u)));
  const topWeeks = c.km.map((v, i) => ({ v, i })).filter(w => w.v > 0).sort((a, b) => b.v - a.v).slice(0, 3);
  const upcoming = data.upcoming.filter(r => new Date(r.event_at).getTime() > now).sort((a, b) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime()).slice(0, 3);
  const events = data.events.filter(e => e.status === "published" || e.status === "ended").sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()).slice(0, 5);
  // Private squads' /s/ pages say "This squad isn't public", so they get pacr.life.
  const link = host.isPublic && host.slug ? `pacr.life/s/${host.slug}` : null;

  const cell = (k: string, v: string) => (
    <div key={k} style={{ padding: "14px 16px", borderRadius: 10, background: "var(--surface-panel)", minWidth: 0 }}>
      <div style={{ font: "400 12px var(--font-sans)", color: "var(--text-muted)" }}>{k}</div>
      <div style={{ font: "500 24px/1.2 var(--font-sans)", marginTop: 6, overflowWrap: "anywhere" }}>{v}</div>
    </div>
  );
  const h: React.CSSProperties = { font: "500 15px var(--font-sans)", marginBottom: 8 };
  const rowS: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderTop: "1px solid var(--border-subtle)", font: "400 13px var(--font-sans)" };
  const any = Object.entries(sec).some(([k, v]) => v && (k !== "events" || events.length > 0));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 12, alignItems: "start" }}>
      <GlassCard className="no-print" title="Build a sponsor report" subtitle="One page you can send to a brand partner">
        <div className="pc-label" style={{ margin: "0 0 10px" }}>Sections</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Checkbox label="Community" description="Members, verified badge, km this week" checked={sec.community} onChange={tog("community")} />
          <Checkbox label="Running" description="Km, runs and active runners in the last 12 weeks, with weekly km" checked={sec.running} onChange={tog("running")} />
          <Checkbox label="Top weeks" description="The 3 biggest weeks by km" checked={sec.top} onChange={tog("top")} />
          <Checkbox label="Upcoming runs" description="The next 3 runs with who is going" checked={sec.upcoming} onChange={tog("upcoming")} />
          {events.length > 0 ? <Checkbox label="Events" description="Published and ended events with tickets sold and checked in" checked={sec.events} onChange={tog("events")} /> : null}
        </div>
        <div style={{ display: "flex", marginTop: 18 }}>
          <Button icon="download" style={{ flex: 1 }} onClick={() => window.print()}>Print or save as PDF</Button>
        </div>
      </GlassCard>
      <div className="report-stage" style={{ padding: 16, borderRadius: 16, background: "var(--ink-100)", gridColumn: "span 2", minWidth: 0 }}>
        <div ref={fitRef} className="report-fit" style={{ height: A4_H * scale, overflow: "hidden" }}>
        <div className="report-sheet" style={{ width: A4_W, height: A4_H, transform: `scale(${scale})`, transformOrigin: "top left", background: "#fff", boxShadow: "var(--shadow-md)", padding: "56px 60px 44px", display: "flex", flexDirection: "column", gap: 28, color: "var(--text-strong)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "500 30px/1.15 var(--font-sans)", color: "var(--text-strong)" }}>{name}</div>
              <div style={{ ...kMuted, fontSize: 14, marginTop: 6 }}>Community report · last 12 weeks</div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- a plain img prints reliably */}
            <img src="/host/logo-dark.png" alt="pacr" width={90} height={40} style={{ flexShrink: 0 }} />
          </div>
          {sec.community ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {cell("Members", num(detail?.member_count ?? data.roster.members.length))}
              {cell("Verified squad", (detail?.verified ?? host.verified) ? "Yes" : "No")}
              {cell("Km this week", fmtKm(data.weekKm))}
            </div>
          ) : null}
          {sec.running ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {cell("Km run", fmtKm(sum(c.km)))}{cell("Runs logged", num(sum(c.runCount)))}{cell("Active runners", num(activeAll.size))}
              </div>
              <div>
                <div style={h}>Km per week</div>
                <BarChart height={200} legend={false} yTicks={2} labels={labels} series={[{ name: "Km", data: c.km.map(v => Math.round(v)), color: "var(--chart-1)" }]} />
              </div>
            </>
          ) : null}
          {sec.top && topWeeks.length ? (
            <div><div style={h}>Top weeks</div>
              {topWeeks.map(w => <div key={w.i} style={rowS}><span>{labels[w.i]} · from {day(new Date(starts[w.i]))}</span><span style={{ color: "var(--text-muted)" }}>{fmtKm(w.v)} km</span></div>)}
            </div>
          ) : null}
          {sec.upcoming && upcoming.length ? (
            <div><div style={h}>Upcoming runs</div>
              {upcoming.map(r => <div key={r.id} style={rowS}><span>{r.title} · {day(r.event_at)}</span><span style={{ color: "var(--text-muted)" }}>{num(r.going_count)} going</span></div>)}
            </div>
          ) : null}
          {sec.events && events.length ? (
            <div><div style={h}>Events</div>
              {events.map(e => <div key={e.id} style={rowS}><span>{e.title} · {day(e.starts_at)}</span><span style={{ color: "var(--text-muted)" }}>{num(e.sold)} sold · {num(e.checked_in)} checked in</span></div>)}
            </div>
          ) : null}
          {!any ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", ...kMuted, fontSize: 14 }}>Pick at least one section</div> : null}
          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", gap: 16, font: "400 12px var(--font-sans)", color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>{link ?? "pacr.life"}</span>
            <span>{day(new Date(now))}</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
