"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BarChart, Button, Checkbox, GlassCard, SegmentedControl, Select, Skeleton, Switch } from "@/components/ds";
import { kMuted, LoadError } from "@/components/shell/kit";
import * as api from "@/lib/api";
import type { HostedEvent, SquadReport } from "@/lib/api";
import { day, km as fmtKm, num } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { bucketLabel, istStart, parseDay, periods, type Period, type PeriodKind } from "./period";
import type { Loaded } from "./types";

/** A4 at 96 px per inch: each page is laid out at print size and scaled down on screen. */
const A4_W = 794, A4_H = 1123;
const PAD_T = 56, PAD_X = 60, PAD_B = 44, FOOT = 34, GAP = 22;
/** Room for blocks on one page, after the padding and the footer. */
const CAP = A4_H - PAD_T - PAD_B - FOOT - GAP;

// ── What a report can show ─────────────────────────────────────────────────

type GroupId = "summary" | "community" | "running" | "group" | "events" | "engagement" | "more";
const GROUPS: { id: GroupId; label: string }[] = [
  { id: "summary", label: "Headline" },
  { id: "community", label: "Community" },
  { id: "running", label: "Running" },
  { id: "group", label: "Group runs" },
  { id: "events", label: "Events" },
  { id: "engagement", label: "Engagement" },
  { id: "more", label: "More" },
];

type MetricId =
  | "headline"
  | "members" | "newMembers" | "activeShare" | "verified" | "newMembersChart"
  | "km" | "runs" | "activeRunners" | "time" | "avgRun" | "longest" | "kmChart" | "activeChart" | "distanceMix"
  | "groupRuns" | "checkins" | "avgTurnout" | "showUp" | "firstTimers" | "attendees" | "cancelled" | "turnoutTable" | "turnoutChart"
  | "eventsHosted" | "ticketsSold" | "eventCheckins" | "eventList"
  | "posts" | "kudos" | "comments" | "messages"
  | "bestPeriods" | "topRunners" | "upcoming" | "upcomingEvents";

type Metric = { id: MetricId; group: GroupId; label: string; desc: string; on: boolean; tile?: boolean };
const METRICS: Metric[] = [
  { id: "headline", group: "summary", label: "Headline", desc: "One sentence with the period’s biggest numbers", on: true },

  { id: "members", group: "community", label: "Members", desc: "Members at the end of the period", on: true, tile: true },
  { id: "newMembers", group: "community", label: "New members", desc: "Members who joined in the period", on: true, tile: true },
  { id: "activeShare", group: "community", label: "Members who ran", desc: "Share of members who logged a run", on: true, tile: true },
  { id: "verified", group: "community", label: "Verified squad", desc: "pacr’s verified badge", on: false, tile: true },
  { id: "newMembersChart", group: "community", label: "New members over time", desc: "Chart of joins", on: false },

  { id: "km", group: "running", label: "Km run", desc: "Km members logged on pacr", on: true, tile: true },
  { id: "runs", group: "running", label: "Runs logged", desc: "Runs members logged", on: true, tile: true },
  { id: "activeRunners", group: "running", label: "Active runners", desc: "Members with at least one run", on: true, tile: true },
  { id: "time", group: "running", label: "Time running", desc: "Hours on their feet", on: false, tile: true },
  { id: "avgRun", group: "running", label: "Average run", desc: "Distance and pace of a typical run", on: false, tile: true },
  { id: "longest", group: "running", label: "Longest run", desc: "The longest single run", on: false, tile: true },
  { id: "kmChart", group: "running", label: "Km over time", desc: "Chart of km", on: true },
  { id: "activeChart", group: "running", label: "Active runners over time", desc: "Chart of runners", on: false },
  { id: "distanceMix", group: "running", label: "Runs by distance", desc: "Under 5 km up to marathons", on: false },

  { id: "groupRuns", group: "group", label: "Group runs held", desc: "Squad runs that took place", on: true, tile: true },
  { id: "checkins", group: "group", label: "Check-ins", desc: "Runners checked in by QR", on: true, tile: true },
  { id: "avgTurnout", group: "group", label: "Average turnout", desc: "Check-ins per run that used check-in", on: true, tile: true },
  { id: "showUp", group: "group", label: "Show-up rate", desc: "Checked in out of those who said going", on: false, tile: true },
  { id: "firstTimers", group: "group", label: "First-timers", desc: "Runners at their first group run with the squad", on: false, tile: true },
  { id: "attendees", group: "group", label: "Runners at group runs", desc: "Different runners checked in", on: false, tile: true },
  { id: "cancelled", group: "group", label: "Runs cancelled", desc: "Squad runs called off", on: false, tile: true },
  { id: "turnoutTable", group: "group", label: "Turnout per run", desc: "Each run with going, checked in and first-timers", on: true },
  { id: "turnoutChart", group: "group", label: "Check-ins over time", desc: "Chart of check-ins", on: false },

  { id: "eventsHosted", group: "events", label: "Events hosted", desc: "Events held in the period", on: true, tile: true },
  { id: "ticketsSold", group: "events", label: "Tickets sold", desc: "Seats sold, with how full events were", on: true, tile: true },
  { id: "eventCheckins", group: "events", label: "Event check-ins", desc: "Ticket holders checked in", on: true, tile: true },
  { id: "eventList", group: "events", label: "Event list", desc: "Each event with tickets sold and checked in", on: true },

  { id: "posts", group: "engagement", label: "Posts", desc: "Posts shared in the squad", on: false, tile: true },
  { id: "kudos", group: "engagement", label: "Kudos", desc: "Kudos on the squad’s posts", on: false, tile: true },
  { id: "comments", group: "engagement", label: "Comments", desc: "Comments on the squad’s posts", on: false, tile: true },
  { id: "messages", group: "engagement", label: "Chat messages", desc: "Messages in the squad chat", on: false, tile: true },

  { id: "bestPeriods", group: "more", label: "Best stretches", desc: "The 3 biggest days, weeks or months by km", on: false },
  { id: "topRunners", group: "more", label: "Top runners", desc: "The 5 members with the most km. Shows their names", on: false },
  { id: "upcoming", group: "more", label: "Upcoming runs", desc: "The next 3 runs with who’s going", on: true },
  { id: "upcomingEvents", group: "more", label: "Upcoming events", desc: "The next 3 events with tickets sold so far", on: true },
];
const DEFAULTS = METRICS.filter(m => m.on).map(m => m.id);

