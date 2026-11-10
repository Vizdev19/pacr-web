"use client";

import type { CSSProperties } from "react";
import { Badge, DateTile, EmptyState, GlassCard, Icon, StatusTag } from "@/components/ds";
import { Meta, kMuted, kStrong } from "@/components/shell/kit";
import { num, tile, time } from "@/lib/format";
import { distanceText } from "../runs/helpers";
import { addDays, dayNum, dowMon, hm, monthStart, WEEKDAYS, type CalItem } from "./dates";

const shortTime = (iso: string) => time(iso).replace(":00", "").replace(" ", "");
const isDraft = (it: CalItem) => it.event?.status === "draft";
const isCancelled = (it: CalItem) => it.event?.status === "cancelled";

function Chip({ it, onOpen }: { it: CalItem; onOpen: (it: CalItem) => void }) {
  const ev = it.kind === "event";
  const faded = isCancelled(it);
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onOpen(it); }} title={it.title}
      style={{
        display: "flex", alignItems: "center", gap: 5, width: "100%", minWidth: 0, height: 22, padding: "0 7px",
        border: `1px ${isDraft(it) ? "dashed" : "solid"} ${ev ? "var(--ink-900)" : "var(--border-default)"}`, borderRadius: ev ? 3 : 999,
        background: ev ? "var(--hatch-dark),#fff" : "#fff", cursor: "pointer", font: "400 11px/1 var(--font-sans)",
        color: faded ? "var(--text-subtle)" : "var(--text-strong)", textDecoration: faded ? "line-through" : "none",
      }}>
      <Icon name={ev ? "ticket" : it.repeating ? "repeat" : "footprints"} size={11} />
      <span style={{ flex: "none", color: "var(--text-muted)" }}>{shortTime(it.at)}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
    </button>
  );
}

