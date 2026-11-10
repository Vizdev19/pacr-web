"use client";

import type { ReactNode } from "react";
import { GlassCard } from "@/components/ds";
import { kMuted } from "@/components/shell/kit";

export type SummaryCell = { label: string; value: ReactNode; note?: ReactNode; hero?: boolean };

/** The mock's Summary strip: a row of figures, the last one on hatched lime. */
export function Summary({ cells }: { cells: SummaryCell[] }) {
  return (
    <GlassCard padding={0}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))" }}>
        {cells.map((c, i) => (
          <div
            key={c.label}
            style={{
              padding: 18, borderLeft: i ? "1px solid var(--border-subtle)" : 0,
              background: c.hero ? "var(--fill-lime)" : "transparent", borderRadius: c.hero ? 10 : 0, margin: c.hero ? 6 : 0,
            }}
          >
            <div style={{ font: "400 13px var(--font-sans)", color: c.hero ? "var(--ink-900)" : "var(--text-strong)" }}>{c.label}</div>
            <div style={{ font: "var(--type-kpi)", letterSpacing: "var(--tracking-display)", color: "var(--ink-900)", marginTop: 12, fontSize: 26 }}>{c.value}</div>
            {c.note ? <div style={{ ...kMuted, color: c.hero ? "var(--lime-800)" : undefined, marginTop: 8 }}>{c.note}</div> : null}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/** A payout line's status as people read it (hold looks pending, void looks neutral). */
export function payoutTag(status: string): { status: string; label: string } {
  switch (status) {
    case "paid": return { status: "Paid", label: "Paid" };
    case "pending": return { status: "Pending", label: "Pending" };
    case "hold": return { status: "Pending", label: "On hold" };
    case "void": return { status: "Refunded", label: "Void" };
    default: return { status: "Draft", label: status };
  }
}

/** "payout_account_required" → "Payout account required". */
export function holdText(reason: string | null | undefined): string {
  const s = String(reason ?? "").replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}
