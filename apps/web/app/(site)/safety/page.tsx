import type { Metadata } from "next";
import { Safety } from "@/components/pages/static/Safety";

export const metadata: Metadata = {
  title: "Safety",
  description: "How pacr makes running with squads, run buddies and people at events safer: verified squads, women-only runs, private meeting points, I'm safe check-ins, live sharing, reporting and blocking.",
  alternates: { canonical: "/safety" },
};

export default function Page() {
  return <Safety />;
}
