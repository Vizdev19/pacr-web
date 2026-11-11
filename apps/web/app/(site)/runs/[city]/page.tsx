import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RunsWeek } from "@/components/pages/RunsWeek";
import { getCities, getCityRuns, requestTime } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const c = (await getCities()).find(x => x.id === city);
  if (!c) return {};
  return {
    title: `Group runs this week in ${c.name}`,
    description: `Every public squad run in ${c.name} for the next 7 days: where to meet, the distance and who's leading.`,
    alternates: { canonical: `/runs/${c.id}` },
  };
}

export default async function Page({ params }: Props) {
  const { city } = await params;
  const c = (await getCities()).find(x => x.id === city);
  if (!c) notFound();
  const runs = await getCityRuns(c.id, 7, 100);
  return <RunsWeek city={c.id} cityName={c.name} runs={runs.filter(r => !r.projected)} now={requestTime()} />;
}
