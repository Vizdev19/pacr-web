import type { MetadataRoute } from "next";
import { getCities } from "@/lib/data";

// pacr.life/sitemap.xml: the public pages, plus squads, runs and events for
// every city in list_cities. Signed-in pages and share links (/s /e /p /u)
// stay out; share links are found by the people they're shared with.
export const revalidate = 3600;

const SITE = "https://pacr.life";
const PAGES = [
  "/", "/clubs", "/runs", "/events", "/app", "/hosts", "/safety", "/about", "/support", "/download",
  "/plans/5k", "/plans/10k", "/plans/half-marathon", "/plans/marathon", "/zones",
  "/community-rules", "/terms", "/privacy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cities = await getCities().catch(() => []);
  return [
    ...PAGES.map(p => ({ url: SITE + (p === "/" ? "/" : p) })),
    ...cities.flatMap(c => ["clubs", "runs", "events"].map(s => ({ url: `${SITE}/${s}/${c.id}` }))),
  ];
}
