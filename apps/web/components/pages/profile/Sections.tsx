"use client";
// The Milestones and Squads tabs.
//   Milestones: get_runner_profile's whole-run bests for 5K, 10K, half and
//   marathon. Badges are worked out on the phone (only pacr_badges_ack syncs),
//   so the web shows bests and says where badges are.
//   Squads: the squads get_runner_profile returns (shared ones, plus their
//   public clubs), each linking to /s/<slug>.
import { useEffect, useState } from "react";
import { Badge, TrustTag } from "@/components/ds/core";
import { AchievementTile, SquadCard } from "@/components/ds/content";
import { EmptyState, Skeleton } from "@/components/ds/feedback";
import { Banner } from "@/components/ds/overlays";
import { duration } from "@/lib/time";
import { dateLong, squadExtras, type Best, type ProfileSquad, type SquadExtra } from "@/lib/profile";

// Labels are shown uppercase by the tile, and as "No half marathon yet" when locked.
const DISTANCES: [string, string][] = [["5K", "5K"], ["10K", "10K"], ["Half", "half marathon"], ["Marathon", "marathon"]];

export function Milestones({ bests, isMe }: { bests: Best[]; isMe: boolean }) {
  return <div className="stack" style={{ gap: "var(--space-8)", maxWidth: 860 }}>
    <section className="block" aria-label="Personal bests">
      <h2>Personal bests</h2>
      <p className="t-body-s t-secondary" style={{ margin: 0 }}>From whole runs: the fastest run within 5% over each distance, timed to the distance. The app&apos;s records count the fastest stretch inside any run, so they can be quicker.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "var(--space-3)" }}>
        {DISTANCES.map(([key, label]) => {
          const b = bests.find(x => x.label === key);
          return <AchievementTile key={key} type="record" label={label} state={b ? "earned" : "locked"}
            value={b ? duration(b.timeSec) ?? "—" : undefined}
            date={b ? [dateLong(b.startedAt), b.neighborhood].filter(Boolean).join(" · ") : undefined} />;
        })}
      </div>
    </section>
    <Banner tone="neutral" icon="award" title="Badges are in the app">{isMe ? "Your badges are worked out on your phone, so they show in the app under Profile." : "Badges are worked out on each runner's phone, so they only show in the app."}</Banner>
  </div>;
}

export function Squads({ squads, isMe, name }: { squads: ProfileSquad[]; isMe: boolean; name: string }) {
  const [extra, setExtra] = useState<Map<string, SquadExtra> | null>(null);
  useEffect(() => {
    let alive = true;
    squadExtras(squads).then(m => { if (alive) setExtra(m); }, () => { if (alive) setExtra(new Map()); });
    return () => { alive = false; };
  }, [squads]);

  if (!squads.length) return isMe
    ? <EmptyState boxed icon="users-round" title="You're not in a squad yet." body="Find a squad near you and join it to run with them every week." action="Find squads" href="/clubs" />
    : <EmptyState boxed icon="users-round" title="No squads to show." body={`You see the squads you share with ${name} and the public clubs they're in.`} />;
  if (!extra) return <div className="stack"><Skeleton variant="runner" /><Skeleton variant="runner" /></div>;

  return <div className="stack" style={{ maxWidth: 760 }}>
    {squads.map(s => {
      const x = extra.get(s.id);
      return <SquadCard key={s.id} layout="row" name={s.name} href={x?.slug ? `/s/${x.slug}` : undefined} photo={x?.photo ?? null}
        verified={s.verified} area={s.location} members={s.memberCount} policy={x?.policy ?? null} womenOnly={x?.womenOnly ?? false}>
        <div className="pw-tags" style={{ justifyContent: "flex-end" }}>
          {s.role === "owner" ? <TrustTag kind="owner" size="sm" /> : null}
          {!isMe && s.shared ? <Badge tone="accent" size="sm">You&apos;re in it</Badge> : null}
        </div>
      </SquadCard>;
    })}
  </div>;
}
