"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Avatar, Button, DataTable, DateTile, Dialog, EmptyState, GlassCard, Icon, Input, ProgressBar, SegmentChip, StatusTag, Tabs,
} from "@/components/ds";
import { kMuted, kStrong, kTextarea, KV, LoadError, Meta, RowsSkeleton, Toolbar } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { day, dayTime, firstName, num, paise, plural, tile, time } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { encodeRef, eventEditHref } from "@/lib/refs";
import { Summary, payoutNote, payoutTag } from "../money/Summary";
import { Poster, tagOf } from "./shared";

type View = "attendees" | "sales";
type Seat = api.Attendee & { avatar?: string };
type SeatsLoad = ReturnType<typeof useLoad<Seat[]>>;
type SalesLoad = ReturnType<typeof useLoad<api.EventSales>>;

export function EventDetail({ event: e, cover, now, initialTab }: { event: api.HostedEvent; cover?: string; now: number; initialTab: View }) {
  const [view, setView] = useState<View>(initialTab);
  const t = tile(e.starts_at);
  const status = tagOf(e, now);
  const ref = encodeRef(e.id);
  const draft = e.status === "draft";
  // Both tabs read both: the seats carry each booking's refund, and the sales
  // summary answers only the event's host (not co-hosts), the same rule as
  // refunds, so whether it loads is how this page knows who may refund.
  const seats = useLoad(async (): Promise<Seat[]> => {
    if (draft) return [];
    const rows = await api.eventAttendees(e.id);
    const faces = await api.signedUrls("avatars", rows.map(r => r.avatar_path));
    return rows.map(r => ({ ...r, avatar: r.avatar_path ? faces.get(r.avatar_path) : undefined }));
  }, `attendees:${e.id}`);
  const sales = useLoad(() => api.eventSales(e.id), `sales:${e.id}`);
  return (
    <div>
      <Link href="/events" style={{ ...kMuted, textDecoration: "none", display: "inline-flex", gap: 4, alignItems: "center", marginBottom: 10 }}>
        <Icon name="arrow-left" size={13} />All events
      </Link>
      <GlassCard padding={14} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Poster src={cover} title={e.title} cancelled={status === "Cancelled"} w={44} />
          <DateTile day={t.day} date={t.date} month={t.month} kind="event" />
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ font: "500 20px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>{e.title}</span><StatusTag status={status} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
              <Meta icon="clock">{day(e.starts_at)} · {time(e.starts_at)} IST</Meta>
              {e.place_name ? <Meta icon="map-pin">{e.place_name}</Meta> : null}
              <Meta icon="ticket">{e.capacity != null ? `${num(e.sold)} / ${num(e.capacity)} sold` : `${num(e.sold)} going`}</Meta>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {status !== "Draft" && ref ? (
              <a className="pc-btn pc-btn--secondary" href={`/e/${ref}`} style={{ textDecoration: "none" }}><Icon name="external-link" size={17} />View page</a>
            ) : null}
            <a className="pc-btn pc-btn--primary" href={eventEditHref(e.id)} style={{ textDecoration: "none" }}><Icon name="pencil" size={17} />Edit event</a>
          </div>
        </div>
      </GlassCard>
      <Tabs value={view} onChange={v => setView(v as View)} style={{ marginBottom: 12 }}
        tabs={[{ value: "attendees", label: "Attendees", count: e.sold }, { value: "sales", label: "Sales" }]} />
      {view === "attendees" ? <Attendees event={e} seats={seats} sales={sales} /> : <Sales event={e} now={now} sales={sales} seats={seats} />}
    </div>
  );
}

// ── Bookings ───────────────────────────────────────────────────────────────

/** The seats one runner bought together (one order): refunded as one. */
type Booking = {
  key: string;
  /** Any one of its seats names the booking for refund_event_ticket. */
  ticketId: string;
  name: string; avatar?: string; tier: string | null; registeredAt: string; qty: number; seats: Seat[];
  /** The booking's whole total: ticket price, pacr's fee and GST. */
  totalMinor: number;
  refund: api.RefundStatus | null;
  status: "valid" | "refunded" | "cancelled";
  checkedIn: number;
};

/**
 * list_event_attendees has a row per seat. A booking's seats share the buyer,
 * the moment it was booked (its order's created_at) and the count, which
 * together tell one booking from another, even for the same runner.
 */
