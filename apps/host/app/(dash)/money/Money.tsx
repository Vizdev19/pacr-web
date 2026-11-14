"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart, Button, EmptyState, GlassCard, Icon, Input, SegmentedControl, Skeleton, StatusTag, Tabs } from "@/components/ds";
import { kMuted, kStrong, KV, LoadError, RowsSkeleton } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { day, paise } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { encodeRef } from "@/lib/refs";
import { Summary, payoutNote, payoutTag } from "./Summary";

type Tab = "overview" | "account";
type AccountLoad = ReturnType<typeof useLoad<api.PayoutAccount>>;

export function Money() {
  const { host } = useHost();
  const [tab, setTab] = useState<Tab>("overview");
  const account = useLoad(() => api.payoutAccount(host.kind, host.id), `payout-account:${host.key}`);
  const locked = account.status === "ready" && !account.data.can_edit;
  return (
    <div>
      <Tabs value={tab} onChange={v => setTab(v as Tab)} style={{ marginBottom: 14 }}
        tabs={[{ value: "overview", label: "Overview" }, { value: "account", label: "Payout account", icon: locked ? "lock" : undefined }]} />
      {tab === "overview"
        ? <Overview key={host.key} account={account} onAccount={() => setTab("account")} />
        : <Account key={host.key} account={account} />}
    </div>
  );
}

const short = (t: string) => (t.length > 10 ? `${t.slice(0, 9).trimEnd()}…` : t);
const rupeesK = (v: number) => (v >= 1000 ? `₹${Math.round((v / 1000) * 10) / 10}k` : `₹${Math.round(v)}`);

/** "UPI · ol•••@okhdfc" / "Bank account ···· 1234 · HDFC0001234": the masked details, as the app words them. */
const payoutLine = (a: api.MaskedPayout) =>
  a.method === "upi" ? `UPI · ${a.upi ?? ""}` : `Bank account ···· ${a.account_last4 ?? ""}${a.ifsc ? ` · ${a.ifsc}` : ""}`;

// ── Overview ───────────────────────────────────────────────────────────────

/** One paid event: its live figures (ticket prices only), and its payout once there is one. */
type Line = {
  eventId: string; title: string; startsAt: string; endsAt: string | null; cancelled: boolean;
  gross: number; refunded: number; net: number; payout: api.PayoutLine | null;
  /** In your hosting list, so its page opens; false for an older event known only by its payout. */
  listed: boolean;
};

/** What the host gets for an event: the payout's own figure once pacr is paying it, else the live one. */
const expectedOf = (l: Line) => (l.payout && (l.payout.status === "paid" || l.payout.status === "paying") ? l.payout.net_minor : l.net);
/** Nothing more will come for it: paid, nothing to pay, or cancelled. */
const doneWith = (l: Line) => l.payout?.status === "paid" || l.payout?.status === "void" || l.cancelled;

function lineTag(l: Line, now: number): { status: string; label: string } {
  if (l.payout) return payoutTag(l.payout.status);
  if (l.cancelled) return { status: "Cancelled", label: "Cancelled" };
  if (new Date(l.startsAt).getTime() > now) return { status: "Scheduled", label: "Upcoming" };
  if (l.endsAt && new Date(l.endsAt).getTime() > now) return { status: "Live", label: "Under way" };
  return { status: "Ended", label: "Ended" };
}
function lineNote(l: Line, now: number): string {
  if (l.payout) return payoutNote(l.payout);
  if (l.cancelled) return "Cancelled: every paid booking is refunded.";
  if (l.endsAt && new Date(l.endsAt).getTime() > now) return "Paid out a day after it ends.";
  return "pacr works out the payout a day after the event ends.";
}

