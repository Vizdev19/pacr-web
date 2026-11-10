import type { Metadata } from "next";
import { Insights } from "./Insights";

export const metadata: Metadata = { title: "Insights" };

export default function Page() {
  return <Insights />;
}
