"use client";

import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface AudienceOption {
  id: string;
  label: ReactNode;
  sub?: ReactNode;
  icon?: IconName;
  extra?: ReactNode;
  count?: number;
}

export interface AudiencePickerProps {
  options?: AudienceOption[];
  value?: string;
  onChange?: (id: string) => void;
  totalLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export function AudiencePicker({ options = [], value, onChange, totalLabel = "will get this", className = "", style }: AudiencePickerProps) {
  const cur = options.find(o => o.id === value) || options[0];
  return (
    <div className={"pc-aud" + (className ? " " + className : "")} style={style} role="radiogroup">
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === (cur && cur.id)} className={"pc-aud__opt" + (o.id === (cur && cur.id) ? " is-on" : "")} onClick={() => { if (onChange) onChange(o.id); }}>
          <span className="pc-aud__radio" />
          {o.icon ? <Icon name={o.icon} size={16} color="var(--text-muted)" /> : null}
          <span className="pc-aud__label">{o.label}{o.sub ? <span className="pc-aud__sub">{o.sub}</span> : null}</span>
          {o.extra}
          <span className="pc-aud__count">{o.count != null ? o.count.toLocaleString("en-IN") : ""}</span>
        </button>
      ))}
      {cur ? <div className="pc-aud__total"><Icon name="users" size={16} /><b>{(cur.count || 0).toLocaleString("en-IN")}</b><span>{(cur.count === 1 ? "runner " : "runners ") + totalLabel}</span></div> : null}
    </div>
  );
}
