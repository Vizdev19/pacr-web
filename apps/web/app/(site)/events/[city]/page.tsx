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
  const cities = await getCities();
  const c = cities.find(x => x.id === city);
  if (!c) notFound();
  // The city's own events, and every upcoming event (city_events with no city):
  // the rest go under "Events elsewhere", so an event whose pin is outside all
  // of our cities still has a page it shows on.
  const [events, all] = await Promise.all([getCityEvents(c.id, 100), getCityEvents(null, 200).catch(() => [])]);
  const elsewhere = all.filter(e => e.city_id !== c.id);
  const cityNames = Object.fromEntries(cities.map(x => [x.id, x.name]));
  return <Events city={c.id} cityName={c.name} events={events} elsewhere={elsewhere} cityNames={cityNames} now={requestTime()} />;
}
