"use client";

import { useMemo, useState } from "react";
import { Avatar, Badge, Button, DataTable, EmptyState, GlassCard, Icon, IconButton, Input, Select, Tabs } from "@/components/ds";
import { membersLite, roleRank, runHistory, setMemberRole, signedUrls, type MemberLite, type SquadRole } from "@/lib/api";
import { ago, dayTime, firstName, monthYear, plural, roleLabel } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { kMuted, kStrong, LoadError, RowsSkeleton } from "@/components/shell/kit";
import { givableRoles, myRankOf, roleNoun } from "../members/parts";

type Tone = 1 | 0 | "own";
const ROLES = ["Squad owner", "Organiser", "Run leader", "Organizer account"];
const PERMS: [string, Tone[]][] = [
  ["See overview & calendar", [1, 1, 1, 1]],
  ["Schedule runs", [1, 1, 1, 0]],
  ["Cancel runs & run check-in", [1, 1, "own", 0]],
  ["Host events (verified squads)", [1, 1, 1, 1]],
  ["Approve join requests", [1, 1, 0, 0]],
  ["Remove or ban members", [1, 1, 0, 0]],
  ["Change team roles", [1, 1, 0, 0]],
  ["Post announcements", [1, 1, 0, 0]],
  ["Moderate reports", [1, 1, 0, 0]],
  ["Edit squad profile, rules & join questions", [1, 1, 0, 0]],
  ["See sales & payouts", [1, 1, 0, 1]],
  ["Payout account", [1, 0, 0, 1]],
  ["Instagram, home base & verification", [1, 0, 0, 0]],
  ["Add co-owners / delete squad", [1, 0, 0, 0]],
];

function Cell({ v }: { v: Tone }) {
  if (v === 1) return <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center", background: "var(--fill-lime)" }}><Icon name="check" size={14} strokeWidth={2.5} /></span>;
  if (!v) return <span style={{ color: "var(--text-disabled)" }}>—</span>;
  return <Badge tone="neutral">Own runs</Badge>;
}

export default function Team() {
  const { host } = useHost();
  if (host.kind !== "squad") return null;
  return <Inner />;
}

function Inner() {
  const { host } = useHost();
  const [tab, setTab] = useState("team");
  const [teamCount, setTeamCount] = useState<number | undefined>(undefined);
  const owner = host.roleKey === "owner";
  return (
    <div>
      <Tabs value={tab} onChange={setTab} style={{ marginBottom: 14 }} tabs={[
        { value: "team", label: "Team", count: teamCount },
        { value: "roles", label: "Roles & permissions" },
        ...(owner ? [{ value: "log", label: "Run log" }] : []),
      ]} />
      {tab === "roles" ? <Roles /> : tab === "log" && owner ? <RunLog /> : <TeamTab onCount={setTeamCount} />}
    </div>
  );
}

function Roles() {
  return (
    <GlassCard flush title="Who can do what" subtitle="Read-only · the same for every squad on pacr">
      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead><tr><th>Permission</th>{ROLES.map(r => <th key={r} style={{ textAlign: "center" }}>{r}</th>)}</tr></thead>
          <tbody>{PERMS.map(([p, vs]) => <tr key={p}><td>{p}</td>{vs.map((v, i) => <td key={i} style={{ textAlign: "center" }}><Cell v={v} /></td>)}</tr>)}</tbody>
        </table>
      </div>
      <div style={{ ...kMuted, padding: "10px 20px 16px" }}>Organizer account = brand, coach or race organiser account. Organizer accounts only see the events, tickets and money they host.</div>
    </GlassCard>
  );
}

