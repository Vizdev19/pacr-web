import type { Metadata } from "next";
import { LegalPage } from "@/components/pages/legal/Legal";
import { PRIVACY } from "@/components/pages/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What pacr collects, who can see it, who we share it with, how long we keep it, and how to delete your account: runs and GPS, health data, squads, payments and your rights.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}
