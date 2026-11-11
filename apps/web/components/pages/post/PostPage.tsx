"use client";
// /p/<ref>: a public post as the feed draws it (PostCard), with "Open in pacr".
// Kudos and comments happen in the feed: a signed-in runner goes to
// /feed/<ref>, a visitor is asked to sign in first.
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/ds/content";
import { Badge, Button } from "@/components/ds/core";
import { EmptyState } from "@/components/ds/feedback";
import { useToast } from "@/components/ds/overlays";
import { OpenInAppButton, OpenInAppCard } from "@/components/pages/card/OpenInApp";
import { MentionText } from "@/components/site/MentionText";
import { signinHref, useAuth } from "@/lib/auth";
import type { PostView } from "@/lib/post";

export function PostPage({ post, refStr }: { post: PostView | null; refStr: string }) {
  const auth = useAuth();
  const toast = useToast();
  const router = useRouter();
  const feed = `/feed/${refStr}`;
  const signedIn = auth.status === "signed-in";

  if (!post) return <div className="pw-reading sec"><div className="stack" style={{ alignItems: "center", gap: "var(--space-4)" }}>
    <EmptyState icon="lock" title="Open it in pacr" body="This post is shared with a squad or the runner's followers, or it is no longer up. If you can see it, it opens in the app." />
    {signedIn ? <Button href={feed} icon="newspaper">See it in your feed</Button> : <OpenInAppButton path={`p/${refStr}`} />}
  </div></div>;

  const kudos = () => {
    if (signedIn) { router.push(feed); return; }
    toast({ title: "Sign in to give kudos", message: `Or give ${post.first} kudos in the app.`, tone: "neutral", action: "Sign in", onAction: () => router.push(signinHref(feed)) });
  };
  const context = post.handle || post.badge ? <span className="row" style={{ gap: 6 }}>{post.handle ? `@${post.handle}` : null}{post.badge ? <Badge tone="accent" size="sm">{post.badge}</Badge> : null}</span> : undefined;

  return <div className="pw-reading pw-page"><div className="stack" style={{ gap: "var(--space-6)" }}>
    <PostCard
      author={{ name: post.author, avatar: post.avatar, href: post.handle ? `/u/${post.handle}` : undefined }}
      time={post.date ?? ""} context={context} title={post.title}
      body={post.body ? <MentionText body={post.body} /> : undefined}
      photo={post.photo ? { src: post.photo, mode: "story" } : null} photoAlt={`Photo by ${post.author}`}
      run={post.run} kudos={post.kudos} comments={post.comments} commentHref={signedIn ? feed : signinHref(feed)} onKudos={kudos} />
    {signedIn ? <Button variant="secondary" href={feed} icon="newspaper">See it in your feed</Button> : null}
    <OpenInAppCard path={`p/${refStr}`} sub={`Give ${post.first} kudos, comment and follow along in the app.`} />
  </div></div>;
}