function bookingsOf(seats: Seat[]): Booking[] {
  const by = new Map<string, Booking>();
  for (const s of seats) {
    const key = `${s.user_id ?? s.name ?? ""}|${s.registered_at}|${s.qty}`;
    let b = by.get(key);
    if (!b) {
      b = {
        key, ticketId: s.ticket_id, name: s.name ?? "Runner", avatar: s.avatar, tier: s.tier_name, registeredAt: s.registered_at,
        qty: s.qty, seats: [], totalMinor: Number(s.total_minor ?? 0), refund: s.refund_status, status: "cancelled", checkedIn: 0,
      };
      by.set(key, b);
    }
    b.seats.push(s);
    if (s.ticket_status === "valid") {
      b.status = "valid";
      if (s.checked_in_at) b.checkedIn += 1;
    } else if (s.ticket_status === "refunded" && b.status !== "valid") {
      b.status = "refunded";
    }
  }
  return [...by.values()].map(b => {
    const sorted = [...b.seats].sort((x, y) => x.seq - y.seq);
    return { ...b, seats: sorted, ticketId: sorted[0]?.ticket_id ?? b.ticketId };
  });
}

const REFUND: Record<api.RefundStatus, { status: string; label: string }> = {
  requested: { status: "Requested", label: "Refund queued" },
  processing: { status: "Processing", label: "Refund sending" },
  done: { status: "Refunded", label: "Refunded" },
  failed: { status: "Failed", label: "Refund failed" },
};
const refundTag = (r: api.RefundStatus) => REFUND[r] ?? { status: "Refunded", label: "Refunded" };
/** Under a failed refund: event-jobs sends it again, and pacr staff follow up. */
const RETRYING = "pacr is retrying";

const validSeats = (b: Booking) => b.seats.filter(s => s.ticket_status === "valid").length;

/** A booking's state: its refund when it has one, else check-in. */
function bookingTag(b: Booking, eventCancelled: boolean): { status: string; label: string; note?: string } {
  if (b.refund) return { ...refundTag(b.refund), note: b.refund === "failed" ? RETRYING : undefined };
  if (b.status === "refunded") return { status: "Refunded", label: "Refunded" };
  if (b.status === "cancelled") return { status: "Cancelled", label: eventCancelled ? "Event cancelled" : "Gave up" };
  if (b.checkedIn === 0) return { status: "Draft", label: "Not yet" };
  const n = validSeats(b);
  return { status: "Checked in", label: b.checkedIn >= n ? "Checked in" : `${num(b.checkedIn)} of ${num(n)} in` };
}

/** One seat, for the CSV. */
function seatLabel(s: Seat, eventCancelled: boolean): string {
  if (s.ticket_status === "refunded") return s.refund_status ? refundTag(s.refund_status).label : "Refunded";
  if (s.ticket_status !== "valid") return eventCancelled ? "Event cancelled" : "Gave up";
  return s.checked_in_at ? "Checked in" : "Not yet";
}
const seatOf = (s: Seat) => (s.qty > 1 ? `${s.seq} of ${s.qty}` : "1 of 1");

// ── Attendees ──────────────────────────────────────────────────────────────

type Filter = "all" | "in" | "not" | "gone";

