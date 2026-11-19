"use client";
// What the host asks for each seat of a booking: a choice (T-shirt size, age
// group), a line of text (name on the bib), an emergency contact. The app's
// SeatQuestionsSheet (src/components/events/SeatQuestionsSheet.tsx) on the
// same two RPCs (lib/seatAnswers.ts).
//
// One group a seat ("Ticket 1 of 3"). A paid booking can't go to payment with
// a required answer missing (the server refuses it too); a free one is the
// runner's already, so closing this early only leaves the registration
// unfinished.
//
// An emergency contact is someone else's number: the form says who sees it
// (pacr, if something goes wrong at the event; never the host).
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ds/core";
import { BottomSheet, Skeleton } from "@/components/ds/feedback";
import { ChipSelect, FieldMessage, Input } from "@/components/ds/forms";
import { orderAnswers, saveFailCopy, saveOrderAnswers, type EventQuestion, type OrderAnswers, type SeatAnswer } from "@/lib/seatAnswers";

type Draft = Record<string, { answer?: string; name?: string; phone?: string }>;
const keyOf = (seq: number, questionId: string) => `${seq}:${questionId}`;
const PHONE = /^[+0-9][0-9 ()-]{5,19}$/;

/**
 * The questions of one booking, with a save button. Mount it with
 * `key={orderId}`: it reads the booking once, when it appears.
 */
