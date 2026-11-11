import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Directory } from "@/components/pages/Directory";
import { getCities, getDirectory } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const c = (await getCities()).find(x => x.id === city);
  if (!c) return {};
  return {
    title: `Running clubs in ${c.name}`,
    description: `${c.squads ? `${c.squads} running squads` : "Running squads"} in ${c.name} post their weekly group runs on pacr. Find one near you and run with them this week.`,
    alternates: { canonical: `/clubs/${c.id}` },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ city }, { q }] = await Promise.all([params, searchParams]);
  const cities = await getCities();
  const c = cities.find(x => x.id === city);
  if (!c) notFound();
  const query = (q || "").slice(0, 60);
  const rows = await getDirectory(c.id, { query });
  return <Directory city={c.id} cityName={c.name} initial={rows} initialQuery={query}
    otherCities={[...cities].sort((a, b) => b.squads - a.squads).map(x => ({ id: x.id, name: x.name, squads: x.squads }))} />;
}
