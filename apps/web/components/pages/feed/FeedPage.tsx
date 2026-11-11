"use client";
// /feed: ui_kits/website/Feed.jsx (FeedPage) on the app's own feed.
//   Tabs All · Following · Squads → list_home_feed scopes all / following /
//   squads; on Squads a chip per squad (p_circle_id) and the picked squad's
//   strip (squad_feed_meta). Keyset paging with Load more.
//   The side column: Your week and your squads' next runs.
// Everything is read in the browser with the runner's session; the server
// only sends the shell. /feed?squad=<slug> opens on that squad's chip.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ds/core";
import { EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { ChipSelect } from "@/components/ds/forms";
import { LoadMore, Tabs } from "@/components/ds/nav";
import { useToast } from "@/components/ds/overlays";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { whenLine } from "@/lib/format";
import { useSigned } from "@/lib/storage";
import { listFeed, mySquads, squadMeta, type Cursor, type FeedPost, type MySquad, type Scope, type SquadMeta } from "@/lib/feed";
import { FeedPostCard, useKudos, useNow, usePostActions } from "./FeedPost";
import { NextRuns, YourWeek } from "./Side";

const TABS: { id: Scope; label: string }[] = [{ id: "all", label: "All" }, { id: "following", label: "Following" }, { id: "squads", label: "Squads" }];

export function FeedPage({ squadSlug, cityId, cityName }: { squadSlug: string | null; cityId: string; cityName: string }) {
  return <RequireSignIn title="Sign in to see your feed" body="Runs, photos and kudos from the people and squads you follow.">
    {auth => <Feed uid={auth.uid} squadSlug={squadSlug} cityId={cityId} cityName={cityName} />}
  </RequireSignIn>;
}

const without = (s: Set<string>, id: string) => { const n = new Set(s); n.delete(id); return n; };

function Feed({ uid, squadSlug, cityId, cityName }: { uid: string; squadSlug: string | null; cityId: string; cityName: string }) {
  const now = useNow();
  const toast = useToast();
  const [tab, setTab] = useState<Scope>(squadSlug ? "squads" : "all");
  const [squads, setSquads] = useState<MySquad[] | null>(null);
  const [picked, setPicked] = useState("all");
  const [meta, setMeta] = useState<Map<string, SquadMeta>>(new Map());
  // The loaded list, tagged with what it was loaded for; another tab or chip
  // shows skeletons until its own page arrives.
  const [page, setPage] = useState<{ key: string; posts: FeedPost[]; cursor: Cursor | null; failed: boolean } | null>(null);
  const [more, setMore] = useState(false);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [goneAuthors, setGoneAuthors] = useState<Set<string>>(new Set());
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    mySquads(uid).then(s => {
      if (!live) return;
      setSquads(s);
      const hit = squadSlug ? s.find(x => x.slug === squadSlug) : null;
      if (hit) setPicked(hit.id);
    });
    squadMeta().then(m => { if (live) setMeta(m); });
    return () => { live = false; };
  }, [uid, squadSlug]);

  // A ?squad= link waits for my squads, to know which chip it means.
  const ready = !(tab === "squads" && squadSlug && squads === null);
  const circleId = tab === "squads" && picked !== "all" ? picked : null;

  const key = `${tab}|${circleId ?? ""}|${retry}`;

  useEffect(() => {
    if (!ready) return;
    let live = true;
    listFeed(tab, uid, { circleId }).then(r => { if (live) setPage({ key, posts: r?.posts ?? [], cursor: r?.cursor ?? null, failed: !r }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key covers tab, circleId and retry
  }, [uid, key, ready]);

  const status = !page || page.key !== key ? "loading" : page.failed ? "error" : "ready";
  const cursor = page && page.key === key ? page.cursor : null;

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    const r = await listFeed(tab, uid, { circleId, cursor });
    setMore(false);
    if (!r) { toast({ title: "More posts didn't load", message: "Check your connection and try again.", tone: "error" }); return; }
    setPage(pg => pg && pg.key === key
      ? { ...pg, posts: [...pg.posts, ...r.posts.filter(x => !pg.posts.some(y => y.id === x.id))], cursor: r.cursor } : pg);
  };

  const pickedSquad = squads?.find(s => s.id === picked) ?? null;
  const go = (t: Scope, sq: string) => {
    setTab(t); setPicked(sq);
    const slug = t === "squads" ? squads?.find(s => s.id === sq)?.slug : null;
    window.history.replaceState(null, "", slug ? `/feed?squad=${encodeURIComponent(slug)}` : "/feed");
  };

  const patch = useCallback((id: string, p: Partial<FeedPost>) => setPage(pg => pg && { ...pg, posts: pg.posts.map(x => x.id === id ? { ...x, ...p } : x) }), []);
  const kudos = useKudos(uid, patch);
  const actions = usePostActions({
    uid, squads: squads ?? [], pickedSquadId: circleId,
    drop: id => setGone(s => new Set(s).add(id)), restore: id => setGone(s => without(s, id)),
    dropAuthor: id => setGoneAuthors(s => new Set(s).add(id)), restoreAuthor: id => setGoneAuthors(s => without(s, id)),
    patch,
  });

  const shown = useMemo(() => (page && page.key === key ? page.posts : []).filter(p => !gone.has(p.id) && !goneAuthors.has(p.authorId)), [page, key, gone, goneAuthors]);
  const avatars = useSigned("avatars", shown.map(p => p.authorAvatarPath));
  const images = useSigned("post-images", shown.map(p => p.imagePath));

  const m = pickedSquad ? meta.get(pickedSquad.id) : undefined;
  const clubs = `/clubs/${cityId}`;
  const empty = tab === "all"
    ? <EmptyState icon="compass" title="Your feed is quiet." body="Follow runners and join squads to see their runs here." action="Find squads near you" href={clubs} />
    : tab === "following"
      ? <EmptyState icon="user-plus" title="Follow runners to see their runs here." action="Find squads" href={clubs} />
      : !squads?.length
        ? <EmptyState icon="users-round" title="Join a squad to see its posts." action={`See squads in ${cityName}`} href={clubs} />
        : pickedSquad
          ? <EmptyState icon="users-round" title={`Nothing in ${pickedSquad.name} yet.`} body="When a member posts a run, it shows up here." action="Open squad" href={`/s/${pickedSquad.slug}`} />
          : <EmptyState icon="users-round" title="Your squads are quiet." body="When a squadmate posts a run, it shows up here." action={`See squads in ${cityName}`} href={clubs} />;

  return <div className="pw-container pw-page"><div className="split split--feed">
    <div className="stack" style={{ gap: "var(--space-4)" }}>
      <Tabs variant="pill" value={tab} onChange={id => go(id as Scope, picked)} tabs={TABS} />
      {tab === "squads" && squads && squads.length ? <ChipSelect scroll multi={false} label="Squads" value={[picked]}
        onChange={v => go("squads", v[v.length - 1] ?? "all")}
        options={[{ id: "all", label: "All squads" }, ...squads.map(s => ({ id: s.id, label: s.name }))]} /> : null}
      {tab === "squads" && pickedSquad ? <Card>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
          <div style={{ minWidth: 0 }}>
            <b>{pickedSquad.name}</b>
            <div className="t-caption">{m ? `${m.weekPosts} ${m.weekPosts === 1 ? "post" : "posts"} in the last 7 days` : "Posts from this squad"}</div>
            {m?.nextAt ? <div className="t-caption">Next run: {m.nextTitle ? `${m.nextTitle}, ` : ""}{whenLine(m.nextAt)}</div> : null}
          </div>
          <Button size="sm" variant="secondary" href={`/s/${pickedSquad.slug}`}>Open squad</Button>
        </div>
      </Card> : null}

      {status === "loading" ? <><Skeleton variant="post" /><Skeleton variant="post" /></>
        : status === "error" ? <Card><ErrorState title="Your feed didn't load." body="Check your connection and try again." onRetry={() => setRetry(x => x + 1)} /></Card>
        : !shown.length && !cursor ? <Card>{empty}</Card>
        : <>
          {shown.map(p => <FeedPostCard key={p.id} post={p} now={now}
            avatar={p.authorAvatarPath ? avatars.get(p.authorAvatarPath) : null} image={p.imagePath ? images.get(p.imagePath) : null}
            onKudos={give => kudos(p, give)} menu={actions.items(p)} onMenu={id => actions.select(p, id)} />)}
          <LoadMore hasMore={!!cursor} loading={more} onClick={loadMore} endLabel="You're all caught up" />
        </>}
    </div>
    <aside className="stack sticky hide-md">
      <YourWeek uid={uid} />
      <NextRuns squads={squads} cityId={cityId} cityName={cityName} />
    </aside>
  </div>{actions.ui}</div>;
}
