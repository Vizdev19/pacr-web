"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomTabBar, CityPicker, MobileMenuSheet, SiteFooter, SiteHeader } from "@/components/ds/nav";
import { ToastProvider } from "@/components/ds/overlays";
import type { SiteCity } from "@/lib/cities";
import { rememberCity, useSessionUser, useUnread } from "./session";

const CITY_SECTIONS = ["clubs", "runs", "events"] as const;
// Which header link / tab a path lights up.
const ACTIVE: Record<string, string> = {
  clubs: "squads", s: "squads", squads: "squads", runs: "runs", events: "events", e: "events", feed: "feed", p: "feed",
  runbuddies: "runbuddies", tickets: "tickets", notifications: "notifications", profile: "profile", activity: "profile", routes: "profile", shoes: "profile", settings: "profile", app: "app", plans: "app", download: "app", hosts: "hosts",
};

/**
 * The site frame for every page but the home page (which has its own nav and
 * footer in the lime design): sticky header (signed out or in), city picker,
 * mobile menu, toasts, the footer for visitors and the bottom tab bar for
 * signed-in runners on phones. The city in the URL (/clubs/<city>) wins over
 * the remembered one.
 */
export function Shell({ cities, cookieCity, children }: { cities: SiteCity[]; cookieCity: string; children: ReactNode }) {
  const path = usePathname() || "/";
  const router = useRouter();
  const [seg, urlCity] = path.split("/").filter(Boolean);
  const section = (CITY_SECTIONS as readonly string[]).includes(seg) ? seg : null;
  const city = section && urlCity && cities.some(c => c.id === urlCity) ? urlCity : cookieCity;
  const cityName = cities.find(c => c.id === city)?.name ?? "Bengaluru";
  const [cityOpen, setCityOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [user, signOut] = useSessionUser();
  const unread = useUnread(!!user);
  const active = ACTIVE[seg] ?? undefined;
  // Sign in brings you back here (but not back to /signin itself).
  const signin = seg === "signin" ? "/signin" : `/signin?next=${encodeURIComponent(path)}`;

  useEffect(() => { if (section && urlCity && city === urlCity) rememberCity(urlCity); }, [section, urlCity, city]);

  const pick = (id: string) => {
    setCityOpen(false); setMenu(false);
    rememberCity(id);
    router.push(`/${section ?? "clubs"}/${id}`);
  };
  const avatar = async (id: string) => {
    if (id === "signout") { await signOut(); router.push("/"); router.refresh(); return; }
    // /host is another app (apps/host, behind a rewrite): load it in full.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- /host is apps/host, not a page here
    if (id === "host") { window.location.assign("/host"); return; }
    router.push("/" + id);
  };
  const footerCities = cities.filter(c => c.squads > 0 || c.events_upcoming > 0);

  return <ToastProvider><div className="site" style={user ? { paddingBottom: 0 } : undefined}>
    <SiteHeader active={active} signin={signin} cityName={cityName} onCity={() => setCityOpen(true)} onMenu={() => setMenu(true)} user={user} unread={unread} onAvatarAction={avatar} />
    <main>{children}</main>
    <SiteFooter cities={footerCities.length ? footerCities : cities.slice(0, 6)} />
    {user ? <div className="only-md"><div style={{ height: "var(--tabbar-h)" }} /><BottomTabBar active={active} /></div> : null}
    <CityPicker open={cityOpen} city={city} cities={cities} onClose={() => setCityOpen(false)} onSelect={pick} />
    <MobileMenuSheet signin={signin} open={menu} onClose={() => setMenu(false)} active={active} cityName={cityName} onCity={() => { setMenu(false); setCityOpen(true); }} user={user} onSignOut={async () => { await signOut(); setMenu(false); router.push("/"); router.refresh(); }} />
  </div></ToastProvider>;
}