export function MonthGrid({ month, today, items, phone, onOpen }: {
  month: string; today: string; items: CalItem[]; phone: boolean; onOpen: (it: CalItem) => void;
}) {
  const first = monthStart(month);
  const start = addDays(first, -dowMon(first));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const byDay = new Map<string, CalItem[]>();
  for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);
  return (
    <GlassCard padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", borderBottom: "1px solid var(--border-subtle)" }}>
        {WEEKDAYS.map(d => <div key={d} style={{ padding: "10px 10px", font: "400 12px var(--font-sans)", color: "var(--text-muted)" }}>{phone ? d[0] : d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}>
        {cells.map((c, i) => {
          const inMonth = c.slice(0, 7) === first.slice(0, 7);
          const its = byDay.get(c) ?? [];
          const isToday = c === today;
          return (
            <div key={c} style={{ minHeight: phone ? 54 : 104, padding: 6, borderRight: i % 7 < 6 ? "1px solid var(--border-subtle)" : 0, borderBottom: "1px solid var(--border-subtle)", background: inMonth ? "#fff" : "var(--surface-locked)", display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ alignSelf: "flex-start", minWidth: 22, height: 22, padding: "0 6px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6, font: "500 12px var(--font-sans)", background: isToday ? "var(--ink-900)" : "transparent", color: isToday ? "#fff" : inMonth ? "var(--text-strong)" : "var(--text-subtle)" }}>{dayNum(c)}</span>
              {phone ? (
                <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  {its.map(it => (
                    <button key={it.key} type="button" aria-label={it.title} onClick={() => onOpen(it)} style={{ padding: 3, border: 0, background: "none", cursor: "pointer" }}>
                      <span style={{ display: "block", width: 7, height: 7, borderRadius: it.kind === "event" ? 1 : 4, background: it.kind === "event" ? "var(--ink-900)" : "transparent", border: `1.5px ${isDraft(it) ? "dashed" : "solid"} var(--ink-900)` }} />
                    </button>
                  ))}
                </div>
              ) : its.map(it => <Chip key={it.key} it={it} onOpen={onOpen} />)}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

const H = 44;
export function WeekGrid({ weekStart, today, items, onOpen }: { weekStart: string; today: string; items: CalItem[]; onOpen: (it: CalItem) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = items.map(it => hm(it.at).h);
  const from = Math.min(5, ...hours), to = Math.max(21, ...hours);
  const rows = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const label = (h: number) => (h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`);
  return (
    <GlassCard padding={0} style={{ overflow: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, minmax(110px,1fr))", minWidth: 820 }}>
        <div />
        {days.map((d, i) => (
          <div key={d} style={{ padding: "10px 8px", borderLeft: "1px solid var(--border-subtle)", font: "400 12px var(--font-sans)", color: "var(--text-muted)" }}>
            {WEEKDAYS[i]} <span style={{ font: "500 15px var(--font-sans)", color: d === today ? "#fff" : "var(--text-strong)", background: d === today ? "var(--ink-900)" : "none", borderRadius: 6, padding: d === today ? "1px 6px" : 0 }}>{dayNum(d)}</span>
          </div>
        ))}
        <div>{rows.map(h => <div key={h} style={{ height: H, borderTop: "1px solid var(--border-subtle)", font: "400 11px var(--font-sans)", color: "var(--text-subtle)", padding: "4px 8px", textAlign: "right" }}>{label(h)}</div>)}</div>
        {days.map(d => (
          <div key={d} style={{ position: "relative", borderLeft: "1px solid var(--border-subtle)", background: d === today ? "var(--surface-selected)" : "#fff" }}>
            {rows.map(h => <div key={h} style={{ height: H, borderTop: "1px solid var(--border-subtle)" }} />)}
            {items.filter(it => it.day === d).map(it => {
              const { h, m } = hm(it.at);
              const ev = it.kind === "event";
              const style: CSSProperties = {
                position: "absolute", left: 4, right: 4, top: (h - from) * H + (m / 60) * H + 2, height: H * 1.3, padding: "6px 8px", textAlign: "left", overflow: "hidden", cursor: "pointer",
                border: `1px ${isDraft(it) ? "dashed" : "solid"} ${ev ? "var(--ink-900)" : "var(--border-strong)"}`, borderRadius: ev ? 4 : 10,
                background: ev ? "var(--hatch-dark),#fff" : "var(--fill-lime)",
              };
              return (
                <button key={it.key} type="button" onClick={() => onOpen(it)} style={style}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, font: "500 11px/1.2 var(--font-sans)", color: "var(--ink-900)" }}>
                    <Icon name={ev ? "ticket" : it.repeating ? "repeat" : "footprints"} size={11} />{time(it.at)}
                  </div>
                  <div style={{ font: "400 12px/1.25 var(--font-sans)", color: "var(--ink-900)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

export function ListView({ items, label, onOpen }: { items: CalItem[]; label: string; onOpen: (it: CalItem) => void }) {
  if (items.length === 0) return <EmptyState icon="calendar" title={`Nothing scheduled in ${label}`} message="Runs and events you schedule appear here." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(it => {
        const t = tile(it.at);
        const r = it.run, e = it.event;
        const dist = r ? distanceText(r) : null;
        const place = r ? r.meeting_point : e?.place_name;
        return (
          <GlassCard key={it.key} interactive padding={12} role="button" tabIndex={0} onClick={() => onOpen(it)}
            onKeyDown={ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(it); } }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <DateTile day={t.day} date={t.date} month={t.month} kind={it.kind} size="sm" />
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={kStrong}>{it.title}</span>
                  {it.repeating ? <Badge tone="neutral" icon="repeat">Every week</Badge> : null}
                  {e && (e.status === "draft" || e.status === "cancelled") ? <StatusTag status={e.status === "draft" ? "Draft" : "Cancelled"} /> : null}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 5, flexWrap: "wrap" }}>
                  <Meta icon="clock">{time(it.at)}</Meta>
                  <Meta icon="map-pin">{place || (r ? "No meeting place" : "Place to be confirmed")}</Meta>
                  {dist ? <Meta icon="route">{dist}</Meta> : null}
                </div>
              </div>
              <span style={{ ...kMuted, whiteSpace: "nowrap" }}>
                {r ? (it.projected ? "" : `${r.going_count} going`) : e ? (e.capacity != null ? `${num(e.sold)} / ${num(e.capacity)} sold` : `${num(e.sold)} sold`) : ""}
              </span>
              <Icon name="chevron-right" size={16} color="var(--text-muted)" />
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

export function Legend() {
  const swatch: CSSProperties = { width: 18, height: 12 };
  return (
    <div style={{ display: "flex", gap: 14, ...kMuted }}>
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span style={{ ...swatch, borderRadius: 999, border: "1px solid var(--border-strong)" }} />Squad run</span>
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span style={{ ...swatch, borderRadius: 2, border: "1px solid var(--ink-900)", background: "var(--hatch-dark),#fff" }} />Event</span>
    </div>
  );
}

