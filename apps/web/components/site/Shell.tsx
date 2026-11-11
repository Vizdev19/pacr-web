"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CityPicker, MobileMenuSheet, SiteFooter, SiteHeader } from "@/components/ds/nav";
import type { SiteCity } from "@/lib/cities";
import { rememberCity, useSessionUser } from "./session";

const SECTIONS = ["clubs", "runs", "events"] as const;
const ACTIVE: Record<string, string> = { clubs: "squads", runs: "runs", events: "events" };

/**
 * The site frame for every page but the home page (which has its own nav and
 * footer in the lime design): sticky header, city picker, mobile menu, footer.
 * The city in the URL (/clubs/<city>) wins over the remembered one.
 */
export function Shell({ cities, cookieCity, children }: { cities: SiteCity[]; cookieCity: string; children: ReactNode }) {
  const path = usePathname() || "/";
  const router = useRouter();
  const [seg, urlCity] = path.split("/").filter(Boolean);
  const section = (SECTIONS as readonly string[]).includes(seg) ? seg : null;
  const city = section && urlCity && cities.some(c => c.id === urlCity) ? urlCity : cookieCity;
  const cityName = cities.find(c => c.id === city)?.name ?? "Bengaluru";
  const [cityOpen, setCityOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [user, signOut] = useSessionUser();

  useEffect(() => { if (section && urlCity && city === urlCity) rememberCity(urlCity); }, [section, urlCity, city]);

  const pick = (id: string) => {
    setCityOpen(false); setMenu(false);
    rememberCity(id);
    router.push(`/${section ?? "clubs"}/${id}`);
  };
  const avatar = async (id: string) => {
    if (id === "signout") { await signOut(); router.refresh(); return; }
    window.location.href = id === "host" ? "/host" : "/" + id;
  };
  const footerCities = cities.filter(c => c.squads > 0 || c.events_upcoming > 0);

  return <div className="site">
    <SiteHeader active={section ? ACTIVE[section] : undefined} cityName={cityName} onCity={() => setCityOpen(true)} onMenu={() => setMenu(true)} user={user} onAvatarAction={avatar} />
    <main>{children}</main>
    <SiteFooter cities={footerCities.length ? footerCities : cities.slice(0, 6)} />
    <CityPicker open={cityOpen} city={city} cities={cities} onClose={() => setCityOpen(false)} onSelect={pick} />
    <MobileMenuSheet open={menu} onClose={() => setMenu(false)} active={section ? ACTIVE[section] : undefined} cityName={cityName} onCity={() => { setMenu(false); setCityOpen(true); }} user={user} onSignOut={async () => { await signOut(); setMenu(false); }} />
  </div>;
}

