"use client";

// The event page's own sections, which the older web editor (/host/e/<ref>)
// edited and the pacr app's form doesn't: race details, the event-day
// timeline, the course (a map and a few facts), good to know, and what's
// included. Each is optional; the database's limits are in lib/eventEditor.ts.

import { Button, IconButton, Input, Select } from "@/components/ds";
import { kMuted } from "@/components/shell/kit";
import {
  DETAIL_MAX, SURFACES, newKey,
  type Check, type EventDetails, type FactRow, type FaqRow, type ScheduleRow, type Surface,
} from "@/lib/eventEditor";
import { Area, eBox, eErr, eRow, Section, SwitchRow } from "./parts";
import { PosterField } from "./PosterField";

type Props = {
  details: EventDetails;
  set: (p: Partial<EventDetails>) => void;
  check: Check;
  show: boolean;
};

export function RaceDetails({ details: d, set, check, show }: Props) {
  return (
    <Section title="Race details" note="Optional. The distances and surface also come from the tags: 5K adds 5 km, Trail sets trail.">
      <div style={eRow}>
        <Select label="Surface" value={d.surface} onChange={v => set({ surface: v as Surface, tagSurface: false })} style={{ flex: "1 1 180px" }}
          options={SURFACES.map(s => ({ value: s.value, label: s.label }))} />
        <Input label="Terrain" value={d.terrain} maxLength={40} placeholder="Flat road · +410 m climb" style={{ flex: "2 1 240px" }}
          onChange={e => set({ terrain: e.target.value })} />
      </div>
      <Input label="Distances in km" value={d.distances} placeholder="5, 10, 21.1" autoComplete="off"
        error={show ? check.details.distances : undefined} hint="Up to 6, separated by commas."
        onChange={e => set({ distances: e.target.value.slice(0, 60) })} />
      <SwitchRow label="Chip timed" checked={d.timed} onChange={on => set({ timed: on })} />
    </Section>
  );
}

/** A list of rows, each a few fields, with a remove button and an add button up to `max`. */
function Rows<T extends { key: string }>({ rows, max, fields, blank, onChange, addLabel, error }: {
  rows: T[];
  max: number;
  fields: { k: keyof T & string; label: string; max: number; placeholder: string; area?: boolean; flex?: string }[];
  blank: () => T;
  onChange: (rows: T[]) => void;
  addLabel: string;
  error?: string;
}) {
  const setRow = (key: string, p: Partial<T>) => onChange(rows.map(r => (r.key === key ? { ...r, ...p } : r)));
  return (
    <>
      {rows.map((r, i) => (
        <div key={r.key} style={{ ...eBox, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ ...eRow, flex: 1, minWidth: 0 }}>
            {fields.map(f => f.area ? (
              <div key={f.k} style={{ flex: "1 1 100%" }}>
                <Area label={f.label} value={String(r[f.k] ?? "")} max={f.max} rows={2} placeholder={f.placeholder}
                  onChange={v => setRow(r.key, { [f.k]: v } as Partial<T>)} />
              </div>
            ) : (
              <Input key={f.k} label={f.label} value={String(r[f.k] ?? "")} maxLength={f.max} placeholder={f.placeholder}
                style={{ flex: f.flex ?? "1 1 160px" }} onChange={e => setRow(r.key, { [f.k]: e.target.value } as Partial<T>)} />
            ))}
          </div>
          <IconButton icon="trash-2" label={`Remove row ${i + 1}`} variant="ghost" size="sm" style={{ marginTop: 22 }}
            onClick={() => onChange(rows.filter(x => x.key !== r.key))} />
        </div>
      ))}
      {error ? <span style={eErr}>{error}</span> : null}
      {rows.length < max ? (
        <div><Button variant="secondary" size="sm" icon="plus" onClick={() => onChange([...rows, blank()])}>{addLabel}</Button></div>
      ) : <span style={kMuted}>That’s the most this section holds.</span>}
    </>
  );
}

export function EventDay({ details: d, set, check, show }: Props) {
  return (
    <Section title="Event day" right={<span style={kMuted}>{d.schedule.length} of {DETAIL_MAX.schedule}</span>}
      note="Optional. The timeline runners see: bib pickup, bag drop, the start, when the course closes.">
      <Rows<ScheduleRow> rows={d.schedule} max={DETAIL_MAX.schedule} addLabel="Add a step"
        error={show ? check.details.schedule : undefined}
        blank={() => ({ key: newKey(), time: "", label: "", note: "" })} onChange={schedule => set({ schedule })}
        fields={[
          { k: "time", label: "Time", max: 20, placeholder: "6:15 am", flex: "0 1 130px" },
          { k: "label", label: "What happens", max: 60, placeholder: "Bib pickup opens", flex: "1 1 220px" },
          { k: "note", label: "Note", max: 160, placeholder: "Bandstand tent. Bring your ticket QR.", flex: "2 1 260px" },
        ]} />
    </Section>
  );
}

export function Course({ details: d, set, check, show, onRefuse }: Props & { onRefuse: (title: string, body: string) => void }) {
  return (
    <Section title="Course" right={<span style={kMuted}>{d.course.length} of {DETAIL_MAX.course} facts</span>}
      note="Optional. A course map, and a few facts: elevation, loops, aid stations.">
      <PosterField kind="course" cover={d.courseMap} onChange={courseMap => set({ courseMap })} onRefuse={onRefuse} />
      <Rows<FactRow> rows={d.course} max={DETAIL_MAX.course} addLabel="Add a fact"
        error={show ? check.details.course : undefined}
        blank={() => ({ key: newKey(), label: "", value: "" })} onChange={course => set({ course })}
        fields={[
          { k: "label", label: "Fact", max: 20, placeholder: "Elevation" },
          { k: "value", label: "Value", max: 30, placeholder: "+38 m" },
        ]} />
    </Section>
  );
}

export function GoodToKnow({ details: d, set, check, show }: Props) {
  return (
    <Section title="Good to know" right={<span style={kMuted}>{d.faq.length} of {DETAIL_MAX.faq}</span>}
      note="Optional. Questions runners ask: parking, bag drop, pacers.">
      <Rows<FaqRow> rows={d.faq} max={DETAIL_MAX.faq} addLabel="Add a question"
        error={show ? check.details.faq : undefined}
        blank={() => ({ key: newKey(), q: "", a: "" })} onChange={faq => set({ faq })}
        fields={[
          { k: "q", label: "Question", max: 80, placeholder: "Where do I park?", flex: "1 1 100%" },
          { k: "a", label: "Answer", max: 500, placeholder: "Free parking at Gate 3 until 6 am.", area: true },
        ]} />
    </Section>
  );
}

export function Included({ details: d, set, check, show }: Props) {
  return (
    <Section title="What’s included" note="Optional. One per line, up to 12, each up to 30 characters.">
      <Area label="Included" value={d.included} max={12 * 31} rows={4} placeholder={"Chip timing\nFinisher medal\nAid at 3 and 7 km"}
        hint={`${d.included.split("\n").filter(l => l.trim()).length} of ${DETAIL_MAX.included} lines`} onChange={included => set({ included })} />
      {show && check.details.included ? <span style={eErr}>{check.details.included}</span> : null}
    </Section>
  );
}
