"use client";
// /events/<city>: ui_kits/website/Directory.jsx (EventsPage) on city_events.
import { useState } from "react";
import { EventCard } from "@/components/ds/content";
import { EmptyState } from "@/components/ds/feedback";
import { ChipSelect } from "@/components/ds/forms";
import { SegmentedControl, Tabs } from "@/components/ds/nav";
import { eventCard } from "@/lib/cards";
import { istParts } from "@/lib/format";
import type { EventRow } from "@/lib/types";

const TYPES = [{ id: "all", label: "All" }, { id: "run", label: "Runs" }, { id: "race", label: "Races" }, { id: "workshop", label: "Workshops" }, { id: "social", label: "Socials" }];

/** The coming Saturday and Sunday in IST, as YYYY-MM-DD (just Sunday on a Sunday). */
function weekendDays(now: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now + i * 86400000);
    const p = istParts(d);
    if (i > 0 && p.dow === "Mon") break;
    if (p.dow === "Sat" || p.dow === "Sun") out.add(p.ymd);
  }
  return out;
}

export function Events({ city, cityName, events, now }: { city: string; cityName: string; events: EventRow[]; now: number }) {
  const [type, setType] = useState("all");
  const [when, setWhen] = useState("all");
  const [price, setPrice] = useState<string[]>([]);
  const month = now + 31 * 86400000;
  const weekend = weekendDays(now);
  const list = events.filter(e =>
    (type === "all" || e.kind === type) &&
    (when === "all" || (when === "month" ? new Date(e.starts_at).getTime() <= month : weekend.has(istParts(e.starts_at).ymd))) &&
    (!price.includes("free") || !e.is_paid) && (!price.includes("paid") || e.is_paid));
  const filtered = type !== "all" || when !== "all" || price.length > 0;

  return <div className="pw-container pw-page">
    <h1 className="t-h1">Events in {cityName}</h1>
    {events.length ? <div className="row" style={{ justifyContent: "space-between", margin: "20px 0 24px", gap: 12 }}>
      <Tabs variant="pill" value={type} onChange={setType} tabs={TYPES} />
      <div className="row"><SegmentedControl size="sm" value={when} onChange={setWhen} label="When" options={[{ id: "weekend", label: "This weekend" }, { id: "month", label: "This month" }, { id: "all", label: "All" }]} /><ChipSelect value={price} onChange={setPrice} options={[{ id: "free", label: "Free" }, { id: "paid", label: "Paid" }]} label="Price" /></div>
    </div> : <p className="t-secondary" style={{ margin: "8px 0 24px" }}>Races, group runs, workshops and socials from verified squads and organisers.</p>}
    {list.length
      ? <div className="grid-posters">{list.map(e => { const c = eventCard(e); return <EventCard key={c.href} {...c} />; })}</div>
      : filtered
        ? <EmptyState boxed icon="calendar-x" title="No events like that." action="Show all events" onAction={() => { setType("all"); setWhen("all"); setPrice([]); }} />
        : <EmptyState boxed icon="calendar-x" title={`No events in ${cityName} yet.`} body="Verified squads and organisers list their races and runs here, with tickets in the app." action={`See squads in ${cityName}`} href={`/clubs/${city}`} />}
  </div>;
}
