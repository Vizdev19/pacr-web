"use client";
// /s/<slug>: ui_kits/website/Squad.jsx (the public view) on get_club_page.
// Members get a banner pointing at the app for chat, announcements and the
// leaderboard (the member tabs aren't on the web yet); owners and organisers
// get "Manage in dashboard".
import { Avatar, AvatarGroup, Button, Card, Icon, IconButton, Media, TrustTag, VerifiedMark } from "@/components/ds/core";
import { EventCard, RunCard, type RunCardProps } from "@/components/ds/content";
import { DirectionsLink, PlaceMap } from "@/components/ds/actions";
import { Breadcrumbs } from "@/components/ds/nav";
import { istParts, km, whenLine } from "@/lib/format";
import { plural, type Squad, type SquadEventCard, type SquadRun } from "@/lib/squad";
import { InviteBanner, JoinAction, joinNote, MemberBanner, runCardProps, type JoinState } from "./parts";

const POLICY_TAG = { open: "open", request: "ask", invite: "invite" } as const;

export type SquadViewProps = {
  squad: Squad; events: SquadEventCard[]; today: string; signedIn: boolean; invited: boolean;
  joinState: JoinState; busy: boolean; onJoin: () => void; signin: string; appHref: string; staff: boolean;
  followNames: string[]; followCount: number; runHref: (ref: string) => string;
  rsvpOf: (r: SquadRun) => RunCardProps["rsvp"]; onRsvp: (r: SquadRun) => void; onShare: () => void; canShare: boolean;
};

function followLine(names: string[], count: number): string | null {
  if (!count || !names.length) return null;
  if (count === 1) return `${names[0]}, who you follow, is a member`;
  if (count === 2 && names.length > 1) return `${names[0]} and ${names[1]}, who you follow, are members`;
  return `${names[0]} and ${plural(count - 1, "other")} you follow are members`;
}

/** One line per weekly run: "Sat · Long run · 6:00 am · 10 km". */
function schedule(runs: SquadRun[]) {
  const seen = new Set<string>();
  return runs.filter(r => r.repeatWeekly).map(r => {
    const p = istParts(r.startsAt);
    return { key: `${p.dow}|${p.time}|${r.title}`, dow: p.dow, title: r.title, right: [p.time, km(r.distanceKm) ? `${km(r.distanceKm)} km` : null].filter(Boolean).join(" · ") };
  }).filter(x => (seen.has(x.key) ? false : (seen.add(x.key), true)));
}

