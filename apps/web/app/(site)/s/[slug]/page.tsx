// /s/<slug> — a squad's share link (the app's Invite / Share buttons), the
// replacement for pacr.life's api/squad.mjs. URLs already in the wild:
//
//   /s/<slug>                  a public squad's page (ui_kits/website/Squad.jsx)
//   /s/<slug>?invite=<code>    an organiser's invite: joins with the code, even
//                              for a hidden (invite-only) squad
//   /s/<slug>?run=<ref>        one group run (ui_kits/website/Run.jsx); ref is
//                              the run's id as 22 base64url characters.
//                              Combines with invite= for an invite-only squad.
//
// Server-rendered as anon for the first paint and the link preview (iMessage,
// WhatsApp and Slack never run JavaScript); the browser then asks again with
// the runner's session for membership and RSVPs. A slug that names a hidden
// squad and one that names nothing look the same: 404 without an invite, the
// invite card with one.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SquadPage } from "@/components/pages/squad/SquadPage";
import { istToday, km, whenLine } from "@/lib/format";
import {
  APP_STORE_ID, SITE, anonClient, cleanInvite, cleanRunRef, cleanSlug, decodeRef, fetchClub, fetchSquadEvents, plural,
  proxiedPictures, squadEventCards, squadQuery, toSquad, version,
} from "@/lib/squad";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Search> };

/** One anon read per request, shared by generateMetadata and the page. */
const load = cache(async (slug: string) => {
  const sb = anonClient();
  const raw = await fetchClub(sb, slug).catch(() => null);
  if (!raw) return null;
  const [pics, rows, cardV] = await Promise.all([
    proxiedPictures(raw),
    fetchSquadEvents(sb, raw.id).catch(() => []),
    raw.cover_path || raw.avatar_path
      ? version([raw.cover_path, raw.avatar_path, raw.name, raw.member_count, raw.location].join("|"))
      : Promise.resolve(null),
  ]);
  return { raw, squad: toSquad(raw, pics), events: squadEventCards(rows, raw.name), cardV };
});

async function read({ params, searchParams }: Props) {
  const [{ slug: rawSlug }, sp] = await Promise.all([params, searchParams]);
  const slug = cleanSlug(rawSlug);
  const invite = cleanInvite(sp.invite);
  const runRef = cleanRunRef(sp.run);
  return { slug, invite, runRef, data: slug ? await load(slug) : null };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug, invite, runRef, data } = await read(props);
  const raw = data?.raw ?? null;
  const name = raw?.name ?? null;
  // The shared run, if it's still on the calendar (runs drop off an hour after they start).
  const runId = runRef ? decodeRef(runRef) : null;
  const picked = runId ? raw?.runs?.find(r => r.id === runId) ?? null : null;
  const title = picked && name ? `${picked.title} with ${name} · pacr`
    : name ? (invite ? `Join ${name} on pacr` : `${name}, a squad on pacr`)
    : invite ? "You’re invited to a squad on pacr" : "Squad not found · pacr";
  const description = picked
    ? [whenLine(picked.event_at), picked.meeting_point, km(picked.distance_km) ? `${km(picked.distance_km)} km` : null,
      `${Number(picked.going_count) || 0} going`].filter(Boolean).join(" · ")
    : raw
      ? [raw.description?.replace(/\s+/g, " ").trim(), plural(Number(raw.member_count) || 0, "member"), raw.location?.trim()].filter(Boolean).join(" · ")
      : invite ? "Sign in to join the squad, or open this link on your phone to join in the pacr app."
      : "This squad isn’t public. Ask a member for an invite link.";
  const share = `${SITE}/s/${slug ?? "squad"}${squadQuery(invite, runRef)}`;
  const image = data?.cardV ? `${SITE}/s/${slug}/card${data.cardV}` : `${SITE}/og-image.png?v=3`;
  return {
    title: { absolute: title },
    description,
    robots: { index: false },
    // Anyone holding an invite joins, so its code shouldn't ride along in a Referer.
    ...(invite ? { referrer: "no-referrer" as const } : {}),
    alternates: slug ? { canonical: `/s/${slug}` } : undefined,
    itunes: { appId: APP_STORE_ID, appArgument: share },
    openGraph: {
      type: "website", siteName: "pacr", title, description, url: share,
      images: [{ url: image, width: 1200, height: 630, alt: name ? `${name} on pacr` : "pacr" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Page(props: Props) {
  const { slug, invite, runRef, data } = await read(props);
  if (!slug || (!data && !invite)) notFound();
  return <SquadPage slug={slug} invite={invite} runRef={runRef} initial={data?.squad ?? null} events={data?.events ?? []} today={istToday()} />;
}
