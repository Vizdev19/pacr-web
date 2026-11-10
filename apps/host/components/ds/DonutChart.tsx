"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useReveal, chartColor } from "./AreaChart";

const fmtDefault = (v: number) => v.toLocaleString("en-US");

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data?: DonutDatum[];
  size?: number;
  thickness?: number;
  centerValue?: ReactNode;
  centerLabel?: ReactNode;
  valueFormat?: (v: number) => string;
  list?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function DonutChart({ data = [], size = 180, thickness = 22, centerValue, centerLabel, valueFormat = fmtDefault, list = true, className = "", style }: DonutChartProps) {
  const [hot, setHot] = useState<number | null>(null);
  const p = useReveal(900);
  const items = data.map((d, i) => ({ ...d, color: d.color || chartColor(i) }));
  const total = items.reduce((a, d) => a + d.value, 0) || 1;
  const r = (size - thickness - 10) / 2, C = 2 * Math.PI * r, gap = items.length > 1 ? 6 : 0, cap = items.length > 1 ? thickness : 0;
  const starts = items.map((_, i) => items.slice(0, i).reduce((a, d) => a + (d.value / total) * C, 0));
  const h = hot != null ? items[hot] : null;
  return (
    <div className={"pc-chart " + className} style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", ...style }}>
      <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {items.map((d, i) => {
            const len = Math.max(0.01, (d.value / total) * C * p - gap - cap), off = -starts[i] * p - (gap + cap) / 2;
            return (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" strokeDasharray={len + " " + (C - len)} strokeDashoffset={off} strokeLinecap={cap ? "round" : "butt"}
                onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
                style={{ stroke: d.color, strokeWidth: hot === i ? thickness + 6 : thickness, opacity: hot != null && hot !== i ? 0.4 : 1, transition: "stroke-width 240ms cubic-bezier(.34,1.56,.64,1), opacity 200ms", cursor: "pointer" }} />
            );
          })}
        </svg>
        <div className="pc-donut__center">
          <span className="pc-donut__value">{h ? valueFormat(h.value) : centerValue != null ? centerValue : valueFormat(total)}</span>
          <span className="pc-donut__label">{h ? h.label : centerLabel}</span>
        </div>
      </div>
      {list ? (
        <div className="pc-donut__list">
          {items.map((d, i) => (
            <div key={i} className={"pc-donut__row" + (hot === i ? " is-hot" : "")} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
              <span className="pc-legend__dot" style={{ background: d.color }} />
              <span>{d.label}</span>
              <b>{valueFormat(d.value)}</b>
              <span className="pct">{Math.round((d.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
