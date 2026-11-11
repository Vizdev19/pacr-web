// /p/<ref>: a shared feed post (replaces api/post.mjs). Server-rendered so
// link previews get og:title / og:image; the same image URLs as the old page.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErrorState } from "@/components/ds/feedback";
import { PostPage } from "@/components/pages/post/PostPage";
import { APP_STORE_ID, SITE, decodeRef } from "@/lib/event";
import { loadPost, postView } from "@/lib/post";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ref: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ref } = await params;
  const valid = !!decodeRef(ref);
  const r = valid ? await loadPost(ref) : null;
  const p = r?.ok && r.post ? postView(r.post, ref) : null;
  const url = `${SITE}/p/${valid ? ref : "post"}`;
  const title = p ? `${p.headline} — ${p.author} on pacr` : "A post on pacr";
  const stats = p?.run ? [`${p.run.distance} km`, p.run.duration, p.run.pace ? `${p.run.pace} /km` : null].filter(Boolean).join(" · ") : "";
  const description = p ? ([stats, p.body].filter(Boolean).join(" — ").slice(0, 200) || `${p.author} on pacr`)
    : "Open this link in the pacr app to see the post.";
  // The photo, else the author's picture (art or proxied), else the site card.
  const image = p?.photo ? `${SITE}${p.photo}` : p?.avatar ? `${SITE}${p.avatar}` : `${SITE}/og-image.png?v=3`;
  const card = p && !p.photo && p.avatar ? "summary" : "summary_large_image";
  return {
    title: { absolute: title },
    description,
    robots: { index: false },
    alternates: { canonical: url },
    itunes: { appId: APP_STORE_ID, appArgument: url },
    openGraph: { type: "article", siteName: "pacr", title, description, url, images: [image] },
    twitter: { card, title, description, images: [image] },
  };
}

export default async function Page({ params }: Props) {
  const { ref } = await params;
  // Only a malformed ref is a 404; a squad or followers post is a fine link
  // the web can't show (200, "open it in pacr").
  if (!decodeRef(ref)) notFound();
  const r = await loadPost(ref);
  if (!r.ok) return <div className="pw-container sec"><ErrorState kind="error" body="We couldn't load this post. Try again in a moment." action="Try again" href={`/p/${ref}`} /></div>;
  return <PostPage post={r.post ? postView(r.post, ref) : null} refStr={ref} />;
}
