"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface GlassCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  strong?: boolean;
  flush?: boolean;
  interactive?: boolean;
  rise?: boolean;
  padding?: CSSProperties["padding"];
}

export function GlassCard({ title, subtitle, actions, strong = false, flush = false, interactive = false, rise = false, padding, className = "", style, children, ...rest }: GlassCardProps) {
  const cls = ["pc-card", "pc-glass", strong ? "pc-card--strong" : "", flush ? "pc-card--flush" : "", interactive ? "pc-card--interactive" : "", rise ? "pc-card--rise" : "", className].filter(Boolean).join(" ");
  const head = title || subtitle || actions;
  return (
    <div className={cls} style={{ ...(padding != null ? { padding } : null), ...style }} {...rest}>
      {head ? (
        <div className="pc-card__head" style={flush ? { padding: "18px 20px 0" } : undefined}>
          <div style={{ minWidth: 0 }}>
            {title ? <div className="pc-card__title">{title}</div> : null}
            {subtitle ? <div className="pc-card__sub">{subtitle}</div> : null}
          </div>
          {actions ? <div className="pc-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
