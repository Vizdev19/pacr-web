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
//
// Two rules keep the page honest and usable:
//   - Nothing here waits for ever. Razorpay's script, each server call and
//     Razorpay's window all have a time limit, so the summary can always be
//     used or closed again.
//   - Before saying a payment didn't happen (the window was closed, the hold
//     ran out, the order is no longer waiting), the order is read back
//     (settledOrder): a UPI payment can land after its window has gone.
import { getSupabase } from "./supabase";

/** A hold as reserve_event_ticket and get_event's my_payment describe it. Paise. */
export type Held = {
  orderId: string; qty: number; unitMinor: number; feeMinor: number; gstMinor: number; totalMinor: number;
  holdExpiresAt: string;
};

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v) || 0;

/** `p`, or `late` if it hasn't answered in `ms`. */
function within<T>(p: Promise<T>, ms: number, late: T): Promise<T> {
  return new Promise<T>(resolve => {
    const t = setTimeout(() => resolve(late), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(late); });
  });
}
const SCRIPT_MS = 15_000;
const CALL_MS = 20_000;
const READ_MS = 10_000;
/** How long past the hold's end Razorpay's window is waited for before the page takes over again. */
const WINDOW_GRACE_S = 60;

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

/** Razorpay's script, fetched the first time someone pays. Null when it can't load (offline, blocked, too slow). */
function loadRazorpay(): Promise<RazorpayCtor | null> {
  const have = () => (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay ?? null;
  if (have()) return Promise.resolve(have());
  loading ??= new Promise<RazorpayCtor | null>(resolve => {
    const s = document.createElement("script");
    s.src = SCRIPT; s.async = true;
    // A load that failed, stalled or brought nothing isn't kept: the next tap on Pay tries again.
    const end = (got: RazorpayCtor | null) => { clearTimeout(slow); if (!got) { s.remove(); loading = null; } resolve(got); };
    const slow = setTimeout(() => end(have()), SCRIPT_MS);
    s.onload = () => end(have());
    s.onerror = () => end(null);
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
    // It closes itself when the hold does. If it never says how it ended, the
    // page takes over a minute after that rather than wait on it for ever.
    const guard = setTimeout(() => done({ closed: "declined" }), (Math.max(0, Math.floor(init.expires_in)) + WINDOW_GRACE_S) * 1000);
    const done = (r: { paid: CheckoutSuccess } | { closed: "cancelled" | "declined" }) => { clearTimeout(guard); resolve(r); };
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
        handler: (data: CheckoutSuccess) => done({ paid: data ?? {} }),
        modal: { ondismiss: () => done({ closed: failedOnce ? "declined" : "cancelled" }) },
      });
      rzp.on("payment.failed", () => { failedOnce = true; });
      rzp.open();
    } catch {
      done({ closed: "declined" });
    }
  });
}

// ─── Server calls ────────────────────────────────────────────────────────────

type Call<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function checkoutCall<T>(body: Record<string, unknown>): Promise<Call<T>> {
  return within(checkoutCallOnce<T>(body), CALL_MS, { ok: false, status: 0, error: "timeout" });
}

async function checkoutCallOnce<T>(body: Record<string, unknown>): Promise<Call<T>> {
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

/** The order as the server has it now: confirmed, refunded, reserved, expired… Null when it can't be read. */
function orderStatus(orderId: string): Promise<string | null> {
  const read = async () => {
    try {
      const { data, error } = await getSupabase().rpc("my_event_order", { p_order_id: orderId });
      return error ? null : ((data as { status?: string } | null)?.status ?? null);
    } catch {
      return null;
    }
  };
  return within(read(), READ_MS, null);
}

/**
 * Has a payment already settled this order? "confirmed": the tickets are
 * theirs. "refunded": paid, no ticket, money going back. Null: neither (still
 * waiting, lapsed, or it couldn't be read). Asked before the page says a
 * payment didn't happen, and while one is still being confirmed.
 */
export async function settledOrder(orderId: string): Promise<"confirmed" | "refunded" | null> {
  const st = await orderStatus(orderId);
  return st === "confirmed" || st === "refunded" ? st : null;
}

/** Give a hold back. Best effort: it lapses by itself anyway. */
export async function abandonOrder(orderId: string): Promise<void> {
  const give = async () => { try { await getSupabase().rpc("abandon_event_order", { p_order_id: orderId }); } catch { /* the hold runs out on its own */ } };
  await within(give(), READ_MS, undefined);
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
 * note at the top); the caller reserves again. It always answers: every wait
 * in it has a time limit.
 */
export async function payForOrder(orderId: string, onStage?: (stage: "checkout" | "confirming") => void): Promise<PayOutcome> {
  // Both at once: the script is usually there by the time the order is.
  const [Razorpay, init] = await Promise.all([loadRazorpay(), checkoutCall<CheckoutInit>({ action: "init", order_id: orderId })]);
  if (!init.ok) {
    // "No longer waiting" is also what an order says once an earlier payment has landed.
    if (init.error === "hold_expired" || init.error === "not_reserved") {
      const done = await settledOrder(orderId);
      if (done) return { kind: done };
    }
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
  if ("closed" in sheet) {
    // Closed without a payment handed back. One made in a UPI or bank app may have landed all the same.
    const done = await settledOrder(orderId);
    if (done) return { kind: done };
    return sheet.closed === "cancelled" ? { kind: "cancelled" } : { kind: "failed", reason: "declined" };
  }

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
