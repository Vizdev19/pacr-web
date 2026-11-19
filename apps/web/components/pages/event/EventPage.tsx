"use client";
// /e/<ref>: ui_kits/website/Event.jsx on get_event.
//
// The server renders the event as anon (no ids in it). A signed-in runner's
// browser reads get_event again with their session: that adds their booking
// (my_ticket), the ticket types' ids for reserve_event_ticket, and squad-only
// events they can see. Tickets are booked here exactly as the app does
// (src/services/events.ts reserveTicket): a free one is theirs at once, a paid
// one is held for ten minutes while they pay (Checkout, lib/checkout.ts). The
// host's questions for each ticket are asked on the way (SeatQuestions).
import { Fragment, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { DirectionsLink, PlaceMap } from "@/components/ds/actions";
import { TicketCard } from "@/components/ds/content";
import { Badge, Button, Card, Icon, Media, TrustTag, VerifiedMark } from "@/components/ds/core";
import { BottomSheet, EmptyState, Skeleton } from "@/components/ds/feedback";
import { QuantityStepper } from "@/components/ds/forms";
import { Breadcrumbs, SectionNav } from "@/components/ds/nav";
import { Banner, Dialog, useToast } from "@/components/ds/overlays";
import { OpenInAppButton, OpenInAppCard } from "@/components/pages/card/OpenInApp";
import { signinHref, useAuth } from "@/lib/auth";
import { heldOf, type Held } from "@/lib/checkout";
import {
  eventView, eventWhen, failCopy, failOf, isOver, money, priceLine, seatQr, spotsLeft, tierLeft, whoFor,
  type EventFail, type EventRaw, type EventView, type TierView,
} from "@/lib/event";
import { whenLine } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { Checkout } from "./Checkout";
import { SeatQuestionsSheet } from "./SeatQuestions";

/** The event's uuid, in this browser only, for the RPCs. Never rendered. */
function uuidOf(ref: string): string | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(ref)) return null;
  const bin = atob(ref.replace(/-/g, "+").replace(/_/g, "/") + "==");
  if (bin.length !== 16) return null;
  const hex = Array.from(bin, c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type Mine = { tierName: string; qty: number };
type Seat = { seq: number; code: string; checkedIn: boolean; status: "valid" | "cancelled" | "refunded"; tierName: string | null };
/** Seats held while the runner pays: the hold, and which ticket type it is of. */
type Paying = { held: Held; tierId: string | null; tierName: string };
type Mem = { view: EventView; tierIds: string[]; mine: Mine | null; hold: Paying | null };

function memOf(raw: EventRaw, ref: string, now: number): Mem {
  const mt = raw.my_ticket, mp = raw.my_payment;
  const held = heldOf(mp);
  return {
    view: eventView(raw, ref),
    tierIds: (raw.tiers ?? []).map(t => t.id),
    mine: mt && mt.order_status === "confirmed" && mt.ticket_status === "valid"
      ? { tierName: mt.tier_name ?? "", qty: Math.max(1, Number(mt.qty) || 1) } : null,
    hold: held && new Date(held.holdExpiresAt).getTime() > now
      ? { held, tierId: mp?.tier_id ?? null, tierName: (raw.tiers ?? []).find(t => t.id === mp?.tier_id)?.name ?? "" } : null,
  };
}

/** Which app's built-in browser this is, from the browser's own description of itself; null in a real browser. */
function inAppBrowser(): string | null {
  const ua = navigator.userAgent || "";
  return /Instagram/i.test(ua) ? "Instagram" : /FBAN|FBAV|FB_IAB/i.test(ua) ? "Facebook" : /LinkedInApp/i.test(ua) ? "LinkedIn"
    : /Snapchat/i.test(ua) ? "Snapchat" : /musical_ly|TikTok|Bytedance/i.test(ua) ? "TikTok" : /\bLine\//i.test(ua) ? "LINE"
    : /Twitter/i.test(ua) ? "X" : null;
}
const noChange = () => () => {};

const closeAt = (t: TierView, e: EventView) => t.salesCloseAt ?? e.startsAt;
const closedNow = (t: TierView, e: EventView, now: number) => now >= new Date(closeAt(t, e)).getTime();
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function EventPage({ view: served, refStr, now }: { view: EventView | null; refStr: string; now: number }) {
  const auth = useAuth();
  const toast = useToast();
  const [mem, setMem] = useState<Mem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState<{ tier: number; qty: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [sheet, setSheet] = useState(false);
  /** Checkout is open on these held seats. */
  const [paying, setPaying] = useState<Paying | null>(null);
  /** The host's questions are open for this booking (a free one, or to change answers); `then` shows the tickets after. */
  const [details, setDetails] = useState<{ orderId: string; then: boolean } | null>(null);
  const [seats, setSeats] = useState<Seat[] | null | "error">(null);
  const [holder, setHolder] = useState("You");
  const id = useMemo(() => uuidOf(refStr), [refStr]);
  const signedIn = auth.status === "signed-in";

  // get_event with the runner's session; `reload` asks again after a booking or a refusal.
  const [reload, setReload] = useState(0);
  const load = useCallback(() => setReload(n => n + 1), []);
  useEffect(() => {
    if (!signedIn || !id) return;
    let alive = true;
    getSupabase().rpc("get_event", { p_event_id: id }).then(({ data, error }) => {
      if (!alive) return;
      if (!error) setMem(data ? memOf(data as EventRaw, refStr, Date.now()) : null);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [signedIn, id, refStr, reload]);
  useEffect(() => {
    if (!signedIn || !auth.uid) return;
    let alive = true;
    getSupabase().from("users").select("display_name").eq("id", auth.uid).maybeSingle()
      .then(({ data }) => { if (alive && data?.display_name) setHolder(data.display_name); });
    return () => { alive = false; };
  }, [signedIn, auth.uid]);

  // A link opened from a post or a message often lands in that app's own
  // little browser, which can't hand over to the pacr app and forgets a
  // sign-in. Named from the browser's own description of itself, after the
  // page has loaded (the server doesn't guess).
  const inApp = useSyncExternalStore(noChange, inAppBrowser, () => null);

  // Sold out, with the page open: it keeps looking (event_seat_status, pacr
  // 20270122120000). A seat comes back when a hold runs out unpaid or a
  // booking is refunded. Every 20 seconds while the tab is showing, for 20
  // minutes. `seatNow` is the seats as they stand, type by type in the page's
  // order; a database from before the migration answers nothing and the page
  // stays as it was served.
  const e0 = (signedIn && mem?.view) || served;
  const watchSeats = !!e0 && !e0.cancelled && !isOver(e0, now) && e0.tiers.length > 0 && e0.tiers.every(t => t.soldOut)
    && !(signedIn && (mem?.mine || mem?.hold));
  const [seatNow, setSeatNow] = useState<{ names: string[]; capacity: (number | null)[]; taken: number[]; held: number; minutes: number } | null>(null);
  const tierCount = e0?.tiers.length ?? 0;
  useEffect(() => {
    if (!watchSeats || !id) return;
    let alive = true;
    let looks = 0;
    const look = () => {
      getSupabase().rpc("event_seat_status", { p_event_id: id }).then(({ data, error }) => {
        const tiers = (data as { tiers?: { name: string; taken: number; held: number; capacity: number | null }[]; hold_minutes?: number } | null)?.tiers;
        if (!alive || error || !Array.isArray(tiers) || tiers.length !== tierCount) return;
        setSeatNow({
          names: tiers.map(t => String(t.name ?? "")), capacity: tiers.map(t => (t.capacity == null ? null : Number(t.capacity))),
          taken: tiers.map(t => Number(t.taken) || 0), held: tiers.reduce((n, t) => n + (Number(t.held) || 0), 0),
          minutes: Number((data as { hold_minutes?: number }).hold_minutes) || 10,
        });
        // A seat is back: a signed-in runner's page is read again, so it can be booked.
        if (signedIn && tiers.some(t => t.capacity == null || Number(t.taken) < t.capacity)) load();
      });
    };
    look();
    const timer = setInterval(() => { if (document.visibilityState === "visible" && ++looks <= 60) look(); }, 20000);
    // The watch is over (a seat came back, a ticket was got, the event ended): what it last saw goes with it.
    return () => { alive = false; clearInterval(timer); setSeatNow(null); };
  }, [watchSeats, id, tierCount, signedIn, load]);

  // The seats as just read, laid over the page as served. Only when the ticket
  // types are the same ones in the same order (the page's copy can be a little
  // old, and it carries no ids to match by); the limit is the one just read.
  const sameTypes = !!e0 && !!seatNow && seatNow.names.length === e0.tiers.length && e0.tiers.every((t, i) => t.name === seatNow.names[i]);
  const e = e0 && seatNow && sameTypes
    ? { ...e0, tiers: e0.tiers.map((t, i) => ({ ...t, capacity: seatNow.capacity[i], taken: seatNow.taken[i],
        soldOut: seatNow.capacity[i] != null && seatNow.taken[i] >= (seatNow.capacity[i] as number) })) }
    : e0;
  if (!e) {
    if (signedIn && !!id && !loaded) return <div className="pw-container pw-page"><Skeleton variant="event" /></div>;
    return <Hidden refStr={refStr} />;
  }

  const tierIds = signedIn ? mem?.tierIds ?? null : null;
  const mine = signedIn ? mem?.mine ?? null : null;
  const over = isOver(e, now);
  const live = !e.cancelled && !over;
  const left = spotsLeft(e.tiers);
  const allSold = e.tiers.length > 0 && e.tiers.every(t => t.soldOut);
  const price = priceLine(e.tiers);
  const status = e.cancelled ? <TrustTag kind="cancelled" /> : over ? <Badge>Ended</Badge>
    : allSold ? <TrustTag kind="sold-out" /> : left != null && left > 0 && left <= 10 ? <TrustTag kind="few-left" /> : null;
  const onSale = (t: TierView) => !t.soldOut && t.saleState === "on_sale" && !closedNow(t, e, now);
  const freeOpen = e.tiers.some(t => t.priceMinor === 0 && onSale(t));
  const paidOpen = e.tiers.some(t => t.priceMinor > 0 && onSale(t));
  const picked = sel && e.tiers[sel.tier] ? { tier: e.tiers[sel.tier], qty: sel.qty, id: tierIds?.[sel.tier] ?? null } : null;
  const eligible = whoFor(e);

  const openSeats = async () => {
    setSheet(true); setSeats(null);
    const { data, error } = await getSupabase().rpc("my_tickets");
    if (error || !Array.isArray(data)) { setSeats("error"); return; }
    // my_tickets is the one place a seat's code is read (20261210120000).
    // The live booking first; a booking the host cancelled can be listed too.
    const rows = (data as { event_id: string; tier_name: string | null; tickets: { seq: number; code: string; checked_in_at: string | null; status: string }[] | null }[])
      .filter(r => r.event_id === id);
    const row = rows.find(r => r.tickets?.some(t => t.status === "valid")) ?? rows[0];
    setSeats((row?.tickets ?? []).filter(t => t.code).sort((a, b) => a.seq - b.seq).map(t => ({
      seq: t.seq, code: t.code, checkedIn: !!t.checked_in_at, tierName: row?.tier_name ?? null,
      status: t.status === "cancelled" || t.status === "refunded" ? t.status : "valid",
    })));
  };

  /** reserve_event_ticket, exactly the app's call: p_qty only when it says something. */
  const reserve = async (tierId: string, qty: number): Promise<{ ok: true; data: unknown } | { ok: false; reason: EventFail }> => {
    if (!id) return { ok: false, reason: "error" };
    const { data, error } = await getSupabase().rpc("reserve_event_ticket", { p_event_id: id, p_tier_id: tierId, ...(qty > 1 ? { p_qty: qty } : {}) });
    return error ? { ok: false, reason: failOf(error.message) } : { ok: true, data };
  };

  const get = async (confirmed = false) => {
    if (!picked?.id || !id || busy) return;
    if (Date.now() >= new Date(closeAt(picked.tier, e)).getTime()) {
      const c = failCopy("sales_closed"); toast({ title: c.title, message: c.body, tone: "error" }); load(); return;
    }
    if (eligible.length && !confirmed) { setAsk(true); return; }
    setAsk(false); setBusy(true);
    const r = await reserve(picked.id, picked.qty);
    setBusy(false);
    if (!r.ok) {
      const c = failCopy(r.reason);
      toast({ title: c.title, message: c.body, tone: "error" });
      if (["sold_out", "not_enough_seats", "invalid_qty", "already_have_ticket", "sales_closed", "event_over"].includes(r.reason)) load();
      return;
    }
    const booked = r.data as { status?: string; order_id?: string } | null;
    // A paid ticket: the seats are held for ten minutes while they pay.
    const held = heldOf(booked);
    if (held) { setPaying({ held, tierId: picked.id, tierName: picked.tier.name }); return; }
    if (booked?.status !== "confirmed") { const c = failCopy("error"); toast({ title: c.title, message: c.body, tone: "error" }); load(); return; }
    // A free one is theirs already; the host's questions come before the tickets are shown.
    setSel(null);
    load();
    if (e.questionCount > 0 && booked.order_id) setDetails({ orderId: booked.order_id, then: true });
    else void openSeats();
  };

  /** Checkout's hold ran out: the same seats again, for a fresh ten minutes. */
  const holdAgain = async () => {
    if (!paying?.tierId) return failCopy("error");
    const r = await reserve(paying.tierId, paying.held.qty);
    if (!r.ok) { load(); return failCopy(r.reason); }
    const held = heldOf(r.data);
    if (!held) { load(); return failCopy("error"); }
    setPaying({ ...paying, held });
    return null;
  };

  /** "Add or change details" on a booking they already have: its order id comes from my_tickets. */
  const openDetails = async () => {
    const { data } = await getSupabase().rpc("my_tickets");
    const row = (Array.isArray(data) ? (data as { event_id: string; order_id: string | null; tickets: { status: string }[] | null }[]) : [])
      .find(r => r.event_id === id && r.order_id && r.tickets?.some(t => t.status === "valid"));
    if (row?.order_id) setDetails({ orderId: row.order_id, then: false });
    else toast({ title: "We couldn't open your booking", message: "Check your connection and try again.", tone: "error" });
  };

  const holdNote = allSold && live && seatNow && seatNow.held > 0
    ? `${plural(seatNow.held, "spot is", "spots are")} being held while ${seatNow.held === 1 ? "a runner pays" : "runners pay"}. If a payment doesn’t go through, the spot is back within ${seatNow.minutes} minutes. Keep this page open: it checks for you.`
    : null;
  const hold = signedIn && !mine ? mem?.hold ?? null : null;
  const panel = <TicketPanel holdNote={holdNote} e={e} now={now} auth={auth.status} tierIds={tierIds} mine={mine} holding={!!hold}
    sel={sel} setSel={setSel} busy={busy} onGet={() => void get()} onSeats={() => void openSeats()} anyOpen={freeOpen || paidOpen}
    onResume={() => { if (hold) setPaying(hold); }} onDetails={() => void openDetails()} />;

  const sections = [
    { id: "about", label: "About", on: !!(e.description || e.included.length) },
    { id: "course", label: "Course", on: !!(e.courseMap || e.courseFacts.length) },
    { id: "venue", label: "Venue", on: !!e.place.name },
    { id: "schedule", label: "Schedule", on: e.schedule.length > 0 },
    { id: "tickets", label: "Tickets", on: live && e.tiers.length > 0 },
    { id: "good-to-know", label: "Good to know", on: true },
    { id: "faq", label: "FAQ", on: e.faq.length > 0 },
  ].filter(s => s.on);

  const appNote = e.cancelled ? "Find other runs, races and socials near you in the app."
    : over ? "See what this host runs next, and other events near you, in the app."
    : "Your tickets, check-in code and directions, in the app.";

  return <>
    <div className="pw-container" style={{ paddingTop: "var(--space-4)" }}><Breadcrumbs items={[{ label: "Events", href: "/events" }, { label: e.title }]} /></div>
    <div className="pw-container"><div className="split split--wide" style={{ marginTop: "var(--space-5)" }}>
      <div className="stack" style={{ gap: "var(--space-6)" }}>
        <div className="row" style={{ alignItems: "flex-start", gap: 28, flexWrap: "wrap" }}>
          <div style={{ width: "min(260px, 100%)" }}><Media ratio="2:3" radius="var(--radius-lg)" src={e.poster} alt={`Poster for ${e.title}`} label="Event poster" /></div>
          <div style={{ flex: 1, minWidth: 260 }} className="stack">
            <div className="row"><Badge tone="accent">{e.typeLabel}</Badge>{status}{e.womenOnly ? <TrustTag kind="women-only" /> : null}</div>
            <h1 className="t-h1">{e.title}</h1>
            {e.host ? <div className="row t-secondary" style={{ gap: 6 }}>By {e.host.href
              ? <a href={e.host.href} style={{ color: "var(--text-primary)", textDecoration: "none" }}><b>{e.host.name}</b></a>
              : <b style={{ color: "var(--text-primary)" }}>{e.host.name}</b>}{e.host.verified ? <VerifiedMark /> : null}</div> : null}
            <dl className="dl" style={{ marginTop: 8 }}>
              <dt><Icon name="calendar" size={17} />When</dt><dd>{eventWhen(e.startsAt, e.endsAt, e.timezone)}</dd>
              {e.place.name ? <><dt><Icon name="map-pin" size={17} />Where</dt><dd>{e.place.name}{e.place.address ? <div className="t-body-s t-secondary">{e.place.address}</div> : null}</dd></> : null}
              {e.distances ? <><dt><Icon name="route" size={17} />Distance</dt><dd>{e.distances}{e.terrain ? <span className="t-secondary"> · {e.terrain}</span> : null}</dd></> : null}
              {price && !e.cancelled ? <><dt><Icon name="ticket" size={17} />Price</dt><dd className="num">{price}</dd></> : null}
              {e.goingCount > 0 && !e.cancelled ? <><dt><Icon name="users-round" size={17} />Going</dt><dd className="num">{plural(e.goingCount, "runner", "runners")}</dd></> : null}
            </dl>
            {e.tags.length ? <div className="pw-tags">{e.tags.map(t => <Badge key={t} size="sm">{t}</Badge>)}</div> : null}
          </div>
        </div>
        {inApp && live ? <Banner tone="info" title={`You’re inside ${inApp}’s browser`}>
          It can’t open the pacr app or keep you signed in. Tap the ••• or share button at the top and choose “Open in browser”, then come back to this page.</Banner> : null}
        {e.cancelled ? <Banner tone="error" title="This event was cancelled" actions={<Button size="sm" variant="secondary" href="/events">See other events</Button>}>
          {e.cancelReason ? `From the host: ${e.cancelReason}` : "The host cancelled it. Anyone with a paid ticket is refunded in full."}</Banner>
          : over ? <Banner tone="neutral" title="This event has ended" actions={e.resultsUrl
              ? <Button size="sm" href={e.resultsUrl} target="_blank" rel="noopener noreferrer nofollow">See results</Button>
              : <Button size="sm" variant="secondary" href={e.host?.href ?? "/events"}>{e.host?.href ? `See ${e.host.name}` : "See other events"}</Button>}>
            See what this host runs next, and other events near you.</Banner> : null}
      </div>
      {live && e.tiers.length ? <aside className="sticky hide-md"><Card><h2 className="t-h4" style={{ marginBottom: 4 }}>Tickets</h2>{panel}</Card></aside> : <div />}
    </div></div>

    {sections.length > 1 ? <div style={{ marginTop: "var(--space-8)" }}><SectionNav sections={sections} /></div> : null}
    <div className="pw-container" style={{ paddingBottom: "var(--space-16)" }}><div className="split split--wide" style={{ marginTop: 28 }}><div>
      {e.description || e.included.length ? <div className="block prose" id="about"><h2>About</h2>
        {e.description ? e.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p.split("\n").map((l, j) => <span key={j}>{j ? <br /> : null}{l}</span>)}</p>) : null}
        {e.included.length ? <><b>What&apos;s included</b><ul className="rules" style={{ marginTop: 8 }}>{e.included.map(x => <li key={x}>{x}</li>)}</ul></> : null}
      </div> : null}

      {e.courseMap || e.courseFacts.length ? <div className="block" id="course"><h2>Course</h2>
        {e.courseMap ? <Media ratio="4:3" radius="var(--radius-lg)" src={e.courseMap} alt={`Course map for ${e.title}`} label="Course map" /> : null}
        {e.courseFacts.length ? <dl className="dl">{e.courseFacts.map((f, i) => <Fragment key={i}><dt>{f.label}</dt><dd>{f.value}</dd></Fragment>)}</dl> : null}
      </div> : null}

      {e.place.name ? <div className="block" id="venue"><h2>Venue</h2>
        <PlaceMap lat={e.place.lat} lng={e.place.lng} label={e.place.name} ratio="5:2" />
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div><b>{e.place.name}</b>{e.place.address ? <div className="t-body-s t-secondary">{e.place.address}</div> : null}</div>
          {e.place.lat != null || e.place.address ? <DirectionsLink variant="button" address={e.place.address ?? e.place.name} lat={e.place.lat} lng={e.place.lng} placeId={e.place.placeId} /> : null}
        </div>
        {e.meetNote ? <p className="t-body-s t-secondary" style={{ margin: 0 }}><Icon name="flag" size={15} /> {e.meetNote}</p> : null}
      </div> : null}

      {e.schedule.length ? <div className="block" id="schedule"><h2>Schedule</h2><Card pad={false}>{e.schedule.map((s, i) =>
        <div key={i} className="row" style={{ padding: "12px 18px", borderTop: i ? "1px solid var(--border-subtle)" : 0, flexWrap: "nowrap", alignItems: "flex-start" }}>
          <b className="num" style={{ width: 80, flex: "none" }}>{s.time}</b><div>{s.label}{s.note ? <div className="t-caption">{s.note}</div> : null}</div></div>)}</Card></div> : null}

      {live && e.tiers.length ? <div className="block only-md" id="tickets"><h2>Tickets</h2><Card>{panel}</Card></div> : null}

      <div className="block" id="good-to-know"><h2>Good to know</h2><Card pad={false}>
        <Fact label="Age" value={e.minAge != null ? `${e.minAge}+` : "All ages"} note={e.minAge != null ? "You confirm it when you register" : null} first />
        <Fact label="Gender" value={e.gender === "women" ? "Women only" : e.gender === "men" ? "Men only" : e.gender === "women_nb" ? "Women and non-binary" : "Open to all"}
          note={e.gender === "women" ? "Checked against your profile" : e.gender === "all" ? null : "You confirm it when you register"} />
        {e.isPaid || e.refundNote ? <Fact label="Refunds" value={e.isPaid ? "No refunds on request" : "Give up your spot anytime"}
          note={[e.isPaid ? "Paid tickets can't be cancelled. Your money comes back only if the event is cancelled, or the host or pacr refunds the booking, always the whole booking." : null, e.refundNote ? `From the host: ${e.refundNote}` : null].filter(Boolean).join(" ") || null} /> : null}
      </Card></div>

      {e.faq.length ? <div className="block faq" id="faq"><h2>FAQ</h2>{e.faq.map((f, i) => <details key={i}><summary>{f.q}<Icon name="plus" /></summary>{f.a ? <p>{f.a}</p> : null}</details>)}</div> : null}

      <div className="block"><OpenInAppCard path={`e/${e.ref}`} sub={appNote} /></div>
    </div><div /></div></div>

    {picked && live ? <div className="only-md mbar" style={{ bottom: signedIn ? "var(--tabbar-h)" : 0, zIndex: 31 }}>
      <div><b className="num">{plural(picked.qty, "ticket", "tickets")} · {money(picked.tier.priceMinor * picked.qty)}</b>
        <div className="t-caption">{picked.tier.name}{picked.tier.priceMinor ? " · + fee and GST" : ""}</div></div>
      <Button onClick={() => void get()} loading={busy}>{picked.tier.priceMinor ? "Continue" : "Get tickets"}</Button></div> : null}

    <Dialog open={ask} onClose={() => setAsk(false)} title="Is this event for you?"
      actions={<><Button variant="secondary" onClick={() => setAsk(false)}>Not me</Button><Button onClick={() => void get(true)} loading={busy}>Yes, register</Button></>}>
      <p style={{ margin: 0 }}>The host has set it for {eligible.join(", ")}. Registering confirms that&apos;s you.</p>
    </Dialog>

    <BottomSheet open={sheet} onClose={() => setSheet(false)} title="You're in"
      footer={<Button block size="lg" variant="secondary" href="/tickets">See all your tickets</Button>}>
      {seats === null ? <Skeleton variant="ticket" />
        : seats === "error" ? <EmptyState icon="ticket" title="We couldn't load your tickets" body="They're booked. Open Your tickets to see the codes." action="Your tickets" href="/tickets" />
        : !seats.length ? <EmptyState icon="ticket" title="No tickets to show yet" body="Your booking may still be confirming. Your tickets has the latest." action="Your tickets" href="/tickets" />
        : <div className="stack" style={{ alignItems: "center", gap: "var(--space-4)" }}>
          <p className="t-secondary" style={{ margin: 0, textAlign: "center" }}>{plural(seats.length, "ticket", "tickets")} for {e.title}. One QR per runner; each is scanned once at check-in.</p>
          {seats.map(s => <TicketCard key={s.seq} event={e.title} date={whenLine(e.startsAt, e.timezone)} venue={e.place.name} holder={holder}
            ticketType={s.tierName} seat={s.seq} seats={seats.length}
            status={e.cancelled ? "cancelled" : s.checkedIn ? "checked-in" : s.status} qr={seatQr(s.code)} />)}
        </div>}
    </BottomSheet>

    {paying ? <Checkout key={paying.held.orderId} held={paying.held} tierName={paying.tierName} e={e} askQuestions={e.questionCount > 0}
      onHoldAgain={holdAgain}
      onClose={() => { setPaying(null); load(); }}
      onConfirmed={() => { setPaying(null); setSel(null); load(); void openSeats(); }} /> : null}

    <SeatQuestionsSheet orderId={details?.orderId ?? null}
      onClose={() => { const then = details?.then; setDetails(null); if (then) void openSeats(); }}
      onDone={() => { const then = details?.then; setDetails(null); if (then) void openSeats(); else toast({ title: "Saved" }); }} />
  </>;
}

function Fact({ label, value, note, first = false }: { label: string; value: string; note?: string | null; first?: boolean }) {
  return <div style={{ padding: "12px 18px", borderTop: first ? 0 : "1px solid var(--border-subtle)" }}>
    <div className="t-caption">{label}</div><b>{value}</b>{note ? <div className="t-body-s t-secondary">{note}</div> : null}</div>;
}

function TicketPanel({ e, now, auth, tierIds, mine, holding, sel, setSel, busy, onGet, onSeats, anyOpen, holdNote, onResume, onDetails }: {
  holdNote: string | null;
  e: EventView; now: number; auth: "loading" | "signed-in" | "signed-out"; tierIds: string[] | null; mine: Mine | null; holding: boolean;
  sel: { tier: number; qty: number } | null; setSel: (s: { tier: number; qty: number } | null) => void; busy: boolean;
  onGet: () => void; onSeats: () => void;
  /** A ticket type, free or paid, can be booked right now. */
  anyOpen: boolean;
  onResume: () => void; onDetails: () => void;
}) {
  const canBook = auth === "signed-in" && !!tierIds && !mine;
  const picked = sel && e.tiers[sel.tier] ? sel : null;
  const pickedTier = picked ? e.tiers[picked.tier] : null;
  const asks = e.questionCount > 0 && !e.cancelled && !isOver(e, now);
  const closes = e.tiers.map(t => t.salesCloseAt).find(Boolean);
  return <div className="stack" style={{ gap: 0 }}>
    {mine ? <div style={{ padding: "12px 0" }}><Banner tone="success" title="You're in"
      actions={asks ? <Button size="sm" variant="secondary" onClick={onDetails}>Add or change details</Button> : undefined}>{plural(mine.qty, "ticket", "tickets")}{mine.tierName ? ` · ${mine.tierName}` : ""}
      {asks ? ` · The host asks ${e.questionCount === 1 ? "one detail" : "a few details"} for each ticket.` : ""}</Banner></div> : null}
    {holding && !mine ? <div style={{ padding: "12px 0" }}><Banner tone="info" title="You have seats on hold"
      actions={<Button size="sm" onClick={onResume}>Finish paying</Button>}>Pay before the hold runs out, or the seats go back on sale.</Banner></div> : null}
    {e.tiers.map((t, i) => {
      const left = tierLeft(t);
      const closed = closedNow(t, e, now);
      const max = Math.max(1, Math.min(e.maxPerOrder, left ?? e.maxPerOrder));
      return <div key={i} className="ticket-type">
        <div><b>{t.name}</b>
          <div className="t-body-s"><b className="num">{money(t.priceMinor)}</b>{t.priceMinor ? <span className="t-caption"> + fee and GST</span> : null}</div>
          {!t.soldOut && !closed && t.saleState === "on_sale" && left != null && left > 0 && left <= 10 ? <div style={{ marginTop: 4 }}><TrustTag kind="few-left" size="sm">{left} left</TrustTag></div> : null}
        </div>
        {t.soldOut ? <TrustTag kind="sold-out" size="sm" />
          : closed ? <Badge size="sm">Registration closed</Badge>
          : t.saleState === "closed" ? <Badge size="sm">No longer on sale</Badge>
          : t.saleState === "not_open" ? <Badge size="sm">{t.salesOpenAt ? `On sale ${whenLine(t.salesOpenAt, e.timezone)}` : "On sale soon"}</Badge>
          : t.saleState === "waiting" ? <Badge size="sm">{t.opensAfterName ? `Opens when ${t.opensAfterName} sells out` : "Opens later"}</Badge>
          : canBook ? <QuantityStepper value={picked?.tier === i ? picked.qty : 0} max={max} label={`${t.name} tickets`}
            onChange={v => setSel(v > 0 ? { tier: i, qty: v } : null)} /> : null}
      </div>;
    })}
    {holdNote && !mine ? <p className="t-body-s t-secondary" style={{ margin: "var(--space-3) 0 0" }}>{holdNote}</p> : null}
    <div className="stack" style={{ paddingTop: "var(--space-4)", gap: "var(--space-2)" }}>
      {mine ? <>
        <Button block size="lg" icon="qr-code" onClick={onSeats}>Show my tickets</Button>
        <Button block variant="ghost" href="/tickets">See all your tickets</Button>
      </> : anyOpen ? (
        auth === "signed-out" ? <Button block size="lg" href={signinHref()}>Sign in to get tickets</Button>
        : <>
          <Button block size="lg" disabled={!picked || !canBook} loading={busy || auth === "loading" || (auth === "signed-in" && !tierIds)} onClick={onGet}>
            {!picked || !pickedTier ? "Choose tickets"
              : pickedTier.priceMinor ? `Continue · ${money(pickedTier.priceMinor * picked.qty)}`
              : `Get ${plural(picked.qty, "free ticket", "free tickets")}`}</Button>
          <p className="t-caption" style={{ margin: 0, textAlign: "center" }}>
            {pickedTier?.priceMinor ? "+ pacr fee and GST, shown before you pay. " : ""}One ticket type per booking, up to {e.maxPerOrder}. Each ticket gets its own QR.</p>
        </>
      ) : <Button block size="lg" disabled>{(e.tiers.some(t => t.saleState !== "closed") ? e.tiers.filter(t => t.saleState !== "closed") : e.tiers).every(t => t.soldOut) ? "Sold out"
          : e.tiers.some(t => !t.soldOut && (t.saleState === "not_open" || t.saleState === "waiting")) ? "Not on sale yet" : "Registration closed"}</Button>}
      {closes && !mine ? <p className="t-caption" style={{ margin: 0, textAlign: "center" }}>
        Registration {now >= new Date(closes).getTime() ? "closed" : "closes"} {whenLine(closes, e.timezone)}</p> : null}
    </div>
  </div>;
}

/** Squad-only, draft, removed or unknown: the link is fine, the web just can't show it. */
function Hidden({ refStr }: { refStr: string }) {
  return <div className="pw-reading sec"><div className="stack" style={{ alignItems: "center", gap: "var(--space-4)" }}>
    <EmptyState icon="lock" title="Open it in pacr" body="This event is open to a squad's members, or it is no longer up. If you can see it, it opens in the app." />
    <OpenInAppButton path={`e/${refStr}`} />
    <Button variant="ghost" href="/events">See events near you</Button>
  </div></div>;
}
