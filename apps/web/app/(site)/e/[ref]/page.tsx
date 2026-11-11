// /e/<ref>: a shared event (replaces api/event.mjs). Server-rendered so link
// previews get og:title / og:image without running JavaScript; the same
// title, description, poster URL and app banner as the old page.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErrorState } from "@/components/ds/feedback";
import { EventPage } from "@/components/pages/event/EventPage";
import { requestTime } from "@/lib/data";
import { APP_STORE_ID, SITE, decodeRef, eventView, eventWhen, loadEvent, priceLine } from "@/lib/event";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ref: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ref } = await params;
  const valid = !!decodeRef(ref);
  const r = valid ? await loadEvent(ref) : null;
  const ev = r?.ok ? r.event : null;
  const v = ev ? eventView(ev, ref) : null;
  const url = `${SITE}/e/${valid ? ref : "event"}`;
  const title = v ? `${v.title} — on pacr` : "An event on pacr";
  const description = v
    ? [eventWhen(v.startsAt, v.endsAt), v.place.name, v.distances ?? v.typeLabel, priceLine(v.tiers)].filter(Boolean).join(" · ").slice(0, 200)
    : "Open this link in the pacr app to see the event.";
  const image = v?.poster ? `${SITE}${v.poster}` : `${SITE}/og-image.png?v=3`;
  return {
    title: { absolute: title },
    description,
    robots: { index: false },
    alternates: { canonical: url },
    itunes: { appId: APP_STORE_ID, appArgument: url },
    openGraph: { type: "website", siteName: "pacr", title, description, url, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Page({ params }: Props) {
  const { ref } = await params;
  // Only a malformed ref is a 404; a squad-only or removed event is a fine
  // link the web can't show (200, "open it in pacr").
  if (!decodeRef(ref)) notFound();
  const r = await loadEvent(ref);
  if (!r.ok) return <div className="pw-container sec"><ErrorState kind="error" body="We couldn't load this event. Try again in a moment." action="Try again" href={`/e/${ref}`} /></div>;
  return <EventPage view={r.event ? eventView(r.event, ref) : null} refStr={ref} now={requestTime()} />;
}
