"use client";
// components/data/* of the pacr Web Design System, ported to TSX
// (BarChart, LineChart, SplitsTable, LeaderboardTable, ActivityStrip, DayStrip).
import { useState } from "react";
import { Avatar } from "./core";

export function BarChart({ data = [], labels = [], height = 160, color = "var(--data-1)", highlight = "last", unit = " km", format = (v: number) => String(v) }:
  { data: number[]; labels?: string[]; height?: number; color?: string; highlight?: "last" | number | null; unit?: string; format?: (v: number) => string }) {
  const [hov, setHov] = useState<number | null>(null);
  const W = 600, H = height, P = { t: 8, b: 22 }; const mx = Math.max(1, ...data); const n = Math.max(1, data.length); const bw = W / n;
  return <div className="pw-chart"><svg viewBox={`0 0 ${W} ${H}`} height={H} preserveAspectRatio="none">
    <line className="pw-chart__grid" x1="0" x2={W} y1={H - P.b} y2={H - P.b} />
    {data.map((v, i) => { const h = Math.max(v > 0 ? 3 : 0, (v / mx) * (H - P.t - P.b)); const hi = highlight === "last" ? i === n - 1 : highlight === i; return <rect key={i} className="pw-chart__bar" x={i * bw + bw * .18} y={H - P.b - h} width={bw * .64} height={h} rx={Math.min(6, bw * .2)} fill={hi ? "var(--accent)" : color} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} />; })}
    {labels.map((l, i) => <text key={i} className="pw-chart__axis" x={i * bw + bw / 2} y={H - 5} textAnchor="middle">{l}</text>)}
  </svg>{hov != null ? <div className="pw-chart__tip" style={{ left: ((hov + .5) / n * 100) + "%", top: ((H - P.b - (data[hov] / mx) * (H - P.t - P.b)) / H * 100) + "%" }}>{format(data[hov])}{unit}</div> : null}</div>;
}

