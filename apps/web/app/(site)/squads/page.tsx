import type { Metadata } from "next";
import { MySquadsPage } from "@/components/pages/squads/MySquadsPage";

export const metadata: Metadata = { title: "Your squads", robots: { index: false } };

/** /squads: the squads you're in. Signed in, read in the browser. */
export default function Page() {
  return <MySquadsPage />;
}
