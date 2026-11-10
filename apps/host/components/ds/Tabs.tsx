"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Icon, type IconName } from "./Icon";

export interface IndicatorBox { x: number; w: number }

export function useIndicator(ref: RefObject<HTMLElement | null>, active: string | undefined, depKey: string | number): IndicatorBox | null {
  const [box, setBox] = useState<IndicatorBox | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLElement>('[data-active="true"]');
      if (el) setBox({ x: el.offsetLeft, w: el.offsetWidth });
    };
    const raf = requestAnimationFrame(measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(root);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }, [ref, active, depKey]);
  return box;
}

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: IconName;
  count?: number | string | null;
}

export interface TabsProps {
  tabs?: (string | TabItem)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  style?: CSSProperties;
}

export function Tabs({ tabs = [], value, defaultValue, onChange, className = "", style }: TabsProps) {
  const list: TabItem[] = tabs.map(t => typeof t === "string" ? { value: t, label: t } : t);
  const [inner, setInner] = useState<string | undefined>(defaultValue !== undefined ? defaultValue : list[0] && list[0].value);
  const cur = value !== undefined ? value : inner;
  const ref = useRef<HTMLDivElement>(null);
  const box = useIndicator(ref, cur, list.length);
  const pick = (v: string) => { if (value === undefined) setInner(v); if (onChange) onChange(v); };
  return (
    <div ref={ref} className={"pc-tabs " + className} role="tablist" style={style}>
      {list.map(t => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === cur} data-active={t.value === cur}
          className={"pc-tab" + (t.value === cur ? " is-active" : "")} onClick={() => pick(t.value)}>
          {t.icon ? <Icon name={t.icon} size={16} /> : null}
          {t.label}
          {t.count != null ? <span className="pc-tab__count">{t.count}</span> : null}
        </button>
      ))}
      {box ? <span className="pc-tabs__ind" style={{ width: box.w, transform: "translateX(" + box.x + "px)" }} /> : null}
    </div>
  );
}
