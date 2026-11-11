// /live?t=<token>: follow a run in progress (replaces live.html + js/live.js).
// The URL carries the token that grants access, so the page sends no
// referrer anywhere (the old page's meta tag), and it is never indexed.
import type { Metadata } from "next";
import { LivePage } from "@/components/pages/live/LivePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Live run — pacr" },
  description: "Follow a run in progress.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const { t } = await searchParams;
  return <LivePage token={typeof t === "string" ? t : null} />;
}
