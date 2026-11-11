import type { Metadata } from "next";
import { ShoesPage } from "@/components/pages/shoes/Shoes";

export const metadata: Metadata = { title: "Shoes", robots: { index: false, follow: false } };

export default function Page() {
  return <ShoesPage />;
}