function Attendees({ event: e, seats, sales }: { event: api.HostedEvent; seats: SeatsLoad; sales: SalesLoad }) {
  const { notifyError } = useHost();
  const { phone } = useViewport();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const [asking, setAsking] = useState<Booking | null>(null);
  const draft = e.status === "draft";
  const cancelled = e.status === "cancelled";

  const data = seats.status === "ready" ? seats.data : null;
  const all = useMemo(() => (data ? bookingsOf(data) : []), [data]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(b => {
      if (needle && !b.name.toLowerCase().includes(needle)) return false;
      if (f === "in") return b.status === "valid" && b.checkedIn > 0;
      if (f === "not") return b.status === "valid" && b.checkedIn < validSeats(b);
      if (f === "gone") return b.status !== "valid";
      return true;
    });
  }, [all, q, f]);

  if (draft) return <EmptyState icon="ticket" title="Publish the event to start selling tickets" message="Attendees show here once runners book." style={{ padding: "40px 24px" }} />;
  if (seats.status === "loading") return <RowsSkeleton />;
  if (seats.status === "error") return <LoadError what="attendees" error={seats.error} onRetry={seats.reload} />;
  if (all.length === 0) return <EmptyState icon="users" title="No tickets yet" message="Each booking shows here as soon as someone books." style={{ padding: "40px 24px" }} />;

  // Refunds are the host's (not co-hosts'), until the payout is being paid.
  const isHost = sales.status === "ready";
  const payout = sales.status === "ready" ? sales.data.payout : null;
  const settled = payout?.status === "paid" || payout?.status === "paying";
  const anyPaid = all.some(b => b.totalMinor > 0);
  const canRefund = (b: Booking) => isHost && !settled && b.status === "valid" && !b.refund && b.totalMinor > 0;
  const refundable = isHost && !settled && all.some(canRefund);
  const live = all.filter(b => b.status === "valid");
  const cnt = {
    in: live.filter(b => b.checkedIn > 0).length,
    not: live.filter(b => b.checkedIn < validSeats(b)).length,
    gone: all.length - live.length,
  };
  const seatsLive = live.reduce((n, b) => n + validSeats(b), 0);
  const seatsIn = live.reduce((n, b) => n + b.checkedIn, 0);

  const exportCsv = () => {
    try {
      const cell = (v: string) => {
        const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      const lines = [["Name", "Tier", "Seat", "Status", "Checked in at", "Registered"].map(cell).join(",")];
      for (const b of rows) {
        for (const s of b.seats) {
          lines.push([
            s.name ?? "Runner", s.tier_name ?? "", seatOf(s), seatLabel(s, cancelled),
            s.checked_in_at ? dayTime(s.checked_in_at) : "", day(s.registered_at),
          ].map(cell).join(","));
        }
      }
      const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendees-${(e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      notifyError("Couldn’t export", err);
    }
  };

  const paid = (b: Booking) => (b.totalMinor > 0 ? paise(b.totalMinor) : "Free");
  const tag = (b: Booking) => {
    const s = bookingTag(b, cancelled);
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "none" }}>
        <StatusTag status={s.status}>{s.label}</StatusTag>
        {s.note ? <span style={kMuted}>{s.note}</span> : null}
      </span>
    );
  };
  const refundButton = (b: Booking) => (canRefund(b)
    ? <Button size="sm" variant="secondary" icon="undo-2" onClick={() => setAsking(b)}>Refund</Button>
    : null);
  const afterRefund = () => { seats.reload(); sales.reload(); };

  return (
    <div>
      <Toolbar>
        <Input icon="search" placeholder="Search name" value={q} onChange={ev => setQ(ev.target.value)} style={{ flex: "1 1 240px", maxWidth: 360 }} />
        <SegmentChip label="All bookings" count={all.length} active={f === "all"} onClick={() => setF("all")} />
        <SegmentChip label="Checked in" count={cnt.in} active={f === "in"} onClick={() => setF("in")} />
        <SegmentChip label="Not yet" count={cnt.not} active={f === "not"} onClick={() => setF("not")} />
        <SegmentChip label="Gave up or refunded" count={cnt.gone} active={f === "gone"} onClick={() => setF("gone")} />
        <div style={{ flex: 1 }} />
        <Button variant="secondary" icon="download" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</Button>
      </Toolbar>
      {isHost && settled && anyPaid ? (
        <div style={{ ...kMuted, display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
          <Icon name="lock" size={13} />
          This event’s payout {payout?.status === "paid" ? "has been sent" : "is being sent"}, so only pacr can refund now. Write to support@pacr.life.
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState icon="search" title="No bookings match" message="Try another name or filter." style={{ padding: "32px 24px" }} />
      ) : phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map(b => (
            <GlassCard key={b.key} padding={12}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Avatar name={b.name} src={b.avatar} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={kStrong}>{b.name}</div>
                  <div style={kMuted}>{b.tier ?? "Ticket"} · {plural(b.qty, "seat")} · {paid(b)}</div>
                </div>
                {tag(b)}
              </div>
              {canRefund(b) ? <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>{refundButton(b)}</div> : null}
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard flush>
          <DataTable<Booking>
            rows={rows} rowKey={b => b.key}
            columns={[
              { key: "name", header: "Booked by", render: b => <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={b.name} src={b.avatar} size={24} />{b.name}</span> },
              { key: "seats", header: "Seats", render: b => num(b.qty) },
              { key: "tier", header: "Ticket", render: b => b.tier ?? "—" },
              { key: "reg", header: "Booked", render: b => day(b.registeredAt) },
              { key: "paid", header: "Paid", align: "right", render: paid },
              { key: "status", header: "Status", align: "right", render: tag },
              ...(refundable ? [{ key: "act", header: "", align: "right" as const, render: refundButton }] : []),
            ]}
          />
        </GlassCard>
      )}
      <div style={{ ...kMuted, marginTop: 10 }}>
        {plural(seatsLive, "seat")} in {plural(live.length, "booking")} · {num(seatsIn)} checked in. Each seat has its own QR.
        {isHost && anyPaid && !settled ? " A refund covers the whole booking: the ticket price, pacr’s fee and GST go back, and all its seats are cancelled." : ""}
      </div>
      {asking ? (
        <RefundDialog key={asking.key} event={e} booking={asking} onClose={() => setAsking(null)}
          onRefunded={() => { setAsking(null); afterRefund(); }} onStale={afterRefund} />
      ) : null}
    </div>
  );
}

/** Refusals that mean the list is out of date: show it as it is now. */
const STALE = new Set(["already_refunded", "no_ticket", "free_ticket", "payout_settled", "not_allowed", "not_found"]);

function RefundDialog({ event: e, booking: b, onClose, onRefunded, onStale }: {
  event: api.HostedEvent; booking: Booking; onClose: () => void; onRefunded: () => void; onStale: () => void;
}) {
  const { notify } = useHost();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const theSeats = b.qty === 1 ? "The seat is" : `All ${num(b.qty)} seats are`;
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const back = await api.refundBooking(e.id, b.ticketId, note);
      notify("success", "Booking refunded",
        `${paise(back || b.totalMinor)} goes back to ${b.name}. ${b.qty === 1 ? "Their seat is" : `Their ${num(b.qty)} seats are`} cancelled.`);
      onRefunded();
    } catch (x) {
      setErr(api.refundFailText(x));
      if (x instanceof api.ApiError && STALE.has(x.reason)) onStale();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} icon="undo-2" tone="danger" title={`Refund ${b.name}?`}
      description={`${plural(b.qty, "seat")}${b.tier ? ` · ${b.tier}` : ""} · booked ${day(b.registeredAt)}`}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Keep booking</Button>
        <Button variant="danger" loading={busy} onClick={go}>Refund booking</Button>
      </>}>
      <KV k="Goes back to them" v={<span style={kStrong}>{paise(b.totalMinor)}</span>} />
      <p style={{ font: "400 13px/1.5 var(--font-sans)", color: "var(--text-body)", margin: "12px 0 14px" }}>
        That’s the whole booking: the ticket price, pacr’s fee and the GST, back the way they paid. {theSeats} cancelled
        and {b.qty === 1 ? "its QR stops" : "their QRs stop"} working. This can’t be undone.
      </p>
      <label className="pc-field">
        <span className="pc-label">Note to {firstName(b.name)} <span style={kMuted}>optional</span></span>
        <textarea rows={2} maxLength={300} style={kTextarea} value={note} disabled={busy}
          placeholder="Say why, if you like" onChange={ev => { setNote(ev.target.value); setErr(null); }} />
        <span className="pc-hint">They see it with the refund. {note.length} / 300</span>
      </label>
      {err ? <div role="alert" style={{ font: "400 13px/1.45 var(--font-sans)", color: "var(--danger-text)", marginTop: 10 }}>{err}</div> : null}
    </Dialog>
  );
}

