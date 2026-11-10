import type { Metadata } from "next";
import { Money } from "./Money";

export const metadata: Metadata = { title: "Money" };

export default function Page() {
  return <Money />;
}
