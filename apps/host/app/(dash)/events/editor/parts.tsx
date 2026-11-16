"use client";

// The small pieces the event editor's sections share: a titled card, a date
// and time pair read in the event's zone, a counted text area, a switch with
// a line under it.

import { useId, type CSSProperties, type ReactNode } from "react";
import { GlassCard, Input, Switch } from "@/components/ds";
import { kMuted, kTextarea } from "@/components/shell/kit";
import { instantOf, wallOf, type Wall } from "@/lib/eventZone";

export const eBox: CSSProperties = { border: "1px solid var(--border-subtle)", borderRadius: 12, padding: 14, background: "var(--surface-panel)" };
export const eRow: CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" };
export const eErr: CSSProperties = { font: "var(--type-caption)", color: "var(--danger-text)" };

export function Section({ title, note, right, children }: { title: string; note?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <GlassCard title={title} subtitle={note} actions={right}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </GlassCard>
  );
}

/** A date and a time of day, as a clock at the event reads them. */
export function WhenInput({ label, value, onChange, error, hint, disabled }: {
  label: string; value: Wall; onChange: (w: Wall) => void; error?: string; hint?: string; disabled?: boolean;
}) {
  return (
    <div className="pc-field" style={{ flex: "1 1 260px" }}>
      <span className="pc-label">{label}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <Input type="date" aria-label={`${label}: date`} value={value.date} disabled={disabled} aria-invalid={!!error || undefined}
          onChange={e => onChange({ ...value, date: e.target.value })} style={{ flex: "1 1 150px" }} />
        <Input type="time" aria-label={`${label}: time`} value={value.time} disabled={disabled} aria-invalid={!!error || undefined}
          onChange={e => onChange({ ...value, time: e.target.value })} style={{ flex: "0 1 130px" }} />
      </div>
      {error ? <span className="pc-hint pc-hint--error">{error}</span> : hint ? <span className="pc-hint">{hint}</span> : null}
    </div>
  );
}

/** A multi-line field with its label and a count. */
export function Area({ label, value, onChange, max, rows = 4, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; max: number; rows?: number; placeholder?: string; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="pc-field">
      <label className="pc-label" htmlFor={id}>{label}</label>
      <textarea id={id} rows={rows} maxLength={max} style={kTextarea} value={value} disabled={disabled} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} />
      <span className="pc-hint">{value.length.toLocaleString("en-IN")} / {max.toLocaleString("en-IN")}</span>
    </div>
  );
}

/** A switch with what it does on a line under its name. */
export function SwitchRow({ label, sub, checked, onChange, disabled }: {
  label: string; sub?: ReactNode; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, opacity: disabled ? 0.55 : 1 }}>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
      {sub ? <span style={{ ...kMuted, paddingLeft: 46 }}>{sub}</span> : null}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
/** The calendar day `days` before (or after) a wall date, at `time`. */
export function shiftDay(w: Wall, days: number, time: string): Wall {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w.date);
  if (!m) return { date: w.date, time };
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time };
}
/** `w` moved by `ms`, read in `zone` (null when it can't be read). */
export function shiftWall(w: Wall | null, ms: number, zone: string): Wall | null {
  const at = instantOf(w, zone);
  return at ? wallOf(new Date(at.getTime() + ms), zone) : w;
}
