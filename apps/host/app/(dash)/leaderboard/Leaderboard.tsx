"use client";

import { useMemo, useState } from "react";
import { Avatar, Badge, Button, EmptyState, GlassCard, Input, ProgressBar, SegmentedControl } from "@/components/ds";
import { kMuted, LoadError, RowsSkeleton, Toolbar } from "@/components/shell/kit";
import {
  boardMembers, boardTotals, currentWeekKey, PACE_MIN_KM, signedUrls, weekLabel, type BoardMember, type BoardRange, type BoardTotal,
} from "@/lib/api";
import { faceSrc } from "@/lib/faces";
import { km, num, roleLabel, ymd } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad } from "@/lib/hooks";

// The squad's leaderboard, as members see it in the app (pacr
// src/components/squads/Leaderboard.tsx): Distance or Pace, over this week,
// this month or dates you pick. Week by distance is the app's own member list
// (so it matches the KM THIS WEEK tile); everything else totals the runs
// members log on pacr. Only runners with distance in the window are ranked;
// your own row is always on the board.

type Metric = "km" | "pace";
type Span = "week" | "month" | "custom";
type Row = { m: BoardMember; rank: number | null; value: number; runs: number; km: number };

const TOP = 10;
const fromYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const paceText = (sec: number) => { const s = Math.round(sec); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const shortDate = (s: string) => fromYmd(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function windowOf(span: Span, from: string, to: string): BoardRange {
  if (span === "week") return { weekKey: currentWeekKey() };
  if (span === "month") {
    const n = new Date();
    return { from: new Date(n.getFullYear(), n.getMonth(), 1), to: new Date(n.getFullYear(), n.getMonth() + 1, 1) };
  }
  const b = fromYmd(to);
  return { from: fromYmd(from), to: new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1) };
}

export function Leaderboard() {
  const { host } = useHost();
  if (host.kind !== "squad") {
    return <EmptyState variant="locked" title="The leaderboard is for squads" message="It ranks a squad’s members by the runs they log on pacr." />;
  }
  return <Board />;
}

function Board() {
  const { host } = useHost();
  const today = ymd(new Date());
  const [metric, setMetric] = useState<Metric>("km");
  const [span, setSpan] = useState<Span>("week");
  const [from, setFrom] = useState(() => ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(today);
  const [all, setAll] = useState(false);

  const people = useLoad(async () => {
    const members = await boardMembers(host.id);
    const urls = await signedUrls("avatars", members.map(m => m.avatarPath));
    return { members, urls };
  }, `board:${host.key}`);

  // Week by distance needs nothing beyond the member list.
  const own = span === "week" && metric === "km";
  const winKey = span === "custom" ? `custom|${from}|${to}` : span;
  const ids = people.status === "ready" ? people.data.members.map(m => m.userId) : null;
  const totals = useLoad<Map<string, BoardTotal> | null>(
    async () => (own || !ids?.length ? null : boardTotals(ids, windowOf(span, from, to))),
    `board-totals:${host.key}:${own ? "own" : winKey}:${ids?.length ?? "-"}`,
  );

  const rows = useMemo<Row[] | null>(() => {
    if (people.status !== "ready" || (!own && totals.status !== "ready")) return null;
    const t = totals.status === "ready" ? totals.data : null;
    const ranked = people.data.members.flatMap(m => {
      const x = t?.get(m.userId);
      const dist = own ? m.weekKm : x?.km ?? 0;
      const runs = own ? m.weekRuns : x?.runs ?? 0;
      if (metric === "km") return dist > 0 ? [{ m, value: dist, runs, km: dist }] : [];
      return x && x.paceKm >= PACE_MIN_KM ? [{ m, value: x.paceSec / x.paceKm, runs, km: dist }] : [];
    });
    ranked.sort((a, b) => (metric === "km" ? b.value - a.value : a.value - b.value) || b.runs - a.runs || a.m.name.localeCompare(b.m.name));
    return ranked.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [people, totals, own, metric]);

  const spanLabel = span === "week" ? `This week · ${weekLabel(new Date())}` : span === "month" ? "This month"
    : from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;
  const value = (r: Row) => (r.rank == null ? (metric === "km" ? "0" : "—") : metric === "km" ? km(r.value) : paceText(r.value));
  const unit = metric === "km" ? "km" : "/km";

  const toolbar = (
    <Toolbar>
      <SegmentedControl size="sm" value={metric} onChange={v => setMetric(v as Metric)}
        options={[{ value: "km", label: "Distance" }, { value: "pace", label: "Pace" }]} />
      <SegmentedControl size="sm" value={span} onChange={v => { setSpan(v as Span); setAll(false); }}
        options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "custom", label: "Custom" }]} />
      {span === "custom" && (
        <>
          <Input size="sm" type="date" aria-label="From" value={from} max={to}
            onChange={e => { const v = e.target.value; if (v) { setFrom(v > to ? to : v); setAll(false); } }} style={{ width: 150 }} />
          <span style={kMuted}>to</span>
          <Input size="sm" type="date" aria-label="To" value={to} min={from} max={today}
            onChange={e => { const v = e.target.value; if (v) { setTo(v > today ? today : v < from ? from : v); setAll(false); } }} style={{ width: 150 }} />
        </>
      )}
    </Toolbar>
  );

  if (people.status === "error") return <div>{toolbar}<LoadError what="the leaderboard" error={people.error} onRetry={people.reload} /></div>;
  if (totals.status === "error") return <div>{toolbar}<LoadError what="the leaderboard" error={totals.error} onRetry={totals.reload} /></div>;
  if (!rows || people.status !== "ready") return <div>{toolbar}<RowsSkeleton rows={8} /></div>;

  const { members, urls } = people.data;
  const face = (m: BoardMember) => faceSrc(m.userId, m.avatarPath, urls) ?? undefined;

  if (!rows.length) {
    const msg = metric === "pace" ? `No paces yet. Runs adding up to ${PACE_MIN_KM} km or more count.`
      : span === "week" ? "No runs logged this week yet." : span === "month" ? "No runs logged this month yet." : "No runs logged in these dates.";
    return <div>{toolbar}<EmptyState icon="trophy" title="Nobody on the board yet" message={msg} style={{ padding: "56px 24px" }} /></div>;
  }

  const cut = all ? rows.length : TOP;
  const me = members.find(m => m.isSelf);
  const myIdx = rows.findIndex(r => r.m.isSelf);
  // I'm always on the board: below the cut, or unranked at the bottom.
  const tail: Row | null = !me ? null : myIdx >= cut ? rows[myIdx] : myIdx < 0 ? { m: me, rank: null, value: 0, runs: 0, km: 0 } : null;
  const best = rows[0].value;
  const share = (r: Row) => (r.rank == null ? 0 : metric === "km" ? (r.value / best) * 100 : (best / r.value) * 100);
  const podium = [rows[1], rows[0], rows[2]];

  return (
    <div>
      {toolbar}
      <GlassCard title="Leaderboard"
        subtitle={`${spanLabel} · ${metric === "km" ? "km" : "average pace /km"} · ${num(rows.length)} ${rows.length === 1 ? "runner" : "runners"} ranked`}>
        <div className="lb-podium" aria-label="Top three">
          {podium.map((r, i) => r ? (
            <div key={r.m.userId} className={`lb-place lb-place--${r.rank}`}>
              <Avatar name={r.m.name} src={face(r.m)} size={r.rank === 1 ? 64 : 52} />
              <span className="lb-name">{r.m.name}</span>
              <div className="lb-block">
                <span style={kMuted}>{r.rank === 1 ? "1st" : r.rank === 2 ? "2nd" : "3rd"}</span>
                <span className="lb-value">{value(r)}</span>
                <span style={kMuted}>{unit} · {plural(r.runs)}</span>
              </div>
            </div>
          ) : <div key={`empty${i}`} />)}
        </div>

        <div role="list" aria-label="Rankings">
          {rows.slice(0, cut).map(r => <BoardRow key={r.m.userId} r={r} src={face(r.m)} value={value(r)} unit={unit} share={share(r)} metric={metric} />)}
          {tail && <BoardRow r={tail} src={face(tail.m)} value={value(tail)} unit={unit} share={share(tail)} metric={metric} />}
        </div>
        {rows.length > TOP && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <Button variant="ghost" size="sm" onClick={() => setAll(x => !x)}>{all ? `Show top ${TOP}` : `Show all ${num(rows.length)}`}</Button>
          </div>
        )}
        <div style={{ ...kMuted, marginTop: 12 }}>
          {metric === "km"
            ? "From runs members log on pacr. Ties go to more runs. The week matches the app’s km-this-week tile."
            : `Average pace over runs no faster than 2:30 /km, once they add up to ${PACE_MIN_KM} km. Ties go to more runs.`}
        </div>
      </GlassCard>
    </div>
  );
}

