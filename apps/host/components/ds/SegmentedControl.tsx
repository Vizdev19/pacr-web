"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { useIndicator } from "./Tabs";

export interface SegmentOption {
  value: string;
  label?: ReactNode;
  icon?: IconName;
  title?: string;
}

export interface SegmentedControlProps {
  options?: (string | SegmentOption)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  block?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function SegmentedControl({ options = [], value, defaultValue, onChange, size = "md", block = false, className = "", style }: SegmentedControlProps) {
  const list: SegmentOption[] = options.map(o => typeof o === "string" ? { value: o, label: o } : o);
  const [inner, setInner] = useState<string | undefined>(defaultValue !== undefined ? defaultValue : list[0] && list[0].value);
  const cur = value !== undefined ? value : inner;
  const ref = useRef<HTMLDivElement>(null);
  const box = useIndicator(ref, cur, list.length);
  const pick = (v: string) => { if (value === undefined) setInner(v); if (onChange) onChange(v); };
  return (
    <div ref={ref} role="radiogroup" className={"pc-seg" + (size === "sm" ? " pc-seg--sm" : "") + (block ? " pc-seg--block" : "") + (className ? " " + className : "")} style={style}>
      {box ? <span className="pc-seg__ind" style={{ width: box.w, transform: "translateX(" + box.x + "px)" }} /> : null}
      {list.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === cur} data-active={o.value === cur}
          className={"pc-seg__btn" + (o.value === cur ? " is-active" : "")} onClick={() => pick(o.value)} title={o.title}>
          {o.icon ? <Icon name={o.icon} size={15} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}
