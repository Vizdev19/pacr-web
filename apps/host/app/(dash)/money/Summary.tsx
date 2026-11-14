"use client";

import type { ReactNode } from "react";
import { GlassCard } from "@/components/ds";
import { kMuted } from "@/components/shell/kit";
import type { PayoutDispute, PayoutLine } from "@/lib/api";
import { day, paise } from "@/lib/format";

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

/** A payout's status as people read it (hold looks pending, void looks neutral). */
export function payoutTag(status: string): { status: string; label: string } {
  switch (status) {
    case "paid": return { status: "Paid", label: "Paid" };
    case "paying": return { status: "Processing", label: "Sending" };
    case "pending": return { status: "Pending", label: "Pending" };
    case "hold": return { status: "Pending", label: "On hold" };
    case "void": return { status: "Refunded", label: "Nothing to pay" };
    default: return { status: "Draft", label: status };
  }
}

const HOLD: Record<string, string> = {
  refund_in_progress: "Waiting for a refund to go through. It’s paid once every refund is done.",
  no_payout_account: "Waiting for payout details. The owner adds them under Money → Payout account.",
  dispute_open: "A runner disputed their payment with their bank, and it’s the only booking to pay out. It’s paid once that’s settled.",
  host_suspended: "Hosting is paused for this account. Write to support@pacr.life.",
};

/** Why a payout is on hold, in plain words. */
export function holdText(reason: string | null | undefined): string {
  if (reason && HOLD[reason]) return HOLD[reason];
  const s = String(reason ?? "").replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

/**
 * What a bank dispute is keeping out of a payout, in plain words: the rest of
 * the payout goes ahead, and a disputed booking is paid if the bank sides with
 * the event.
 */
export function disputeNote(d: PayoutDispute | null | undefined): string {
  if (!d) return "";
  const held = Number(d.held_minor) || 0, due = Number(d.due_minor) || 0, paid = Number(d.paid_minor) || 0;
  return [
    held > 0 ? `${paise(held)} is kept back while a runner’s bank dispute is open; it’s paid if the bank sides with you.` : null,
    due > 0 ? `${paise(due)} from a settled dispute is on its way.` : null,
    paid > 0 ? `${paise(paid)} from a settled dispute was paid separately.` : null,
  ].filter(Boolean).join(" ");
}

/** One line on where a payout stands: the hold reason, or when it was paid and its reference; then what a dispute is keeping back. */
export function payoutNote(p: Pick<PayoutLine, "status" | "hold_reason" | "paid_at" | "reference" | "dispute">): string {
  // A payout on hold for its dispute already says so.
  const extra = p.status === "hold" && p.hold_reason === "dispute_open" ? "" : disputeNote(p.dispute);
  const stands = payoutStands(p);
  if (!extra || !stands) return stands || extra;
  return `${stands}${/[.!?]$/.test(stands) ? " " : " · "}${extra}`;
}

function payoutStands(p: Pick<PayoutLine, "status" | "hold_reason" | "paid_at" | "reference">): string {
  switch (p.status) {
    case "paid": return [p.paid_at ? `Paid ${day(p.paid_at)}` : "Paid", p.reference ? `ref ${p.reference}` : null].filter(Boolean).join(" · ");
    case "paying": return "pacr is transferring it now.";
    case "pending": return "Ready to pay. pacr sends it to your payout details.";
    case "hold": return holdText(p.hold_reason) || "On hold.";
    case "void": return "Every ticket was refunded, so there’s nothing to pay.";
    default: return "";
  }
}
