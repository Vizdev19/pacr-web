"use client";

// Overview (ui_kits/host/Overview.jsx): what needs the host, what's next, the
// week's numbers and what just happened. Every card is built from what the
// database has today, so there are no weather, pacer or week-over-week items:
// those need data pacr doesn't keep yet.

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ActionCard, Avatar, AvatarGroup, Badge, Button, DateTile, EmptyState, GlassCard, Icon, IconButton, ProgressBar,
  Skeleton, StatCard, type IconName,
} from "@/components/ds";
import { Meta, SectionTitle, kMuted, kitGrid, LoadError } from "@/components/shell/kit";
import {
  answerJoinRequest, hostedEvents, listJoinRequests, listReports, listRuns, membersLite, runHistory, squadDetail,
  squadsOverview, type HostedEvent, type JoinRequest, type MemberLite, type Report, type RunLogRow,
  type SquadDetail, type SquadRun,
} from "@/lib/api";
import { ago, day, firstName, km, num, plural, tile, time, until } from "@/lib/format";
import { isStaff, useHost, type Host } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { encodeRef, eventEditHref, eventNewHref } from "@/lib/refs";
import { goSite } from "@/lib/supabase";

type Data = {
  now: number;
  detail: SquadDetail | null;
  weekKm: number;
  runs: SquadRun[];
  events: HostedEvent[];
  requests: JoinRequest[];
  reports: Report[];
  members: MemberLite[];
  log: RunLogRow[];
};

async function load(host: Host): Promise<Data> {
  const mine = (e: HostedEvent) => e.host?.kind === host.kind && e.host?.id === host.id;
  const events = (await hostedEvents(false)).filter(mine);
  const now = Date.now();
  if (host.kind === "organizer") {
    return { now, detail: null, weekKm: 0, runs: [], events, requests: [], reports: [], members: [], log: [] };
  }
  const staff = isStaff(host.roleKey);
  const [detail, overview, runs, requests, reports, members, log] = await Promise.all([
    squadDetail(host.id),
    squadsOverview(),
    listRuns(host.id, 30),
    staff ? listJoinRequests(host.id) : Promise.resolve([]),
    staff ? listReports(host.id) : Promise.resolve([]),
    membersLite(host.id),
    // The run log is the owner's; nobody else may read it.
    host.roleKey === "owner" ? runHistory(host.id, 20).catch(() => []) : Promise.resolve([]),
  ]);
  const upcoming = runs.filter(r => new Date(r.event_at).getTime() > now - 3600000).sort((a, b) => a.event_at.localeCompare(b.event_at));
  return {
    now, detail, weekKm: Number(overview.find(o => o.circle_id === host.id)?.week_km ?? 0), runs: upcoming, events,
    requests, reports, members, log,
  };
}

// ── Key numbers ────────────────────────────────────────────────────────────

function Kpis({ d, host }: { d: Data; host: Host }) {
  const week = d.runs.filter(r => new Date(r.event_at).getTime() < d.now + 7 * 86400000);
  const live = d.events.filter(e => e.status === "published");
  const sold = live.reduce((a, e) => a + e.sold, 0);
  const tiles: { label: string; value: number; unit?: string; icon: IconName; tone: "lime" | "sky" | "amber" | "orange"; format?: (v: number | string) => string }[] = [];
  if (host.kind === "squad") {
    if (isStaff(host.roleKey)) tiles.push({ label: "Members", value: d.detail?.member_count ?? d.members.length, icon: "users", tone: "lime" });
    tiles.push({ label: "Runs in the next 7 days", value: week.length, icon: "footprints", tone: "sky" });
    tiles.push({ label: "Going to those runs", value: week.reduce((a, r) => a + r.going_count, 0), icon: "user-check", tone: "amber" });
    tiles.push({ label: "Km run this week", value: d.weekKm, unit: "km", icon: "route", tone: "lime", format: v => (typeof v === "number" ? km(v) : v) });
  }
  if (host.kind === "organizer") tiles.push({ label: "Events on sale", value: live.length, icon: "ticket", tone: "orange" });
  if (host.kind === "organizer" || live.length) tiles.push({ label: "Tickets taken", value: sold, icon: "ticket", tone: "orange" });
  // Two to a row on a phone, one row on a desktop.
  return <div style={kitGrid(150)}>{tiles.map(t => <StatCard key={t.label} label={t.label} value={t.value} unit={t.unit} icon={t.icon} tone={t.tone} format={t.format} />)}</div>;
}

