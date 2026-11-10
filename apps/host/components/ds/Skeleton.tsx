"use client";

import type { CSSProperties } from "react";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  lines?: number;
  gap?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = 12, radius, lines, gap = 8, className = "", style }: SkeletonProps) {
  if (lines) return (
    <div style={{ display: "flex", flexDirection: "column", gap, ...style }} className={className} aria-busy="true">
      {Array.from({ length: lines }, (_, i) => <span key={i} className="pc-skel" style={{ width: i === lines - 1 ? "62%" : width, height, borderRadius: radius }} />)}
    </div>
  );
  return <span className={"pc-skel" + (className ? " " + className : "")} aria-busy="true" style={{ width, height, borderRadius: radius, ...style }} />;
}