function Overview({ account, onAccount }: { account: AccountLoad; onAccount: () => void }) {
  const { host } = useHost();
  const { phone } = useViewport();
  const router = useRouter();
  const d = useLoad(async () => {
    const [live, rows, pricing] = await Promise.all([
      api.hostSales(host.kind, host.id),
      // Only for events the live list can't reach: never worth failing the page over.
      api.myPayouts(host.kind, host.id).catch(() => [] as api.Payout[]),
      api.eventPricing().catch(() => null),
    ]);
    const lines: Line[] = live.map(({ event: e, sales: s }) => ({
      eventId: e.id, title: e.title, startsAt: e.starts_at, endsAt: e.ends_at, cancelled: e.status === "cancelled",
      gross: Number(s.ticket_gross_minor), refunded: Number(s.ticket_refunded_minor), net: Number(s.net_minor),
      payout: s.payout ? { ...s.payout, net_minor: Number(s.payout.net_minor) } : null, listed: true,
    }));
    // Payouts of events the hosting list no longer reaches (it keeps the newest 200).
    const seen = new Set(lines.map(l => l.eventId));
    for (const p of rows) {
      if (seen.has(p.event_id)) continue;
      lines.push({
        eventId: p.event_id, title: p.title, startsAt: p.starts_at, endsAt: null, cancelled: false,
        gross: Number(p.ticket_gross_minor), refunded: Number(p.ticket_refunded_minor), net: Number(p.net_minor),
        payout: { status: p.status, hold_reason: p.hold_reason, net_minor: Number(p.net_minor), paid_at: p.paid_at, reference: p.reference, dispute: p.dispute },
        listed: false,
      });
    }
    const shown = lines.filter(l => !(l.cancelled && l.gross === 0))
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    return { lines: shown, pricing, now: Date.now() };
  }, `money:${host.key}`);

  if (d.status === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <GlassCard><Skeleton width="100%" height={72} /></GlassCard>
        <RowsSkeleton rows={4} />
      </div>
    );
  }
  if (d.status === "error") return <LoadError what="ticket money" error={d.error} onRetry={d.reload} />;

  const { lines, pricing, now } = d.data;
  if (lines.length === 0) {
    return (
      <EmptyState icon="wallet" title="No paid events yet" message="Ticket money shows here from the first sale. pacr pays it out a day after each event ends."
        style={{ padding: "56px 24px" }} action={{ label: "Go to events", variant: "secondary", onClick: () => router.push("/events") }} />
    );
  }
  const canEdit = account.status === "ready" && account.data.can_edit;
  const sum = (xs: Line[], f: (l: Line) => number) => xs.reduce((a, l) => a + f(l), 0);
  const sold = lines.filter(l => l.gross > 0).slice(0, 8).reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Summary cells={[
        { label: "Ticket sales", value: paise(sum(lines, l => l.gross)), note: "Before refunds" },
        { label: "Refunded", value: paise(sum(lines, l => l.refunded)) },
        { label: "Paid out", value: paise(sum(lines.filter(l => l.payout?.status === "paid"), expectedOf)) },
        { label: "Expected payout", value: paise(sum(lines.filter(l => !doneWith(l)), expectedOf)), note: "Not paid yet. Each event is paid a day after it ends.", hero: true },
      ]} />
      {pricing ? (
        <div style={kMuted}>
          Runners pay the ticket price plus a {pricing.fee_bps / 100}% pacr fee and {pricing.gst_bps / 100}% GST on that fee. You receive the ticket price.
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1.2fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
        <GlassCard title="Ticket sales by event" subtitle="Gross, latest events with sales">
          {sold.length === 0 ? (
            <div style={kMuted}>No ticket sales to chart yet.</div>
          ) : (
            <BarChart height={220} track legend={false} labels={sold.map(l => short(l.title))} yFormat={rupeesK}
              series={[{ name: "Gross", data: sold.map(l => l.gross / 100), color: "var(--chart-1)" }]} />
          )}
        </GlassCard>
        <GlassCard title="Payouts" subtitle="One line per paid event, newest first">
          <div style={{ position: "relative" }}>
            {lines.map((l, i) => {
              const tag = lineTag(l, now);
              const ref = encodeRef(l.eventId);
              const paid = l.payout?.status === "paid";
              const quiet = l.payout?.status === "void" || l.cancelled;
              const needsDetails = l.payout?.status === "hold" && l.payout.hold_reason === "no_payout_account";
              const body = (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={kStrong}>{paise(expectedOf(l))}</span><StatusTag status={tag.status}>{tag.label}</StatusTag>
                  </div>
                  <div style={{ ...kMuted, marginTop: 2 }}>{l.title} · {day(l.startsAt)}</div>
                  <div style={kMuted}>Ticket sales {paise(l.gross)}{l.refunded > 0 ? ` · ${paise(l.refunded)} refunded` : ""}</div>
                  <div style={kMuted}>{lineNote(l, now)}</div>
                </div>
              );
              return (
                <div key={l.eventId} style={{ display: "flex", gap: 12, paddingBottom: 14, position: "relative" }}>
                  <span style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, flex: "none", background: paid ? "var(--lime-500)" : "#fff", border: `2px solid ${paid ? "var(--lime-500)" : quiet ? "var(--ink-300)" : "var(--ink-900)"}`, zIndex: 1 }} />
                  {i < lines.length - 1 ? <span style={{ position: "absolute", left: 5, top: 16, bottom: 0, width: 2, background: "var(--border-default)" }} /> : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {ref && l.listed
                      ? <Link href={`/events?event=${ref}&tab=sales`} style={{ display: "flex", textDecoration: "none", color: "inherit" }}>{body}</Link>
                      : body}
                    {needsDetails && canEdit ? <Button size="sm" variant="secondary" icon="wallet" onClick={onAccount} style={{ marginTop: 8 }}>Add payout details</Button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ── Payout account ─────────────────────────────────────────────────────────

function Account({ account }: { account: AccountLoad }) {
  const { host, notify } = useHost();
  const [editing, setEditing] = useState(false);
  if (account.status === "loading") return <RowsSkeleton rows={3} />;
  if (account.status === "error") return <LoadError what="the payout account" error={account.error} onRetry={account.reload} />;
  const { ready, can_edit, account: acc } = account.data;
  if (!can_edit) {
    return (
      <div style={{ maxWidth: 640 }}>
        <EmptyState variant="locked" title="Payout details are for the squad’s owner"
          message={ready
            ? "They’re on file, so paid events can go live. Organisers see sales, but not where the money goes."
            : "None yet. Paid events can’t go live until the squad’s owner adds them here."} />
      </div>
    );
  }
  const saved = (a: api.MaskedPayout) => {
    account.set(cur => ({ ...cur, ready: true, account: a }));
    setEditing(false);
    notify("success", "Payout details saved", `pacr pays ${host.name}’s ticket money to ${payoutLine(a)}.`);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
      {acc && !editing ? (
        <GlassCard title="Payout details" subtitle={`Where pacr pays ${host.name}’s ticket money, a day after each paid event ends`}
          actions={<StatusTag status={ready ? "Approved" : "Pending"}>{ready ? "Ready" : "Not ready"}</StatusTag>}>
          <KV k="Method" v={acc.method === "upi" ? "UPI" : "Bank account"} />
          <KV k="Account holder" v={acc.account_name} />
          {acc.method === "upi" ? <KV k="UPI ID" v={acc.upi ?? "—"} /> : (
            <>
              <KV k="Account number" v={`···· ${acc.account_last4 ?? ""}`} />
              <KV k="IFSC" v={acc.ifsc ?? "—"} />
            </>
          )}
          <KV k="PAN" v={acc.has_pan ? "On file" : "Not added"} />
          {acc.updated_at ? <KV k="Last changed" v={day(acc.updated_at)} /> : null}
          <div style={{ marginTop: 14 }}>
            <Button variant="secondary" icon="pencil" onClick={() => setEditing(true)}>Change payout details</Button>
          </div>
        </GlassCard>
      ) : (
        <PayoutForm current={acc} onSaved={saved} onCancel={acc ? () => setEditing(false) : undefined} />
      )}
      <div style={{ ...kMuted, display: "flex", gap: 6, alignItems: "flex-start" }}>
        <Icon name="shield-check" size={13} style={{ marginTop: 2, flex: "none" }} />
        <span>
          pacr staff see these details only to pay you. Here they only ever show masked.
          {host.kind === "squad" ? " The squad’s other owners get a notice whenever they change." : ""}
        </span>
      </div>
    </div>
  );
}

type Field = "name" | "upi" | "account" | "ifsc" | "pan";
/** Which field a refusal belongs under. */
const FIELD_OF: Record<string, Field> = {
  name_required: "name", invalid_vpa: "upi", invalid_account: "account", invalid_ifsc: "ifsc", invalid_pan: "pan",
};

/**
 * The details go to set_host_payout_account once and are never read back:
 * the form starts empty every time, is cleared when saved, and what is on
 * file only ever shows masked.
 */
function PayoutForm({ current, onSaved, onCancel }: { current: api.MaskedPayout | null; onSaved: (a: api.MaskedPayout) => void; onCancel?: () => void }) {
  const { host } = useHost();
  const [method, setMethod] = useState<"upi" | "bank">(current?.method ?? "upi");
  const [name, setName] = useState("");
  const [upi, setUpi] = useState("");
  const [acct, setAcct] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [pan, setPan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field: Field | null; text: string } | null>(null);
  const filled = name.trim().length >= 2 && (method === "upi" ? /^[^@\s]+@[^@\s]+$/.test(upi) : acct.length >= 9 && ifsc.length === 11);
  const change = (set: (v: string) => void, clean: (v: string) => string) => (ev: { target: { value: string } }) => {
    set(clean(ev.target.value));
    setErr(null);
  };
  const errFor = (f: Field) => (err?.field === f ? err.text : undefined);

  const save = async () => {
    if (!filled || busy) return;
    setBusy(true);
    setErr(null);
    const extra = pan ? { pan } : {};
    const details: api.PayoutDetails = method === "upi"
      ? { method: "upi", account_name: name.trim(), upi, ...extra }
      : { method: "bank", account_name: name.trim(), account_number: acct, ifsc, ...extra };
    try {
      const masked = await api.setPayoutAccount(host.kind, host.id, details);
      setName(""); setUpi(""); setAcct(""); setIfsc(""); setPan("");
      onSaved(masked);
    } catch (e) {
      const reason = e instanceof api.ApiError ? e.reason : "error";
      setErr({
        field: FIELD_OF[reason] ?? null,
        text: reason === "not_allowed"
          ? (host.kind === "squad" ? "Only the squad’s owner can change payout details." : "Only the organizer account’s owner can change payout details.")
          : api.payoutFailText(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard title={current ? "Change payout details" : "Add payout details"}
      subtitle={current
        ? `Now: ${payoutLine(current)}. Saving replaces it.`
        : `Where pacr pays ${host.name}’s ticket money, a day after each paid event ends. Paid events can’t go live without them.`}>
      <SegmentedControl options={[{ value: "upi", label: "UPI" }, { value: "bank", label: "Bank account" }]} value={method}
        onChange={v => { setMethod(v === "bank" ? "bank" : "upi"); setErr(null); }} />
      <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
        <Input label="Account holder’s name" hint="As the bank has it" value={name} maxLength={80} autoComplete="off" spellCheck={false}
          error={errFor("name")} disabled={busy} onChange={change(setName, v => v)} />
        {method === "upi" ? (
          <Input label="UPI ID" placeholder="name@bank" value={upi} maxLength={130} autoComplete="off" autoCapitalize="none" spellCheck={false}
            error={errFor("upi")} disabled={busy} onChange={change(setUpi, v => v.replace(/\s/g, "").toLowerCase())} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 14 }}>
            <Input label="Account number" hint="9 to 18 digits" inputMode="numeric" value={acct} maxLength={18} autoComplete="off"
              error={errFor("account")} disabled={busy} onChange={change(setAcct, v => v.replace(/\D/g, ""))} />
            <Input label="IFSC" placeholder="HDFC0001234" value={ifsc} maxLength={11} autoComplete="off" autoCapitalize="characters" spellCheck={false}
              error={errFor("ifsc")} disabled={busy} onChange={change(setIfsc, v => v.replace(/[^a-z0-9]/gi, "").toUpperCase())} />
          </div>
        )}
        <Input label="PAN" hint="Optional" placeholder="ABCDE1234F" value={pan} maxLength={10} autoComplete="off" autoCapitalize="characters" spellCheck={false}
          error={errFor("pan")} disabled={busy} onChange={change(setPan, v => v.replace(/[^a-z0-9]/gi, "").toUpperCase())} />
      </div>
      {err && !err.field ? <div role="alert" style={{ font: "400 13px/1.45 var(--font-sans)", color: "var(--danger-text)", marginTop: 12 }}>{err.text}</div> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 16 }}>
        {onCancel ? <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button> : null}
        <Button icon="save" loading={busy} disabled={!filled} onClick={save}>Save payout details</Button>
      </div>
    </GlassCard>
  );
}
