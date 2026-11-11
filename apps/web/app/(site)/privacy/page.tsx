import type { Metadata } from "next";
import { LegalPage } from "@/components/pages/legal/Legal";
import { PRIVACY } from "@/components/pages/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How pacr collects, uses and protects your information: what we collect, location and live sharing, who we share it with, how long we keep it and your rights.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return <LegalPage doc={PRIVACY} />;
}
