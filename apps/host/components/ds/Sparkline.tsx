"use client";

import { useId, type CSSProperties } from "react";
import { smoothPath, useReveal } from "./AreaChart";

export interface SparklineProps {
  data?: number[];
  color?: string;
  height?: number;
  width?: number;
  fill?: boolean;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

export function Sparkline({ data = [], color = "var(--chart-1)", height = 36, width = 120, fill = true, strokeWidth = 2, className = "", style }: SparklineProps) {
  const uid = useId().replace(/:/g, "");
  const p = useReveal(800);
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1, pad = 3;
  const pts = data.map((v, i): [number, number] => [(i / (data.length - 1)) * width, pad + (1 - (v - min) / rng) * (height - pad * 2)]);
  const d = smoothPath(pts);
  return (
    <svg className={className} width={width} height={height} viewBox={"0 0 " + width + " " + height} preserveAspectRatio="none" style={{ display: "block", overflow: "visible", ...style }}>
      <defs>
        <linearGradient id={uid + "g"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
          <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
        <clipPath id={uid + "c"}><rect x={0} y={-4} width={width * p + 4} height={height + 8} /></clipPath>
      </defs>
      <g clipPath={"url(#" + uid + "c)"}>
        {fill ? <path d={d + " L" + width + "," + height + " L0," + height + " Z"} fill={"url(#" + uid + "g)"} /> : null}
        <path d={d} fill="none" style={{ stroke: color }} strokeWidth={strokeWidth} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} style={{ fill: color }} />
      </g>
    </svg>
  );
}
