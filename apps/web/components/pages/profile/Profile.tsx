"use client";
// /profile (yours) and /profile?r=<ref> (someone else's). The behaviour spec
// is the old pacr.life js/profile.js, on today's RPCs:
//   - A ref that doesn't decode, a blocked runner and a runner the viewer has
//     no way to reach all get the same "Not visible" page, so a ref is never
//     an oracle for whether it names anybody.
//   - Overview and Milestones exist only when get_runner_profile sends stats
//     (yourself and squadmates). A follower's view of run_summaries is partial
//     by design, and a chart drawn from it would be wrong.
//   - Follow / unfollow is the one write this page makes about someone else.
//     Unfollowing a runner you share no squad with asks first, since it can
//     cost you the sight of them.
//   - Your own name, photo, bio and handle are edited in the app.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, Icon, IconButton } from "@/components/ds/core";
import { BottomSheet, EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { Tabs } from "@/components/ds/nav";
import { Dialog, useToast } from "@/components/ds/overlays";
import { ShareMenu } from "@/components/ds/actions";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { decodeRef } from "@/lib/activity";
import { follow, getProfile, unfollow, useLoad, type Profile as P } from "@/lib/profile";
import { Overview } from "./Overview";
import { People, peopleLoader, type Kind } from "./People";
import { Posts } from "./Posts";
import { Milestones, Squads } from "./Sections";

export function ProfilePage({ r }: { r: string | null }) {
  return <RequireSignIn title="Sign in to see profiles" body="Your runs, posts and squads, and the runners you share a squad with.">
    {auth => <Profile key={(r ?? "") + auth.uid} me={auth.uid} r={r} />}
  </RequireSignIn>;
}

type Tab = "overview" | "posts" | "milestones" | "squads";

function Profile({ me, r }: { me: string; r: string | null }) {
  const subjectId = r ? decodeRef(r) : me;
  const isMe = subjectId === me;
  const toast = useToast();
  const [tab, setTab] = useState<Tab | null>(null);
  const [busy, setBusy] = useState(false);
  const [askUnfollow, setAskUnfollow] = useState(false);
  const [share, setShare] = useState(false);
  const [kind, setKind] = useState<Kind>("following");
  const [sheet, setSheet] = useState(false);

  const fetchProfile = useCallback(() => (subjectId ? getProfile(subjectId) : Promise.resolve(null)), [subjectId]);
  const { data, failed, retry, update } = useLoad<P | null>(fetchProfile);
  const p = data ?? null;
  const patch = (f: (x: P) => P) => update(x => (x ? f(x) : x));
  // A follow changes their followers list, so it starts a fresh one.
  const followed = data?.followedByMe;
  const load = useMemo(() => peopleLoader(subjectId ?? "", isMe, followed), [subjectId, isMe, followed]);
  useEffect(() => { if (p) document.title = `${isMe ? "Your profile" : p.name} · pacr`; }, [p, isMe]);

  if (data === null) return <div className="pw-container sec">
    <EmptyState icon="eye-off" title="This profile isn't visible to you"
      body="You can see a runner when you share a squad, one of you follows the other, or they've shared a public profile link. The link may also be mistyped."
      action="Go to your profile" href="/profile" />
  </div>;
  if (failed) return <div className="pw-container sec"><ErrorState title="Couldn't load this profile" body="Check your connection and try again." onRetry={retry} /></div>;
  if (!p) return <div className="pw-container pw-page"><Skeleton variant="runner" /><div style={{ marginTop: "var(--space-6)" }}><Skeleton lines={4} /></div></div>;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    ...(p.stats ? [{ id: "overview" as const, label: "Overview" }] : []),
    { id: "posts", label: "Posts", count: p.postCount || undefined },
    ...(p.stats ? [{ id: "milestones" as const, label: "Milestones" }] : []),
    { id: "squads", label: "Squads", count: p.squads.length || undefined },
  ];
  const current = tab && tabs.some(t => t.id === tab) ? tab : tabs[0].id;
  const shared = p.squads.filter(s => s.shared);
  const counts = { followers: p.followers, following: p.following };
  const openPeople = (k: Kind) => { setKind(k); setSheet(true); };

  const doFollow = async () => {
    setBusy(true);
    if (p.followedByMe) {
      const ok = await unfollow(me, p.id);
      if (ok) patch(x => ({ ...x, followedByMe: false, followers: Math.max(0, x.followers - 1) }));
      else toast({ title: "Couldn't unfollow", message: "Something went wrong. Try again.", tone: "error" });
    } else {
      const res = await follow(me, p.id);
      if (res.ok) patch(x => ({ ...x, followedByMe: true, followers: x.followers + 1 }));
      else toast(res.reason === "email_required"
        ? { title: "Add an email first", message: "Add an email to your account in the app before following anyone here.", tone: "error" }
        : { title: "Couldn't follow", message: "Something went wrong. Try again.", tone: "error" });
    }
    setBusy(false);
  };
  const onFollow = () => { if (p.followedByMe && !shared.length) setAskUnfollow(true); else void doFollow(); };

  const people = (limit?: number) => <People load={load} me={me} self={isMe} name={p.name} counts={counts} kind={kind} onKind={setKind}
    limit={limit} onSeeAll={limit ? () => setSheet(true) : undefined} />;

  return <div className="pw-container pw-page">
    <header className="row" style={{ alignItems: "flex-start", gap: "var(--space-5)", flexWrap: "nowrap" }}>
      <Avatar name={p.name} src={p.avatar} size={88} />
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: "var(--space-2)" }}>
        <div className="row" style={{ gap: "var(--space-3)" }}>
          <h1 className="t-h1" style={{ overflowWrap: "anywhere" }}>{p.name}</h1>
          {!isMe && p.followsYou ? <Badge tone="accent">Follows you</Badge> : null}
        </div>
        {p.handle || p.location ? <div className="pw-meta">
          {p.handle ? <span><Icon name="at-sign" size={15} />{p.handle}</span> : null}
          {p.location ? <span><Icon name="map-pin" size={15} />{p.location}</span> : null}
        </div> : null}
        {p.bio ? <p className="t-body" style={{ margin: 0, maxWidth: 560 }}>{p.bio}</p> : null}
        {p.tags.length ? <div className="pw-tags">{p.tags.map(t => <Badge key={t} tone={t.includes("·") ? "accent" : "neutral"}>{t}</Badge>)}</div> : null}
        {!isMe && shared.length ? <span className="t-body-s t-secondary">{shared.length === 1 ? "1 squad in common" : `${shared.length} squads in common`} · {shared.map(s => s.name).join(", ")}</span> : null}
        <div className="row" style={{ gap: "var(--space-1)", marginLeft: "calc(var(--space-3) * -1)" }}>
          {p.stats ? <span className="t-body-s" style={{ padding: "0 var(--space-3)" }}><b className="num">{Math.round(p.stats.lifetimeKm).toLocaleString("en-IN")}</b> <span className="t-secondary">km run</span></span> : null}
          <Button variant="ghost" size="sm" onClick={() => openPeople("followers")}><b className="num">{p.followers.toLocaleString("en-IN")}</b> {p.followers === 1 ? "follower" : "followers"}</Button>
          <Button variant="ghost" size="sm" onClick={() => openPeople("following")}><b className="num">{p.following.toLocaleString("en-IN")}</b> following</Button>
        </div>
        <div className="row" style={{ marginTop: "var(--space-2)" }}>
          {isMe
            ? <><Button variant="secondary" icon="smartphone" href="/download">Edit in the app</Button><IconButton icon="settings" label="Settings" variant="secondary" href="/settings" /></>
            : <Button variant={p.followedByMe ? "secondary" : "primary"} icon={p.followedByMe ? "check" : "user-plus"} loading={busy} aria-pressed={p.followedByMe} onClick={onFollow}>
              {p.followedByMe ? "Following" : p.followsYou ? "Follow back" : "Follow"}</Button>}
          {p.handle ? <IconButton icon="share-2" label="Share profile" variant="secondary" onClick={() => setShare(true)} /> : null}
          {p.instagram ? <IconButton icon="instagram" label={`@${p.instagram} on Instagram`} variant="secondary" href={`https://www.instagram.com/${encodeURIComponent(p.instagram)}/`} target="_blank" rel="noopener noreferrer" /> : null}
        </div>
      </div>
    </header>

    <div style={{ margin: "var(--space-8) 0 var(--space-6)" }}><Tabs tabs={tabs} value={current} onChange={id => setTab(id as Tab)} /></div>
    {!p.stats && !isMe ? <p className="t-body-s t-secondary" style={{ margin: "calc(var(--space-2) * -1) 0 var(--space-6)", maxWidth: 620 }}>
      You don&apos;t share a squad with {p.name}, so their runs and stats stay private. You see the posts they share with followers or everyone.</p> : null}

    {current === "overview" && p.stats ? <Overview subjectId={p.id} isMe={isMe} stats={p.stats}
      aside={<Card><h3 className="t-h4" style={{ marginBottom: "var(--space-3)" }}>People</h3>{people(6)}</Card>} />
      : current === "posts" ? <Posts subjectId={p.id} me={me} isMe={isMe} name={p.name} />
      : current === "milestones" && p.stats ? <Milestones bests={p.stats.bests} isMe={isMe} />
      : <Squads squads={p.squads} isMe={isMe} name={p.name} />}

    <BottomSheet open={sheet} onClose={() => setSheet(false)} title={isMe ? "Your people" : `${p.name}'s people`}>{sheet ? people() : null}</BottomSheet>
    <Dialog open={askUnfollow} onClose={() => setAskUnfollow(false)} title={`Unfollow ${p.name}?`}
      actions={<><Button variant="secondary" onClick={() => setAskUnfollow(false)}>Cancel</Button><Button variant="destructive" onClick={() => { setAskUnfollow(false); void doFollow(); }}>Unfollow</Button></>}>
      <p style={{ margin: 0 }}>You share no squad, so this is the whole connection: their posts leave your Following feed, and this profile may stop showing them. You can follow again later.</p>
    </Dialog>
    {p.handle ? <ShareMenu open={share} onClose={() => setShare(false)} url={`/u/${p.handle}`} title="Share profile" text={isMe ? undefined : `${p.name} on pacr`} /> : null}
  </div>;
}
