import type { Metadata } from "next";
import { LegalPage } from "@/components/pages/legal/Legal";
import { COMMUNITY_RULES } from "@/components/pages/legal/communityRules";

export const metadata: Metadata = {
  title: "Community rules",
  description: "The five rules that keep pacr's feed a place runners cheer each other on, and how to report anything that breaks them.",
  alternates: { canonical: "/community-rules" },
};

export default function Page() {
  return <LegalPage doc={COMMUNITY_RULES} />;
}
