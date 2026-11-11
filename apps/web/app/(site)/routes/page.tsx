import type { Metadata } from "next";
import { RoutesPage } from "@/components/pages/routes/Routes";

export const metadata: Metadata = { title: "Routes", robots: { index: false, follow: false } };

export default function Page() {
  return <RoutesPage />;
}