// ── Helpers ────────────────────────────────────────────────────────────────

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const pace = (sec: number | null) => (sec == null ? null : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")} /km`);
const hours = (sec: number) => { const h = sec / 3600; return h < 10 ? (Math.round(h * 10) / 10).toLocaleString("en-IN") : num(Math.round(h)); };
const one = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-IN");
const many = (n: number, a: string, b = `${a}s`) => `${num(n)} ${n === 1 ? a : b}`;
/** Km with a decimal only while it matters: "8.4", "1,825". */
const bigKm = (n: number) => (n >= 100 ? num(Math.round(n)) : fmtKm(n));

type EvStats = { list: HostedEvent[]; count: number; sold: number; checkedIn: number; capacity: number; soldCapped: number };
/** Events that started in [from, to) and before `now`: one later this month hasn't been hosted yet. */
function eventStats(events: HostedEvent[], from: string, to: string, now: number): EvStats {
  const a = istStart(from), b = Math.min(istStart(to), now);
  const list = events
    .filter(e => (e.status === "published" || e.status === "ended") && Date.parse(e.starts_at) >= a && Date.parse(e.starts_at) < b)
    .sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at));
  const capped = list.filter(e => e.capacity != null && e.capacity > 0);
  return {
    list, count: list.length,
    sold: list.reduce((s, e) => s + e.sold, 0),
    checkedIn: list.reduce((s, e) => s + e.checked_in, 0),
    capacity: capped.reduce((s, e) => s + (e.capacity ?? 0), 0),
    soldCapped: capped.reduce((s, e) => s + e.sold, 0),
  };
}

/** Whether a metric has anything to show for this period (an empty one is left off the sheet). */
function emptyOf(id: MetricId, r: SquadReport, ev: EvStats, data: Loaded): boolean {
  switch (id) {
    case "newMembersChart": return r.members.joined === 0;
    case "kmChart": case "activeChart": case "distanceMix": case "bestPeriods": case "avgRun": case "longest": return r.running.runs === 0;
    case "turnoutTable": case "turnoutChart": return r.group_runs.runs.length === 0;
    case "showUp": return !r.group_runs.going;
    case "eventsHosted": case "ticketsSold": case "eventCheckins": return data.events.length === 0;
    case "eventList": return ev.count === 0;
    case "topRunners": return r.top_runners.length === 0;
    case "upcoming": return !data.upcoming.some(u => Date.parse(u.event_at) > data.now);
    case "upcomingEvents": return !nextEvents(data).length;
    default: return false;
  }
}

