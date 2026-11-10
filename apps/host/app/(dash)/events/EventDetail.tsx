"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Avatar, Button, DataTable, DateTile, EmptyState, GlassCard, Icon, Input, ProgressBar, SegmentChip, StatusTag, Tabs,
} from "@/components/ds";
import { kMuted, kStrong, LoadError, Meta, RowsSkeleton, Toolbar } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { day, dayTime, num, paise, plural, tile, time } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { encodeRef, eventEditHref } from "@/lib/refs";
import { Summary, holdText, payoutTag } from "../money/Summary";
import { Poster, tagOf } from "./shared";

type View = "attendees" | "sales";

export function EventDetail({ event: e, cover, now, initialTab }: { event: api.HostedEvent; cover?: string; now: number; initialTab: View }) {
  const [view, setView] = useState<View>(initialTab);
  const t = tile(e.starts_at);
  const status = tagOf(e, now);
  const ref = encodeRef(e.id);
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
      {view === "attendees" ? <Attendees event={e} /> : <Sales event={e} />}
    </div>
  );
}

// ── Attendees ──────────────────────────────────────────────────────────────

type Filter = "all" | "in" | "not" | "gone";
type Seat = api.Attendee & { avatar?: string };

const seatOf = (r: api.Attendee) => (r.qty > 1 ? `${r.seq} of ${r.qty}` : "1 of 1");
const valid = (r: api.Attendee) => r.ticket_status === "valid";
function statusOf(r: api.Attendee): { status: string; label: string } {
  if (r.ticket_status === "refunded") return { status: "Refunded", label: "Refunded" };
  if (!valid(r)) return { status: "Cancelled", label: "Gave up" };
  if (r.checked_in_at) return { status: "Checked in", label: "Checked in" };
  return { status: "Draft", label: "Not yet" };
}

