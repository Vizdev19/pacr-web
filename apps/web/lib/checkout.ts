"use client";

// Paying for an event ticket on the web: the app's src/services/payments.ts
// with Razorpay's Checkout.js in place of the native sheet.
//
//   reserve_event_ticket   holds the seats for ten minutes and answers with a
//                          reserved order (EventPage)
//   payForOrder(order id)  1. event-checkout `init` makes the Razorpay order
//                             and hands back the key id (this site carries no
//                             Razorpay config of its own)
//                          2. Razorpay's payment window
//                          3. event-checkout `verify` confirms the ticket
//                          4. if that can't say yet, my_event_order is asked
//                             for a while: Razorpay's webhook confirms the
//                             same payment
//
// One difference from the app: closing Razorpay's window here does not give
// the hold back. The order summary is still open behind it with its timer, so
// the runner can pay again with the same hold; the hold goes back when they
// close the summary (abandonOrder), or by itself when its ten minutes are up.
import { getSupabase } from "./supabase";

/** A hold as reserve_event_ticket and get_event's my_payment describe it. Paise. */
export type Held = {
  orderId: string; qty: number; unitMinor: number; feeMinor: number; gstMinor: number; totalMinor: number;
  holdExpiresAt: string;
};

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v) || 0;

/** A reserved order out of either RPC's JSON, or null when it isn't one. */
export function heldOf(raw: unknown): Held | null {
  const o = raw as Row | null;
  const orderId = typeof o?.order_id === "string" ? o.order_id : "";
  const until = typeof o?.hold_expires_at === "string" ? o.hold_expires_at : "";
  const status = o?.status ?? o?.order_status;
  if (!orderId || !until || status !== "reserved") return null;
  return {
    orderId, qty: Math.max(1, num(o?.qty) || 1), unitMinor: num(o?.unit_minor), feeMinor: num(o?.fee_minor),
    gstMinor: num(o?.gst_minor), totalMinor: num(o?.total_minor), holdExpiresAt: until,
  };
}

export type PayFail =
  /** Payments are switched off on the server. */
  | "unavailable"
  /** The ten-minute hold ran out, or the order is no longer waiting. */
  | "hold_expired"
  /** The host's questions for each ticket aren't all answered. */
  | "answers"
  /** Staff have paused ticket sales: this hold hadn't started paying. */
  | "paused"
  /** Razorpay couldn't start the payment, or its window couldn't load. */
  | "gateway"
  /** The payment window ended without a payment, and not because they closed it. */
  | "declined"
  | "error";

export type PayOutcome =
  | { kind: "confirmed" }
  | { kind: "refunded" }
  | { kind: "pending" }
  | { kind: "cancelled" }
  | { kind: "failed"; reason: PayFail };

export function payFailCopy(reason: PayFail): { title: string; body: string } {
  switch (reason) {
    case "unavailable": return { title: "Payments aren’t open yet", body: "Paid tickets are being switched on. Try again soon." };
    case "answers": return { title: "A few details first", body: "The host asks a few things for each ticket. Fill them in, then pay." };
    case "paused": return { title: "Ticket sales are paused", body: "pacr has paused ticket sales for a short while. Nothing was charged. Please try again a little later." };
    case "hold_expired": return { title: "Your hold ran out", body: "We keep a spot for ten minutes while you pay. Nothing was charged." };
    case "gateway": return { title: "Couldn’t start the payment", body: "The payment window didn’t open. Nothing was charged. If you use an ad blocker, allow checkout.razorpay.com, then try again." };
    // UPI apps sometimes say "failed" before the money has actually moved; a
    // payment that goes through after all still becomes a ticket (or comes back).
    case "declined": return { title: "Payment didn’t go through", body: "Nothing is booked yet. If you did finish paying in your UPI app, the ticket turns up in Your tickets within a few minutes. Otherwise, try again." };
    default: return { title: "Something went wrong", body: "Check your connection and try again. Nothing was booked." };
  }
}

// ─── Razorpay's Checkout.js ──────────────────────────────────────────────────

interface CheckoutInit {
  key_id: string; razorpay_order_id: string; amount: number; currency: string; name: string;
  description: string; prefill?: { name?: string; email?: string }; expires_in: number;
}
interface CheckoutSuccess { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string }
interface RazorpayWindow { open(): void; on(event: "payment.failed", fn: () => void): void }
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayWindow;

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<RazorpayCtor | null> | null = null;