/** Published events still to come, soonest first. */
const nextEvents = (data: Loaded) => data.events
  .filter(e => e.status === "published" && Date.parse(e.starts_at) > data.now)
  .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(0, 3);

type Remember = { kind: PeriodKind; on: MetricId[]; compare: boolean };
const storeKey = (hostKey: string) => `pacr.host.report.${hostKey}`;
function recall(hostKey: string): Remember | null {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(hostKey)) ?? "null") as Remember | null;
    if (!v || !["week", "month", "year"].includes(v.kind) || !Array.isArray(v.on)) return null;
    return { kind: v.kind, on: v.on.filter(id => METRICS.some(m => m.id === id)), compare: !!v.compare };
  } catch { return null; }
}
function remember(hostKey: string, v: Remember) {
  try { localStorage.setItem(storeKey(hostKey), JSON.stringify(v)); } catch { /* private window: lasts this visit */ }
}

/** html-to-image drops class-based CSS on SVG parts (the chart's axis text and grid
 *  lines), so copy what they compute to inline styles for the capture. Returns an undo. */
const SVG_PROPS = ["font-family", "font-size", "font-weight", "fill", "stroke", "stroke-width", "stroke-dasharray", "opacity"];
function inlineSvgStyles(root: HTMLElement): () => void {
  const saved: [Element, string | null][] = [];
  root.querySelectorAll<SVGElement>("svg *").forEach(n => {
    saved.push([n, n.getAttribute("style")]);
    const cs = getComputedStyle(n);
    for (const k of SVG_PROPS) n.style.setProperty(k, cs.getPropertyValue(k));
  });
  return () => saved.forEach(([n, st]) => (st == null ? n.removeAttribute("style") : n.setAttribute("style", st)));
}

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

// ── Pages ──────────────────────────────────────────────────────────────────

/** One piece of the sheet. keepNext: never last on a page (headings).
 *  cont: the block to repeat when this one starts a page (a table's header).
 *  tight: no gap above it (a table's rows). */
type Block = { key: string; node: ReactNode; keepNext?: boolean; cont?: string; tight?: boolean };
/** Space above a block on its page: none at the top, none for a table's next row. */
const gapOf = (b: Block, first: boolean) => (first || b.tight ? 0 : GAP);

function paginate(blocks: Block[], extras: Map<string, Block>, h: (k: string) => number): Block[][] {
  const pages: Block[][] = [[]];
  let used = 0;
  const add = (b: Block) => { const pg = pages[pages.length - 1]; used += gapOf(b, !pg.length) + h(b.key); pg.push(b); };
  blocks.forEach((b, i) => {
    const page = pages[pages.length - 1];
    let need = gapOf(b, !page.length) + h(b.key);
    const nb = blocks[i + 1];
    if (b.keepNext && nb) need += gapOf(nb, false) + h(nb.key);
    if (page.length && used + need > CAP) {
      pages.push([]);
      used = 0;
      const c = b.cont ? extras.get(b.cont) : undefined;
      if (c) add(c);
    }
    add(b);
  });
  return pages;
}

// ── The report ─────────────────────────────────────────────────────────────

