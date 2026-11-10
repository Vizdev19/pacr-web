"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart, EmptyState, GlassCard, Icon, Skeleton, StatusTag, Tabs } from "@/components/ds";
import { kMuted, kStrong, KV, LoadError, RowsSkeleton } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { day, paise } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { encodeRef } from "@/lib/refs";
import { Summary, holdText, payoutTag } from "./Summary";

type Tab = "overview" | "account";

export function Money() {
  const { host } = useHost();
  const [tab, setTab] = useState<Tab>("overview");
  const account = useLoad(() => api.payoutAccount(host.kind, host.id), `payout-account:${host.key}`);
  const locked = account.status === "ready" && !account.data.can_edit;
  return (
    <div>
      <Tabs value={tab} onChange={v => setTab(v as Tab)} style={{ marginBottom: 14 }}
        tabs={[{ value: "overview", label: "Overview" }, { value: "account", label: "Payout account", icon: locked ? "lock" : undefined }]} />
      {tab === "overview" ? <Overview /> : <Account account={account} />}
    </div>
  );
}

const short = (t: string) => (t.length > 10 ? `${t.slice(0, 9).trimEnd()}…` : t);
const rupeesK = (v: number) => (v >= 1000 ? `₹${Math.round((v / 1000) * 10) / 10}k` : `₹${Math.round(v)}`);

function Overview() {
  const { host } = useHost();
  const { phone } = useViewport();
  const router = useRouter();
  const d = useLoad(async () => {
    const [lines, pricing] = await Promise.all([
      api.myPayouts(host.kind, host.id),
      api.eventPricing().catch(() => null),
    ]);
    return { lines, pricing };
  }, `money:${host.key}`);

  if (d.status === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <GlassCard><Skeleton width="100%" height={72} /></GlassCard>
        <RowsSkeleton rows={4} />
      </div>
    );
  }
  if (d.status === "error") return <LoadError what="payouts" error={d.error} onRetry={d.reload} />;

  const { lines, pricing } = d.data;
  if (lines.length === 0) {
    return (
      <EmptyState icon="wallet" title="No ticket sales yet" message="Payouts appear here once a paid event sells tickets."
        style={{ padding: "56px 24px" }} action={{ label: "Go to events", variant: "secondary", onClick: () => router.push("/events") }} />
    );
  }
  const live = lines.filter(l => l.status !== "void");
  const sum = (xs: api.Payout[], f: (l: api.Payout) => number) => xs.reduce((a, l) => a + f(l), 0);
  const byStart = [...lines].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  const sold = byStart.filter(l => l.ticket_gross_minor > 0).slice(0, 8).reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Summary cells={[
        { label: "Ticket sales", value: paise(sum(live, l => l.ticket_gross_minor)) },
        { label: "Refunded", value: paise(sum(live, l => l.ticket_refunded_minor)) },
        { label: "Paid out", value: paise(sum(lines.filter(l => l.status === "paid"), l => l.net_minor)) },
        { label: "On the way", value: paise(sum(lines.filter(l => l.status === "pending" || l.status === "hold"), l => l.net_minor)) },
        { label: "You receive in total", value: paise(sum(live, l => l.net_minor)), hero: true },
      ]} />
      {pricing ? (
        <div style={kMuted}>
          Runners pay the ticket price plus a {pricing.fee_bps / 100}% pacr fee and {pricing.gst_bps / 100}% GST on that fee. You receive the ticket price.
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1.4fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
        <GlassCard title="Ticket sales by event" subtitle="Gross, latest events with sales">
          {sold.length === 0 ? (
            <div style={kMuted}>No ticket sales to chart yet.</div>
          ) : (
            <BarChart height={220} track legend={false} labels={sold.map(l => short(l.title))} yFormat={rupeesK}
              series={[{ name: "Gross", data: sold.map(l => l.ticket_gross_minor / 100), color: "var(--chart-1)" }]} />
          )}
        </GlassCard>
        <GlassCard title="Payouts" subtitle="One line per event">
          <div style={{ position: "relative" }}>
            {byStart.map((l, i) => {
              const tag = payoutTag(l.status);
              const ref = encodeRef(l.event_id);
              const paid = l.status === "paid";
              const meta = paid
                ? `Paid ${l.paid_at ? day(l.paid_at) : ""}${l.reference ? ` · ref ${l.reference}` : ""}`
                : l.status === "hold" ? holdText(l.hold_reason) : "";
              const body = (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={kStrong}>{paise(l.net_minor)}</span><StatusTag status={tag.status}>{tag.label}</StatusTag>
                  </div>
                  <div style={{ ...kMuted, marginTop: 2 }}>{l.title} · {day(l.starts_at)}</div>
                  {meta ? <div style={kMuted}>{meta}</div> : null}
                </div>
              );
              return (
                <div key={l.event_id} style={{ display: "flex", gap: 12, paddingBottom: 14, position: "relative" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, flex: "none", background: paid ? "var(--lime-500)" : "#fff", border: `2px solid ${paid ? "var(--lime-500)" : l.status === "void" ? "var(--ink-300)" : "var(--ink-900)"}`, zIndex: 1 }} />
                  {i < byStart.length - 1 ? <span style={{ position: "absolute", left: 5, top: 16, bottom: 0, width: 2, background: "var(--border-default)" }} /> : null}
                  {ref ? <Link href={`/events?event=${ref}&tab=sales`} style={{ flex: 1, minWidth: 0, display: "flex", textDecoration: "none", color: "inherit" }}>{body}</Link> : body}
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

const FIELDS: [string, string][] = [
  ["method", "Method"], ["account_name", "Account name"], ["upi", "UPI"], ["account_last4", "Account number"], ["ifsc", "IFSC"], ["has_pan", "PAN"],
];

function fieldValue(key: string, v: unknown): string | null {
  if (v == null || v === false || v === "") return null;
  if (key === "has_pan") return "On file";
  if (key === "method") return v === "upi" ? "UPI" : v === "bank" ? "Bank account" : String(v);
  if (key === "account_last4") return `···· ${String(v)}`;
  return String(v);
}

function Account({ account }: { account: ReturnType<typeof useLoad<api.PayoutAccount>> }) {
  if (account.status === "loading") return <RowsSkeleton rows={3} />;
  if (account.status === "error") return <LoadError what="the payout account" error={account.error} onRetry={account.reload} />;
  const { ready, can_edit, account: acc } = account.data;
  const entries = acc ? FIELDS.map(([k, label]) => [label, fieldValue(k, (acc as Record<string, unknown>)[k])] as const).filter(([, v]) => v !== null) : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
      {!can_edit ? (
        <EmptyState variant="locked" title="The payout account is for the owner." message="Organisers can see sales, but payout details stay with the owner." />
      ) : acc ? (
        <GlassCard title="Payout account" actions={<StatusTag status={ready ? "Approved" : "Pending"}>{ready ? "Ready" : "Not ready"}</StatusTag>}>
          {entries.map(([k, v]) => <KV key={k} k={k} v={v} />)}
        </GlassCard>
      ) : (
        <EmptyState icon="wallet" title="No payout account yet" message="Paid events can’t sell tickets until one is added." />
      )}
      {can_edit ? (
        <div style={kMuted}><Icon name="smartphone" size={13} /> Add or change the payout account in the pacr app: Events → Payouts.</div>
      ) : null}
    </div>
  );
}
