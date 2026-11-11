"use client";
// /squads ("Your squads"): the app's Squads tab list on my_squads_overview,
// one SquadCard row per squad, linking to its page by slug.
import { useEffect, useState } from "react";
import { Badge, Button, TrustTag } from "@/components/ds/core";
import { SquadCard } from "@/components/ds/content";
import { EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { whenLine } from "@/lib/format";
import { mySquads, type MySquad, type Role } from "@/lib/mysquads";

const ROLE_TAG: Record<Role, string | null> = { owner: "owner", organiser: "organiser", run_leader: "run-leader", member: null };

export function MySquadsPage() {
  return <RequireSignIn title="Sign in to see your squads" body="The squads you run with, their next runs and what's new.">
    {() => <Squads />}
  </RequireSignIn>;
}

function Squads() {
  const [list, setList] = useState<MySquad[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [key, setKey] = useState(0);
  useEffect(() => {
    let alive = true;
    mySquads().then(l => { if (alive) { setList(l); setFailed(false); } }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [key]);

  return <div className="pw-container" style={{ paddingTop: 24, paddingBottom: 64, maxWidth: 840 }}>
    <div className="sec-h"><h1 className="t-h1">Your squads</h1>
      {list?.length ? <Button variant="secondary" size="sm" icon="search" href="/clubs">Find squads</Button> : null}</div>
    {failed && !list ? <ErrorState title="We couldn't load your squads" body="Check your connection, then try again." onRetry={() => setKey(k => k + 1)} />
      : !list ? <div className="stack">{[0, 1, 2].map(i => <Skeleton key={i} variant="run" />)}</div>
      : !list.length ? <EmptyState boxed icon="users-round" title="You're not in a squad yet." body="Squads run together every week. Find one near you and join from its page." action="Find squads near you" href="/clubs" />
      : <div className="stack">{list.map(s => <Row key={s.slug} s={s} />)}</div>}
  </div>;
}

function Row({ s }: { s: MySquad }) {
  const tag = ROLE_TAG[s.role];
  const staff = s.role === "owner" || s.role === "organiser";
  const extras = [
    s.unreadPosts > 0 ? <Badge key="p" tone="accent" size="sm">{s.unreadPosts} new {s.unreadPosts === 1 ? "post" : "posts"}</Badge> : null,
    s.unreadChat > 0 && !s.muted ? <Badge key="c" tone="info" size="sm">{s.unreadChat} in chat</Badge> : null,
    staff && s.pendingRequests > 0 ? <Badge key="r" tone="warning" size="sm">{s.pendingRequests} {s.pendingRequests === 1 ? "request" : "requests"}</Badge> : null,
  ].filter(Boolean);
  return <SquadCard layout="row" name={s.name} href={`/s/${s.slug}`} photo={s.photo} verified={s.verified} area={s.location}
    members={s.members} nextRun={s.nextRunAt ? `${s.nextRunTitle ? s.nextRunTitle + " · " : ""}${whenLine(s.nextRunAt)}` : null} policy={null}>
    {tag || extras.length ? <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>{tag ? <TrustTag kind={tag} size="sm" /> : null}{extras}</div> : null}
  </SquadCard>;
}
