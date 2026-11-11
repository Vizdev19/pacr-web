"use client";

// Your tickets, read as the runner (app repo: 20261210120000_event_group_booking.sql).
//
//   my_tickets        one row per booking whose event hasn't ended: the
//                     seats with their own check-in codes, cancellations
//                     and refunds included
//   my_past_tickets   bookings at events that have ended (no order id)
//   my_event_order    what a booking cost: unit price × qty, pacr's fee and
//                     the GST on it, all in paise; the refund's state
//   my_checkin_code   the runner's own check-in code
//   release_free_ticket  give a free booking back (the only cancel a buyer has;
//                     paid tickets are refunded by the host)
//
// The QR is exactly what the app's My tickets screen encodes
// (app/event-tickets.tsx): "PACR1:<code>". A booking of one seat shows the
// runner's personal code (my_checkin_code); a group booking shows each seat's
// own code (event_tickets.code). The gate scanner (check_in_event_ticket)
// takes both.
import { getSupabase } from "./supabase";

export const QR_PREFIX = "PACR1:";

export type Seat = { seq: number; code: string; checkedInAt: string | null; status: "valid" | "cancelled" | "refunded" };

export type Ticket = {
  eventId: string; orderId: string; title: string; kind: string; startsAt: string; endsAt: string;
  placeName: string | null; placeAddress: string | null; lat: number | null; lng: number | null; placeId: string | null;
  meetNote: string | null; hasCover: boolean; eventStatus: string; ticketStatus: "valid" | "cancelled" | "refunded";
  tierName: string; totalMinor: number; refundNote: string | null; cancelReason: string | null; checkedInAt: string | null;
  checkinOpen: boolean; qty: number; checkedInCount: number; seats: Seat[];
};

export type PastTicket = {
  eventId: string; title: string; startsAt: string; placeName: string | null; hasCover: boolean;
  tierName: string; checkedInAt: string | null; qty: number; checkedInCount: number;
};

export type Order = {
  status: string; qty: number; unitMinor: number; feeMinor: number; gstMinor: number; totalMinor: number;
  paidAt: string | null; refundStatus: "requested" | "processing" | "done" | "failed" | null;
};

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v) || 0;
const numOrNull = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const seatStatus = (v: unknown): Seat["status"] => (v === "cancelled" || v === "refunded" ? v : "valid");

function seatOf(x: Row): Seat | null {
  const code = str(x?.code);
  if (!code) return null;
  return { seq: Math.max(1, num(x.seq) || 1), code, checkedInAt: str(x.checked_in_at), status: seatStatus(x.status) };
}

export async function myTickets(): Promise<Ticket[]> {
  const { data, error } = await getSupabase().rpc("my_tickets", {});
  if (error) throw new Error(error.message);
  return ((data as Row[]) ?? []).filter(r => str(r.order_id)).map(r => ({
    eventId: String(r.event_id), orderId: String(r.order_id), title: String(r.title ?? ""), kind: String(r.kind ?? ""),
    startsAt: String(r.starts_at), endsAt: String(r.ends_at),
    placeName: str(r.place_name), placeAddress: str(r.place_address),
    lat: numOrNull(r.place_lat), lng: numOrNull(r.place_lng), placeId: str(r.google_place_id),
    meetNote: str(r.meet_note), hasCover: !!str(r.cover_path), eventStatus: String(r.event_status ?? ""),
    ticketStatus: seatStatus(r.ticket_status), tierName: String(r.tier_name ?? ""), totalMinor: num(r.total_minor),
    refundNote: str(r.refund_note), cancelReason: str(r.cancel_reason), checkedInAt: str(r.checked_in_at),
    checkinOpen: !!r.checkin_open, qty: Math.max(1, num(r.qty) || 1),
    checkedInCount: r.checked_in_count == null ? (r.checked_in_at ? 1 : 0) : num(r.checked_in_count),
    seats: (Array.isArray(r.tickets) ? (r.tickets as Row[]) : []).map(seatOf).filter((s): s is Seat => !!s).sort((a, b) => a.seq - b.seq),
  }));
}

