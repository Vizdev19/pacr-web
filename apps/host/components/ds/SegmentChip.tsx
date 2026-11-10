"use client";

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface SegmentChipProps {
  label?: ReactNode;
  count?: number | string | null;
  active?: boolean;
  icon?: IconName;
  mark?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
}

export function SegmentChip({ label, count, active = false, icon, mark, onClick, className = "", style }: SegmentChipProps) {
  return (
    <button type="button" className={"pc-chip" + (active ? " is-active" : "") + (className ? " " + className : "")} onClick={onClick} aria-pressed={active} style={style}>
      {mark ? <span className="pc-chip__mark" style={{ background: mark }} /> : null}
      {icon ? <Icon name={icon} size={14} /> : null}
      {label}
      {count != null ? <span className="pc-chip__count">{count}</span> : null}
    </button>
  );
}
