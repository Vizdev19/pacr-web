"use client";

// Registration questions: what the host asks for each ticket when a runner
// books (pacr 20270125120000). Up to six: a choice, a line of text, or an
// emergency contact, each required or not. A question may not ask for a phone
// number, an email or a handle (the database refuses it: contact_question);
// the emergency contact is the one place for a number, and pacr keeps it.

import { Badge, Button, IconButton, Input } from "@/components/ds";
import { kMuted } from "@/components/shell/kit";
import { MAX_QUESTIONS, QUESTION_PRESETS, newKey, optionsOf, questionBad, type EventForm, type QuestionDraft } from "@/lib/eventEditor";
import { eBox, eRow, Section, SwitchRow } from "./parts";

const KIND: Record<QuestionDraft["kind"], string> = { choice: "Pick one", text: "A short answer", emergency: "Emergency contact" };

export function Questions({ form, patch, show, available, started }: {
  form: EventForm;
  patch: (p: Partial<EventForm>) => void;
  show: boolean;
  /** false when this database has no registration questions yet; null while unknown. */
  available: boolean | null;
  /** The event has started: answers are closed, and so are the questions. */
  started: boolean;
}) {
  const qs = form.questions;
  if (available === false) {
    return (
      <Section title="Registration questions">
        <span style={kMuted}>Registration questions (a T-shirt size, a name for the bib, an emergency contact) aren’t switched on yet.</span>
      </Section>
    );
  }
  const set = (key: string, p: Partial<QuestionDraft>) => patch({ questions: qs.map(q => (q.key === key ? { ...q, ...p } : q)) });
  // One emergency contact, and one of each ready-made question, is plenty.
  const presets = QUESTION_PRESETS.filter(p => p.label === "" || !qs.some(q => q.label === p.label || (p.kind === "emergency" && q.kind === "emergency")));
  return (
    <Section title="Registration questions" right={<span style={kMuted}>{qs.length} of {MAX_QUESTIONS}</span>}
      note={started
        ? "The event has started, so the questions are as they are."
        : "Asked for each ticket when a runner books. Leave empty to ask nothing. Answering needs the latest pacr app: with a required question, runners on an older one can’t pay until they update."}>
      {qs.map(q => {
        const bad = show && questionBad(q);
        const n = optionsOf(q.options).length;
        return (
          <div key={q.key} style={{ ...eBox, ...(bad ? { borderColor: "var(--danger-text)" } : null) }}>
            <div style={{ ...eRow, alignItems: "center", marginBottom: 10 }}>
              <Badge tone="neutral">{KIND[q.kind]}</Badge>
              <div style={{ flex: 1 }} />
              <IconButton icon="trash-2" label={`Remove ${q.label.trim() || "this question"}`} variant="ghost" size="sm" disabled={started}
                onClick={() => patch({ questions: qs.filter(x => x.key !== q.key) })} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input label="Question" value={q.label} maxLength={60} placeholder="What do you want to ask?" disabled={started}
                error={bad && !q.label.trim() ? "Write the question." : undefined}
                onChange={e => set(q.key, { label: e.target.value })} />
              {q.kind === "choice" ? (
                <Input label="Options, separated by commas" value={q.options} maxLength={400} placeholder="S, M, L, XL" autoComplete="off" disabled={started}
                  error={bad && n < 2 ? "A choice needs at least two options." : undefined}
                  hint={n >= 2 ? `${n} options · up to 12, each up to 30 characters` : "Up to 12, each up to 30 characters"}
                  onChange={e => set(q.key, { options: e.target.value })} />
              ) : null}
              {q.kind === "emergency" ? (
                <span style={kMuted}>
                  Runners give a name and a phone number. You’ll see that each runner gave one, not the number: it’s someone else’s phone, so pacr
                  keeps it and reaches them if something goes wrong. Write to support@pacr.life on the day.
                </span>
              ) : null}
              <SwitchRow label="Required" checked={q.required} disabled={started} onChange={on => set(q.key, { required: on })} />
            </div>
          </div>
        );
      })}
      {!started && qs.length < MAX_QUESTIONS ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {presets.map(p => (
            <Button key={p.name} variant="secondary" size="sm" icon="plus"
              onClick={() => patch({ questions: [...qs, { key: newKey(), id: null, kind: p.kind, label: p.label, options: p.options, required: true }] })}>
              {p.name}
            </Button>
          ))}
        </div>
      ) : null}
      {!started ? (
        <span style={kMuted}>
          A question can’t ask for a phone number, an email or a handle: pacr doesn’t pass runners’ contact details to hosts.
          Once a runner has answered a question it can be reworded or given more options, not removed.
        </span>
      ) : null}
    </Section>
  );
}