export async function myPastTickets(): Promise<PastTicket[]> {
  const { data, error } = await getSupabase().rpc("my_past_tickets", { p_limit: 100 });
  if (error) throw new Error(error.message);
  return ((data as Row[]) ?? []).map(r => ({
    eventId: String(r.event_id), title: String(r.title ?? ""), startsAt: String(r.starts_at), placeName: str(r.place_name),
    hasCover: !!str(r.cover_path), tierName: String(r.tier_name ?? ""), checkedInAt: str(r.checked_in_at),
    qty: Math.max(1, num(r.qty) || 1),
    checkedInCount: r.checked_in_count == null ? (r.checked_in_at ? 1 : 0) : num(r.checked_in_count),
  }));
}

export async function myEventOrder(orderId: string): Promise<Order | null> {
  const { data, error } = await getSupabase().rpc("my_event_order", { p_order_id: orderId });
  if (error || !data) return null;
  const o = data as Row;
  const rs = o.refund_status;
  return {
    status: String(o.status ?? ""), qty: Math.max(1, num(o.qty) || 1), unitMinor: num(o.unit_minor),
    feeMinor: num(o.fee_minor), gstMinor: num(o.gst_minor), totalMinor: num(o.total_minor), paidAt: str(o.paid_at),
    refundStatus: rs === "requested" || rs === "processing" || rs === "done" || rs === "failed" ? rs : null,
  };
}

/** The runner's own code, the QR of a one-seat booking. Null when it can't be had. */
export async function myCheckinCode(): Promise<string | null> {
  const { data, error } = await getSupabase().rpc("my_checkin_code");
  return !error && typeof data === "string" && data ? data : null;
}

export async function holderName(uid: string): Promise<string> {
  const { data } = await getSupabase().from("users").select("display_name").eq("id", uid).maybeSingle();
  return (data?.display_name as string | undefined)?.trim() || "You";
}

/** Give a free booking back. Null on success, else what to say. */
export async function releaseFreeTicket(eventId: string): Promise<{ title: string; body: string } | null> {
  const { error } = await getSupabase().rpc("release_free_ticket", { p_event_id: eventId });
  if (!error) return null;
  const m = error.message;
  if (/paid_ticket/.test(m)) return { title: "Ask the host", body: "Paid tickets can't be given back. Only the host can refund them." };
  if (/event_over/.test(m)) return { title: "This event is over", body: "It has already started or finished." };
  if (/no_ticket/.test(m)) return { title: "No ticket to give back", body: "This booking was already cancelled. Refresh to see it." };
  return { title: "Couldn't give your spot back", body: "Check your connection and try again." };
}

/** Each seat's QR, as the app draws them. */
export function seatQrs(t: Ticket, personal: string | null): (string | null)[] {
  if (t.qty > 1 && t.seats.length > 1) return t.seats.map(s => QR_PREFIX + s.code);
  return [personal ? QR_PREFIX + personal : null];
}

/** Why a ticket stopped working, in the app's words. */
export function offLine(t: Ticket, order: Order | null): string {
  const base = t.eventStatus === "cancelled" || t.cancelReason === "event_cancelled" ? "This event was cancelled. Your ticket no longer works."
    : t.cancelReason === "host" ? "The host cancelled this ticket."
    : t.cancelReason === "admin" ? "pacr cancelled this ticket."
    : t.cancelReason === "chargeback" ? "Your bank reversed this payment, so the ticket no longer works."
    : "This ticket was cancelled.";
  return t.cancelReason === "chargeback" ? base : `${base}${refundLine(t, order) ? " " + refundLine(t, order) : ""}`;
}

export function refundLine(t: Ticket, order: Order | null): string | null {
  if (t.ticketStatus !== "refunded" || t.totalMinor <= 0) return null;
  const amt = money(t.totalMinor);
  if (order?.refundStatus === "failed") return `Your ${amt} refund hasn't gone through yet. pacr is retrying it; you don't need to do anything.`;
  if (order?.refundStatus === "done") return `Your ${amt} was refunded to how you paid. Banks can take 5–7 working days to show it.`;
  return `Your ${amt} refund is on its way back to how you paid. It usually takes 5–7 working days.`;
}

/** "₹524", "₹99.50"; "Free" for nothing. */
export function money(minor: number): string {
  if (!minor) return "Free";
  const r = minor / 100;
  return "₹" + r.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 });
}
