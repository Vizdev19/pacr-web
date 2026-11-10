"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useChartWidth, useReveal, niceMax, chartColor, ChartLegend, ChartTip, type ChartSeries } from "./AreaChart";

const fmtDefault = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-US");

export interface BarChartProps {
  labels?: string[];
  series?: ChartSeries[];
  stacked?: boolean;
  height?: number;
  yFormat?: (v: number) => string;
  legend?: boolean;
  yTicks?: number;
  highlight?: number;
  track?: boolean;
  barColors?: string[];
  valueLabels?: boolean | ((v: number) => string);
  className?: string;
  style?: CSSProperties;
}

export function BarChart({ labels = [], series = [], stacked = false, height = 260, yFormat = fmtDefault, legend = true, yTicks = 4, highlight, track = false, barColors, valueLabels, className = "", style }: BarChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useChartWidth(ref);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<number | null>(null);
  const p = useReveal(800);
  const all = series.map((s, i) => ({ ...s, color: s.color || chartColor(i) }));
  const vis = all.filter(s => !hidden[s.name]);
  const pl = 40, pr = 4, pt = valueLabels ? 30 : 12, pb = 28, iw = w - pl - pr, ih = height - pt - pb, n = labels.length;
  const totals = labels.map((_, j) => vis.reduce((a, s) => a + (s.data[j] || 0), 0));
  const max = niceMax(Math.max(1, ...(stacked ? totals : vis.flatMap(s => s.data))));
  const band = iw / Math.max(1, n), gw = Math.min(band * 0.78, stacked ? 52 : 44 * Math.max(1, vis.length) + 4 * (vis.length - 1));
  const bw = stacked ? gw : (gw - 4 * (vis.length - 1)) / Math.max(1, vis.length);
  const Y = (v: number) => pt + ih - (v / max) * ih;
  const H = (v: number) => (v / max) * ih * p;
  const r = Math.min(4, bw / 2);
  const h0 = () => vis.length > 0;
  const vfmt: (v: number) => string = typeof valueLabels === "function" ? valueLabels : yFormat;
  const bar = (x: number, y: number, bwid: number, h: number, top: boolean, color: string, key: number, dim: boolean) => {
    if (h <= 0) return null;
    const rr = top ? Math.min(r, h) : 0, rb = Math.min(r, h - rr);
    const d = "M" + x + "," + (y + h - rb) + " V" + (y + rr) + " Q" + x + "," + y + " " + (x + rr) + "," + y + " H" + (x + bwid - rr) + " Q" + (x + bwid) + "," + y + " " + (x + bwid) + "," + (y + rr) + " V" + (y + h - rb) + " Q" + (x + bwid) + "," + (y + h) + " " + (x + bwid - rb) + "," + (y + h) + " H" + (x + rb) + " Q" + x + "," + (y + h) + " " + x + "," + (y + h - rb) + " Z";
    return <g key={key} style={{ opacity: dim ? 0.38 : 1, transition: "opacity 200ms" }}><path d={d} style={{ fill: color }} /><path d={d} fill="url(#pc-hatch)" /></g>;
  };
  return (
    <div className={"pc-chart " + className} style={style}>
      <div ref={ref} style={{ position: "relative" }}>
        <svg width={w} height={height} onMouseLeave={() => setHover(null)}>
          <defs><pattern id="pc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="6" fill="rgba(255,255,255,.3)" /></pattern></defs>
          {Array.from({ length: yTicks + 1 }, (_, k) => {
            const v = (max / yTicks) * k, y = Y(v);
            return (
              <g key={k}>
                <line className="pc-chart__grid" x1={pl} x2={pl + iw} y1={y} y2={y} strokeDasharray={k === 0 ? undefined : "3 5"} />
                <text className="pc-chart__axis" x={pl - 10} y={y + 4} textAnchor="end">{yFormat(v)}</text>
              </g>
            );
          })}
          {labels.map((l, j) => {
            const cx = pl + band * j + band / 2, x0 = cx - gw / 2, dim = (hover != null && hover !== j) || (highlight != null && hover == null && highlight !== j);
            let acc = 0;
            return (
              <g key={j} onMouseEnter={() => setHover(j)}>
                <rect x={pl + band * j} y={pt} width={band} height={ih} rx={8} style={{ fill: !track && hover === j ? "var(--surface-hover)" : "transparent", transition: "fill 150ms" }} />
                {track ? <rect x={x0} y={pt} width={gw} height={ih} rx={r} style={{ fill: hover === j ? "var(--ink-100)" : "var(--chart-track)", transition: "fill 150ms" }} /> : null}
                {vis.map((s, i) => {
                  const v = s.data[j] || 0, h = H(v);
                  if (stacked) { const y = pt + ih - H(acc) - h; acc += v; return bar(x0, y, bw, h, i === vis.length - 1, s.color, i, dim); }
                  const col = barColors && vis.length === 1 ? barColors[j % barColors.length] : s.color;
                  return bar(x0 + i * (bw + 4), pt + ih - h, bw, h, true, col, i, dim);
                })}
                {valueLabels && h0() ? (() => { const tv = stacked ? totals[j] : (vis[0].data[j] || 0), ty = pt + ih - H(tv) - 24, txt = vfmt(tv), tw = txt.length * 6.4 + 14; return <g style={{ opacity: p, transition: "opacity 200ms" }}><rect x={cx - tw / 2} y={ty} width={tw} height={19} rx={5} style={{ fill: "#fff", stroke: "var(--border-default)" }} /><text className="pc-chart__pill" x={cx} y={ty + 13} textAnchor="middle">{txt}</text></g>; })() : null}
                <text className="pc-chart__axis" x={cx} y={height - 8} textAnchor="middle" style={hover === j ? { fill: "var(--text-strong)", fontWeight: 700 } : undefined}>{l}</text>
              </g>
            );
          })}
        </svg>
        {hover != null && vis.length ? (
          <ChartTip x={pl + band * hover + band / 2 + gw / 2} w={w} title={labels[hover]} fmt={yFormat}
            rows={vis.map(s => ({ name: s.name, color: s.color, value: s.data[hover] || 0 }))} />
        ) : null}
      </div>
      {legend && all.length > 1 ? (
        <div style={{ marginTop: 12 }}><ChartLegend series={all} hidden={hidden} onToggle={nm => setHidden(h => ({ ...h, [nm]: !h[nm] }))} /></div>
      ) : null}
    </div>
  );
}
