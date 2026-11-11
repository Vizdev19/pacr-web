import type { Metadata } from "next";
import { LegalPage } from "@/components/pages/legal/Legal";
import { TERMS } from "@/components/pages/legal/terms";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using pacr: your account, health and safety, your content, event tickets and refunds, and hosting.",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return <LegalPage doc={TERMS} />;
}
