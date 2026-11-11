import type { Metadata } from "next";
import { ZoneCalculator } from "@/components/pages/zones/ZoneCalculator";
import { DEFAULTS, raceKm, type ZoneForm } from "@/lib/zones";

export const metadata: Metadata = {
  title: "Your running zones",
  description: "Free heart-rate and pace zone calculator. Enter your age and a race time to find your real easy pace, and the grey zone to avoid on easy days.",
  alternates: { canonical: "/zones" },
  openGraph: {
    title: "Find your real easy: your running zones",
    description: "Enter your age and a race time. Get your heart rate and pace for every kind of run, free.",
    url: "https://pacr.life/zones",
    images: ["https://pacr.life/og-image.png?v=3"],
  },
  twitter: { card: "summary_large_image", title: "Find your real easy: your running zones", description: "Enter your age and a race time. Get your heart rate and pace for every kind of run, free." },
};

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 12);

/** A shared link (?age=45&d=5&t=28:00) opens with those numbers filled in. */
export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const shared = q.age != null || q.max != null || q.d != null || q.t != null;
  const initial: ZoneForm = shared
    ? { age: one(q.age) ?? "", max: one(q.max) ?? "", d: String(raceKm(one(q.d) ?? "")), t: one(q.t) ?? "" }
    : DEFAULTS;
  return <ZoneCalculator initial={initial} />;
}
