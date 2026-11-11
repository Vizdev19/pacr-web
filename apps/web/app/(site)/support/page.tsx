import type { Metadata } from "next";
import { Support } from "@/components/pages/static/Support";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with pacr. Email support@pacr.life and a human will reply: bugs, your account, data requests, tickets and refunds, reports and grievances.",
  alternates: { canonical: "/support" },
};

export default function Page() {
  return <Support />;
}