// ── Needs your attention ───────────────────────────────────────────────────

function Answers({ q }: { q: JoinRequest }) {
  const answers = (q.answers ?? []).filter(a => a.a?.trim()).slice(0, 2);
  if (!answers.length) return null;
  return (
    <div style={{ display: "grid", gap: 6, padding: "10px 12px", borderRadius: 10, background: "var(--surface-panel)" }}>
      {answers.map((a, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,160px) minmax(0,1fr)", gap: 10, font: "400 12px/1.4 var(--font-sans)" }}>
          <span style={{ color: "var(--text-muted)" }}>{a.q}</span><span style={{ color: "var(--text-strong)" }}>{a.a}</span>
        </div>
      ))}
    </div>
  );
}

const REPORT_KIND: Record<string, string> = { post: "Post", comment: "Comment", message: "Chat message", user: "Runner" };

type Item = {
  k: string; icon: IconName; tone?: "neutral" | "warning" | "danger" | "accent"; kind: string; title: string; reason: string;
  extra?: ReactNode; more?: { label: string; onClick: () => void };
  primary?: { label: string; icon?: IconName; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
};

function Attention({ d, host, onChanged }: { d: Data; host: Host; onChanged: () => void }) {
  const { notify, notifyError, refreshCounts } = useHost();
  const router = useRouter();
  const [done, setDone] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const staff = isStaff(host.roleKey);
  const items: Item[] = [];

  if (host.kind === "organizer" && host.status !== "approved") {
    items.push({
      k: "org", icon: "badge-check", tone: host.status === "pending" ? "accent" : "danger", kind: "Organizer account",
      title: host.status === "pending" ? "Your organizer account is in review" : "Your organizer account isn’t approved",
      reason: host.status === "pending" ? "You can create events once the pacr team approves it." : "Open Settings to see the note from the pacr team.",
      primary: { label: "Open settings", onClick: () => router.push("/settings") },
    });
  }

  const q = d.requests[0];
  if (staff && q) {
    const name = q.display_name ?? "A runner";
    const facts = [ago(q.created_at, d.now), q.follows_in_squad ? `follows ${plural(q.follows_in_squad, "member")}` : "", q.runs_30d ? `${plural(q.runs_30d, "run")} in the last 30 days` : ""].filter(Boolean);
    const answer = async (approve: boolean) => {
      if (busy) return;
      setBusy(true);
      try {
        await answerJoinRequest(host.id, q.user_id, approve);
        const msg = approve ? `${name} joined ${host.name}.` : "They can ask again later.";
        setDone(x => ({ ...x, req: msg }));
        notify(approve ? "success" : "neutral", approve ? "Member approved" : "Request declined", msg);
        refreshCounts();
      } catch (e) {
        notifyError(approve ? "Couldn’t approve" : "Couldn’t decline", e);
      } finally {
        setBusy(false);
      }
    };
    items.push({
      k: "req", icon: "user-plus", kind: `Join request · 1 of ${num(d.requests.length)}`, title: `${name} wants to join`, reason: facts.join(" · "),
      extra: <Answers q={q} />,
      secondary: { label: "Decline", onClick: () => answer(false) }, primary: { label: "Approve", icon: "check", onClick: () => answer(true) },
      more: d.requests.length > 1 ? { label: `All ${num(d.requests.length)} requests`, onClick: () => router.push("/requests") } : undefined,
    });
  }

  const rep = d.reports[0];
  if (staff && rep) {
    items.push({
      k: "rep", icon: "flag", tone: "danger", kind: `Report · ${plural(rep.reportCount, "report")}`,
      title: `${REPORT_KIND[rep.targetType] ?? "Post"}${rep.authorName ? ` by ${rep.authorName}` : ""} was reported`,
      reason: rep.body ? `“${rep.body.slice(0, 160)}”` : "Open Moderation to see it.",
      primary: { label: d.reports.length > 1 ? `Review ${num(d.reports.length)}` : "Review", onClick: () => router.push("/moderation") },
    });
  }

  if (host.kind === "squad" && d.detail && (!d.detail.description?.trim() || !d.detail.location?.trim())) {
    items.push({
      k: "setup", icon: "circle-alert", tone: "warning", kind: "Squad setup", title: "Finish setting up the squad before scheduling runs",
      reason: `${host.name} needs ${!d.detail.description?.trim() ? "a description" : ""}${!d.detail.description?.trim() && !d.detail.location?.trim() ? " and " : ""}${!d.detail.location?.trim() ? "a home base" : ""}.`,
      primary: staff ? { label: "Open settings", onClick: () => router.push("/settings") } : undefined,
    });
  }

  for (const r of d.runs.filter(x => !x.meeting_point?.trim() && new Date(x.event_at).getTime() < d.now + 14 * 86400000).slice(0, 2)) {
    const ref = encodeRef(r.id);
    items.push({
      k: `place:${ref}`, icon: "map-pin-off", tone: "warning", kind: "Run setup", title: `${day(r.event_at)} ${r.title} has no meeting place`,
      reason: `${plural(r.going_count, "runner")} going. Runs can’t be edited: cancel it and schedule it again with a place.`,
      primary: { label: "Open run", onClick: () => router.push(`/runs?run=${ref}`) },
    });
  }

  if (host.kind === "squad" && d.detail && !d.runs.length && d.detail.description?.trim() && d.detail.location?.trim()) {
    items.push({
      k: "norun", icon: "footprints", kind: "Calendar", title: "No runs on the calendar",
      reason: "Squads grow around a regular run. Schedule one and members can RSVP from the app.",
      primary: { label: "Schedule run", icon: "plus", onClick: () => router.push("/runs?new=1") },
    });
  }

  for (const e of d.events.filter(x => x.status === "published" && x.capacity != null && x.capacity > 0 && x.sold >= x.capacity * 0.9).slice(0, 2)) {
    const ref = encodeRef(e.id), full = e.sold >= (e.capacity ?? 0);
    items.push({
      k: `cap:${ref}`, icon: "list-ordered", tone: "warning", kind: "Event capacity", title: full ? `${e.title} is sold out` : `${e.title} is almost full`,
      reason: `${num(e.sold)} / ${num(e.capacity ?? 0)} seats taken for ${day(e.starts_at)}.`,
      primary: { label: "Open event", onClick: () => router.push(`/events?event=${ref}`) },
    });
  }

  for (const e of d.events.filter(x => x.status === "draft").slice(0, 2)) {
    items.push({
      k: `draft:${encodeRef(e.id)}`, icon: "ticket", kind: "Draft event", title: `${e.title || "An untitled event"} isn’t published yet`,
      reason: `Planned for ${day(e.starts_at)}. Runners can’t see it until you publish.`,
      primary: { label: "Finish event", onClick: () => goSite(eventEditHref(e.id)) },
    });
  }

  if (host.kind === "squad" && host.roleKey === "owner" && !host.verified) {
    items.push({
      k: "verify", icon: "badge-check", tone: "accent", kind: "Verification", title: "Get verified to host events",
      reason: "Verified squads carry the badge and can host free and ticketed events.",
      primary: { label: "Open settings", onClick: () => router.push("/settings") },
    });
  }

  const waiting = items.filter(i => !done[i.k]).length;
  return (
    <div style={{ minWidth: 0 }}>
      <SectionTitle style={{ marginTop: 6 }} right={waiting ? <Badge tone="neutral" variant="solid">{waiting} waiting</Badge> : null}>Needs your attention</SectionTitle>
      {!items.length ? (
        <EmptyState variant="done" title="You’re all caught up"
          message={host.kind === "squad"
            ? `No join requests or reports waiting.${d.runs[0] ? ` Next run is ${day(d.runs[0].event_at)} at ${time(d.runs[0].event_at)}.` : ""}`
            : "Nothing is waiting on you."}
          action={{ label: host.kind === "squad" ? "Open calendar" : "Open events", variant: "secondary", icon: "calendar", onClick: () => router.push(host.kind === "squad" ? "/calendar" : "/events") }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(i => (
            <ActionCard key={i.k} icon={i.icon} tone={i.tone} kind={i.kind} title={i.title} reason={i.reason} secondary={i.secondary} primary={i.primary}
              done={!!done[i.k]} doneLabel={done[i.k]}>
              {i.extra}
              {i.more ? (
                <button type="button" onClick={i.more.onClick} style={{ marginTop: 8, padding: 0, border: 0, background: "none", cursor: "pointer", font: "500 12px var(--font-sans)", color: "var(--text-strong)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {i.more.label}<Icon name="chevron-right" size={13} />
                </button>
              ) : null}
            </ActionCard>
          ))}
          {Object.keys(done).length ? <div><Button size="sm" variant="ghost" icon="refresh-cw" onClick={() => { setDone({}); onChanged(); }}>Show what’s next</Button></div> : null}
        </div>
      )}
    </div>
  );
}

// ── Next up ────────────────────────────────────────────────────────────────

function NextRun({ r, d }: { r: SquadRun; d: Data }) {
  const router = useRouter();
  const ref = encodeRef(r.id), t = tile(r.event_at);
  const goers = r.goers ?? [];
  return (
    <GlassCard title="Next up" subtitle={`${day(r.event_at)} · ${until(r.event_at, d.now)}`}
      actions={<IconButton icon="arrow-up-right" label="Open run" variant="secondary" size="sm" onClick={() => router.push(`/runs?run=${ref}`)} />}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <DateTile day={t.day} date={t.date} month={t.month} kind="run" />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "500 17px/1.25 var(--font-sans)", color: "var(--text-strong)" }}>{r.title}{r.distance_km ? ` · ${km(r.distance_km)} km` : ""}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
            <Meta icon="clock">{time(r.event_at)}</Meta>
            <Meta icon="map-pin">{r.meeting_point?.trim() || "No meeting place"}</Meta>
            {r.pace_label ? <Meta icon="gauge">{r.pace_label}</Meta> : null}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
        <span style={{ font: "var(--type-kpi)", letterSpacing: "var(--tracking-display)", color: "var(--text-strong)" }}>{num(r.going_count)}</span>
        <span style={{ ...kMuted, flex: 1 }}>going</span>
        {goers.length ? <AvatarGroup names={goers.map(g => g.name ?? "Runner")} size={26} max={4} /> : null}
      </div>
      {r.leader_name ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 0", marginTop: 14, borderTop: "1px solid var(--border-subtle)", font: "400 13px var(--font-sans)", color: "var(--text-body)" }}>
          <Avatar name={r.leader_name} size={22} /><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.leader_name}</span><span style={kMuted}>Run leader</span>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Button variant="secondary" icon="users" style={{ flex: 1 }} onClick={() => router.push(`/runs?run=${ref}&tab=going`)}>Who’s going</Button>
        <Button icon="scan-line" style={{ flex: 1 }} onClick={() => router.push(`/runs?run=${ref}&tab=checkin`)}>Open check-in</Button>
      </div>
    </GlassCard>
  );
}

function NextEvent({ e, d }: { e: HostedEvent; d: Data }) {
  const router = useRouter();
  const t = tile(e.starts_at);
  return (
    <GlassCard title="Next event" subtitle={`${day(e.starts_at)} · ${until(e.starts_at, d.now)}`}
      actions={<IconButton icon="arrow-up-right" label="Open event" variant="secondary" size="sm" onClick={() => router.push(`/events?event=${encodeRef(e.id)}`)} />}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <DateTile day={t.day} date={t.date} month={t.month} kind="event" />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "500 17px/1.25 var(--font-sans)", color: "var(--text-strong)" }}>{e.title}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
            <Meta icon="clock">{time(e.starts_at)}</Meta>{e.place_name ? <Meta icon="map-pin">{e.place_name}</Meta> : null}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ font: "var(--type-kpi)", letterSpacing: "var(--tracking-display)", color: "var(--text-strong)" }}>{num(e.sold)}</span>
          <span style={kMuted}>{e.capacity ? `of ${num(e.capacity)} seats taken` : "going"}</span>
        </div>
        {e.capacity ? <ProgressBar size="lg" tone="pop" value={e.sold} max={e.capacity} style={{ marginTop: 10 }} /> : null}
      </div>
    </GlassCard>
  );
}

