"use client";
// /runs/<city>: ui_kits/website/Directory.jsx (RunsWeekPage) on real data —
// every public squad run in the city for the next 7 days, grouped by day.
import { useMemo, useState } from "react";
import { RunCard, WeekList } from "@/components/ds/content";
import { EmptyState } from "@/components/ds/feedback";
import { ChipSelect } from "@/components/ds/forms";
import { runCard } from "@/lib/cards";
import { dayLine, istParts, TZ } from "@/lib/format";
import type { RunRow } from "@/lib/types";

const FILTERS = [{ id: "am", label: "Mornings", icon: "sunrise" }, { id: "eve", label: "Evenings", icon: "moon" }, { id: "women", label: "Women only" }, { id: "verified", label: "Verified" }, { id: "open", label: "Open to join" }];

function hourIST(iso: string) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date(iso)));
}

export function RunsWeek({ city, cityName, runs, now }: { city: string; cityName: string; runs: RunRow[]; now: number }) {
  const [f, setF] = useState<string[]>([]);
  const days = useMemo(() => {
    const out: { ymd: string; label: string; note?: string }[] = [];
    // 7 × 24 h from now touches 8 calendar days.
    for (let i = 0; i < 8; i++) {
      const d = new Date(now + i * 86400000);
      out.push({ ymd: istParts(d).ymd, label: dayLine(d), note: i === 0 ? "Today" : i === 1 ? "Tomorrow" : undefined });
    }
    return out;
  }, [now]);
  const list = runs.filter(r =>
    (!f.includes("am") || hourIST(r.starts_at) < 11) && (!f.includes("eve") || hourIST(r.starts_at) >= 16) &&
    (!f.includes("women") || r.women_only) && (!f.includes("verified") || r.squad_verified) && (!f.includes("open") || r.squad_join_policy === "open"));

  return <div className="pw-container pw-page" style={{ maxWidth: 860 }}>
    <h1 className="t-h1">Runs this week in {cityName}</h1>
    <p className="t-secondary" style={{ margin: "8px 0 20px" }}>Every public squad run for the next 7 days. Pick one to see the meeting point and RSVP in the app.</p>
    <ChipSelect scroll value={f} onChange={setF} options={FILTERS} label="Filters" />
    <div style={{ marginTop: 20 }}>
      {list.length
        // Only days with runs: with a handful of squads, a row per empty day is mostly blank.
        ? <WeekList days={days.map(d => ({ label: d.label, note: d.note, items: list.filter(r => istParts(r.starts_at).ymd === d.ymd).map(r => <RunCard key={r.run_ref + r.starts_at} {...runCard(r)} />) })).filter(d => d.items.length)} />
        : runs.length
          ? <EmptyState boxed icon="search-x" title="No runs match those filters." action="Clear filters" onAction={() => setF([])} />
          : <EmptyState boxed title={`No runs in ${cityName} this week.`} body="Squads post their group runs here as they schedule them." action={`See squads in ${cityName}`} href={`/clubs/${city}`} />}
    </div>
  </div>;
}
