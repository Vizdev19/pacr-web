"use client";
// The Posts tab: list_runner_posts in the feed's PostCard look. Kudos toggle
// here (optimistic, rolled back on failure); comments and everything else
// open the post on /feed/<ref>.
import { useCallback, useState } from "react";
import { FEED_ON_WEB } from "@/lib/config";
import { PostCard } from "@/components/ds/content";
import { EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { LoadMore } from "@/components/ds/nav";
import { useToast } from "@/components/ds/overlays";
import { MentionText } from "@/components/site/MentionText";
import { encodeRef } from "@/lib/refs";
import { duration, paceOf, ago } from "@/lib/time";
import { getPosts, likedLine, setKudos, useLoad, type Cursor, type ProfilePost } from "@/lib/profile";

export function Posts({ subjectId, me, isMe, name }: { subjectId: string; me: string; isMe: boolean; name: string }) {
  const toast = useToast();
  const [more, setMore] = useState(false);
  const first = useCallback(() => getPosts(subjectId, null).then(r => ({ ...r, now: Date.now() })), [subjectId]);
  const { data, failed, retry, update } = useLoad(first);
  const posts = data?.posts ?? null, cursor: Cursor = data?.cursor ?? null, now = data?.now ?? 0;
  const setPosts = (f: (ps: ProfilePost[]) => ProfilePost[]) => update(d => ({ ...d, posts: f(d.posts) }));

  const loadMore = async () => {
    if (!cursor) return;
    setMore(true);
    try {
      const r = await getPosts(subjectId, cursor);
      update(d => ({ ...d, cursor: r.cursor, posts: [...d.posts, ...r.posts.filter(x => !d.posts.some(y => y.id === x.id))] }));
    } catch { toast({ title: "Couldn't load more posts", message: "Check your connection and try again.", tone: "error" }); }
    setMore(false);
  };

  const kudos = async (id: string, give: boolean) => {
    const flip = (g: boolean) => setPosts(ps => ps.map(p => p.id === id && p.liked !== g ? { ...p, liked: g, likes: Math.max(0, p.likes + (g ? 1 : -1)) } : p));
    flip(give);
    if (!(await setKudos(id, me, give))) { flip(!give); toast({ title: "Couldn't update kudos", message: "Try again in a moment.", tone: "error" }); }
  };

  if (failed) return <ErrorState title="Couldn't load these posts" body="Check your connection and try again." onRetry={retry} />;
  if (!posts) return <div className="stack" style={{ gap: "var(--space-4)" }}><Skeleton variant="post" /><Skeleton variant="post" /></div>;
  if (!posts.length) return isMe
    ? <EmptyState boxed icon="newspaper" title="You haven't posted yet." body="Runs you post from the app show up here, with their kudos and comments." {...(FEED_ON_WEB ? { action: "Open your feed", href: "/feed" } : {})} />
    : <EmptyState boxed icon="newspaper" title={`Nothing from ${name} you can see.`} body="Posts reach their squads first. Only what they share with followers or everyone reaches you." />;

  return <div className="stack" style={{ gap: "var(--space-4)", maxWidth: 620 }}>
    {posts.map(p => {
      const ref = encodeRef(p.id) ?? "";
      const audience = p.squadNames.length ? p.squadNames.join(", ") : p.visibility === "public" ? "Public" : p.visibility === "followers" ? "Followers" : "Squads";
      return <PostCard key={p.id}
        author={{ name: p.authorName, avatar: p.authorAvatar }}
        time={ago(p.createdAt, now)} href={FEED_ON_WEB ? `/feed/${ref}` : `/p/${ref}`}
        context={[p.place, audience].filter(Boolean).join(" · ")}
        title={p.title} body={p.body ? <MentionText body={p.body} /> : undefined}
        photo={p.image ? { src: p.image, mode: p.imageMode } : null}
        run={p.run ? {
          distance: p.run.distanceKm.toFixed(2), duration: duration(p.run.durationSec), pace: paceOf(p.run.paceSecPerKm),
          route: p.image ? null : p.run.route,
        } : null}
        kudos={p.likes} kudosGiven={p.liked} likedLine={likedLine(p)} onKudos={give => void kudos(p.id, give)}
        comments={p.comments} commentHref={FEED_ON_WEB ? `/feed/${ref}` : undefined} />;
    })}
    {cursor || posts.length > 3 ? <LoadMore hasMore={!!cursor} loading={more} onClick={() => void loadMore()} endLabel="That's every post you can see" /> : null}
  </div>;
}
