"use client";

import { useId, useLayoutEffect, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode, type RefObject } from "react";

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export function useChartWidth(ref: RefObject<HTMLElement | null>, fallback = 600): number {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = () => setW(Math.max(120, el.clientWidth));
    const raf = requestAnimationFrame(m);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(m) : null;
    if (ro) ro.observe(el);
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }, [ref]);
  return w;
}

export function useReveal(dur = 700, key?: string | number): number {
  const [st, setSt] = useState<{ k: string | number | undefined; v: number }>({ k: key, v: 0 });
  useEffect(() => {
    let raf = 0;
    let t0: number | undefined;
    const step = (t: number) => {
      if (t0 === undefined) t0 = t;
      const k = Math.min(1, (t - t0) / dur);
      setSt({ k: key, v: 1 - Math.pow(1 - k, 3) });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [dur, key]);
  return st.k === key ? st.v : 0;
}

export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function smoothPath(pts: [number, number][]): string {
  if (!pts.length) return "";
  let d = "M" + pts[0][0] + "," + pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], dx = (x1 - x0) / 2;
    d += " C" + (x0 + dx) + "," + y0 + " " + (x1 - dx) + "," + y1 + " " + x1 + "," + y1;
  }
  return d;
}

export const chartColor = (i: number): string => "var(--chart-" + ((i % 8) + 1) + ")";
const fmtDefault = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-US");

export interface ChartLegendProps {
  series: ChartSeries[];
  hidden: Record<string, boolean>;
  onToggle?: (name: string) => void;
}

export function ChartLegend({ series, hidden, onToggle }: ChartLegendProps) {
  return (
    <div className="pc-legend">
      {series.map((s, i) => (
        <button key={s.name} type="button" className={"pc-legend__item" + (hidden[s.name] ? " is-off" : "")} onClick={() => { if (onToggle) onToggle(s.name); }}>
          <span className="pc-legend__dot" style={{ background: s.color || chartColor(i) }} />{s.name}
        </button>
      ))}
    </div>
  );
}

export interface ChartTipRow {
  name: string;
  color: string;
  value: number;
}

export interface ChartTipProps {
  x: number;
  w: number;
  title: ReactNode;
  rows: ChartTipRow[];
  fmt: (v: number) => string;
}

export function ChartTip({ x, w, title, rows, fmt }: ChartTipProps) {
  const tw = 160, left = x > w - tw - 24 ? x - tw - 14 : x + 14;
  return (
    <div className="pc-chart__tip" style={{ left: Math.max(0, left), width: tw }}>
      <div className="pc-chart__tip-title">{title}</div>
      {rows.map(r => (
        <div key={r.name} className="pc-chart__tip-row"><span className="pc-legend__dot" style={{ background: r.color }} />{r.name}<b>{fmt(r.value)}</b></div>
      ))}
    </div>
  );
}

export interface AreaChartProps {
  labels?: string[];
  series?: ChartSeries[];
  height?: number;
  yFormat?: (v: number) => string;
  legend?: boolean;
  area?: boolean;
  yTicks?: number;
  className?: string;
  style?: CSSProperties;
}

export function AreaChart({ labels = [], series = [], height = 260, yFormat = fmtDefault, legend = true, area = true, yTicks = 4, className = "", style }: AreaChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useChartWidth(ref);
  const uid = useId().replace(/:/g, "");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<number | null>(null);
  const p = useReveal(900);
  const all = series.map((s, i) => ({ ...s, color: s.color || chartColor(i) }));
  const vis = all.filter(s => !hidden[s.name]);
  const pl = 44, pr = 12, pt = 12, pb = 28, iw = w - pl - pr, ih = height - pt - pb, n = labels.length;
  const max = niceMax(Math.max(1, ...vis.flatMap(s => s.data)));
  const X = (i: number) => pl + (n > 1 ? (i * iw) / (n - 1) : iw / 2);
  const Y = (v: number) => pt + ih - (v / max) * ih;
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));
  const move = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - pl) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <div className={"pc-chart " + className} style={style}>
      <div ref={ref} style={{ position: "relative" }}>
        <svg width={w} height={height} onMouseMove={move} onMouseLeave={() => setHover(null)}>
          <defs>
            {all.map((s, i) => (
              <linearGradient key={i} id={uid + "g" + i} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.26 }} />
                <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
              </linearGradient>
            ))}
            <clipPath id={uid + "c"}><rect x={0} y={0} width={pl + iw * p + 2} height={height} /></clipPath>
          </defs>
          {Array.from({ length: yTicks + 1 }, (_, k) => {
            const v = (max / yTicks) * k, y = Y(v);
            return (
              <g key={k}>
                <line className="pc-chart__grid" x1={pl} x2={pl + iw} y1={y} y2={y} strokeDasharray={k === 0 ? undefined : "3 5"} />
                <text className="pc-chart__axis" x={pl - 10} y={y + 4} textAnchor="end">{yFormat(v)}</text>
              </g>
            );
          })}
          {labels.map((l, i) => i % step === 0 || i === n - 1 ? (
            <text key={i} className="pc-chart__axis" x={X(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              style={hover === i ? { fill: "var(--text-strong)", fontWeight: 700 } : undefined}>{l}</text>
          ) : null)}
          <g clipPath={"url(#" + uid + "c)"}>
            {all.map((s, i) => {
              if (hidden[s.name]) return null;
              const pts = s.data.map((v, j): [number, number] => [X(j), Y(v)]);
              const d = smoothPath(pts);
              return (
                <g key={s.name}>
                  {area ? <path d={d + " L" + X(n - 1) + "," + (pt + ih) + " L" + X(0) + "," + (pt + ih) + " Z"} fill={"url(#" + uid + "g" + i + ")"} /> : null}
                  <path d={d} fill="none" style={{ stroke: s.color }} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </g>
              );
            })}
          </g>
          {hover != null ? (
            <g pointerEvents="none">
              <line x1={X(hover)} x2={X(hover)} y1={pt} y2={pt + ih} style={{ stroke: "var(--navy-300)" }} strokeDasharray="3 4" />
              {vis.map(s => <circle key={s.name} cx={X(hover)} cy={Y(s.data[hover])} r={5} style={{ fill: "#fff", stroke: s.color }} strokeWidth={2.5} />)}
            </g>
          ) : null}
          <rect x={pl} y={pt} width={iw} height={ih} fill="transparent" />
        </svg>
        {hover != null && vis.length ? (
          <ChartTip x={X(hover)} w={w} title={labels[hover]} fmt={yFormat} rows={vis.map(s => ({ name: s.name, color: s.color, value: s.data[hover] }))} />
        ) : null}
      </div>
      {legend && all.length > 1 ? (
        <div style={{ marginTop: 12 }}><ChartLegend series={all} hidden={hidden} onToggle={nm => setHidden(h => ({ ...h, [nm]: !h[nm] }))} /></div>
      ) : null}
    </div>
  );
}