export function SeatQuestions({ orderId, cta, request = false, onDone }: {
  orderId: string;
  /** What the button says: "Continue to payment", "Save". */
  cta: string;
  /** The booking is a request the host hasn't answered: there is no ticket yet, and Your tickets can't open it. */
  request?: boolean;
  /** Saved, with nothing required left out. */
  onDone: () => void;
}) {
  const [got, setGot] = useState<OrderAnswers | null | "error">(null);
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let alive = true;
    void orderAnswers(orderId).then(r => {
      if (!alive) return;
      if (!r) { setGot("error"); return; }
      const d: Draft = {};
      for (const a of r.answers) d[keyOf(a.seq, a.questionId)] = { answer: a.answer ?? undefined, name: a.name ?? undefined, phone: a.phone ?? undefined };
      setDraft(d); setGot(r);
    });
    return () => { alive = false; };
  }, [orderId]);

  const data = got && got !== "error" ? got : null;
  const set = (seq: number, q: EventQuestion, p: { answer?: string; name?: string; phone?: string }) => {
    setDraft(d => ({ ...d, [keyOf(seq, q.id)]: { ...d[keyOf(seq, q.id)], ...p } }));
    setErr(null);
  };

  /** Seats × questions with something wrong: a required one empty, or a contact half-given. */
  const bad = useMemo(() => {
    const out = new Set<string>();
    if (!data) return out;
    for (let seq = 1; seq <= data.qty; seq++) {
      for (const q of data.questions) {
        const v = draft[keyOf(seq, q.id)] ?? {};
        if (q.kind === "emergency") {
          const name = (v.name ?? "").trim(), phone = (v.phone ?? "").trim();
          const empty = !name && !phone;
          if ((q.required && empty) || (!empty && (!name || !PHONE.test(phone)))) out.add(keyOf(seq, q.id));
        } else if (q.required && !(v.answer ?? "").trim()) {
          out.add(keyOf(seq, q.id));
        }
      }
    }
    return out;
  }, [data, draft]);

  const save = async () => {
    if (!data || busy) return;
    setTouched(true);
    if (bad.size > 0) { setErr(bad.size === 1 ? "One answer is still needed." : `${bad.size} answers are still needed.`); return; }
    const list: SeatAnswer[] = [];
    for (let seq = 1; seq <= data.qty; seq++) {
      for (const q of data.questions) {
        const v = draft[keyOf(seq, q.id)] ?? {};
        list.push(q.kind === "emergency"
          ? { seq, questionId: q.id, answer: null, name: (v.name ?? "").trim(), phone: (v.phone ?? "").trim() }
          : { seq, questionId: q.id, answer: (v.answer ?? "").trim(), name: null, phone: null });
      }
    }
    setBusy(true);
    const r = await saveOrderAnswers(orderId, list);
    setBusy(false);
    if (typeof r !== "number") { setErr(saveFailCopy(r)); return; }
    if (r > 0) { setErr(r === 1 ? "One answer is still needed." : `${r} answers are still needed.`); return; }
    onDone();
  };

  if (got === null) return <Skeleton lines={4} />;
  if (!data) return <FieldMessage tone="error">Couldn&apos;t load the questions. Check your connection, close this and try again.</FieldMessage>;

  const locked = !data.open || busy;
  return <form noValidate className="stack" style={{ gap: "var(--space-5)" }} onSubmit={ev => { ev.preventDefault(); void save(); }}>
    <p className="t-secondary" style={{ margin: 0 }}>
      {request
        ? `The host asks these for ${data.qty > 1 ? "each ticket" : "your ticket"}, and reads them when deciding. You can change them on this page until the event starts.`
        : `The host asks these for ${data.qty > 1 ? "each ticket" : "your ticket"}. You can change them from Your tickets until the event starts.`}
    </p>
    {Array.from({ length: data.qty }, (_, i) => i + 1).map(seq => <div key={seq} className="stack" style={{ gap: "var(--space-4)" }}>
      {data.qty > 1 ? <h3 className="t-h4" style={{ margin: 0 }}>Ticket {seq} of {data.qty}</h3> : null}
      {data.questions.map((q, qi) => {
        const v = draft[keyOf(seq, q.id)] ?? {};
        const wrong = touched && bad.has(keyOf(seq, q.id));
        // Field ids are positions, never the questions' own ids.
        const fid = `seat-${seq}-q-${qi}`;
        const said = data.qty > 1 ? `${q.label}, ticket ${seq}` : q.label;
        if (q.kind === "choice") return <div key={q.id} className="pw-field">
          <span className="pw-field__label">{q.label}{q.required ? null : <small>Optional</small>}</span>
          <ChipSelect multi={false} label={said} value={v.answer ? [v.answer] : []}
            options={q.options.map(o => ({ id: o, label: o, disabled: locked }))}
            // Tapping the chosen one again clears an optional answer.
            onChange={([o]) => set(seq, q, { answer: o === v.answer && !q.required ? "" : o })} />
          {wrong ? <FieldMessage tone="error">Choose one.</FieldMessage> : null}
        </div>;
        if (q.kind === "text") return <Input key={q.id} id={fid} label={q.label} optional={!q.required} aria-label={said}
          value={v.answer ?? ""} maxLength={120} disabled={locked} autoComplete="off"
          onChange={ev => set(seq, q, { answer: ev.target.value })} error={wrong ? "This one is needed." : undefined} />;
        return <div key={q.id} className="stack" style={{ gap: "var(--space-2)" }}>
          <Input id={`${fid}-name`} label={q.label} optional={!q.required} placeholder="Their name" aria-label={`${said}: name`}
            value={v.name ?? ""} maxLength={80} disabled={locked} autoComplete="off" autoCapitalize="words"
            onChange={ev => set(seq, q, { name: ev.target.value })} />
          <Input id={`${fid}-phone`} placeholder="Their phone number" aria-label={`${said}: phone number`} type="tel" inputMode="tel"
            value={v.phone ?? ""} maxLength={20} disabled={locked} autoComplete="off"
            onChange={ev => set(seq, q, { phone: ev.target.value.replace(/[^0-9+ ()-]/g, "") })}
            error={wrong ? "Add their name and a phone number." : undefined}
            hint="Only pacr can see this, and only if something goes wrong at the event. The host can’t." />
        </div>;
      })}
    </div>)}
    {!data.open ? <FieldMessage tone="warning">The event has started, so these can&apos;t be changed now.</FieldMessage> : null}
    {err ? <FieldMessage tone="error">{err}</FieldMessage> : null}
    {data.open ? <Button block size="lg" type="submit" loading={busy}>{cta}</Button> : null}
  </form>;
}

/** The questions in a sheet of their own: after a free booking, or to change answers later. */
export function SeatQuestionsSheet({ orderId, cta = "Save", request = false, onClose, onDone }: {
  orderId: string | null; cta?: string;
  /** For a request waiting on the host (see SeatQuestions). */
  request?: boolean;
  onClose: () => void; onDone: () => void;
}) {
  return <BottomSheet open={!!orderId} onClose={onClose} title="A few details">
    {orderId ? <SeatQuestions key={orderId} orderId={orderId} cta={cta} request={request} onDone={onDone} /> : null}
  </BottomSheet>;
}
