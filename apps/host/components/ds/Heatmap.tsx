"use client";

import { useState, type CSSProperties } from "react";

const SCALE = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];

export interface HeatmapProps {
  rows?: string[];
  cols?: (string | number)[];
  data?: number[][];
  colLabelEvery?: number;
  scale?: string[];
  valueFormat?: (v: number) => string;
  className?: string;
  style?: CSSProperties;
}

export function Heatmap({ rows = [], cols = [], data = [], colLabelEvery = 1, scale = SCALE, valueFormat = v => String(v), className = "", style }: HeatmapProps) {
  const [hot, setHot] = useState<[number, number] | null>(null);
  const flat = data.flat();
  const min = Math.min(...flat), max = Math.max(...flat), span = max - min || 1;
  const col = (v: number) => scale[Math.min(scale.length - 1, Math.floor(((v - min) / span) * scale.length))];
  const rootStyle = { "--cols": cols.length, position: "relative", ...style } as CSSProperties;
  return (
    <div className={"pc-heat " + className} style={rootStyle} onMouseLeave={() => setHot(null)}>
      {rows.map((r, i) => (
        <div key={r} className="pc-heat__row">
          <span className="pc-heat__lab">{r}</span>
          {cols.map((c, j) => <span key={j} className="pc-heat__cell" onMouseEnter={() => setHot([i, j])} style={{ background: col((data[i] || [])[j] || 0), opacity: hot && (hot[0] !== i && hot[1] !== j) ? 0.55 : 1 }} />)}
        </div>
      ))}
      <div className="pc-heat__cols"><span />{cols.map((c, j) => <span key={j}>{j % colLabelEvery === 0 ? c : ""}</span>)}</div>
      {hot ? <div className="pc-chart__tip" style={{ left: "calc(36px + (100% - 36px) * " + ((hot[1] + 0.5) / cols.length) + ")", top: hot[0] * 26 - 52, transform: "translateX(-50%)", minWidth: 0, whiteSpace: "nowrap" }}><div className="pc-chart__tip-title">{rows[hot[0]]} · {cols[hot[1]]}</div><b style={{ font: "600 13px var(--font-sans)", color: "var(--text-strong)" }}>{valueFormat(data[hot[0]][hot[1]])}</b></div> : null}
    </div>
  );
}
