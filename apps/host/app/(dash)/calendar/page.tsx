import type { Metadata } from "next";
import Calendar from "./Calendar";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return <Calendar />;
}
