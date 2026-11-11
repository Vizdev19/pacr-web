"use client";
// Followers / following as RunnerRows. Mine come from list_my_follows, someone
// else's from list_runner_follows, which lists only people the viewer could
// open a profile for, so a list can be shorter than its count; the page says
// how many it isn't showing rather than hiding the gap.
import { useEffect, useState } from "react";
import { Badge, Button } from "@/components/ds/core";
import { RunnerRow } from "@/components/ds/content";
import { EmptyState, Skeleton } from "@/components/ds/feedback";
import { SegmentedControl } from "@/components/ds/nav";
import { encodeRef } from "@/lib/refs";
import { getPeople, type Person } from "@/lib/profile";

export type Kind = "following" | "followers";
export type PeopleLoader = (kind: Kind) => Promise<Person[]>;

/**
 * One loader per profile, so the card and the sheet share a list. Lists are
 * kept per follow state: following or unfollowing changes their followers.
 */
export function peopleLoader(subjectId: string, self: boolean, followed?: boolean): PeopleLoader {
  const cache = new Map<string, Promise<Person[]>>();
  return kind => {
    const k = `${kind}:${followed ? 1 : 0}`;
    let p = cache.get(k);
    if (!p) { p = getPeople(subjectId, self, kind); p.catch(() => cache.delete(k)); cache.set(k, p); }
    return p;
  };
}

export function People({ load, me, self, name, counts, kind, onKind, limit, onSeeAll }:
  { load: PeopleLoader; me: string; self: boolean; name: string; counts: Record<Kind, number>; kind: Kind; onKind: (k: Kind) => void; limit?: number; onSeeAll?: () => void }) {
  const [state, setState] = useState<{ kind: Kind; list: Person[] | null; failed: boolean }>({ kind, list: null, failed: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    load(kind).then(list => { if (alive) setState({ kind, list, failed: false }); }, () => { if (alive) setState({ kind, list: null, failed: true }); });
    return () => { alive = false; };
  }, [load, kind, attempt]);

  const ready = state.kind === kind;
  const list = ready ? state.list : null;
  const shown = list && limit ? list.slice(0, limit) : list;
  const hidden = list ? Math.max(0, counts[kind] - list.length) : 0;

  return <div className="stack">
    <SegmentedControl size="sm" label="People" value={kind} onChange={id => onKind(id as Kind)}
      options={[{ id: "following", label: `Following ${counts.following.toLocaleString("en-IN")}` }, { id: "followers", label: `Followers ${counts.followers.toLocaleString("en-IN")}` }]} />
    {ready && state.failed ? <EmptyState icon="circle-alert" title="Couldn't load these people." body="Check your connection and try again." action="Try again" onAction={() => setAttempt(a => a + 1)} />
      : !shown ? <><Skeleton variant="runner" /><Skeleton variant="runner" /></>
      : shown.length ? <div>
        {shown.map(p => <RunnerRow key={p.id} name={p.name} avatar={p.avatar} isYou={p.id === me}
          href={p.id === me ? "/profile" : `/profile?r=${encodeRef(p.id) ?? ""}`}
          sub={[p.handle ? "@" + p.handle : null, p.place].filter(Boolean).join(" · ") || undefined}
          action={self && kind === "following" && p.followsYou ? <Badge size="sm">Follows you</Badge> : undefined} />)}
      </div>
      : <p className="t-body-s t-secondary" style={{ margin: 0 }}>{emptyLine(kind, self, name, counts[kind])}</p>}
    {list && hidden > 0 ? <p className="t-caption" style={{ margin: 0 }}>{hidden.toLocaleString("en-IN")} more not shown. pacr only lists runners whose profile you could open.</p> : null}
    {onSeeAll && list && limit && list.length > limit ? <Button variant="ghost" size="sm" onClick={onSeeAll} style={{ alignSelf: "flex-start" }}>See all {list.length.toLocaleString("en-IN")}</Button> : null}
  </div>;
}

function emptyLine(kind: Kind, self: boolean, name: string, count: number): string {
  if (count > 0) return "None of them are runners you can see.";
  if (self) return kind === "following" ? "You're not following anyone yet. Follow runners from their profile or the feed." : "Nobody follows you yet.";
  return kind === "following" ? `${name} isn't following anyone yet.` : `Nobody follows ${name} yet.`;
}
