"use client";
// /clubs/<city>: ui_kits/website/Directory.jsx (DirectoryPage) on real data.
// The first page is rendered on the server; search, filters and "Load more"
// call directory_clubs from the browser, as anon or as the signed-in runner.
import { useEffect, useRef, useState } from "react";
import { SquadCard } from "@/components/ds/content";
import { EmptyState, Skeleton } from "@/components/ds/feedback";
import { ChipSelect, SearchInput } from "@/components/ds/forms";
import { Breadcrumbs, LoadMore } from "@/components/ds/nav";
import { squadCard } from "@/lib/cards";
import { getSupabase } from "@/lib/supabase";
import type { DirectoryRow } from "@/lib/types";

const PAGE = 24;
const FILTERS = [
  { id: "sat", label: "Saturday" }, { id: "sun", label: "Sunday" }, { id: "am", label: "Mornings", icon: "sunrise" },
  { id: "eve", label: "Evenings", icon: "moon" }, { id: "women", label: "Women only" }, { id: "verified", label: "Verified" },
  { id: "open", label: "Open to join" },
];

function args(city: string, q: string, f: string[], offset: number) {
  const days = [f.includes("sat") && 6, f.includes("sun") && 7].filter(Boolean) as number[];
  const times = [...(f.includes("am") ? ["early", "morning"] : []), ...(f.includes("eve") ? ["evening"] : [])];
  return {
    p_city: city, p_query: q.trim() || null, p_days: days.length ? days : null, p_times: times.length ? times : null,
    p_tz: "Asia/Kolkata", p_women_only: f.includes("women"), p_verified_only: f.includes("verified"), p_open_only: f.includes("open"),
    p_limit: PAGE, p_offset: offset,
  };
}

export function Directory({ city, cityName, initial, initialQuery, otherCities }:
  { city: string; cityName: string; initial: DirectoryRow[]; initialQuery: string; otherCities: { id: string; name: string; squads: number }[] }) {
  const [q, setQ] = useState(initialQuery);
  const [f, setF] = useState<string[]>([]);
  const [rows, setRows] = useState(initial);
  const [total, setTotal] = useState(initial[0]?.total ?? 0);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    let alive = true;
    setLoading(true); setFailed(false);
    const t = setTimeout(async () => {
      const { data, error } = await getSupabase().rpc("directory_clubs", args(city, q, f, 0));
      if (!alive) return;
      setLoading(false);
      if (error) { setFailed(true); return; }
      const list = (data ?? []) as DirectoryRow[];
      setRows(list); setTotal(list[0]?.total ?? 0);
    }, q ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [city, q, f]);

  const loadMore = async () => {
    setMore(true);
    const { data } = await getSupabase().rpc("directory_clubs", args(city, q, f, rows.length));
    setMore(false);
    setRows(r => [...r, ...((data ?? []) as DirectoryRow[])]);
  };

  const filtered = q.trim() !== "" || f.length > 0;
  const nearest = otherCities.filter(c => c.id !== city && c.squads > 0).slice(0, 1)[0];
  const lead = total
    ? `${total} squad${total === 1 ? "" : "s"} post${total === 1 ? "s" : ""} their weekly runs on pacr. Join one and run with them this week.`
    : `No squads in ${cityName} yet.`;

  return <div className="pw-container pw-page">
    <Breadcrumbs items={[{ label: "Squads", href: "/clubs" }, { label: cityName }]} />
    <div className="sec-h" style={{ marginTop: 16 }}><div><h1 className="t-h1">Running clubs in {cityName}</h1><p>{filtered && total ? `${total} ${total === 1 ? "squad matches" : "squads match"}.` : lead}</p></div></div>
    <div className="stack" style={{ gap: 14, marginBottom: 24 }}>
      <div style={{ maxWidth: 520 }}><SearchInput placeholder="Search squads or areas" value={q} onChange={setQ} /></div>
      <ChipSelect scroll value={f} onChange={setF} options={FILTERS} label="Filters" />
    </div>
    {loading ? <div className="grid-cards">{[0, 1, 2].map(i => <Skeleton key={i} variant="squad" />)}</div>
      : failed ? <EmptyState boxed icon="circle-alert" title="Squads didn't load." body="Check your connection and try again." action="Try again" onAction={() => setF([...f])} />
      : !rows.length ? (filtered
        ? <EmptyState boxed icon="search-x" title="No squads match those filters." action="Clear filters" onAction={() => { setF([]); setQ(""); }} />
        : <EmptyState boxed icon="search-x" title={`No squads in ${cityName} yet.`} body="Squads appear here once an organiser makes theirs public in the app." action={nearest ? `See squads in ${nearest.name}` : undefined} href={nearest ? `/clubs/${nearest.id}` : undefined} />)
      : <>
        <div className="grid-cards">{rows.map(r => <SquadCard key={r.slug} {...squadCard(r, cityName)} />)}</div>
        {rows.length < total ? <div style={{ marginTop: 24 }}><LoadMore onClick={loadMore} loading={more} /></div> : null}
      </>}
  </div>;
}
