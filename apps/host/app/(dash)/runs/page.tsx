import type { Metadata } from "next";
import Runs from "./Runs";

export const metadata: Metadata = { title: "Runs" };

export default function Page() {
  return <Runs />;
}
