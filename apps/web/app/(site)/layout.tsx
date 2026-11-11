import { Shell } from "@/components/site/Shell";
import { siteCities } from "@/lib/cities";
import { cookieCity, getCities } from "@/lib/data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [rows, city] = await Promise.all([getCities(), cookieCity()]);
  return <Shell cities={siteCities(rows)} cookieCity={city}>{children}</Shell>;
}