function Attendees({ event: e }: { event: api.HostedEvent }) {
  const { notifyError } = useHost();
  const { phone } = useViewport();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const draft = e.status === "draft";
  const at = useLoad(async (): Promise<Seat[]> => {
    if (draft) return [];
    const rows = await api.eventAttendees(e.id);
    const faces = await api.signedUrls("avatars", rows.map(r => r.avatar_path));
    return rows.map(r => ({ ...r, avatar: r.avatar_path ? faces.get(r.avatar_path) : undefined }));
  }, `attendees:${e.id}`);

  const rows = useMemo(() => {
    if (at.status !== "ready") return [];
    const needle = q.trim().toLowerCase();
    return at.data.filter(r => {
      if (needle && !String(r.name ?? "").toLowerCase().includes(needle)) return false;
      if (f === "in") return valid(r) && !!r.checked_in_at;
      if (f === "not") return valid(r) && !r.checked_in_at;
      if (f === "gone") return !valid(r);
      return true;
    });
  }, [at, q, f]);

  if (draft) return <EmptyState icon="ticket" title="Publish the event to start selling tickets" message="Attendees show here once runners book." style={{ padding: "40px 24px" }} />;
  if (at.status === "loading") return <RowsSkeleton />;
  if (at.status === "error") return <LoadError what="attendees" error={at.error} onRetry={at.reload} />;

  const all = at.data;
  if (all.length === 0) return <EmptyState icon="users" title="No tickets yet" message="Each seat shows here as soon as someone books." style={{ padding: "40px 24px" }} />;
  const cnt = {
    in: all.filter(r => valid(r) && r.checked_in_at).length,
    not: all.filter(r => valid(r) && !r.checked_in_at).length,
    gone: all.filter(r => !valid(r)).length,
  };

  const exportCsv = () => {
    try {
      const cell = (v: string) => {
        const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      const lines = [["Name", "Tier", "Seat", "Status", "Checked in at", "Registered"].map(cell).join(",")];
      for (const r of rows) {
        lines.push([
          r.name ?? "Runner", r.tier_name ?? "", seatOf(r), statusOf(r).label,
          r.checked_in_at ? dayTime(r.checked_in_at) : "", day(r.registered_at),
        ].map(cell).join(","));
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

  const paid = (r: Seat) => (r.seq !== 1 ? "—" : r.total_minor ? paise(r.total_minor) : "Free");

  return (
    <div>
      <Toolbar>
        <Input icon="search" placeholder="Search name" value={q} onChange={ev => setQ(ev.target.value)} style={{ flex: "1 1 240px", maxWidth: 360 }} />
        <SegmentChip label="All seats" count={all.length} active={f === "all"} onClick={() => setF("all")} />
        <SegmentChip label="Checked in" count={cnt.in} active={f === "in"} onClick={() => setF("in")} />
        <SegmentChip label="Not yet" count={cnt.not} active={f === "not"} onClick={() => setF("not")} />
        <SegmentChip label="Gave up or refunded" count={cnt.gone} active={f === "gone"} onClick={() => setF("gone")} />
        <div style={{ flex: 1 }} />
        <Button variant="secondary" icon="download" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</Button>
      </Toolbar>
      {rows.length === 0 ? (
        <EmptyState icon="search" title="No seats match" message="Try another name or filter." style={{ padding: "32px 24px" }} />
      ) : phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map(r => {
            const s = statusOf(r);
            return (
              <GlassCard key={r.ticket_id} padding={12}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Avatar name={r.name ?? "Runner"} src={r.avatar} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={kStrong}>{r.name ?? "Runner"}</div>
                    <div style={kMuted}>{r.tier_name ?? "Ticket"} · seat {seatOf(r)} · {paid(r)}</div>
                  </div>
                  <StatusTag status={s.status}>{s.label}</StatusTag>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <GlassCard flush>
          <DataTable<Seat>
            rows={rows} rowKey={r => r.ticket_id}
            columns={[
              { key: "name", header: "Seat holder", render: r => <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={r.name ?? "Runner"} src={r.avatar} size={24} />{r.name ?? "Runner"}</span> },
              { key: "seat", header: "Seat", render: r => seatOf(r) },
              { key: "tier", header: "Tier", render: r => r.tier_name ?? "—" },
              { key: "reg", header: "Registered", render: r => day(r.registered_at) },
              { key: "paid", header: "Paid", align: "right", render: paid },
              { key: "status", header: "Check-in", align: "right", render: r => { const s = statusOf(r); return <StatusTag status={s.status}>{s.label}</StatusTag>; } },
            ]}
          />
        </GlassCard>
      )}
      <div style={{ ...kMuted, marginTop: 10 }}>Each seat has its own QR.</div>
    </div>
  );
}

// ── Sales ──────────────────────────────────────────────────────────────────

function Sales({ event: e }: { event: api.HostedEvent }) {
  const { phone } = useViewport();
  const s = useLoad(() => api.eventSales(e.id), `sales:${e.id}`);
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
            { label: "Refunded", value: paise(d.ticket_refunded_minor) },
            { label: "pacr fee", value: paise(d.fee_minor), note: "Paid by runners on top" },
            { label: "GST on fee", value: paise(d.gst_minor), note: "Paid by runners on top" },
            { label: "You receive", value: paise(d.net_minor), note: "Ticket sales minus refunds", hero: true },
          ]} />
          <GlassCard title="Payout">
            {d.payout && pay ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={kStrong}>{paise(d.payout.net_minor)}</span>
                <StatusTag status={pay.status}>{pay.label}</StatusTag>
                <span style={kMuted}>
                  {d.payout.status === "paid"
                    ? `Paid ${d.payout.paid_at ? day(d.payout.paid_at) : ""}${d.payout.reference ? ` · ref ${d.payout.reference}` : ""}`
                    : holdText(d.payout.hold_reason) || (d.payout.status === "pending" ? "Paid out after the event." : "")}
                </span>
              </div>
            ) : (
              <span style={kMuted}>No payout line yet.</span>
            )}
            {d.refunds_open > 0 ? <div style={{ ...kMuted, marginTop: 8 }}>{plural(d.refunds_open, "refund")} in progress</div> : null}
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
