"use client";
// /feed/<ref>: one post, where "Comment" and notifications land. The card
// (get_feed_post, so the same row as the feed), who gave kudos
// (list_post_likers), then the thread and the composer. A post that isn't
// visible to you, or doesn't exist, is the same "can't find" state.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ds/core";
import { RunnerRow } from "@/components/ds/content";
import { ErrorState, Skeleton } from "@/components/ds/feedback";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { signedUrls, useSigned } from "@/lib/storage";
import { getFeedPost, listLikers, myProfile, mySquads, refToUuid, type FeedPost, type Liker, type MySquad } from "@/lib/feed";
import { Comments } from "./Comments";
import { FeedPostCard, useKudos, useNow, usePostActions } from "./FeedPost";
import { faceOf } from "@/lib/avatars";
import { decodeRef } from "@/lib/refs";

export function PostPage({ postRef }: { postRef: string }) {
  return <RequireSignIn title="Sign in to see this post" body="Runs, photos and kudos from the people and squads you follow.">
    {auth => <Post uid={auth.uid} postRef={postRef} />}
  </RequireSignIn>;
}

type Me = { name: string; avatarPath: string | null; avatar: string | null };

function Post({ uid, postRef }: { uid: string; postRef: string }) {
  const router = useRouter();
  const now = useNow();
  const id = useMemo(() => refToUuid(postRef), [postRef]);
  const [post, setPost] = useState<FeedPost | null | undefined | "error">(id ? undefined : null);
  const [retry, setRetry] = useState(0);
  const [squads, setSquads] = useState<MySquad[]>([]);
  const [me, setMe] = useState<Me>({ name: "You", avatarPath: null, avatar: null });

  useEffect(() => {
    if (!id) return;
    let live = true;
    getFeedPost(id, uid).then(r => { if (live) setPost(r); });
    return () => { live = false; };
  }, [id, uid, retry]);

  useEffect(() => {
    let live = true;
    mySquads(uid).then(s => { if (live) setSquads(s); });
    myProfile(uid).then(async p => {
      const avatar = faceOf(p.avatarPath ? (await signedUrls("avatars", [p.avatarPath])).get(p.avatarPath) : null, p.avatarPath, uid);
      if (live) setMe({ ...p, avatar });
    });
    return () => { live = false; };
  }, [uid]);

  const patch = useCallback((_id: string, p: Partial<FeedPost>) => setPost(x => x && x !== "error" ? { ...x, ...p } : x), []);
  const kudos = useKudos(uid, patch);
  const leave = () => router.push("/feed");
  const actions = usePostActions({
    uid, squads, drop: leave, restore: () => {}, dropAuthor: leave, restoreAuthor: () => {}, patch,
  });

  const p = post && post !== "error" ? post : null;
  const signed = useSigned("avatars", [p?.authorAvatarPath]);
  const pictures = useSigned("post-images", [p?.imagePath]);

  return <div className="pw-reading pw-page"><div className="stack" style={{ gap: "var(--space-4)" }}>
    <div><Button variant="ghost" size="sm" icon="arrow-left" href="/feed">Feed</Button></div>
    {post === undefined ? <Skeleton variant="post" />
      : post === "error" ? <Card><ErrorState title="This post didn't load." body="Check your connection and try again." onRetry={() => { setPost(undefined); setRetry(x => x + 1); }} /></Card>
      : post === null ? <Card><ErrorState kind="notfound" title="We can't find that post." body="It may have been deleted, or it isn't shared with you." action="Back to your feed" href="/feed" /></Card>
      : <>
        <FeedPostCard post={post} now={now} commentHref="#comments"
          avatar={faceOf(post.authorAvatarPath ? signed.get(post.authorAvatarPath) : null, post.authorAvatarPath, post.authorId)} image={post.imagePath ? pictures.get(post.imagePath) : null}
          onKudos={give => kudos(post, give)} menu={actions.items(post)} onMenu={a => actions.select(post, a)} />
        <Likers postId={post.id} count={post.likeCount} mine={post.likedByMe} />
        <Card><div id="comments">
          <Comments post={post} uid={uid} me={me} now={now} onCount={d => setPost(x => x && x !== "error" ? { ...x, commentCount: Math.max(0, x.commentCount + d) } : x)} />
        </div></Card>
      </>}
  </div>{actions.ui}</div>;
}

/** "Kudos from …": everyone who gave kudos, people you know first. Re-read when yours changes. */
function Likers({ postId, count, mine }: { postId: string; count: number; mine: boolean }) {
  const [list, setList] = useState<Liker[] | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    listLikers(postId).then(r => { if (live) setList(r); });
    return () => { live = false; };
  }, [postId, mine]);
  const faces = useSigned("avatars", (list ?? []).map(l => l.avatarPath));
  return <Card>
    <h2 className="t-h4" style={{ marginBottom: "var(--space-1)" }}>Kudos from</h2>
    {list === undefined ? <Skeleton variant="runner" />
      : list === null ? <p className="t-caption" style={{ margin: 0 }}>This list didn&apos;t load. Refresh to try again.</p>
      : !list.length ? <p className="t-caption" style={{ margin: 0 }}>{count ? "Nobody you can see yet." : "No kudos yet. Be the first."}</p>
      : list.map(l => <RunnerRow key={l.ref} name={l.name} isYou={l.isMe} avatar={faceOf(l.avatarPath ? faces.get(l.avatarPath) : null, l.avatarPath, decodeRef(l.ref))}
        href={l.handle ? `/u/${l.handle}` : `/profile?r=${l.ref}`} />)}
  </Card>;
}
