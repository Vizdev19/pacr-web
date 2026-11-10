"use client";

// The small layout helpers the design system's page mocks share
// (ui_kits/host/Shell.jsx): Meta, Toolbar, SectionTitle, KV, the card grid and
// the two text styles. Pages are built from these plus components/ds.

import type { CSSProperties, ReactNode } from "react";
import { EmptyState, GlassCard, Icon, Skeleton, type IconName } from "@/components/ds";
import { failText } from "@/lib/api";

export const kitGrid = (min: number, gap = 12): CSSProperties =>
  ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap });
export const kStrong: CSSProperties = { font: "500 14px/1.3 var(--font-sans)", color: "var(--text-strong)" };
export const kMuted: CSSProperties = { font: "var(--type-caption)", color: "var(--text-muted)" };
/** The plain multi-line field the mocks use next to Input. */
export const kTextarea: CSSProperties = {
  width: "100%", font: "400 14px/1.5 var(--font-sans)", padding: "10px 12px", borderRadius: 8,
  border: "1px solid var(--border-default)", resize: "vertical", outline: "none", color: "var(--text-strong)", background: "#fff",
};

export function Meta({ icon, children }: { icon?: IconName; children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center", font: "400 12px/1.3 var(--font-sans)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
      {icon ? <Icon name={icon} size={13} /> : null}{children}
    </span>
  );
}
export function Toolbar({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12, ...style }}>{children}</div>;
}
export function SectionTitle({ children, right, style }: { children: ReactNode; right?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "22px 0 10px", ...style }}>
      <h2 style={{ font: "var(--type-section)", letterSpacing: "-.01em" }}>{children}</h2>{right}
    </div>
  );
}
export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", font: "400 13px/1.35 var(--font-sans)" }}>
      <span style={{ color: "var(--text-muted)" }}>{k}</span><span style={{ color: "var(--text-strong)", textAlign: "right" }}>{v}</span>
    </div>
  );
}

/** The error state every page shows when its data didn't load. */
export function LoadError({ what, error, onRetry }: { what: string; error: unknown; onRetry: () => void }) {
  return <EmptyState variant="error" title={`Couldn’t load ${what}`} message={failText(error)} action={{ label: "Retry", onClick: onRetry }} style={{ marginTop: 24 }} />;
}
/** A card of shimmering rows: the loading state for lists and tables. */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <GlassCard>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderTop: i ? "1px solid var(--border-subtle)" : 0 }}>
          <Skeleton width={28} height={28} radius={14} /><Skeleton width="22%" height={12} /><Skeleton width="10%" height={10} />
          <div style={{ flex: 1 }} /><Skeleton width="14%" height={10} />
        </div>
      ))}
    </GlassCard>
  );
}
