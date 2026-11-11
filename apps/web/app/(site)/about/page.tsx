import type { Metadata } from "next";
import { About } from "@/components/pages/static/About";

export const metadata: Metadata = {
  title: "About",
  description: "pacr is a running app built in India, for Indian cities: run tracking, training plans, squads and group runs. Made by Pacr Life in Bengaluru.",
  alternates: { canonical: "/about" },
};

export default function Page() {
  return <About />;
}