const plural = (n: number) => `${num(n)} ${n === 1 ? "run" : "runs"}`;

function BoardRow({ r, src, value, unit, share, metric }: { r: Row; src?: string; value: string; unit: string; share: number; metric: Metric }) {
  const role = r.m.role !== "member" ? roleLabel(r.m.role) : "";
  return (
    <div role="listitem" className={`lb-row${r.m.isSelf ? " is-self" : ""}`}>
      <span className="lb-rank">{r.rank ?? "–"}</span>
      <Avatar name={r.m.name} src={src} size={32} />
      <div className="lb-who">
        <div className="lb-line">
          <span className="lb-rowname">{r.m.name}</span>
          {r.m.isSelf && <Badge tone="lime">You</Badge>}
          <span className="lb-meta">{[r.m.handle && `@${r.m.handle}`, role, r.m.title].filter(Boolean).join(" · ")}</span>
        </div>
        <ProgressBar size="sm" tone="lime" value={share} max={100} />
      </div>
      <div className="lb-num">
        <span className="lb-rowvalue">{value}<span style={kMuted}> {unit}</span></span>
        <span style={kMuted}>{plural(r.runs)}{metric === "pace" && r.rank != null ? ` · ${km(r.km)} km` : ""}</span>
      </div>
    </div>
  );
}
