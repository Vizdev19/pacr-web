"use client";

import type { CSSProperties } from "react";
import { Icon } from "./Icon";

export interface DateTileProps {
  day: string | number;
  date: string | number;
  month: string | number;
  kind?: "run" | "event";
  size?: "sm" | "md";
  showKind?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function DateTile({ day, date, month, kind = "run", size = "md", showKind = true, className = "", style }: DateTileProps) {
  return (
    <div className={"pc-date pc-date--" + kind + (size === "sm" ? " pc-date--sm" : "") + (className ? " " + className : "")} style={style} aria-label={(kind === "event" ? "Event, " : "Run, ") + day + " " + date + " " + month}>
      <span className="pc-date__dow">{day}</span>
      <span className="pc-date__num">{date}</span>
      <span className="pc-date__mon">{month}</span>
      {showKind ? <span className="pc-date__kind"><Icon name={kind === "event" ? "ticket" : "footprints"} size={11} strokeWidth={2.25} /></span> : null}
    </div>
  );
}