/** Razorpay's script, fetched the first time someone pays. Null when it can't load (offline, blocked). */
function loadRazorpay(): Promise<RazorpayCtor | null> {
  const have = () => (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay ?? null;
  if (have()) return Promise.resolve(have());
  loading ??= new Promise<RazorpayCtor | null>(resolve => {
    const s = document.createElement("script");
    s.src = SCRIPT; s.async = true;
    s.onload = () => resolve(have());
    // A failed load isn't kept: the next tap on Pay tries again.
    s.onerror = () => { s.remove(); loading = null; resolve(null); };
    document.head.appendChild(s);
  });
  return loading;
}

/** Less hold than this isn't enough to pay in: start a fresh one instead. */
const MIN_HOLD_SECONDS = 120;

/** Razorpay's window. Resolves with what it handed back, or how it ended. */
function openCheckout(Razorpay: RazorpayCtor, init: CheckoutInit): Promise<{ paid: CheckoutSuccess } | { closed: "cancelled" | "declined" }> {
  return new Promise(resolve => {
    // The window stays up after a failed try so the runner can pay another
    // way. If they close it after one, that was a decline, not a change of mind.
    let failedOnce = false;
    try {
      const rzp = new Razorpay({
        key: init.key_id,
        order_id: init.razorpay_order_id,
        amount: init.amount,
        currency: init.currency,
        name: init.name,
        description: init.description,
        prefill: { name: init.prefill?.name ?? "", email: init.prefill?.email ?? "" },
        theme: { color: "#0E2B1D" },
        // The window closes itself when the hold does (seconds).
        timeout: Math.floor(init.expires_in),
        handler: (data: CheckoutSuccess) => resolve({ paid: data ?? {} }),
        modal: { ondismiss: () => resolve({ closed: failedOnce ? "declined" : "cancelled" }) },
      });
      rzp.on("payment.failed", () => { failedOnce = true; });
      rzp.open();
    } catch {
      resolve({ closed: "declined" });
    }
  });
}

// ─── Server calls ────────────────────────────────────────────────────────────

type Call<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function checkoutCall<T>(body: Record<string, unknown>): Promise<Call<T>> {
  try {
    const { data, error } = await getSupabase().functions.invoke("event-checkout", { body });
    if (!error) return { ok: true, data: data as T };
    // FunctionsHttpError keeps the response; its body names the reason.
    const res = (error as { context?: Response }).context;
    const status = typeof res?.status === "number" ? res.status : 0;
    let name = "error";
    try {
      const j = (await res?.json?.()) as { error?: unknown } | undefined;
      if (typeof j?.error === "string") name = j.error;
    } catch { /* no body */ }
    return { ok: false, status, error: name };
  } catch {
    return { ok: false, status: 0, error: "error" };
  }
}

/** The order as the server has it now: confirmed, refunded, reserved, expired… */
async function orderStatus(orderId: string): Promise<string | null> {
  try {
    const { data, error } = await getSupabase().rpc("my_event_order", { p_order_id: orderId });
    return error ? null : ((data as { status?: string } | null)?.status ?? null);
  } catch {
    return null;
  }
}

/** Give a hold back. Best effort: it lapses by itself anyway. */
export async function abandonOrder(orderId: string): Promise<void> {
  try { await getSupabase().rpc("abandon_event_order", { p_order_id: orderId }); } catch { /* the hold runs out on its own */ }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Wait for the webhook to confirm a payment this page's own verify couldn't. */
async function waitForOrder(orderId: string, forMs = 40_000): Promise<"confirmed" | "refunded" | "pending"> {
  const until = Date.now() + forMs;
  for (;;) {
    const st = await orderStatus(orderId);
    if (st === "confirmed" || st === "refunded") return st;
    if (Date.now() >= until) return "pending";
    await sleep(2000);
  }
}

// ─── The flow ────────────────────────────────────────────────────────────────

/**
 * Pay for a reserved order. `onStage` says what to show: "checkout" while
 * Razorpay's window is up, "confirming" once the money has gone and the
 * ticket is being made. Only "hold_expired" gives the hold back here (see the
 * note at the top); the caller reserves again.
 */
export async function payForOrder(orderId: string, onStage?: (stage: "checkout" | "confirming") => void): Promise<PayOutcome> {
  // Both at once: the script is usually there by the time the order is.
  const [Razorpay, init] = await Promise.all([loadRazorpay(), checkoutCall<CheckoutInit>({ action: "init", order_id: orderId })]);
  if (!init.ok) {
    const reason: PayFail = init.status === 503 ? "unavailable"
      : init.status === 502 ? "gateway"
      : init.error === "sales_paused" ? "paused"
      : init.error === "answers_required" ? "answers"
      : init.error === "hold_expired" || init.error === "not_reserved" ? "hold_expired"
      : "error";
    return { kind: "failed", reason };
  }
  if (!Razorpay) return { kind: "failed", reason: "gateway" };

  // A hold picked up again with little time left would leave the payment
  // window open after the seat has gone to someone else.
  if ((init.data.expires_in ?? 0) < MIN_HOLD_SECONDS) {
    await abandonOrder(orderId);
    return { kind: "failed", reason: "hold_expired" };
  }

  onStage?.("checkout");
  const sheet = await openCheckout(Razorpay, init.data);
  if ("closed" in sheet) return sheet.closed === "cancelled" ? { kind: "cancelled" } : { kind: "failed", reason: "declined" };

  onStage?.("confirming");
  const p = sheet.paid;
  const verified = await checkoutCall<{ status?: string }>({
    action: "verify",
    razorpay_order_id: p.razorpay_order_id ?? init.data.razorpay_order_id,
    razorpay_payment_id: p.razorpay_payment_id ?? "",
    razorpay_signature: p.razorpay_signature ?? "",
  });
  const said = verified.ok ? verified.data?.status : null;
  if (said === "confirmed" || said === "refunded") return { kind: said };
  // Paid, but verify couldn't say (no signal, Razorpay slow): the webhook will.
  return { kind: await waitForOrder(orderId) };
}