export function LineChart({ data = [], labels = [], height = 180, area = true, color = "var(--data-1)", invert = false, format = (v: number) => String(Math.round(v)), unit = "", ticks = 3 }:
  { data: number[]; labels?: string[]; height?: number; area?: boolean; color?: string; invert?: boolean; format?: (v: number) => string; unit?: string; ticks?: number }) {
  const [hov, setHov] = useState<number | null>(null);
  if (data.length < 2) return null;
  const W = 600, H = height, P = { l: 36, r: 8, t: 10, b: 22 };
  const mn = Math.min(...data), mx = Math.max(...data); const pad = (mx - mn) * .12 || 1; const lo = mn - pad, hi = mx + pad;
  const x = (i: number) => P.l + i * (W - P.l - P.r) / Math.max(1, data.length - 1);
  const y = (v: number) => { const k = (v - lo) / (hi - lo); return P.t + (invert ? k : 1 - k) * (H - P.t - P.b); };
  const d = data.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const gid = "g" + Math.abs(String(color).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7));
  const tv: number[] = []; for (let i = 0; i < ticks; i++) tv.push(lo + (hi - lo) * (i + .5) / ticks);
  return <div className="pw-chart" onMouseLeave={() => setHov(null)}>
    <svg viewBox={`0 0 ${W} ${H}`} height={H} preserveAspectRatio="none" onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; const i = Math.round((px - P.l) / ((W - P.l - P.r) / Math.max(1, data.length - 1))); setHov(Math.max(0, Math.min(data.length - 1, i))); }}>
      <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {tv.map((t, i) => <g key={i}><line className="pw-chart__grid" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} /><text className="pw-chart__axis" x={P.l - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text></g>)}
      {area ? <path d={d + " L" + x(data.length - 1) + " " + (H - P.b) + " L" + x(0) + " " + (H - P.b) + "Z"} fill={`url(#${gid})`} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {labels.map((l, i) => l ? <text key={i} className="pw-chart__axis" x={x(i)} y={H - 4} textAnchor="middle">{l}</text> : null)}
      {hov != null ? <><line x1={x(hov)} x2={x(hov)} y1={P.t} y2={H - P.b} stroke="var(--border-strong)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /><circle cx={x(hov)} cy={y(data[hov])} r="4.5" fill="var(--surface-1)" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></> : null}
    </svg>
    {hov != null ? <div className="pw-chart__tip" style={{ left: (x(hov) / W * 100) + "%", top: (y(data[hov]) / H * 100) + "%" }}>{format(data[hov])}{unit}{labels[hov] ? " · " + labels[hov] : ""}</div> : null}
  </div>;
}

const sec = (p: string) => { const [m, s] = String(p).split(":").map(Number); return m * 60 + s; };
export type Split = { km: string | number; pace: string; elev?: number | null; hr?: number | null };
export function SplitsTable({ splits }: { splits: Split[] }) {
  const ss = splits.map(s => sec(s.pace)); const min = Math.min(...ss), max = Math.max(...ss);
  return <table className="pw-table"><thead><tr><th>Km</th><th>Pace</th><th style={{ width: "40%" }} aria-hidden="true"></th><th className="r">Elev</th><th className="r">HR</th></tr></thead>
    <tbody>{splits.map((s, i) => { const w = max === min ? 80 : 40 + 60 * (max - ss[i]) / (max - min); return <tr key={i}><td style={{ fontWeight: 600 }}>{s.km}</td><td style={{ fontWeight: 600 }}>{s.pace} <span className="t-caption">/km</span></td><td><div className="pw-table__bar" style={{ width: w + "%", background: ss[i] === min ? "var(--accent)" : "var(--data-1)" }} /></td><td className="r t-secondary">{s.elev != null ? (s.elev > 0 ? "+" : "") + s.elev + " m" : "—"}</td><td className="r t-secondary">{s.hr || "—"}</td></tr>; })}</tbody></table>;
}

export type BoardRow = { rank: number; name: string; avatar?: string | null; km: number; runs?: number; you?: boolean };
export function LeaderboardTable({ rows, showRuns = true }: { rows: BoardRow[]; showRuns?: boolean }) {
  return <table className="pw-table"><thead><tr><th>#</th><th>Runner</th><th className="r">Km</th>{showRuns ? <th className="r">Runs</th> : null}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className={r.you ? "is-you" : ""}><td className={"pw-table__rank" + (r.rank <= 3 ? " pw-table__rank--top" : "")}>{r.rank}</td>
      <td><div className="pw-table__who"><Avatar name={r.name} src={r.avatar} size={32} /><b>{r.name}{r.you ? " (you)" : ""}</b></div></td>
      <td className="r" style={{ fontWeight: 700 }}>{Number(r.km).toFixed(1)}</td>{showRuns ? <td className="r t-secondary">{r.runs}</td> : null}</tr>)}</tbody></table>;
}

/** 12 weeks × 7 days of km, oldest first. */
export function ActivityStrip({ days, labels = [] }: { days: number[]; labels?: string[] }) {
  const wk: number[][] = []; for (let w = 0; w < 12; w++) wk.push(days.slice(w * 7, w * 7 + 7));
  const lv = (k?: number) => !k ? 0 : k < 4 ? 1 : k < 8 ? 2 : k < 14 ? 3 : 4;
  return <div role="img" aria-label="Running activity, last 12 weeks"><div className="pw-strip">{wk.map((d, i) => <div key={i} className="pw-strip__wk">{Array.from({ length: 7 }).map((_, j) => <span key={j} className="pw-strip__d" data-l={lv(d[j])} title={d[j] ? d[j] + " km" : "Rest"} />)}</div>)}</div>
    {labels.length ? <div className="pw-strip__lbl">{labels.map((l, i) => <span key={i}>{l}</span>)}</div> : null}</div>;
}

export function DayStrip({ days, value, onChange }: { days: { id: string; dow: string; day: string; count?: number; disabled?: boolean }[]; value: string; onChange: (id: string) => void }) {
  return <div className="pw-days" role="tablist" aria-label="Days">{days.map(d => <button key={d.id} role="tab" className="pw-day" aria-selected={value === d.id} disabled={d.disabled} onClick={() => onChange(d.id)}><small>{d.dow}</small><b>{d.day}</b><i>{d.count ? d.count + (d.count === 1 ? " run" : " runs") : "—"}</i></button>)}</div>;
}