export function SponsorReport({ data }: { data: Loaded }) {
  const { host, notifyError } = useHost();
  const { phone, tablet } = useViewport();
  const saved = useMemo(() => recall(host.key), [host.key]);
  const [kind, setKind] = useState<PeriodKind>(saved?.kind ?? "month");
  const [on, setOn] = useState<Set<MetricId>>(() => new Set(saved?.on ?? DEFAULTS));
  const [compare, setCompare] = useState(saved?.compare ?? true);
  const list = useMemo(() => periods(kind, new Date(data.now)), [kind, data.now]);
  const [pick, setPick] = useState<string>(list[0].from);
  const period: Period = list.find(p => p.from === pick) ?? list[0];

  const save = (next: Partial<Remember>) => remember(host.key, { kind, on: [...on], compare, ...next });
  const setMetric = (id: MetricId, v: boolean) => {
    const n = new Set(on);
    if (v) n.add(id); else n.delete(id);
    setOn(n);
    save({ on: [...n] });
  };
  const changeKind = (k: string) => { const kk = k as PeriodKind; setKind(kk); setPick(periods(kk, new Date(data.now))[0].from); save({ kind: kk }); };

  const rep = useLoad(async () => {
    const [r, p] = await Promise.all([
      api.squadReport(host.id, period.from, period.to, period.bucket),
      api.squadReport(host.id, period.prev.from, period.prev.to, period.bucket),
    ]);
    return { r, p };
  }, `report:${host.key}:${period.from}:${period.to}`);

  return (
    <div style={{ display: "grid", gridTemplateColumns: phone || tablet ? "minmax(0,1fr)" : "minmax(280px, 340px) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
      <GlassCard className="no-print" title="Build a sponsor report" subtitle="Pick a period and what goes on it">
        <div className="pc-label" style={{ margin: "0 0 8px" }}>Period</div>
        <SegmentedControl block value={kind} onChange={changeKind}
          options={[{ value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} />
        <Select style={{ marginTop: 10 }} value={period.from} onChange={setPick}
          options={list.map(p => ({ value: p.from, label: p.current ? `${p.label} · so far` : p.label }))} />
        <div style={{ marginTop: 12 }}>
          <Switch checked={compare} onChange={v => { setCompare(v); save({ compare: v }); }} label={`Compare with ${period.prev.label}`} />
        </div>
        <Picker cols={tablet ? 2 : 1} on={on} setMetric={setMetric} r={rep.status === "ready" ? rep.data.r : null} data={data} period={period}
          reset={() => { setOn(new Set(DEFAULTS)); save({ on: DEFAULTS }); }} />
      </GlassCard>
      <div className="report-stage" style={{ padding: 16, borderRadius: 16, background: "var(--ink-100)", minWidth: 0 }}>
        {rep.status === "loading" ? (
          <div style={{ background: "#fff", borderRadius: 4, padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton width="50%" height={28} /><Skeleton width="100%" height={90} /><Skeleton width="100%" height={200} />
          </div>
        ) : rep.status === "error" ? (
          <LoadError what="the report" error={rep.error} onRetry={rep.reload} />
        ) : (
          <Sheets data={data} r={rep.data.r} p={rep.data.p} period={period} on={on} compare={compare}
            hostName={data.detail?.name ?? host.name} slug={host.slug} isPublic={host.isPublic}
            verified={!!(data.detail?.verified ?? host.verified)} onError={e => notifyError("Couldn’t make the PDF", e)} />
        )}
      </div>
    </div>
  );
}

function Picker({ cols, on, setMetric, r, data, period, reset }: {
  cols: number; on: Set<MetricId>; setMetric: (id: MetricId, v: boolean) => void; r: SquadReport | null; data: Loaded; period: Period; reset: () => void;
}) {
  const ev = useMemo(() => eventStats(data.events, period.from, period.to, data.now), [data.events, data.now, period]);
  const hasEvents = data.events.length > 0;
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="pc-label">On the report</div>
        <button type="button" onClick={reset} style={{ ...kMuted, background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}>Reset</button>
      </div>
      {GROUPS.filter(g => g.id !== "events" || hasEvents).map(g => (
        <div key={g.id} style={{ marginTop: 14 }}>
          <div style={{ ...kMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{g.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 10 }}>
            {METRICS.filter(m => m.group === g.id).map(m => {
              const empty = r ? emptyOf(m.id, r, ev, data) : false;
              return <Checkbox key={m.id} label={m.label} checked={on.has(m.id)} onChange={v => setMetric(m.id, v)}
                description={empty ? `${m.desc} · nothing in this period` : m.desc} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Sheets({ data, r, p, period, on, compare, hostName, slug, isPublic, verified, onError }: {
  data: Loaded; r: SquadReport; p: SquadReport; period: Period; on: Set<MetricId>; compare: boolean;
  hostName: string; slug: string | null | undefined; isPublic: boolean | undefined; verified: boolean; onError: (e: unknown) => void;
}) {
  const { ref: fitRef, scale } = useFit();
  const measureRef = useRef<HTMLDivElement>(null);
  const sheetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  // Private squads' /s/ pages say "This squad isn't public", so they get pacr.life.
  const link = isPublic && slug ? `pacr.life/s/${slug}` : "pacr.life";

  const { blocks, extras } = useMemo(
    () => buildBlocks({ data, r, p, period, on, compare, hostName, verified }),
    [data, r, p, period, on, compare, hostName, verified],
  );

  // Measure every block at print width, then pack them onto A4 pages.
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const m = () => {
      const next: Record<string, number> = {};
      el.querySelectorAll<HTMLElement>("[data-k]").forEach(n => { next[n.dataset.k as string] = Math.ceil(n.getBoundingClientRect().height); });
      setHeights(cur => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    };
    m();
    let live = true;
    if (typeof document !== "undefined" && document.fonts) document.fonts.ready.then(() => { if (live) m(); });
    return () => { live = false; };
  });
  const pages = useMemo(() => paginate(blocks, extras, k => heights[k] ?? 0), [blocks, extras, heights]);
  const nothing = blocks.length <= 1;

  // The PDF is the sheets themselves, drawn at print size (3x for sharp text), one A4 page each.
  // Both libraries load on the first click, not with the page.
  async function downloadPdf() {
    if (saving) return;
    setSaving(true);
    const undos: (() => void)[] = [];
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      const sheets = sheetRefs.current.slice(0, pages.length).filter((s): s is HTMLDivElement => !!s);
      for (let i = 0; i < sheets.length; i++) {
        undos.push(inlineSvgStyles(sheets[i]));
        const png = await toPng(sheets[i], { pixelRatio: 3, width: A4_W, height: A4_H, backgroundColor: "#fff", style: { transform: "none", boxShadow: "none" } });
        if (i) pdf.addPage("a4", "portrait");
        pdf.addImage(png, "PNG", 0, 0, 210, 297, undefined, "FAST");
      }
      const base = (slug || hostName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "squad";
      const when = period.kind === "year" ? period.from.slice(0, 4) : period.kind === "month" ? period.from.slice(0, 7) : period.from;
      pdf.save(`${base}-report-${when}.pdf`);
    } catch (e) {
      onError(e);
    } finally {
      undos.forEach(u => u());
      setSaving(false);
    }
  }

  const sheetStyle: CSSProperties = {
    width: A4_W, height: A4_H, transform: `scale(${scale})`, transformOrigin: "top left", background: "#fff", boxShadow: "var(--shadow-md)",
    padding: `${PAD_T}px ${PAD_X}px ${PAD_B}px`, display: "flex", flexDirection: "column", color: "var(--text-strong)", overflow: "hidden",
  };

  return (
    <>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={kMuted}>{pages.length} {pages.length === 1 ? "page" : "pages"} · A4</span>
        <Button icon="download" loading={saving} disabled={nothing} onClick={downloadPdf}>Download PDF</Button>
      </div>
      {/* An off-screen copy at print width, only for measuring. */}
      <div ref={measureRef} aria-hidden className="no-print" style={{ position: "fixed", left: -10000, top: 0, width: A4_W - 2 * PAD_X, visibility: "hidden", pointerEvents: "none" }}>
        {[...blocks, ...extras.values()].map(b => <div key={b.key} data-k={b.key} style={{ display: "flow-root" }}>{b.node}</div>)}
      </div>
      <div ref={fitRef}>
        {pages.map((pg, i) => (
          <div key={i} className="report-fit" style={{ height: A4_H * scale, overflow: "hidden", marginBottom: i < pages.length - 1 ? 16 : 0 }}>
            <div ref={el => { sheetRefs.current[i] = el; }} className="report-sheet" style={sheetStyle}>
              {pg.map((b, j) => <div key={b.key} style={{ display: "flow-root", marginTop: gapOf(b, j === 0), flexShrink: 0 }}>{b.node}</div>)}
              {nothing && i === 0 ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", ...kMuted, fontSize: 14 }}>Pick at least one thing to show</div> : null}
              <div style={{ marginTop: "auto", paddingTop: 12, flexShrink: 0, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", gap: 16, font: "400 12px var(--font-sans)", color: "var(--text-muted)" }}>
                <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>{link}</span>
                <span>{pages.length > 1 ? `Page ${i + 1} of ${pages.length} · ` : ""}{day(new Date(data.now))}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── The blocks ─────────────────────────────────────────────────────────────

function buildBlocks({ data, r, p, period, on, compare, hostName, verified }: {
  data: Loaded; r: SquadReport; p: SquadReport; period: Period; on: Set<MetricId>; compare: boolean; hostName: string; verified: boolean;
}): { blocks: Block[]; extras: Map<string, Block> } {
  const ev = eventStats(data.events, period.from, period.to, data.now);
  const evPrev = eventStats(data.events, period.prev.from, period.prev.to, data.now);
  const show = (id: MetricId) => on.has(id) && !emptyOf(id, r, ev, data);
  const labels = r.series.map(s => bucketLabel(period, s.start));
  const yearOf = parseDay(period.from);
  const g = r.group_runs;
  const withCheckin = g.runs.filter(x => x.checked_in > 0).length;

  const delta = (cur: number, before: number): string | undefined => {
    if (!compare || before <= 0) return undefined;
    const d = Math.round(((cur - before) / before) * 100);
    return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)}% vs ${period.prev.label}`;
  };
  const tiles: Partial<Record<MetricId, { v: string; sub?: string }>> = {
    members: { v: num(r.members.at_end), sub: r.members.joined ? `${num(r.members.joined)} joined in the period` : undefined },
    newMembers: { v: num(r.members.joined), sub: delta(r.members.joined, p.members.joined) },
    activeShare: { v: pct(r.running.active, r.members.at_end), sub: `${num(r.running.active)} of ${num(r.members.at_end)} logged a run` },
    verified: { v: verified ? "Yes" : "No", sub: verified ? "Checked by pacr" : undefined },
    km: { v: bigKm(r.running.km), sub: delta(r.running.km, p.running.km) },
    runs: { v: num(r.running.runs), sub: delta(r.running.runs, p.running.runs) },
    activeRunners: { v: num(r.running.active), sub: delta(r.running.active, p.running.active) },
    time: { v: `${hours(r.running.duration_sec)} h`, sub: delta(r.running.duration_sec, p.running.duration_sec) },
    avgRun: { v: r.running.avg_km == null ? "—" : `${fmtKm(r.running.avg_km)} km`, sub: pace(r.running.avg_pace_sec) ? `at ${pace(r.running.avg_pace_sec)}` : undefined },
    longest: { v: r.running.longest_km == null ? "—" : `${fmtKm(r.running.longest_km)} km` },
    groupRuns: { v: num(g.held), sub: delta(g.held, p.group_runs.held) },
    checkins: { v: num(g.checkins), sub: delta(g.checkins, p.group_runs.checkins) },
    avgTurnout: { v: withCheckin ? one(g.checkins / withCheckin) : "—", sub: withCheckin ? `runners per run · ${many(withCheckin, "run")} with check-in` : "No run used check-in" },
    showUp: { v: g.going ? pct(g.going_checked_in ?? 0, g.going) : "—", sub: g.going ? `${num(g.going_checked_in ?? 0)} of ${num(g.going)} who said going` : undefined },
    firstTimers: { v: num(g.first_timers), sub: delta(g.first_timers, p.group_runs.first_timers) },
    attendees: { v: num(g.unique), sub: delta(g.unique, p.group_runs.unique) },
    cancelled: { v: num(g.cancelled) },
    eventsHosted: { v: num(ev.count), sub: delta(ev.count, evPrev.count) },
    ticketsSold: { v: num(ev.sold), sub: ev.capacity ? `${pct(ev.soldCapped, ev.capacity)} of ${num(ev.capacity)} places` : delta(ev.sold, evPrev.sold) },
    eventCheckins: { v: num(ev.checkedIn), sub: ev.sold ? `${pct(ev.checkedIn, ev.sold)} of tickets` : undefined },
    posts: { v: num(r.engagement.posts), sub: delta(r.engagement.posts, p.engagement.posts) },
    kudos: { v: num(r.engagement.kudos), sub: delta(r.engagement.kudos, p.engagement.kudos) },
    comments: { v: num(r.engagement.comments), sub: delta(r.engagement.comments, p.engagement.comments) },
    messages: { v: num(r.engagement.messages), sub: r.engagement.chatters ? `from ${many(r.engagement.chatters, "member")}` : undefined },
  };

  const h: CSSProperties = { font: "500 15px var(--font-sans)", marginBottom: 8 };
  const rowS: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderTop: "1px solid var(--border-subtle)", font: "400 13px var(--font-sans)" };
  const mutedS: CSSProperties = { color: "var(--text-muted)", whiteSpace: "nowrap" };
  const cell = (id: MetricId, t: { v: string; sub?: string }) => (
    <div key={id} style={{ padding: "13px 16px", borderRadius: 10, background: "var(--surface-panel)", minWidth: 0 }}>
      <div style={{ font: "400 12px var(--font-sans)", color: "var(--text-muted)" }}>{METRICS.find(m => m.id === id)?.label}</div>
      <div style={{ font: "500 24px/1.2 var(--font-sans)", marginTop: 6, overflowWrap: "anywhere" }}>{t.v}</div>
      {t.sub ? <div style={{ font: "400 11px/1.35 var(--font-sans)", color: "var(--text-muted)", marginTop: 4 }}>{t.sub}</div> : null}
    </div>
  );
  const chart = (title: string, values: number[], name: string) => (
    <div><div style={h}>{title}</div>
      <BarChart height={180} legend={false} yTicks={2} labels={labels} valueLabels={labels.length <= 14 ? (v => (v ? num(Math.round(v)) : "")) : undefined}
        series={[{ name, data: values.map(v => Math.round(v * 10) / 10), color: "var(--chart-1)" }]} />
    </div>
  );

  const out: Block[] = [];
  const extras = new Map<string, Block>();
  out.push({
    key: "header",
    node: (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "500 30px/1.15 var(--font-sans)", color: "var(--text-strong)" }}>{hostName}</div>
          <div style={{ ...kMuted, fontSize: 14, marginTop: 6 }}>Community report · {period.label}{period.current ? ` · up to ${day(new Date(data.now))}` : ""}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- a plain img prints reliably */}
        <img src="/host/logo-dark.png" alt="pacr" width={90} height={40} style={{ flexShrink: 0 }} />
      </div>
    ),
  });

  if (show("headline")) {
    const bits: string[] = [];
    if (r.running.runs) bits.push(`${many(r.running.active, "runner")} logged ${bigKm(r.running.km)} km over ${many(r.running.runs, "run")}`);
    if (g.held) bits.push(`${many(g.held, "group run")} ${g.checkins ? `brought out ${many(g.checkins, "check-in")}` : "took place"}`);
    if (ev.count) bits.push(`${many(ev.count, "event")} sold ${many(ev.sold, "ticket")}`);
    if (r.members.joined) bits.push(`${many(r.members.joined, "new member")} joined`);
    if (bits.length) {
      const text = bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;
      out.push({ key: "headline", node: (
        <div style={{ padding: "16px 20px", borderRadius: 10, background: "var(--lime-100)", font: "400 16px/1.5 var(--font-sans)", color: "var(--text-strong)" }}>
          {period.kind === "week" ? (period.current ? "So far this week" : `In the week of ${period.label}`) : `${period.current ? "So far in" : "In"} ${period.label}`}, {text}.
        </div>
      ) });
    }
  }

  for (const grp of GROUPS) {
    if (grp.id === "summary") continue;
    const ms = METRICS.filter(m => m.group === grp.id && show(m.id));
    if (!ms.length) continue;
    const parts: Block[] = [];
    const tileIds = ms.filter(m => m.tile).map(m => m.id);
    for (let i = 0; i < tileIds.length; i += 3) {
      const row = tileIds.slice(i, i + 3);
      parts.push({ key: `tiles:${grp.id}:${i}`, node: (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>{row.map(id => cell(id, tiles[id] ?? { v: "—" }))}</div>
      ) });
    }
    for (const m of ms.filter(x => !x.tile)) {
      switch (m.id) {
        case "newMembersChart": parts.push({ key: m.id, node: chart(`New members per ${period.bucket}`, r.series.map(s => s.joined), "New members") }); break;
        case "kmChart": parts.push({ key: m.id, node: chart(`Km per ${period.bucket}`, r.series.map(s => s.km), "Km") }); break;
        case "activeChart": parts.push({ key: m.id, node: chart(`Active runners per ${period.bucket}`, r.series.map(s => s.active), "Runners") }); break;
        case "turnoutChart": parts.push({ key: m.id, node: chart(`Group-run check-ins per ${period.bucket}`, r.series.map(s => s.checkins), "Check-ins") }); break;
        case "distanceMix": {
          const b = r.running.bands;
          const rows: [string, number][] = [["Under 5 km", b.under_5], ["5 to 10 km", b.k5], ["10 to 21 km", b.k10], ["Half marathon and up", b.half], ["Marathon and up", b.full]];
          const max = Math.max(1, ...rows.map(x => x[1]));
          parts.push({ key: m.id, node: (
            <div><div style={h}>Runs by distance</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map(([k, v]) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "150px 1fr 60px", alignItems: "center", gap: 12, font: "400 13px var(--font-sans)" }}>
                    <span>{k}</span>
                    <div style={{ height: 18, borderRadius: 4, background: "var(--chart-track)" }}>
                      <div style={{ height: "100%", width: `${(v / max) * 100}%`, borderRadius: 4, background: "var(--hatch),var(--lime-400)" }} />
                    </div>
                    <span style={{ ...mutedS, textAlign: "right" }}>{num(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) });
          break;
        }
        case "turnoutTable": {
          const grid: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 64px 84px 84px", gap: 12, padding: "8px 0", borderTop: "1px solid var(--border-subtle)", font: "400 13px var(--font-sans)", alignItems: "baseline" };
          const head = (cont: boolean) => (
            <div>
              <div style={h}>Turnout per run{cont ? " (continued)" : ""}</div>
              <div style={{ ...grid, borderTop: 0, padding: "0 0 4px", ...kMuted }}>
                <span>Run</span><span style={{ textAlign: "right" }}>Going</span><span style={{ textAlign: "right" }}>Checked in</span><span style={{ textAlign: "right" }}>First-timers</span>
              </div>
            </div>
          );
          parts.push({ key: "turnout:head", keepNext: true, node: head(false) });
          extras.set("turnout:cont", { key: "turnout:cont", node: head(true) });
          g.runs.forEach((x, i) => parts.push({ key: `turnout:${i}`, cont: "turnout:cont", tight: true, node: (
            <div style={grid}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{day(x.at, yearOf)} · {x.title}</span>
              <span style={{ textAlign: "right", color: "var(--text-muted)" }}>{x.going == null ? "—" : num(x.going)}</span>
              <span style={{ textAlign: "right" }}>{num(x.checked_in)}</span>
              <span style={{ textAlign: "right", color: "var(--text-muted)" }}>{num(x.first_timers)}</span>
            </div>
          ) }));
          const notes: string[] = [];
          if (g.runs.some(x => x.going == null)) notes.push("— going wasn’t recorded for that date.");
          if (g.runs.some(x => x.checked_in === 0)) notes.push("Checked in counts runners scanned by QR at the start; 0 means the run didn’t use check-in.");
          if (notes.length) parts.push({ key: "turnout:note", node: <div style={{ ...kMuted, fontSize: 11 }}>{notes.join(" ")}</div> });
          break;
        }
        case "eventList":
          parts.push({ key: "events:head", keepNext: true, node: <div style={h}>Events</div> });
          ev.list.forEach((e, i) => parts.push({ key: `events:${i}`, tight: true, node: (
            <div style={rowS}><span>{e.title} · {day(e.starts_at, yearOf)}</span>
              <span style={mutedS}>{num(e.sold)}{e.capacity ? ` / ${num(e.capacity)}` : ""} sold · {num(e.checked_in)} checked in</span></div>
          ) }));
          break;
        case "bestPeriods": {
          const best = r.series.map((s, i) => ({ s, i })).filter(x => x.s.km > 0).sort((a, b) => b.s.km - a.s.km).slice(0, 3);
          const name = (start: string) => period.bucket === "day" ? day(start, yearOf)
            : period.bucket === "month" ? `${bucketLabel(period, start)} ${start.slice(0, 4)}`
            : `${bucketLabel(period, start)} ${parseDay(start).toLocaleString("en-IN", { month: "short", timeZone: "UTC" })}`;
          parts.push({ key: m.id, node: (
            <div><div style={h}>Best {period.bucket === "day" ? "days" : period.bucket === "week" ? "weeks" : "months"}</div>
              {best.map(x => <div key={x.i} style={rowS}><span>{name(x.s.start)}</span><span style={mutedS}>{bigKm(x.s.km)} km · {many(x.s.active, "runner")}</span></div>)}
            </div>
          ) });
          break;
        }
        case "topRunners":
          parts.push({ key: m.id, node: (
            <div><div style={h}>Top runners</div>
              {r.top_runners.map((t, i) => <div key={i} style={rowS}><span>{i + 1}. {t.name}</span><span style={mutedS}>{bigKm(t.km)} km · {many(t.runs, "run")}</span></div>)}
            </div>
          ) });
          break;
        case "upcoming": {
          const next = data.upcoming.filter(u => Date.parse(u.event_at) > data.now).sort((a, b) => Date.parse(a.event_at) - Date.parse(b.event_at)).slice(0, 3);
          parts.push({ key: m.id, node: (
            <div><div style={h}>Upcoming runs</div>
              {next.map(u => <div key={u.id} style={rowS}><span>{u.title} · {day(u.event_at)}</span><span style={mutedS}>{num(u.going_count)} going</span></div>)}
            </div>
          ) });
          break;
        }
        case "upcomingEvents":
          parts.push({ key: m.id, node: (
            <div><div style={h}>Upcoming events</div>
              {nextEvents(data).map(e => <div key={e.id} style={rowS}><span>{e.title} · {day(e.starts_at)}</span>
                <span style={mutedS}>{num(e.sold)}{e.capacity ? ` / ${num(e.capacity)}` : ""} sold so far</span></div>)}
            </div>
          ) });
          break;
        default: break;
      }
    }
    if (!parts.length) continue;
    out.push({ key: `section:${grp.id}`, keepNext: true, node: (
      <div style={{ font: "500 11px var(--font-sans)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", paddingBottom: 6, borderBottom: "1px solid var(--border-subtle)" }}>{grp.label}</div>
    ) });
    out.push(...parts);
  }
  return { blocks: out, extras };
}
