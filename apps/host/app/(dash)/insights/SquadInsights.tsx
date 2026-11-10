"use client";

import { useMemo, type CSSProperties } from "react";
import { AreaChart, Avatar, BarChart, DonutChart, GlassCard, ProgressBar, StatCard } from "@/components/ds";
import { kitGrid, kMuted } from "@/components/shell/kit";
import { weekLabel, type Segment } from "@/lib/api";
import { km as fmtKm, num } from "@/lib/format";
import { useViewport } from "@/lib/hooks";
import Link from "next/link";
import { sum, type Computed, type Loaded } from "./types";

const pct = (now: number, before: number): number | null => (before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null);
const SEGS: Segment[] = ["New", "Regulars", "Active", "Slipping", "Lapsed"];
const SEG_COLOR = ["var(--chart-5)", "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-7)"];

export function SquadInsights({ data, c }: { data: Loaded; c: Computed }) {
  const { phone } = useViewport();
  const { roster, detail, weekKm, faces, starts, now } = data;
  const labels = starts.map(s => weekLabel(new Date(s)));
  const members = roster.members;

  const kpi = useMemo(() => {
    const last = (a: number[]) => sum(a.slice(8));
    const prev = (a: number[]) => sum(a.slice(4, 8));
    const uniq = (from: number, to: number) => { const s = new Set<string>(); for (let i = from; i < to; i++) c.who[i].forEach(u => s.add(u)); return s.size; };
    return {
      runs: [last(c.runCount), pct(last(c.runCount), prev(c.runCount))] as const,
      km: [last(c.km), pct(last(c.km), prev(c.km))] as const,
      active: [uniq(8, 12), pct(uniq(8, 12), uniq(4, 8))] as const,
    };
  }, [c]);

  const funnel = useMemo(() => {
    const twoWeeks = now - 14 * 86400000;
    return [
      ["Members", members.length],
      ["Logged a run in 12 weeks", members.filter(m => m.runs12 > 0).length],
      ["4 or more runs", members.filter(m => m.runs12 >= 4).length],
      ["Ran in the last 2 weeks", members.filter(m => m.lastRunAt && new Date(m.lastRunAt).getTime() >= twoWeeks).length],
    ] as [string, number][];
  }, [members, now]);

  const segments = SEGS.map((s, i) => ({ label: s, value: members.filter(m => m.segment === s).length, color: SEG_COLOR[i] })).filter(s => s.value > 0);
  const top = [...members].filter(m => m.runs12 > 0).sort((a, b) => b.runs12 - a.runs12 || b.km12 - a.km12).slice(0, 5);

  const months = useMemo(() => {
    const n = new Date(now);
    const list = Array.from({ length: 6 }, (_, i) => new Date(n.getFullYear(), n.getMonth() - (5 - i), 1));
    return list.map((d, i) => {
      const next = i < 5 ? list[i + 1] : new Date(n.getFullYear(), n.getMonth() + 1, 1);
      return {
        label: d.toLocaleString("en-IN", { month: "short" }),
        value: members.filter(m => { const t = new Date(m.joinedAt).getTime(); return t >= d.getTime() && t < next.getTime(); }).length,
      };
    });
  }, [members, now]);

  const goal = detail?.weekly_goal_km ?? null;
  const row3: CSSProperties = { display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)", gap: 12 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={kitGrid(200)}>
        <StatCard label="Runs logged" value={kpi.runs[0]} delta={kpi.runs[1]} deltaLabel="vs previous 4 weeks" icon="footprints" tone="lime" />
        <StatCard label="Km run" value={kpi.km[0]} format={v => fmtKm(Number(v))} unit="km" delta={kpi.km[1]} deltaLabel="vs previous 4 weeks" icon="route" tone="lime" />
        <StatCard label="Active runners" value={kpi.active[0]} delta={kpi.active[1]} deltaLabel="vs previous 4 weeks" icon="users" tone="lime" />
        <GlassCard>
          <div className="pc-stat__top"><span className="pc-stat__label">Weekly squad goal</span><span style={kMuted}>{labels[11]}</span></div>
          {goal ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 14 }}>
                <span style={{ font: "var(--type-kpi)", letterSpacing: "var(--tracking-display)", color: "var(--text-strong)" }}>{fmtKm(weekKm)}</span>
                <span style={kMuted}>/ {fmtKm(goal)} km</span>
              </div>
              <ProgressBar tone="pop" value={weekKm} max={goal} style={{ marginTop: 12 }} />
            </>
          ) : (
            <div style={{ ...kMuted, marginTop: 14 }}>No weekly goal set. <Link href="/settings" style={{ color: "inherit", textDecoration: "underline" }}>Set one in Settings</Link>.</div>
          )}
        </GlassCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1.6fr) minmax(0,1fr)", gap: 12 }}>
        <GlassCard title="Km per week" subtitle="Total km members logged">
          <AreaChart height={240} labels={labels} legend={false} series={[{ name: "Km", data: c.km.map(v => Math.round(v * 10) / 10), color: "var(--chart-1)" }]} />
        </GlassCard>
        <GlassCard title="Who’s still running" subtitle="Members by how much they log">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {funnel.map(([k, v], i) => (
              <div key={k}>
                <div style={{ display: "flex", justifyContent: "space-between", font: "400 13px var(--font-sans)", color: "var(--text-strong)", marginBottom: 6 }}>
                  <span>{k}</span>
                  <span><b style={{ fontWeight: 500 }}>{num(v)}</b> <span style={{ color: "var(--text-muted)" }}>{i && funnel[i - 1][1] ? `${Math.round((v / funnel[i - 1][1]) * 100)}% of previous` : ""}</span></span>
                </div>
                <div style={{ height: 26, borderRadius: 4, background: "var(--chart-track)" }}>
                  <div style={{ height: "100%", width: `${funnel[0][1] ? (v / funnel[0][1]) * 100 : 0}%`, borderRadius: 4, background: `var(--hatch),${["var(--lime-500)", "var(--lime-400)", "var(--lime-300)", "var(--yellow-500)"][i]}` }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div style={row3}>
        <GlassCard title="Active runners per week" subtitle="Members with at least one run">
          <BarChart height={220} track legend={false} yTicks={4} labels={labels} valueLabels={v => (v ? String(v) : "")} series={[{ name: "Active runners", data: c.active, color: "var(--chart-1)" }]} />
        </GlassCard>
        <GlassCard title="Members by segment">
          <DonutChart size={150} thickness={20} centerValue={num(members.length)} centerLabel="Members" data={segments} />
        </GlassCard>
        <GlassCard title="Top runners" subtitle="Most runs in 12 weeks">
          {top.length === 0 ? <div style={kMuted}>No runs yet.</div> : top.map((m, i) => (
            <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i ? "1px solid var(--border-subtle)" : 0 }}>
              <span style={{ width: 16, ...kMuted }}>{i + 1}</span>
              <Avatar name={m.name} src={m.avatarPath ? faces.get(m.avatarPath) : undefined} size={26} />
              <span style={{ flex: 1, font: "400 13px var(--font-sans)", color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
              <span style={{ font: "400 12px var(--font-sans)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{num(m.runs12)} runs · {fmtKm(m.km12)} km</span>
            </div>
          ))}
        </GlassCard>
      </div>

      <GlassCard title="New members per month" subtitle="Current members only">
        <BarChart height={200} track legend={false} yTicks={3} labels={months.map(m => m.label)} valueLabels={v => (v ? String(v) : "")} series={[{ name: "New members", data: months.map(m => m.value), color: "var(--chart-1)" }]} />
      </GlassCard>
    </div>
  );
}
