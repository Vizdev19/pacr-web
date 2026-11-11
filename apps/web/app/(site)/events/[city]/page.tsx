import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Events } from "@/components/pages/Events";
import { getCities, getCityEvents, requestTime } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const c = (await getCities()).find(x => x.id === city);
  if (!c) return {};
  return {
    title: `Running events in ${c.name}`,
    description: `Races, group runs, workshops and socials in ${c.name}, from verified squads and organisers on pacr.`,
    alternates: { canonical: `/events/${c.id}` },
  };
}

export default async function Page({ params }: Props) {
  const { city } = await params;
  const c = (await getCities()).find(x => x.id === city);
  if (!c) notFound();
  const events = await getCityEvents(c.id, 100);
  return <Events city={c.id} cityName={c.name} events={events} now={requestTime()} />;
}
