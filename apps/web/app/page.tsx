import { Home, type HomeRun, type HomeSquadPic } from "@/components/home/Home";
import { runHref, squadPhoto } from "@/lib/cards";
import { siteCities } from "@/lib/cities";
import { cookieCity, getCities, getCityRuns, getDirectory } from "@/lib/data";
import { km, whenLine } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const city = await cookieCity();
  const [cityRows, runRows, squads] = await Promise.all([
    getCities(),
    getCityRuns(city, 7, 12).catch(() => []),
    getDirectory(null, { limit: 30 }).catch(() => []),
  ]);
  const cities = siteCities(cityRows);
  const known = cities.some(c => c.id === city) ? city : "bengaluru";

  const runs: HomeRun[] = runRows.filter(r => !r.projected).slice(0, 5).map(r => ({
    href: runHref(r.squad_slug, r.run_ref),
    title: r.title,
    place: [r.squad_name, r.meeting_point].filter(Boolean).join(" · "),
    tags: [r.women_only ? "women only" : null, km(r.distance_km) ? `${km(r.distance_km)} km` : null, r.pace_label && !/\d/.test(r.pace_label) ? r.pace_label.toLowerCase() : null].filter((t): t is string => !!t),
    when: whenLine(r.starts_at),
    peek: squadPhoto(r.squad_slug, r.squad_has_photo) ?? "/home/runners.jpg",
  }));

  // Real squads' pictures for the hero avatars and the mission bubbles; the
  // busiest squads first, as directory_clubs sorts them.
  const pics: HomeSquadPic[] = squads.filter(s => s.has_photo).slice(0, 7).map(s => ({ name: s.name, src: squadPhoto(s.slug, true)! }));

  return <Home cities={cities} city={known} runs={runs} pics={pics} />;
}
