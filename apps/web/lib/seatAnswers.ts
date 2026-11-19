"use client";

// What the host asks for each seat of a booking (app repo:
// 20270125120000_event_registration.sql; the app's orderAnswers and
// saveOrderAnswers in src/services/events.ts).
//
//   my_event_order_answers   the booking's questions and the answers so far
//   set_event_order_answers  save them; answers how many required ones are missing
//
// A paid booking can't go to payment with a required answer missing (the
// server refuses it: answers_required). An emergency contact is read by pacr
// only, never by the host.
import { getSupabase } from "./supabase";

export type EventQuestion = {
  id: string;
  /** One of `options`; a short line of text; or an emergency contact (a name and a phone number). */
  kind: "choice" | "text" | "emergency";
  label: string; options: string[]; required: boolean;
};
/** One seat's answer: `answer` for a choice or text, `name` + `phone` for an emergency contact. */
export type SeatAnswer = { seq: number; questionId: string; answer: string | null; name: string | null; phone: string | null };

export type OrderAnswers = {
  qty: number; questions: EventQuestion[]; answers: SeatAnswer[]; missing: number;
  /** False once the event has started: answers can't be changed any more. */
  open: boolean;
};

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v) || 0;
const strOrNull = (v: unknown) => (typeof v === "string" ? v : null);

export async function orderAnswers(orderId: string): Promise<OrderAnswers | null> {
  const { data, error } = await getSupabase().rpc("my_event_order_answers", { p_order_id: orderId });
  if (error || !data) return null;
  const v = data as Row;
  return {
    qty: Math.max(1, num(v.qty)), missing: num(v.missing), open: !!v.open,
    questions: (Array.isArray(v.questions) ? (v.questions as Row[]) : [])
      .filter(q => q && typeof q.id === "string" && (q.kind === "choice" || q.kind === "text" || q.kind === "emergency"))
      .map(q => ({
        id: q.id as string, kind: q.kind as EventQuestion["kind"], label: String(q.label ?? ""), required: q.required !== false,
        options: Array.isArray(q.options) ? q.options.map(String) : [],
      })),
    answers: (Array.isArray(v.answers) ? (v.answers as Row[]) : []).map(a => ({
      seq: num(a.seq), questionId: String(a.question_id), answer: strOrNull(a.answer), name: strOrNull(a.name), phone: strOrNull(a.phone),
    })),
  };
}

export type SaveFail = "closed" | "expired" | "contact" | "blocked" | "error";

/** Save answers: how many required ones are still missing, or why it couldn't. */
export async function saveOrderAnswers(orderId: string, answers: SeatAnswer[]): Promise<number | SaveFail> {
  const { data, error } = await getSupabase().rpc("set_event_order_answers", {
    p_order_id: orderId,
    p_answers: answers.map(a => (a.name !== null || a.phone !== null
      ? { seq: a.seq, question_id: a.questionId, name: a.name ?? "", phone: a.phone ?? "" }
      : { seq: a.seq, question_id: a.questionId, answer: a.answer ?? "" })),
  });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("answers_closed")) return "closed";
    // The hold ran out, or the booking no longer stands.
    if (m.includes("hold_expired")) return "expired";
    // A phone number or an email in a typed answer: the host reads these, and doesn't get those.
    if (m.includes("contact_in_answer")) return "contact";
    if (m.includes("blocked_content")) return "blocked";
    return "error";
  }
  return num((data as Row | null)?.missing);
}

export function saveFailCopy(r: SaveFail): string {
  return r === "closed" ? "Answers can’t be changed once the event has started."
    : r === "expired" ? "Your spot was held for ten minutes and that ran out. Book again: what you answered is kept for an hour."
    : r === "contact" ? "Leave phone numbers and emails out of your answers. The host doesn’t get those."
    : r === "blocked" ? "One of your answers has words that aren’t allowed on pacr."
    : "Couldn’t save your answers. Check your connection and try again.";
}
