import type { Metadata } from "next";
import { RunBuddiesPage } from "@/components/pages/runbuddies/RunBuddiesPage";

export const metadata: Metadata = {
  title: "Run buddies",
  description: "Small runs for 2 to 5 runners at public places near you, with the safety rules built in.",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ run?: string; past?: string; tab?: string }> };

/** /runbuddies, /runbuddies?tab=mine|past, /runbuddies?run=<ref>[&past=1]. Signed in; read in the browser. */
export default async function Page({ searchParams }: Props) {
  const { run, past, tab } = await searchParams;
  const ref = typeof run === "string" && /^[A-Za-z0-9_-]{22}$/.test(run) ? run : null;
  const t = tab === "mine" || tab === "past" ? tab : "nearby";
  return <RunBuddiesPage runRef={ref} past={past === "1"} tab={t} />;
}
