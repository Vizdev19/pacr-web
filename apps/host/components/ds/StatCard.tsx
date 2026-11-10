"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GlassCard, type GlassCardProps } from "./GlassCard";
import { Icon, type IconName } from "./Icon";
import { Sparkline } from "./Sparkline";
import type { BadgeTone } from "./Badge";

const ALIAS: Record<string, string> = { success: "lime", warning: "orange", danger: "red", info: "sky" };
const SPARK: Record<string, number> = { orange: 1, magenta: 2, green: 3, sky: 4, violet: 5, amber: 6, pink: 8, lime: 3 };
const GRAD: Record<string, string> = { pink: "pink", violet: "violet", magenta: "violet", green: "green", lime: "green", orange: "orange", sky: "sky", amber: "amber", red: "pink", navy: "violet" };

export type StatTone = BadgeTone | "pop";

function useCount(target: number | null, dur = 900): number {
  const [st, setSt] = useState<{ k: number | null; v: number }>({ k: target, v: 0 });
  useEffect(() => {
    if (target === null) return;
    let raf = 0;
    let t0: number | undefined;
    const step = (t: number) => {
      if (t0 === undefined) t0 = t;
      const k = Math.min(1, (t - t0) / dur);
      setSt({ k: target, v: target * (1 - Math.pow(1 - k, 3)) });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return st.k === target ? st.v : 0;
}

export interface StatCardProps extends Omit<GlassCardProps, "title" | "subtitle" | "actions" | "children"> {
  label: ReactNode;
  value: number | string;
  unit?: ReactNode;
  format?: (v: number | string) => string;
  delta?: number | null;
  deltaLabel?: string;
  invertDelta?: boolean;
  icon?: IconName;
  tone?: StatTone;
  spark?: number[];
}

export function StatCard({ label, value, unit, format, delta, deltaLabel = "from last week", invertDelta = false, icon, tone = "pink", spark, className = "", style, ...rest }: StatCardProps) {
  const t = ALIAS[tone] || tone;
  const shown = useCount(typeof value === "number" ? value : null);
  const fmt = format || ((v: number | string) => typeof v === "number" ? Math.round(v).toLocaleString("en-US") : v);
  const dir = delta == null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const good = dir === "flat" ? "flat" : (dir === "up") !== invertDelta ? "up" : "down";
  const bubble = tone === "pop" ? "var(--grad-pop)" : "var(--grad-icon-" + (GRAD[t] || "orange") + ")";
  return (
    <GlassCard className={"pc-stat " + className} style={style} {...rest}>
      <div className="pc-stat__top">
        <span className="pc-stat__label">{label}</span>
        {icon ? <span className="pc-stat__icon" style={{ background: bubble }}><Icon name={icon} size={16} strokeWidth={2.25} /></span> : null}
      </div>
      <div className="pc-stat__value">
        <span>{fmt(typeof value === "number" ? shown : value)}{unit ? <span className="pc-stat__unit"> {unit}</span> : null}</span>
      </div>
      <div className="pc-stat__foot">
        <span className="pc-stat__cmp">{dir && delta != null ? <span className={"pc-delta pc-delta--" + good}><Icon name={dir === "up" ? "trending-up" : dir === "down" ? "trending-down" : "minus"} size={13} strokeWidth={2} />{Math.abs(delta)}%</span> : null}{dir ? " " + deltaLabel : ""}</span>
        {spark ? <Sparkline data={spark} width={84} height={24} color={"var(--chart-" + (SPARK[t] || 1) + ")"} /> : null}
      </div>
    </GlassCard>
  );
}