// ── Sales ──────────────────────────────────────────────────────────────────

/** "2 refunds in progress · 1 refund failed · pacr is retrying". failed is null when the seats didn't load. */
function refundsLine(open: number, failed: number | null): string | null {
  if (failed == null) return open > 0 ? `${plural(open, "refund")} not finished yet` : null;
  const going = Math.max(0, open - failed);
  const parts = [
    going > 0 ? `${plural(going, "refund")} in progress` : null,
    failed > 0 ? `${plural(failed, "refund")} failed · ${RETRYING}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function Sales({ event: e, now, sales: s, seats }: { event: api.HostedEvent; now: number; sales: SalesLoad; seats: SeatsLoad }) {
  const { phone } = useViewport();
  if (s.status === "loading") return <RowsSkeleton rows={4} />;
  if (s.status === "error") {
    if (s.error instanceof api.ApiError && s.error.reason === "not_allowed") {
      return <EmptyState variant="locked" title="Sales are for the event’s host" message="Co-hosts can see attendees, but not what the event earned." />;
    }
    return <LoadError what="sales" error={s.error} onRetry={s.reload} />;
  }
  const d = s.data;
  const free = d.tiers.every(t => t.price_minor === 0);
  const pay = d.payout ? payoutTag(d.payout.status) : null;
  const failed = seats.status === "ready" ? bookingsOf(seats.data).filter(b => b.refund === "failed").length : null;
  const refunds = refundsLine(d.refunds_open, failed);
  const before = e.status === "cancelled"
    ? "The event was cancelled, so every paid booking is refunded and there’s nothing to pay out."
    : new Date(e.ends_at ?? e.starts_at).getTime() > now
      ? "Paid out a day after the event ends, to your payout details."
      : "pacr works out the payout a day after the event ends.";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {free ? (
        <GlassCard>
          <div style={kStrong}>{plural(d.sold, "ticket")} sold</div>
          <div style={{ ...kMuted, marginTop: 4 }}>This is a free event, so there is no money to collect or pay out.</div>
        </GlassCard>
      ) : (
        <>
          <Summary cells={[
            { label: "Tickets sold", value: num(d.sold) },
            { label: "Ticket sales (gross)", value: paise(d.ticket_gross_minor) },
            { label: "Refunded", value: paise(d.ticket_refunded_minor), note: refunds ?? undefined },
            { label: "pacr fee", value: paise(d.fee_minor), note: "Paid by runners on top" },
            { label: "GST on fee", value: paise(d.gst_minor), note: "Paid by runners on top" },
            { label: "You receive", value: paise(d.net_minor), note: "Ticket sales minus refunds", hero: true },
          ]} />
          <GlassCard title="Payout">
            {d.payout && pay ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={kStrong}>{paise(d.payout.net_minor)}</span>
                <StatusTag status={pay.status}>{pay.label}</StatusTag>
                <span style={kMuted}>{payoutNote(d.payout)}</span>
              </div>
            ) : (
              <span style={kMuted}>{before}</span>
            )}
            {refunds ? (
              <div style={{ ...kMuted, marginTop: 8, display: "flex", gap: 6, alignItems: "center", color: failed ? "var(--danger-text)" : undefined }}>
                {failed ? <Icon name="circle-alert" size={13} /> : null}{refunds}
              </div>
            ) : null}
          </GlassCard>
        </>
      )}
      <GlassCard flush title="Tiers" style={{ paddingBottom: 6 }}>
        {phone ? (
          <div style={{ padding: "8px 16px 12px" }}>
            {d.tiers.map(t => (
              <div key={t.name} style={{ padding: "10px 0", borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={kStrong}>{t.name}</span><span style={kStrong}>{t.price_minor ? paise(t.price_minor) : "Free"}</span></div>
                <TierBar sold={t.sold} capacity={t.capacity} />
                <div style={kMuted}>{t.refunded > 0 ? `${num(t.refunded)} refunded` : "No refunds"}</div>
              </div>
            ))}
          </div>
        ) : (
          <DataTable<api.EventSales["tiers"][number]>
            rows={d.tiers} rowKey={t => t.name} empty="No tiers."
            columns={[
              { key: "name", header: "Tier" },
              { key: "price", header: "Price", render: t => (t.price_minor ? paise(t.price_minor) : "Free") },
              { key: "sold", header: "Sold / capacity", render: t => <div style={{ minWidth: 180 }}><TierBar sold={t.sold} capacity={t.capacity} /></div> },
              { key: "ref", header: "Refunded", align: "right", render: t => num(t.refunded) },
            ]}
          />
        )}
      </GlassCard>
    </div>
  );
}

function TierBar({ sold, capacity }: { sold: number; capacity: number | null }) {
  if (capacity == null) return <span style={kMuted}>{num(sold)} sold</span>;
  return <ProgressBar size="sm" tone={sold >= capacity ? "warning" : "pop"} value={sold} max={capacity} showValue valueLabel={`${num(sold)} / ${num(capacity)}`} />;
}
