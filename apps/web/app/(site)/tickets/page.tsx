import type { Metadata } from "next";
import { TicketsPage } from "@/components/pages/tickets/TicketsPage";

export const metadata: Metadata = { title: "Your tickets", robots: { index: false } };

type Props = { searchParams: Promise<{ o?: string; tab?: string }> };

/** /tickets, /tickets?tab=past, /tickets?o=<order ref>. Signed in; read in the browser. */
export default async function Page({ searchParams }: Props) {
  const { o, tab } = await searchParams;
  const ref = typeof o === "string" && /^[A-Za-z0-9_-]{22}$/.test(o) ? o : null;
  return <TicketsPage orderRef={ref} past={tab === "past"} />;
}
