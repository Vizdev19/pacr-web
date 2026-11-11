import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FeedPage } from "@/components/pages/feed/FeedPage";
import { FEED_ON_WEB } from "@/lib/config";
import { cookieCity, getCities } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed",
  description: "Runs, photos and kudos from the people and squads you follow on pacr.",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ squad?: string }> };

/** /feed (and /feed?squad=<slug>): the shell; the posts load in the browser with the runner's session. */
export default async function Page({ searchParams }: Props) {
  // App-only for now (FEED_ON_WEB): the page stays, nothing links here.
  if (!FEED_ON_WEB) redirect("/squads");
  const [{ squad }, city] = await Promise.all([searchParams, cookieCity()]);
  const cities = await getCities().catch(() => []);
  const slug = typeof squad === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(squad) && squad.length <= 48 ? squad : null;
  const c = cities.find(x => x.id === city);
  return <FeedPage squadSlug={slug} cityId={c?.id ?? city} cityName={c?.name ?? "your city"} />;
}
