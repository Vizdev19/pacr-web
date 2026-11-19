"use client";
// /tickets: ui_kits/website/Account.jsx (TicketsPage) on my_tickets,
// my_past_tickets and my_event_order. /tickets?o=<order ref> opens a booking:
// one tab per seat, each with the QR the gate scans (lib/tickets.ts).
//
// Above the upcoming tickets, "Waiting for the host": requests at events whose
// host approves each runner (my_event_requests). They are not tickets: no
// seat, no QR, and a database from before requests simply has none.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Icon, Media, TrustTag } from "@/components/ds/core";
import { OrderSummary, TicketCard } from "@/components/ds/content";
import { DirectionsLink } from "@/components/ds/actions";
import { EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { SegmentedControl, Tabs } from "@/components/ds/nav";
import { Banner, Dialog, useToast } from "@/components/ds/overlays";
import { SeatQuestionsSheet } from "@/components/pages/event/SeatQuestions";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { encodeRef } from "@/lib/refs";
import { whenLine } from "@/lib/format";
import { orderAnswers } from "@/lib/seatAnswers";
import {
  holderName, money, myCheckinCode, myEventOrder, myEventRequests, myPastTickets, myTickets, offLine, refundLine, releaseFreeTicket, seatQrs,
  withdrawEventRequest,
  type Order, type PastTicket, type Ticket, type TicketRequest,
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

  // Requests the host hasn't answered, for the list only (a booking's own page
  // never shows them). Read once, and again after one is withdrawn.
  const toast = useToast();
  const [waiting, setWaiting] = useState<TicketRequest[]>([]);
  const [waitKey, setWaitKey] = useState(0);
  const [withdrawing, setWithdrawing] = useState<TicketRequest | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (orderRef) return;
    let alive = true;
    myEventRequests().then(r => { if (alive) setWaiting(r); });
    return () => { alive = false; };
  }, [orderRef, waitKey]);

  async function withdraw() {
    if (!withdrawing || busy) return;
    setBusy(true);
    const fail = await withdrawEventRequest(withdrawing.eventId);
    setBusy(false); setWithdrawing(null);
    if (fail) toast({ title: fail.title, message: fail.body, tone: "error" });
    else toast({ title: "Request withdrawn" });
    // Either way both lists are read again: a request that was gone may have become a ticket.
    setWaitKey(k => k + 1); reload();
  }

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
    {when === "upcoming" && waiting.length ? <section className="stack" style={{ marginBottom: "var(--space-8)" }} aria-labelledby="waiting-for-host">
      <div><h2 className="t-h4" id="waiting-for-host" style={{ margin: 0 }}>Waiting for the host</h2>
        <p className="t-body-s t-secondary" style={{ margin: "var(--space-1) 0 0" }}>The host approves each runner. Your ticket shows up here once they approve.</p></div>
      {waiting.map(r => <RequestRow key={r.orderId} r={r} onWithdraw={() => setWithdrawing(r)} />)}
    </section> : null}
    {when === "upcoming"
      ? up.length ? <div className="stack">{up.map(t => <OrderRow key={t.orderId} t={t} />)}</div>
        : <EmptyState boxed icon="ticket" title="No upcoming tickets." body="Book an event and your entry shows here, ready to scan on the day." action="Browse events" href="/events" />
      : old.length ? <div className="stack">{old.map(p => <PastRow key={p.eventId + p.startsAt} p={p} />)}</div>
        : <EmptyState boxed icon="ticket" title="No past events yet." body="Events you've been to show up here." action="Browse events" href="/events" />}
    <Dialog open={!!withdrawing} onClose={() => setWithdrawing(null)} title="Withdraw your request?"
      actions={<><Button variant="secondary" onClick={() => setWithdrawing(null)}>Keep it</Button><Button variant="destructive" loading={busy} onClick={() => void withdraw()}>Withdraw request</Button></>}>
      <p style={{ margin: 0 }}>The host won&apos;t see your request for {withdrawing?.title} any more. You can ask again while registration is open.</p>
    </Dialog>
  </div>;
}

