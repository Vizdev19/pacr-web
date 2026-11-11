"use client";
// The not-found boundary of /s/<slug>: the page component with no public
// data, so a member of a hidden squad still sees it with their session and
// everyone else gets "We can't find that squad".
import { usePathname, useSearchParams } from "next/navigation";
import { istToday } from "@/lib/format";
import { cleanRunRef, cleanSlug } from "@/lib/squad";
import { ErrorState } from "@/components/ds/feedback";
import { SquadPage } from "./SquadPage";

export function SquadMissing() {
  const path = usePathname() || "";
  const search = useSearchParams();
  const slug = cleanSlug(path.split("/").filter(Boolean)[1]);
  if (!slug) return <div className="pw-container sec"><ErrorState kind="notfound" title="We can't find that squad" body="The link may be old. Ask a member for a new one." action="Browse squads" href="/clubs" /></div>;
  return <SquadPage slug={slug} invite={null} runRef={cleanRunRef(search?.get("run"))} initial={null} events={[]} today={istToday()} />;
}