// ── Recent activity ────────────────────────────────────────────────────────

function Activity({ d }: { d: Data }) {
  const rows = [
    ...d.members.filter(m => !m.isSelf && d.now - new Date(m.joinedAt).getTime() < 21 * 86400000)
      .map(m => ({ at: m.joinedAt, icon: "user-plus" as IconName, who: m.name, what: "joined the squad" })),
    ...d.log.map(l => ({
      at: l.created_at, icon: (l.action === "cancelled" ? "ban" : "calendar-check") as IconName, who: l.actor_name ?? "Someone",
      what: `${l.action === "cancelled" ? "cancelled" : "scheduled"} ${l.title} · ${day(l.event_at)}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);
  return (
    <GlassCard title="Recent activity" subtitle="New members and run changes">
      {!rows.length ? <div style={kMuted}>Nothing new in the last three weeks.</div> : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 0", borderTop: i ? "1px solid var(--border-subtle)" : 0 }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface-panel)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name={a.icon} size={15} /></span>
              <div style={{ flex: 1, minWidth: 0, font: "400 13px/1.35 var(--font-sans)", color: "var(--text-body)" }}>
                <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>{a.who}</span> {a.what}
                <div style={{ ...kMuted, marginTop: 1 }}>{ago(a.at, d.now)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div>
      <div style={kitGrid(150)}>{[0, 1, 2, 3].map(i => <GlassCard key={i}><Skeleton width={110} height={12} /><Skeleton width={90} height={28} style={{ marginTop: 16 }} /><Skeleton width={130} height={10} style={{ marginTop: 12 }} /></GlassCard>)}</div>
      <div style={{ ...kitGrid(380), marginTop: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map(i => <div key={i} className="pc-action"><Skeleton width={36} height={36} radius={8} /><div style={{ flex: 1 }}><Skeleton width="40%" height={10} /><Skeleton width="80%" height={14} style={{ marginTop: 10 }} /><Skeleton width="60%" height={10} style={{ marginTop: 8 }} /></div><Skeleton width={84} height={30} /></div>)}
        </div>
        <GlassCard><Skeleton width={80} height={14} /><Skeleton height={60} style={{ marginTop: 18 }} radius={10} /><Skeleton lines={4} style={{ marginTop: 18 }} /></GlassCard>
      </div>
    </div>
  );
}

export default function Overview() {
  const { host } = useHost();
  const { phone, tablet } = useViewport();
  const router = useRouter();
  const d = useLoad(() => load(host), `overview:${host.key}`);
  if (d.status === "loading") return <OverviewSkeleton />;
  if (d.status === "error") return <LoadError what="your overview" error={d.error} onRetry={d.reload} />;
  const data = d.data;
  const nextEvent = data.events.filter(e => e.status === "published" && new Date(e.starts_at).getTime() > data.now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const stacked = phone || tablet;

  if (host.kind === "organizer" && !data.events.length && host.status === "approved") {
    return (
      <EmptyState icon="ticket" title={`Welcome, ${firstName(host.name)}`} style={{ padding: "56px 24px", marginTop: 12 }}
        message="Events are ticketed or free one-offs: races, trail days, socials. Create one and runners can find it on pacr."
        action={{ label: "Create your first event", icon: "plus", onClick: () => goSite(eventNewHref) }} />
    );
  }
  return (
    <div>
      <Kpis d={data} host={host} />
      <div style={{ display: "grid", gridTemplateColumns: stacked ? "minmax(0,1fr)" : "minmax(0,1.6fr) minmax(340px,1fr)", gap: 12, marginTop: 12, alignItems: "start" }}>
        <Attention d={data} host={host} onChanged={d.reload} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, marginTop: stacked ? 0 : 44 }}>
          {data.runs[0] ? <NextRun r={data.runs[0]} d={data} /> : null}
          {nextEvent ? <NextEvent e={nextEvent} d={data} /> : null}
          {host.kind === "squad" && !data.runs[0] && !nextEvent ? (
            <EmptyState compact icon="calendar" title="Nothing scheduled" message="Your next run or event shows up here."
              action={{ label: "Schedule run", icon: "plus", onClick: () => router.push("/runs?new=1") }} />
          ) : null}
          {host.kind === "squad" ? <Activity d={data} /> : null}
        </div>
      </div>
    </div>
  );
}
