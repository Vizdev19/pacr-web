import type { Metadata } from "next";
import { NoRunner } from "@/components/pages/card/ProfileCard";

export const metadata: Metadata = {
  title: { absolute: "Runner not found — pacr" },
  description: "This profile link may be old. The runner might have changed their handle.",
  robots: { index: false },
};

/** An unknown, cleared or malformed handle: the page says no more than "nobody here". */
export default function NotFound() {
  return <NoRunner />;
}
