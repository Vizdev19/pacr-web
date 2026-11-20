"use client";
// Paying for held seats: ui_kits/website/Event.jsx (Checkout) on a real hold.
//
//   questions   the host's questions for each ticket, when the event has any
//   summary     what it costs, the hold's countdown, Pay
//   expired     the ten minutes ran out: hold the seats again
//   pending     paid, the ticket is still being made (Razorpay's webhook will)
//   refunded    paid, no ticket could be made; the money goes back
//
// A confirmed payment closes this and the page shows the tickets. Closing it
// before paying gives the seats back at once (lib/checkout.ts says why
// closing Razorpay's own window does not).
//
// Once Razorpay's window has been opened, a payment may be on its way even if
// the window closed or the hold ran out: the order is read back before the
// seats are held again, and the words stop promising that nothing was charged.
// A payment still being confirmed is handed to the page (onPending), which
// keeps asking and stops offering to pay again.
//
// Mount it with `key={held.orderId}`: a fresh hold starts from the top.
import { useEffect, useState } from "react";
import { OrderSummary } from "@/components/ds/content";
import { Button, Media } from "@/components/ds/core";
import { BottomSheet } from "@/components/ds/feedback";
import { Banner } from "@/components/ds/overlays";
import { abandonOrder, payFailCopy, payForOrder, settledOrder, type Held, type PayFail } from "@/lib/checkout";
import { inr, whenLine } from "@/lib/format";
import type { EventView } from "@/lib/event";
import { SeatQuestions } from "./SeatQuestions";

type Copy = { title: string; body: string };

