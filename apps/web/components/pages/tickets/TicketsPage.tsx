"use client";
// /tickets: ui_kits/website/Account.jsx (TicketsPage) on my_tickets,
// my_past_tickets and my_event_order. /tickets?o=<order ref> opens a booking:
// one tab per seat, each with the QR the gate scans (lib/tickets.ts).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Icon, Media, TrustTag } from "@/components/ds/core";
import { OrderSummary, TicketCard } from "@/components/ds/content";
import { DirectionsLink } from "@/components/ds/actions";
import { EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { SegmentedControl, Tabs } from "@/components/ds/nav";
import { Banner, Dialog, useToast } from "@/components/ds/overlays";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { encodeRef } from "@/lib/refs";
import { whenLine } from "@/lib/format";
import {
  holderName, money, myCheckinCode, myEventOrder, myPastTickets, myTickets, offLine, refundLine, releaseFreeTicket, seatQrs,
  type Order, type PastTicket, type Ticket,
} from "@/lib/tickets";

const POLL_MS = 8000;

export function TicketsPage({ orderRef, past }: { orderRef: string | null; past: boolean }) {
  return <RequireSignIn title="Sign in to see your tickets" body="Your bookings and their QR codes for the gate.">
    {auth => <Tickets uid={auth.uid} orderRef={orderRef} past={past} />}
  </RequireSignIn>;
}

const poster = (t: { eventId: string; hasCover: boolean }) => (t.hasCover ? `/e/${encodeRef(t.eventId)}/poster` : null);
const eventHref = (eventId: string) => `/e/${encodeRef(eventId) ?? ""}`;
const venue = (t: { placeName: string | null; placeAddress?: string | null }) => [t.placeName, t.placeAddress].filter(Boolean).join(", ");

function statusTag(t: Ticket) {
  if (t.ticketStatus === "refunded") return <TrustTag kind="request-sent" size="sm">Refunded</TrustTag>;
  if (t.ticketStatus === "cancelled") return <TrustTag kind="cancelled" size="sm" />;
  if (t.checkedInCount >= t.qty) return <TrustTag kind="checked-in" size="sm" />;
  return <TrustTag kind="going" size="sm">Valid</TrustTag>;
}

function Tickets({ uid, orderRef, past }: { uid: string; orderRef: string | null; past: boolean }) {
  const [when, setWhen] = useState(past ? "past" : "upcoming");
  const [up, setUp] = useState<Ticket[] | null>(null);
  const [old, setOld] = useState<PastTicket[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [holder, setHolder] = useState("You");

  const [key, setKey] = useState(0);
  const [now, setNow] = useState(0);
  const reload = useCallback(() => setKey(k => k + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([myTickets(), myPastTickets()]).then(([u, p]) => {
      if (alive) { setUp(u); setOld(p); setFailed(false); setNow(Date.now()); }
    }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [key]);

  useEffect(() => {
    myCheckinCode().then(setCode);
    holderName(uid).then(setHolder);
  }, [uid]);

  const open = useMemo(() => (orderRef && up ? up.find(t => encodeRef(t.orderId) === orderRef) ?? null : null), [orderRef, up]);

  // While a seat can still be scanned, often enough that the scan at the gate
  // shows here as "Checked in" (the app polls the same way).
  useEffect(() => {
    if (!open || !open.checkinOpen || open.checkedInCount >= open.qty || open.ticketStatus !== "valid") return;
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [open, reload]);

  if (failed && !up) return <div className="pw-container pw-page"><ErrorState title="We couldn't load your tickets" body="Check your connection, then try again." onRetry={reload} /></div>;
  if (!up || !old) return <div className="pw-container pw-page" style={{ maxWidth: 960 }}><div className="stack"><Skeleton variant="ticket" /><Skeleton variant="ticket" /></div></div>;

  if (orderRef) {
    if (open) return <OrderView t={open} code={code} holder={holder} now={now} onChanged={reload} />;
    return <div className="pw-container pw-page" style={{ maxWidth: 720 }}>
      <EmptyState icon="ticket" title="We can't find that booking" body="It may be for an event that has ended. Past events are under Past." action="See your tickets" href="/tickets" />
    </div>;
  }

  return <div className="pw-container" style={{ paddingTop: 24, paddingBottom: 64, maxWidth: 960 }}>
    <div className="sec-h"><h1 className="t-h1">Your tickets</h1>
      <SegmentedControl value={when} onChange={setWhen} label="Which tickets" options={[{ id: "upcoming", label: "Upcoming" }, { id: "past", label: "Past" }]} /></div>
    {when === "upcoming"
      ? up.length ? <div className="stack">{up.map(t => <OrderRow key={t.orderId} t={t} />)}</div>
        : <EmptyState boxed icon="ticket" title="No upcoming tickets." body="Book an event and your entry shows here, ready to scan on the day." action="Browse events" href="/events" />
      : old.length ? <div className="stack">{old.map(p => <PastRow key={p.eventId + p.startsAt} p={p} />)}</div>
        : <EmptyState boxed icon="ticket" title="No past events yet." body="Events you've been to show up here." action="Browse events" href="/events" />}
  </div>;
}

function OrderRow({ t }: { t: Ticket }) {
  return <Card href={`/tickets?o=${encodeRef(t.orderId)}`} interactive>
    <div className="row" style={{ flexWrap: "nowrap", gap: 16 }}>
      <div style={{ width: 56, flex: "none" }}><Media ratio="2:3" radius={6} src={poster(t)} alt="" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{t.title}</b>
        <div className="t-caption">{whenLine(t.startsAt)}{t.placeName ? ` · ${t.placeName}` : ""}</div>
        <div className="t-body-s" style={{ marginTop: 4 }}>{t.qty} {t.qty === 1 ? "seat" : "seats"} · {t.tierName || "General"}</div>
      </div>
      {statusTag(t)}<Icon name="chevron-right" />
    </div>
  </Card>;
}

function PastRow({ p }: { p: PastTicket }) {
  return <Card href={eventHref(p.eventId)} interactive>
    <div className="row" style={{ flexWrap: "nowrap", gap: 16 }}>
      <div style={{ width: 56, flex: "none" }}><Media ratio="2:3" radius={6} src={poster(p)} alt="" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{p.title}</b>
        <div className="t-caption">{whenLine(p.startsAt)}{p.placeName ? ` · ${p.placeName}` : ""}</div>
        <div className="t-body-s" style={{ marginTop: 4 }}>{p.qty} {p.qty === 1 ? "seat" : "seats"} · {p.tierName || "General"}</div>
      </div>
      {p.checkedInAt ? <TrustTag kind="checked-in" size="sm">{p.qty > 1 ? `${p.checkedInCount} of ${p.qty} checked in` : "Checked in"}</TrustTag> : null}
      <Icon name="chevron-right" />
    </div>
  </Card>;
}

function OrderView({ t, code, holder, now, onChanged }: { t: Ticket; code: string | null | undefined; holder: string; now: number; onChanged: () => void }) {
  const toast = useToast();
  const [seat, setSeat] = useState("1");
  const [order, setOrder] = useState<Order | null>(null);
  const [giveUp, setGiveUp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { let alive = true; myEventOrder(t.orderId).then(o => { if (alive) setOrder(o); }); return () => { alive = false; }; }, [t.orderId, t.ticketStatus]);

  const off = t.ticketStatus !== "valid";
  const qrs = seatQrs(t, code ?? null);
  const many = qrs.length > 1;
  const i = Math.min(Math.max(0, Number(seat) - 1), qrs.length - 1);
  const s = many ? t.seats[i] : null;
  const seatState = (): "valid" | "checked-in" | "cancelled" | "refunded" => {
    const st = s ? s.status : t.ticketStatus;
    if (st !== "valid") return st;
    return (s ? s.checkedInAt : t.checkedInAt) ? "checked-in" : "valid";
  };
  const free = t.totalMinor === 0;
  const canGiveUp = free && !off && !!now && Date.parse(t.startsAt) > now;
  const place = venue(t);

  async function release() {
    setBusy(true);
    const fail = await releaseFreeTicket(t.eventId);
    setBusy(false); setGiveUp(false);
    if (fail) { toast({ title: fail.title, message: fail.body, tone: "error" }); return; }
    toast({ title: t.qty > 1 ? "Your spots went back to the host" : "Your spot went back to the host" });
    onChanged();
  }

  return <div className="pw-container" style={{ paddingTop: 24, paddingBottom: 64, maxWidth: 960 }}>
    <div className="sec-h"><h1 className="t-h1">Your tickets</h1></div>
    <div className="split split--ticket">
      <div className="stack" style={{ alignItems: "center" }}>
        {many ? <Tabs variant="pill" value={String(i + 1)} onChange={setSeat} tabs={t.seats.map((x, k) => ({ id: String(k + 1), label: "Seat " + x.seq }))} /> : null}
        {code === undefined && !many ? <Skeleton variant="ticket" /> :
          <TicketCard event={t.title} date={whenLine(t.startsAt)} venue={place || null} holder={holder} ticketType={t.tierName || "General"}
            seat={s ? s.seq : 1} seats={t.qty} status={seatState()} qr={qrs[i] ?? ""} showQR={!off && !!qrs[i]} />}
        {!off && !qrs[i] ? <p className="t-caption" style={{ textAlign: "center", margin: 0 }}>Your QR couldn&apos;t load. Refresh the page, or show it from the pacr app.</p> : null}
        {!off && qrs[i] ? <p className="t-caption" style={{ textAlign: "center", margin: 0 }}>
          {many ? "One QR per runner. Show each one at check-in." : "Show this at check-in."}{t.meetNote ? ` ${t.meetNote}` : ""}
        </p> : null}
      </div>
      <div className="stack">
        <Button variant="ghost" icon="arrow-left" href="/tickets" style={{ alignSelf: "flex-start" }}>All tickets</Button>
        {off ? <Banner tone={t.ticketStatus === "refunded" ? "info" : "warning"} title={t.ticketStatus === "refunded" ? "Refunded" : "Cancelled"}>{offLine(t, order)}</Banner> : null}
        <Card><div className="stack">
          <b>{t.title}</b>
          <span className="t-secondary">{whenLine(t.startsAt)}</span>
          {place ? <span className="t-secondary">{place}</span> : null}
          {t.meetNote ? <span className="t-caption">{t.meetNote}</span> : null}
          <div className="row" style={{ gap: 12 }}>
            {t.lat != null || place ? <DirectionsLink variant="button" lat={t.lat} lng={t.lng} placeId={t.placeId} address={place} /> : null}
            <Button variant="ghost" size="sm" iconRight="arrow-right" href={eventHref(t.eventId)}>Event page</Button>
          </div>
          {!off ? <span className="t-caption">Check-in · {t.qty > 1 ? `${t.checkedInCount} of ${t.qty} in` : t.checkedInAt ? "Done" : t.checkinOpen ? "Open" : "Not open yet"}</span> : null}
        </div></Card>
        <Card>
          {free ? <div className="row" style={{ justifyContent: "space-between" }}><span className="t-secondary">Paid</span><b className="num">Free</b></div>
            : order ? <OrderSummary lines={[{ label: t.tierName || "General", qty: order.qty, priceMinor: order.unitMinor }]} feeMinor={order.feeMinor} gstMinor={order.gstMinor} totalMinor={order.totalMinor} note={null} />
            : <div className="row" style={{ justifyContent: "space-between" }}><span className="t-secondary">Paid</span><b className="num">{money(t.totalMinor)}</b></div>}
          {!free && refundLine(t, order) ? <p className="t-caption" style={{ margin: "10px 0 0" }}>{refundLine(t, order)}</p> : null}
          {!off && !free ? <p className="t-caption" style={{ margin: "10px 0 0" }}>{t.refundNote ? `Refunds: ${t.refundNote}` : "Refunds are up to the host. Paid tickets can't be given back from here."}</p> : null}
          {canGiveUp ? <Button variant="ghost" size="sm" style={{ marginTop: 8 }} onClick={() => setGiveUp(true)}>{t.qty > 1 ? "Give up my spots" : "Give up my spot"}</Button> : null}
        </Card>
      </div>
    </div>
    <Dialog open={giveUp} onClose={() => setGiveUp(false)} title={t.qty > 1 ? `Give up your ${t.qty} spots?` : "Give up your spot?"}
      actions={<><Button variant="secondary" onClick={() => setGiveUp(false)}>Keep it</Button><Button variant="destructive" loading={busy} onClick={() => void release()}>{t.qty > 1 ? "Give them up" : "Give it up"}</Button></>}>
      <p style={{ margin: 0 }}>{t.qty > 1
        ? `All ${t.qty} tickets for ${t.title} go back to the host, and others can take them. A booking is given back whole.`
        : `Your ticket for ${t.title} goes back to the host, and someone else can take it.`}</p>
    </Dialog>
  </div>;
}
