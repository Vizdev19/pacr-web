"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface TooltipProps {
  label: ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  delay?: number;
  children?: ReactNode;
}

export function Tooltip({ label, placement = "top", delay = 120, children }: TooltipProps) {
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = () => { clearTimeout(t.current); t.current = setTimeout(() => setOn(true), delay); };
  const hide = () => { clearTimeout(t.current); setOn(false); };
  useEffect(() => {
    const timer = t;
    return () => clearTimeout(timer.current);
  }, []);
  return (
    <span className="pc-tip-wrap" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      <span role="tooltip" className={"pc-tip pc-tip--" + placement + (on ? " is-on" : "")}>{label}</span>
    </span>
  );
}