export function Checkout({ held, tierName, e, askQuestions, onClose, onConfirmed, onPending, onHoldAgain }: {
  held: Held; tierName: string; e: EventView;
  /** The event has questions for each ticket: they come before paying. */
  askQuestions: boolean;
  /** Closed without a ticket (the hold has been given back, unless a payment is still being confirmed). */
  onClose: () => void;
  onConfirmed: () => void;
  /** Paid, and the ticket isn't made yet: the page keeps asking about this order from here. */
  onPending: () => void;
  /** Reserve the same seats again; what to say if that can't be done. */
  onHoldAgain: () => Promise<Copy | null>;
}) {
  const [step, setStep] = useState<"questions" | "summary" | "pending" | "refunded">(askQuestions ? "questions" : "summary");
  const [stage, setStage] = useState<"starting" | "checkout" | "confirming" | null>(null);
  const [fail, setFail] = useState<PayFail | null>(null);
  /** The hold was given back for want of time (payForOrder's hold_expired). */
  const [gone, setGone] = useState(false);
  const [again, setAgain] = useState<{ busy: boolean; fail: Copy | null }>({ busy: false, fail: null });
  /** Razorpay's window has been opened for this hold: a payment may be on its way. */
  const [tried, setTried] = useState(false);
  /** Seconds of hold left; null until the first tick. */
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const until = Date.parse(held.holdExpiresAt);
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [held.holdExpiresAt]);

  const waiting = step === "questions" || step === "summary";
  // While Razorpay's window is up it keeps its own clock (it closes when the hold does).
  const expired = waiting && !stage && (gone || left === 0);
  const mm = left == null ? "" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  // The hold ran out after a payment was started: it may have gone through all the same.
  useEffect(() => {
    if (!expired || !tried) return;
    let alive = true;
    void settledOrder(held.orderId).then(done => {
      if (!alive || !done) return;
      if (done === "confirmed") onConfirmed(); else setStep("refunded");
    });
    return () => { alive = false; };
    // onConfirmed is the page's own closure, new on every render; the check is for this hold's expiry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, tried, held.orderId]);

  const pay = async () => {
    if (stage) return;
    setFail(null); setStage("starting");
    const out = await payForOrder(held.orderId, s => { setStage(s); if (s === "checkout") setTried(true); });
    setStage(null);
    if (out.kind === "confirmed") onConfirmed();
    else if (out.kind === "pending") { setStep("pending"); onPending(); }
    else if (out.kind === "refunded") setStep("refunded");
    else if (out.kind === "failed") {
      if (out.reason === "answers") setStep("questions");
      else if (out.reason === "hold_expired") setGone(true);
      else setFail(out.reason);
    }
  };

  const close = () => {
    if (stage) return;
    // Seats nobody is paying for go back on sale now, not in ten minutes.
    if (waiting && !expired) void abandonOrder(held.orderId).then(onClose);
    else onClose();
  };

  const holdAgain = async () => {
    setAgain({ busy: true, fail: null });
    // A payment started on the old hold may have landed: then there is nothing to hold again.
    if (tried) {
      const done = await settledOrder(held.orderId);
      if (done === "confirmed") { onConfirmed(); return; }
      if (done === "refunded") { setAgain({ busy: false, fail: null }); setStep("refunded"); return; }
    }
    const said = await onHoldAgain();
    // On success the page hands this a new hold (a new order) and it starts over.
    if (said) setAgain({ busy: false, fail: said });
  };

  const total = inr(held.totalMinor);
  const failed = fail ? payFailCopy(fail) : null;
  const title = expired ? "Seats released" : step === "questions" ? "A few details" : step === "summary" ? "Order summary"
    : step === "pending" ? "Payment received" : "Payment refunded";

  const footer = expired ? <Button block size="lg" loading={again.busy} onClick={() => void holdAgain()}>Hold seats again</Button>
    : step === "summary" ? <>
      <Button block size="lg" loading={!!stage} onClick={() => void pay()}>Pay {total}</Button>
      <span className="t-caption" style={{ textAlign: "center" }}>{stage === "checkout" ? "Finish paying in the Razorpay window."
        : stage === "confirming" ? "Payment done. Making your tickets…"
        : "Paid tickets can’t be cancelled or refunded on request."}</span>
    </>
    : step === "pending" || step === "refunded" ? <Button block size="lg" variant="secondary" href="/tickets">See your tickets</Button>
    : null;

  return <BottomSheet open title={title} onClose={stage ? undefined : close} footer={footer}>
    {expired ? <div className="stack" style={{ gap: "var(--space-4)" }}>
      <p className="t-secondary" style={{ margin: 0 }}>{tried
        ? "The ten-minute hold ran out and your seats went back on sale. If you finished paying in your UPI or bank app, don’t pay again: the ticket shows up in Your tickets within a few minutes. Otherwise nothing was charged."
        : "The ten-minute hold ran out and your seats went back on sale. Nothing was charged."}</p>
      {again.fail ? <Banner tone="error" title={again.fail.title}>{again.fail.body}</Banner> : null}
    </div>
    : step === "questions" ? <div className="stack" style={{ gap: "var(--space-4)" }}>
      {mm ? <Banner tone="warning" icon="timer" title={`Seats held for ${mm}`}>Answer these and pay before the timer runs out.</Banner> : null}
      <SeatQuestions key={held.orderId} orderId={held.orderId} draftKey={e.ref} cta="Continue to payment" onDone={() => setStep("summary")} />
    </div>
    : step === "summary" ? <div className="stack" style={{ gap: "var(--space-4)" }}>
      {failed ? <Banner tone="error" title={failed.title}>{failed.body}{fail === "declined" || fail === "gateway" || fail === "error" ? " Your seats are still held." : ""}</Banner> : null}
      {mm ? <Banner tone="warning" icon="timer" title={`Seats held for ${mm}`}>Pay before the timer runs out or the seats go back on sale.</Banner> : null}
      <div className="row" style={{ flexWrap: "nowrap", gap: 12 }}>
        <div style={{ width: 52, flex: "none" }}><Media ratio="2:3" radius={6} src={e.poster} alt="" /></div>
        <div><b>{e.title}</b><div className="t-caption">{whenLine(e.startsAt, e.timezone)}{e.place.name ? ` · ${e.place.name}` : ""}</div></div>
      </div>
      <OrderSummary lines={[{ label: tierName || "General", qty: held.qty, priceMinor: held.unitMinor }]}
        feeMinor={held.feeMinor} gstMinor={held.gstMinor} totalMinor={held.totalMinor} />
    </div>
    : step === "pending" ? <p className="t-secondary" style={{ margin: 0 }}>
      Your payment went through and your {held.qty === 1 ? "ticket is" : "tickets are"} being made. {held.qty === 1 ? "It shows" : "They show"} up here and in Your tickets within a few minutes; this page keeps checking. Please don&apos;t pay again.</p>
    : <p className="t-secondary" style={{ margin: 0 }}>
      You paid, but we couldn&apos;t make the {held.qty === 1 ? "ticket" : "tickets"}: the event was cancelled while you paid, or you already hold a ticket for it. Your {total} is on its way back to how you paid. It usually takes 5–7 working days.</p>}
  </BottomSheet>;
}