/** A request the host hasn't answered. Not a link as a whole: it carries its own two actions. */
function RequestRow({ r, onWithdraw }: { r: TicketRequest; onWithdraw: () => void }) {
  return <Card>
    <div className="row" style={{ flexWrap: "nowrap", gap: 16, alignItems: "flex-start" }}>
      <div style={{ width: 56, flex: "none" }}><Media ratio="2:3" radius={6} src={poster(r)} alt="" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{r.title}</b>
        <div className="t-caption">{whenLine(r.startsAt, r.timezone)}{r.placeName ? ` · ${r.placeName}` : ""}</div>
        <div className="t-body-s" style={{ marginTop: 4 }}>{r.tierName || "General"}{r.qty > 1 ? ` · ${r.qty} tickets` : ""}</div>
        {r.answersMissing > 0 ? <div className="t-caption" style={{ marginTop: 4 }}>
          {r.answersMissing === 1 ? "One answer for the host is" : `${r.answersMissing} answers for the host are`} still missing. Add {r.answersMissing === 1 ? "it" : "them"} on the event page.</div> : null}
        <div className="row" style={{ gap: 8, marginTop: "var(--space-3)" }}>
          <Button size="sm" variant="secondary" iconRight="arrow-right" href={eventHref(r.eventId)}>Event page</Button>
          <Button size="sm" variant="ghost" onClick={onWithdraw}>Withdraw</Button>
        </div>
      </div>
      <TrustTag kind="request-sent" size="sm" />
    </div>
  </Card>;
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

  // What the host asks for each ticket, if anything: how many required answers
  // are still missing, while they can still be given (until the event starts).
  const [asks, setAsks] = useState<{ missing: number } | null>(null);
  const [details, setDetails] = useState(false);
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    let alive = true;
    orderAnswers(t.orderId).then(a => { if (alive) setAsks(a && a.questions.length > 0 && a.open ? { missing: a.missing } : null); });
    return () => { alive = false; };
  }, [t.orderId, asked]);

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
        {!off && asks ? <Banner tone={asks.missing ? "warning" : "neutral"} title={asks.missing ? "The host needs a few details" : "Your details for the host"}
          actions={<Button size="sm" variant={asks.missing ? "primary" : "secondary"} onClick={() => setDetails(true)}>{asks.missing ? "Add details" : "Change details"}</Button>}>
          {asks.missing ? `${asks.missing === 1 ? "One answer is" : `${asks.missing} answers are`} still needed to finish your registration.` : "You can change your answers until the event starts."}</Banner> : null}
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
          {!off && !free ? <p className="t-caption" style={{ margin: "10px 0 0" }}>{t.refundNote ? `Refunds: ${t.refundNote}` : "Paid tickets can't be cancelled or refunded on request. Your money comes back only if the event is cancelled, or the host or pacr refunds the booking."}</p> : null}
          {canGiveUp ? <Button variant="ghost" size="sm" style={{ marginTop: 8 }} onClick={() => setGiveUp(true)}>{t.qty > 1 ? "Give up my spots" : "Give up my spot"}</Button> : null}
        </Card>
      </div>
    </div>
    <SeatQuestionsSheet orderId={details ? t.orderId : null} onClose={() => setDetails(false)}
      onDone={() => { setDetails(false); setAsked(n => n + 1); toast({ title: "Saved" }); }} />
    <Dialog open={giveUp} onClose={() => setGiveUp(false)} title={t.qty > 1 ? `Give up your ${t.qty} spots?` : "Give up your spot?"}
      actions={<><Button variant="secondary" onClick={() => setGiveUp(false)}>Keep it</Button><Button variant="destructive" loading={busy} onClick={() => void release()}>{t.qty > 1 ? "Give them up" : "Give it up"}</Button></>}>
      <p style={{ margin: 0 }}>{t.qty > 1
        ? `All ${t.qty} tickets for ${t.title} go back to the host, and others can take them. A booking is given back whole.`
        : `Your ticket for ${t.title} goes back to the host, and someone else can take it.`}</p>
    </Dialog>
  </div>;
}
