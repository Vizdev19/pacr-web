// /u/<handle>: a runner's profile link (replaces api/profile.mjs; the app's
// Profile → Share). Server-rendered so link previews get og:title / og:image;
// an unknown or cleared handle is a 404, as before.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErrorState } from "@/components/ds/feedback";
import { ProfileCard } from "@/components/pages/card/ProfileCard";
import { APP_STORE_ID, SITE } from "@/lib/event";
import { cleanHandle, loadProfile, profileView, shortCount } from "@/lib/profilecard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const handle = cleanHandle((await params).handle);
  const r = handle ? await loadProfile(handle) : null;
  const p = r?.ok && r.runner ? profileView(r.runner) : null;
  const url = `${SITE}/u/${handle ?? "runner"}`;
  const title = p ? `${p.name} (@${p.handle}) on pacr` : "Runner not found — pacr";
  const description = p
    ? [p.bio, p.location, `${shortCount(p.followers)} ${p.followers === 1 ? "follower" : "followers"}`].filter(Boolean).join(" · ")
    : "This profile link may be old. The runner might have changed their handle.";
  const image = p?.avatar ? `${SITE}${p.avatar}` : `${SITE}/og-image.png?v=3`;
  return {
    title: { absolute: title },
    description,
    robots: { index: false },
    alternates: { canonical: url },
    itunes: { appId: APP_STORE_ID, appArgument: url },
    openGraph: { type: "profile", siteName: "pacr", title, description, url, images: [image] },
    twitter: { card: p?.avatar ? "summary" : "summary_large_image", title, description, images: [image] },
  };
}

export default async function Page({ params }: Props) {
  const handle = cleanHandle((await params).handle);
  if (!handle) notFound();
  const r = await loadProfile(handle);
  if (!r.ok) return <div className="pw-container sec"><ErrorState kind="error" body="We couldn't load this profile. Try again in a moment." action="Try again" href={`/u/${handle}`} /></div>;
  if (!r.runner) notFound();
  return <ProfileCard runner={profileView(r.runner)} />;
}
