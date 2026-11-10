"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, GlassCard, Icon, IconButton, SegmentedControl, Skeleton } from "@/components/ds";
import { LoadError, Toolbar, kMuted, kStrong } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { time, ymd } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { encodeRef } from "@/lib/refs";
import { distanceText, weekdayLong } from "../runs/helpers";
import { addDays, addMonths, itemsBetween, monthLabel, monthStart, weekLabel, weekStartOf, type CalItem } from "./dates";
import { ItemDrawer } from "./ItemDrawer";
import { Legend, ListView, MonthGrid, WeekGrid } from "./Views";

type View = "Month" | "Week" | "List";

export default function Calendar() {
  const { host } = useHost();
  const router = useRouter();
  const { phone } = useViewport();
  const squad = host.kind === "squad";
  const [pick, setPick] = useState<View | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [open, setOpen] = useState<CalItem | null>(null);
  const view: View = pick ?? (phone ? "List" : "Month");

  useEffect(() => {
    const raf = requestAnimationFrame(() => setToday(ymd(new Date())));
    return () => cancelAnimationFrame(raf);
  }, []);

  const cal = useLoad(async () => {
    const [runs, all] = await Promise.all([squad ? api.listRuns(host.id, 60) : Promise.resolve([] as api.SquadRun[]), api.hostedEvents(true)]);
    return { runs, events: all.filter(e => e.host?.kind === host.kind && e.host?.id === host.id) };
  }, `cal:${host.key}`);

  const day = anchor ?? today;
  const range = useMemo(() => {
    if (!day) return null;
    if (view === "Week") { const s = weekStartOf(day); return { from: s, to: addDays(s, 6) }; }
    const first = monthStart(day);
    const gs = addDays(first, -((new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7));
    return { from: gs, to: addDays(gs, 41) };
  }, [day, view]);
  const items = useMemo(() => (cal.data && range ? itemsBetween(cal.data.runs, cal.data.events, range.from, range.to) : []), [cal.data, range]);

  const step = (n: number) => {
    if (!day) return;
    setAnchor(view === "Week" ? addDays(day, 7 * n) : addMonths(day, n));
  };
  const label = !day ? "" : view === "Week" ? weekLabel(weekStartOf(day)) : monthLabel(day);
  // List shows only the displayed month; the month grid also reaches into its neighbours.
  const listItems = day ? items.filter(it => it.day.slice(0, 7) === day.slice(0, 7)) : [];

  const repeating = (cal.data?.runs ?? []).filter(r => r.repeat_weekly);

  return (
    <div>
      <Toolbar>
        <SegmentedControl options={["Month", "Week", "List"]} value={view} onChange={v => setPick(v as View)} />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <IconButton icon="chevron-left" label="Previous" variant="secondary" size="sm" onClick={() => step(-1)} />
          <span style={{ font: "500 15px var(--font-sans)", color: "var(--text-strong)", padding: "0 8px" }}>{label}</span>
          <IconButton icon="chevron-right" label="Next" variant="secondary" size="sm" onClick={() => step(1)} />
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAnchor(null)}>Today</Button>
        <div style={{ flex: 1 }} />
        {!phone ? <Legend /> : null}
      </Toolbar>

      <div style={{ display: "grid", gridTemplateColumns: phone || !squad ? "minmax(0,1fr)" : "minmax(0,1fr) 280px", gap: 12, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          {cal.status === "error" ? <LoadError what="the calendar" error={cal.error} onRetry={cal.reload} /> : cal.status === "loading" || !day || !today ? (
            <Skeleton height={view === "List" ? 320 : 560} radius={16} />
          ) : view === "Month" ? (
            <MonthGrid month={day} today={today} items={items} phone={phone} onOpen={setOpen} />
          ) : view === "Week" ? (
            <WeekGrid weekStart={weekStartOf(day)} today={today} items={items} onOpen={setOpen} />
          ) : (
            <ListView items={listItems} label={label} onOpen={setOpen} />
          )}
        </div>
        {squad ? (
          <GlassCard title="Repeating runs" subtitle="Weekly runs fill the calendar"
            actions={<IconButton icon="plus" label="Schedule a run" variant="secondary" size="sm" onClick={() => router.push("/runs?new=1")} />}>
            {cal.status === "loading" ? <Skeleton lines={3} height={40} gap={10} /> : repeating.length === 0 ? (
              <EmptyState compact boxed={false} icon="repeat" message="No repeating runs yet. Turn on “Repeat every week” when you schedule one." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {repeating.map(r => {
                  const ref = encodeRef(r.id);
                  const dist = distanceText(r);
                  return (
                    <div key={r.id} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border-default)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, ...kStrong }}><Icon name="repeat" size={14} />{r.title}</div>
                      <div style={{ font: "400 12px/1.45 var(--font-sans)", color: "var(--text-body)", marginTop: 6 }}>
                        Every {weekdayLong(r.event_at).slice(0, 3)} {time(r.event_at)}{r.meeting_point ? ` · ${r.meeting_point}` : ""}{dist ? ` · ${dist}` : ""}
                      </div>
                      {ref ? <div style={{ marginTop: 10 }}><Button size="sm" variant="secondary" onClick={() => router.push(`/runs?run=${ref}`)}>Open run</Button></div> : null}
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        ) : null}
      </div>
      <p style={{ ...kMuted, marginTop: 10, display: squad ? "block" : "none" }}>Past runs aren’t kept, so earlier days show events only.</p>

      {open ? <ItemDrawer item={open} onClose={() => setOpen(null)} onChanged={cal.reload} /> : null}
    </div>
  );
}
