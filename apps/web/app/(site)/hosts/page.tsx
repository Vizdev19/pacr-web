import type { Metadata } from "next";
import { Hosts } from "@/components/pages/static/Hosts";

export const metadata: Metadata = {
  title: "Host your running squad",
  description: "Run your squad on pacr: weekly runs at saved meeting places, QR check-in, members and join requests, announcements, a verified badge, and event tickets with payouts. Free for squads.",
  alternates: { canonical: "/hosts" },
  openGraph: { title: "Host your squad on pacr", description: "Weekly runs, QR check-in, members, announcements, verification and event tickets, in the app and on the host dashboard.", url: "https://pacr.life/hosts", images: ["https://pacr.life/og-image.png?v=3"] },
};

export default function Page() {
  return <Hosts />;
}