export function SquadView(p: SquadViewProps) {
  const { squad: s, joinState } = p;
  const member = joinState === "member";
  const where = s.homeAddress || s.location;
  const hasPlace = s.homeLat != null || !!s.homeAddress;
  const next = s.runs[0];
  const weekly = schedule(s.runs);
  const follow = followLine(p.followNames, p.followCount);
  const note = joinNote(joinState, s);
  const since = s.createdAt ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", month: "short", year: "numeric" }).format(new Date(s.createdAt)) : null;
  const share = p.canShare ? <IconButton icon="share-2" label="Share squad" variant={s.cover ? "overlay" : "secondary"} onClick={p.onShare} /> : null;

  return <div className="pw-container" style={{ paddingBottom: "var(--space-16)" }}>
    <div className="row" style={{ paddingTop: "var(--space-4)", justifyContent: "space-between", flexWrap: "nowrap" }}>
      <Breadcrumbs items={[{ label: "Squads", href: "/clubs" }, { label: s.name }]} />
      {!s.cover ? share : null}
    </div>
    {p.invited && !member && joinState !== "banned" ? <div style={{ marginTop: "var(--space-4)" }}><InviteBanner name={s.name} signedIn={p.signedIn} appHref={p.appHref} /></div> : null}
    {s.cover ? <div className="ent-cover"><Media ratio="5:2" src={s.cover} alt="" label={null} /><div style={{ position: "absolute", right: "var(--space-3)", top: "var(--space-3)" }}>{share}</div></div> : null}
    <div className="ent-head" style={s.cover ? undefined : { marginTop: "var(--space-5)" }}>
      <div className="ent-head__tile"><Media ratio="1:1" tile src={s.photo} alt="" /></div>
      <div className="ent-head__txt">
        <h1 className="t-h1">{s.name}{s.verified ? <VerifiedMark size={24} /> : null}</h1>
        <div className="pw-meta" style={{ marginTop: "var(--space-2)" }}>
          {s.location ? <span><Icon name="map-pin" size={15} />{s.location}</span> : null}
          <span><Icon name="users-round" size={15} />{plural(s.memberCount, "member")}</span>
          {s.instagram ? <span><Icon name="instagram" size={15} /><a href={`https://instagram.com/${encodeURIComponent(s.instagram)}`} target="_blank" rel="noopener" style={{ color: "inherit" }}>@{s.instagram}</a></span> : null}
        </div>
        <div className="pw-tags" style={{ marginTop: "var(--space-3)" }}>
          <TrustTag kind={POLICY_TAG[s.joinPolicy]} />{s.womenOnly ? <TrustTag kind="women-only" /> : null}{s.verified ? <TrustTag kind="verified" /> : null}
        </div>
      </div>
      <div className="hide-md" style={{ paddingBottom: "var(--space-1)" }}><JoinAction state={joinState} policy={s.joinPolicy} signin={p.signin} onJoin={p.onJoin} busy={p.busy} /></div>
    </div>

    {member ? <div style={{ marginTop: "var(--space-6)" }}><MemberBanner appHref={p.appHref} /></div> : null}

    <div className="split" style={{ marginTop: "var(--space-8)" }}>
      <div>
        <div className="block"><h2>Upcoming runs</h2>
          <div className="stack">{s.runs.length
            ? s.runs.map(r => <RunCard key={r.ref} {...runCardProps(r, { today: p.today, squadWomenOnly: s.womenOnly, href: p.runHref(r.ref), rsvp: p.rsvpOf(r), onRsvp: () => p.onRsvp(r) })} />)
            : <p className="t-secondary" style={{ margin: 0 }}>No runs on the calendar yet. New runs show up here as the organisers schedule them.</p>}</div>
        </div>
        {s.description ? <div className="block prose"><h2>About</h2>{s.description.split(/\n+/).filter(x => x.trim()).map((para, i) => <p key={i}>{para}</p>)}</div> : null}
        {weekly.length ? <div className="block"><h2>Weekly schedule</h2>
          <Card pad={false}>{weekly.map((w, i) => <div key={w.key} className="row" style={{ padding: "var(--space-3) var(--space-4)", borderTop: i ? "1px solid var(--border-subtle)" : 0, justifyContent: "space-between" }}>
            <span><b style={{ display: "inline-block", minWidth: "var(--space-12)" }}>{w.dow}</b>{w.title}</span><span className="t-secondary num">{w.right}</span></div>)}</Card>
        </div> : null}
        {s.rules.length ? <div className="block"><h2>Squad rules</h2><ol className="rules">{s.rules.map((r, i) => <li key={i}>{r}</li>)}</ol></div> : null}
        {p.events.length ? <div className="block"><h2>Events by {s.name}</h2><div className="grid-posters">{p.events.map(e => <EventCard key={e.href} {...e} />)}</div></div> : null}
      </div>

      <aside className="stack sticky">
        <Card className="hide-md"><div className="stack">
          <JoinAction state={joinState} policy={s.joinPolicy} signin={p.signin} onJoin={p.onJoin} busy={p.busy} block />
          {note ? <span className="t-caption">{note}</span> : null}
        </div></Card>
        {hasPlace ? <Card><div className="stack">
          <PlaceMap lat={s.homeLat} lng={s.homeLng} label={where} />
          <div><span className="t-caption">Home base</span><div><b>{where}</b></div></div>
          <DirectionsLink address={where} lat={s.homeLat} lng={s.homeLng} placeId={s.homePlaceId} />
        </div></Card> : null}
        <Card>
          <span className="t-caption">Organiser</span>
          <div className="row" style={{ marginTop: "var(--space-2)" }}><Avatar name={s.organiserName || s.name} size={36} /><b>{s.organiserName || "The squad's owner"}</b></div>
          {since ? <p className="t-caption" style={{ margin: "var(--space-2) 0 0" }}>On pacr since {since}</p> : null}
          {p.signedIn
            ? (follow ? <div className="row" style={{ marginTop: "var(--space-3)" }}><AvatarGroup names={p.followNames} total={p.followCount} size={24} /><span className="t-caption">{follow}</span></div>
              : <p className="t-caption" style={{ margin: "var(--space-3) 0 0" }}>{plural(s.memberCount, "member")}. Nobody you follow is in it yet.</p>)
            : <p className="t-caption" style={{ margin: "var(--space-3) 0 0" }}>{plural(s.memberCount, "member")}. Sign in to see people you follow.</p>}
        </Card>
        {member && p.staff ? <Button variant="ghost" icon="layout-dashboard" href="/host">Manage in dashboard</Button> : null}
      </aside>
    </div>

    {!member ? <div className="only-md mbar" style={{ bottom: p.signedIn ? "var(--tabbar-h)" : 0, zIndex: 31 }}>
      <div><b>{s.name}</b><div className="t-caption">{plural(s.memberCount, "member")}{next ? ` · Next ${whenLine(next.startsAt)}` : ""}</div></div>
      <JoinAction state={joinState} policy={s.joinPolicy} signin={p.signin} onJoin={p.onJoin} busy={p.busy} />
    </div> : null}
  </div>;
}
