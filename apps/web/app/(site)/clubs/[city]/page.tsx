import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Directory } from "@/components/pages/Directory";
import { getCities, getCityRuns, getDirectory } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const c = (await getCities()).find(x => x.id === city);
  if (!c) return {};
  return {
    title: `Running clubs in ${c.name}`,
    description: `${c.squads ? `${c.squads} running squads` : "Running squads"} in ${c.name} on pacr. See where they meet and when they run, and join one near you.`,
    alternates: { canonical: `/clubs/${c.id}` },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ city }, { q }] = await Promise.all([params, searchParams]);
  const cities = await getCities();
  const c = cities.find(x => x.id === city);
  if (!c) notFound();
  const query = (q || "").slice(0, 60);
  // The week's runs (city_runs, as on /runs) give the honest "N running this week".
  const [rows, week] = await Promise.all([getDirectory(c.id, { query }), getCityRuns(c.id, 7).catch(() => [])]);
  const runningThisWeek = new Set(week.map(r => r.squad_slug)).size;
  return <Directory city={c.id} cityName={c.name} initial={rows} initialQuery={query} runningThisWeek={runningThisWeek}
    otherCities={[...cities].sort((a, b) => b.squads - a.squads).map(x => ({ id: x.id, name: x.name, squads: x.squads }))} />;
}