function TeamTab({ onCount }: { onCount: (n: number) => void }) {
  const { host, notify, notifyError } = useHost();
  const { phone } = useViewport();
  const x = useLoad(async () => {
    const list = await membersLite(host.id);
    const urls = await signedUrls("avatars", list.map(m => m.avatarPath));
    onCount(list.filter(m => m.role !== "member").length);
    return { list, urls };
  }, `team:${host.key}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [role, setRole] = useState<"run_leader" | "organiser">("run_leader");
  const myRank = myRankOf(host.roleKey);
  const givable = givableRoles(myRank);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || x.status !== "ready") return [];
    return x.data.list.filter(m => m.role === "member" && m.name.toLowerCase().includes(needle)).slice(0, 6);
  }, [q, x.status, x.data]);

  if (x.status === "loading") return <RowsSkeleton rows={4} />;
  if (x.status === "error") return <LoadError what="the team" error={x.error} onRetry={x.reload} />;
  const { list, urls } = x.data;
  const src = (m: MemberLite) => (m.avatarPath && urls.get(m.avatarPath)) || undefined;
  const staff = list.filter(m => m.role !== "member").sort((a, b) => roleRank(b.role) - roleRank(a.role) || a.name.localeCompare(b.name));
  const plain = list.filter(m => m.role === "member");
  const outranks = (m: MemberLite) => !m.isSelf && myRank > roleRank(m.role);

  const apply = async (m: MemberLite, value: Exclude<SquadRole, "owner">, title: string, message: string) => {
    setBusy(m.userId);
    try {
      await setMemberRole(host.id, m.userId, value);
      notify("success", title, message);
      x.reload();
      return true;
    } catch (e) {
      notifyError("Couldn’t change the role", e);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const chosen = plain.find(m => m.userId === pick) ?? null;
  const addRoles = givable.filter(g => g.value !== "member");

  return (
    <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1.6fr) minmax(280px,1fr)", gap: 12, alignItems: "start" }}>
      <GlassCard flush title={`People who help run ${host.name}`}>
        <DataTable
          rows={staff}
          rowKey="userId"
          empty="Nobody yet. Add a member to the team."
          columns={[
            { key: "name", header: "Name", render: (m: MemberLite) => (
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}><Avatar name={m.name} src={src(m)} size={30} /><span style={{ font: "500 13px var(--font-sans)" }}>{m.name}{m.isSelf ? " (you)" : ""}</span></span>
            ) },
            { key: "role", header: "Role", render: (m: MemberLite) => m.role === "owner"
              ? <Badge tone="neutral" variant="solid" icon="crown">Owner</Badge>
              : outranks(m)
                ? <Select size="sm" value={m.role} disabled={busy === m.userId} style={{ width: 130 }}
                    options={givable.filter(g => g.value !== "member").map(g => ({ value: g.value, label: g.label }))}
                    onChange={v => { if (v !== m.role) void apply(m, v as Exclude<SquadRole, "owner">, "Role changed", `${m.name} is now ${roleNoun(v)}.`); }} />
                : roleLabel(m.role) },
            { key: "joinedAt", header: "Member since", render: (m: MemberLite) => monthYear(m.joinedAt) },
            { key: "x", header: "", align: "right", render: (m: MemberLite) => outranks(m)
              ? <IconButton icon="user-minus" label="Remove from team" variant="ghost" size="sm" disabled={busy === m.userId}
                  onClick={() => void apply(m, "member", "Removed from the team", `${m.name} is a member again.`)} />
              : null },
          ]}
        />
      </GlassCard>
      <GlassCard title="Add to the team" subtitle="They must already be a member">
        <Input icon="search" label="Find a member" placeholder="Search by name" value={q} onChange={e => { setQ(e.target.value); setPick(null); }} />
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {!plain.length ? <div style={kMuted}>Every member is already on the team.</div> : null}
          {q.trim() && !matches.length && plain.length ? <div style={kMuted}>No member by that name.</div> : null}
          {matches.map(m => (
            <button key={m.userId} type="button" onClick={() => setPick(m.userId)} aria-pressed={pick === m.userId}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, border: pick === m.userId ? "1.5px solid var(--ink-900)" : "1px solid var(--border-subtle)", background: "#fff", cursor: "pointer", textAlign: "left" }}>
              <Avatar name={m.name} src={src(m)} size={28} /><span style={kStrong}>{m.name}</span>
            </button>
          ))}
        </div>
        <Select label="Role" value={role} onChange={v => setRole(v as "run_leader" | "organiser")} style={{ marginTop: 12 }}
          options={addRoles.map(g => ({ value: g.value, label: g.label }))} />
        <Button block icon="user-plus" style={{ marginTop: 14 }} disabled={!chosen || !addRoles.length} loading={!!chosen && busy === chosen.userId}
          onClick={async () => {
            if (!chosen) return;
            const ok = await apply(chosen, role, "Added to the team", `${chosen.name} is now ${roleNoun(role)}.`);
            if (ok) { setPick(null); setQ(""); }
          }}>
          Add to team
        </Button>
        <div style={{ ...kMuted, marginTop: 10 }}>Co-owners are invited from the pacr app, and only by the owner.</div>
      </GlassCard>
    </div>
  );
}

function RunLog() {
  const { host } = useHost();
  const x = useLoad(async () => {
    const list = await runHistory(host.id);
    const urls = await signedUrls("avatars", list.map(r => r.actor_avatar_path));
    return { list, urls, now: Date.now() };
  }, `runlog:${host.key}`);
  if (x.status === "loading") return <RowsSkeleton rows={5} />;
  if (x.status === "error") return <LoadError what="the run log" error={x.error} onRetry={x.reload} />;
  const { list, urls, now } = x.data;
  const strong = { fontWeight: 500, color: "var(--text-strong)" } as const;
  return (
    <GlassCard flush title="Run log" subtitle="Who scheduled and cancelled runs">
      {!list.length ? (
        <EmptyState compact boxed={false} icon="calendar" title="No runs scheduled or cancelled yet" />
      ) : (
        <div style={{ padding: "0 20px 12px" }}>
          {list.map((r, i) => (
            <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderTop: i ? "1px solid var(--border-subtle)" : 0, flexWrap: "wrap" }}>
              <Avatar name={r.actor_name ?? "Someone"} src={(r.actor_avatar_path && urls.get(r.actor_avatar_path)) || undefined} size={28} />
              <div style={{ flex: "1 1 220px", minWidth: 0, font: "400 13px/1.4 var(--font-sans)", color: "var(--text-body)" }}>
                <b style={strong}>{r.actor_name ? firstName(r.actor_name) : "Someone"}</b> {r.action} <b style={strong}>{r.title}</b>
                <div style={kMuted}>{dayTime(r.event_at)} · {plural(r.going_count, "going", "going")}</div>
              </div>
              <Badge tone="neutral">{r.action === "scheduled" ? "Scheduled" : "Cancelled"}</Badge>
              <span style={{ ...kMuted, width: 110, textAlign: "right" }}>{ago(r.created_at, now)}</span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
