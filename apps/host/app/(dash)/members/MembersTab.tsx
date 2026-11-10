"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, DataTable, Dialog, EmptyState, GlassCard, Icon, IconButton, Input, Select, SegmentChip } from "@/components/ds";
import { memberRoster, removeMember, roleRank, setMemberRole, signedUrls, weekStart, type Member } from "@/lib/api";
import { ago, day, km, monthYear, num, plural, roleLabel } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { kMuted, kStrong, LoadError, RowsSkeleton, Toolbar } from "@/components/shell/kit";
import MemberDrawer from "./MemberDrawer";
import { givableRoles, myRankOf, roleNoun, SEG_MARK, SegTag, Strip } from "./parts";

const SEGMENTS = ["All", "New", "Regulars", "Active", "Slipping", "Lapsed"] as const;
type Confirm = { kind: "remove" | "ban"; targets: Member[]; skipped: number };

function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export default function MembersTab() {
  const { host, notify, notifyError } = useHost();
  const { phone, tablet } = useViewport();
  const sp = useSearchParams();
  const x = useLoad(async () => {
    const roster = await memberRoster(host.id);
    const urls = await signedUrls("avatars", roster.members.map(m => m.avatarPath));
    return { members: roster.members, urls, now: Date.now(), firstWeek: day(weekStart(11)), thisWeek: day(weekStart(0)) };
  }, `roster:${host.key}`);
  const [seg, setSeg] = useState<(typeof SEGMENTS)[number]>("All");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [role, setRole] = useState("any");
  const [sel, setSel] = useState<(string | number)[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);

  const myRank = myRankOf(host.roleKey);
  const members = x.status === "ready" ? x.data.members : null;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^@/, "");
    return (members ?? []).filter(m =>
      (seg === "All" || m.segment === seg) &&
      (role === "any" || m.role === role) &&
      (!needle || m.name.toLowerCase().includes(needle) || (m.handle ?? "").toLowerCase().includes(needle)));
  }, [members, seg, q, role]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: members?.length ?? 0 };
    for (const m of members ?? []) c[m.segment] = (c[m.segment] ?? 0) + 1;
    return c;
  }, [members]);

  const chips = (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {SEGMENTS.map(s => (
          <SegmentChip key={s} label={s === "New" ? "New, not yet run" : s} count={x.status === "ready" ? (counts[s] ?? 0) : undefined}
            mark={s === "All" ? undefined : SEG_MARK[s]} active={seg === s} onClick={() => setSeg(s)} />
        ))}
      </div>
      <div style={{ ...kMuted, marginBottom: 12 }}>From runs members log on pacr: Regulars ran in 3 of the last 4 weeks, Slipping haven’t logged a run for 3+ weeks, Lapsed for 8+ weeks.</div>
    </>
  );

  const exportCsv = () => {
    const head = ["Name", "Handle", "Role", "Joined", "Runs logged (12 weeks)", "Km (12 weeks)", "Last run", "Segment"];
    const lines = [head, ...rows.map(m => [
      m.name, m.handle ? `@${m.handle}` : "", roleLabel(m.role), monthYear(m.joinedAt), m.runs12, km(m.km12).replace(/,/g, ""),
      m.lastRunAt ? day(m.lastRunAt) : "", m.segment,
    ])].map(r => r.map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob([`﻿${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "members.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const toolbar = (
    <Toolbar>
      <Input icon="search" placeholder="Search name or handle" value={q} onChange={e => setQ(e.target.value)} style={{ flex: "1 1 220px", maxWidth: 320 }} />
      <Select size="sm" value={role} onChange={setRole} style={{ width: 140 }} options={[
        { value: "any", label: "Any role" }, { value: "member", label: "Members" }, { value: "run_leader", label: "Run leaders" },
        { value: "organiser", label: "Organisers" }, { value: "owner", label: "Owners" },
      ]} />
      <div style={{ flex: 1 }} />
      <Button variant="secondary" icon="download" size="sm" disabled={!rows.length} onClick={exportCsv}>Export</Button>
    </Toolbar>
  );

  if (x.status === "loading") return <div>{chips}{toolbar}<RowsSkeleton rows={6} /></div>;
  if (x.status === "error") return <LoadError what="members" error={x.error} onRetry={x.reload} />;
  const { urls, now, firstWeek, thisWeek } = x.data;
  const all = x.data.members;

  if (all.length <= 1) {
    const slug = host.slug;
    return (
      <EmptyState icon="users" title="No members yet" style={{ padding: "56px 24px" }}
        message="Share your squad link on Instagram or WhatsApp. Anyone who joins shows up here, sorted into New, Regulars, Slipping and Lapsed."
        action={slug ? { label: "Copy squad link", icon: "link", onClick: () => {
          navigator.clipboard.writeText(`https://pacr.life/s/${slug}`).then(
            () => notify("success", "Link copied", `pacr.life/s/${slug}`),
            e => notifyError("Couldn’t copy the link", e),
          );
        } } : undefined} />
    );
  }

  const canAct = (m: Member) => !m.isSelf && myRank > roleRank(m.role);
  const src = (m: Member) => (m.avatarPath && urls.get(m.avatarPath)) || undefined;
  const picked = all.filter(m => sel.includes(m.userId));
  const actionable = picked.filter(canAct);
  const skippedMsg = (n: number) => (n ? `${n} skipped: ranked at or above you` : "");

  const bulkRole = async (value: "run_leader" | "member") => {
    if (!actionable.length) { notify("neutral", "Nothing changed", "Everyone selected is ranked at or above you."); return; }
    setBusy(true);
    let done = 0;
    try {
      for (const m of actionable) { await setMemberRole(host.id, m.userId, value); done++; }
      const skipped = picked.length - actionable.length;
      notify("success", done === 1 ? "Role changed" : `${done} roles changed`,
        [done === 1 ? `${actionable[0].name} is now ${roleNoun(value)}.` : `They are now ${value === "run_leader" ? "run leaders" : "members"}.`, skippedMsg(skipped)].filter(Boolean).join(" · "));
      setSel([]);
    } catch (e) {
      notifyError("Couldn’t change the role", e);
    } finally {
      setBusy(false);
      if (done) x.reload();
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    let done = 0;
    const ban = confirm.kind === "ban";
    try {
      for (const m of confirm.targets) { await removeMember(host.id, m.userId, ban); done++; }
      const t = confirm.targets;
      notify(ban ? "danger" : "success", t.length === 1 ? (ban ? "Member banned" : "Member removed") : `${t.length} members ${ban ? "banned" : "removed"}`,
        [t.length === 1 ? (ban ? `${t[0].name} can’t see or rejoin ${host.name}.` : `${t[0].name} can ask to join again.`) : (ban ? "They can’t see or rejoin." : "They can ask to join again."), skippedMsg(confirm.skipped)].filter(Boolean).join(" · "));
      setSel([]);
      setOpen(null);
      setConfirm(null);
    } catch (e) {
      notifyError(ban ? "Couldn’t ban" : "Couldn’t remove", e);
    } finally {
      setBusy(false);
      if (done) x.reload();
    }
  };

  const ask = (kind: "remove" | "ban") => {
    if (!actionable.length) { notify("neutral", "Nothing changed", "Everyone selected is ranked at or above you."); return; }
    setConfirm({ kind, targets: actionable, skipped: picked.length - actionable.length });
  };

  const roleCell = (m: Member) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {m.role === "member" ? <span style={{ color: "var(--text-muted)" }}>Member</span>
        : <Badge tone="neutral" variant={m.role === "run_leader" ? "soft" : "solid"}>{roleLabel(m.role)}</Badge>}
      {m.title ? <span style={kMuted}>{m.title}</span> : null}
    </span>
  );
  const runnerCell = (m: Member) => (
    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Avatar name={m.name} src={src(m)} size={30} />
      <span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, font: "500 13px/1.25 var(--font-sans)" }}>{m.name}{m.isSelf ? <Badge tone="neutral" size="md">You</Badge> : null}</span>
        {m.handle ? <span style={kMuted}>@{m.handle}</span> : null}
      </span>
    </span>
  );

  const confirmNames = confirm ? (confirm.targets.length === 1 ? confirm.targets[0].name : `${confirm.targets.length} members`) : "";
  const openMember = all.find(m => m.userId === open) ?? null;

  return (
    <div>
      {chips}{toolbar}
      {sel.length ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 10px 8px 14px", marginBottom: 10, borderRadius: 10, background: "var(--ink-900)", color: "#fff" }}>
          <span style={{ font: "500 13px var(--font-sans)", flex: 1 }}>{sel.length} selected</span>
          <Button size="sm" variant="on-dark" icon="star" disabled={busy} onClick={() => bulkRole("run_leader")}>Make run leader</Button>
          <Button size="sm" variant="on-dark" icon="users" disabled={busy} onClick={() => bulkRole("member")}>Make member</Button>
          <Button size="sm" variant="on-dark" icon="user-minus" disabled={busy} onClick={() => ask("remove")}>Remove</Button>
          <Button size="sm" variant="danger" icon="ban" disabled={busy} onClick={() => ask("ban")}>Ban</Button>
          <IconButton icon="x" label="Clear selection" size="sm" variant="on-dark" onClick={() => setSel([])} />
        </div>
      ) : null}
      {phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map(m => (
            <GlassCard key={m.userId} interactive padding={12} onClick={() => setOpen(m.userId)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={m.name} src={src(m)} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={kStrong}>{m.name}{m.isSelf ? " (you)" : ""}</div>
                  <div style={kMuted}>{[m.handle ? `@${m.handle}` : "", roleLabel(m.role)].filter(Boolean).join(" · ")}</div>
                </div>
                <Icon name="chevron-right" size={16} color="var(--text-muted)" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                <SegTag seg={m.segment} />
                <span style={kMuted}>{plural(m.runs12, "run")} logged · {m.lastRunAt ? `last ${ago(m.lastRunAt, now)}` : "no runs yet"}</span>
              </div>
            </GlassCard>
          ))}
          {!rows.length ? <EmptyState compact title="No members match" message="Try another search or segment." /> : null}
          <div style={kMuted}>Showing {rows.length} of {all.length}. Gender, health data and exact locations are never shown.</div>
        </div>
      ) : (
        <GlassCard flush>
          <DataTable
            rows={rows}
            rowKey="userId"
            selectable
            selected={sel}
            onSelectionChange={setSel}
            onRowClick={m => setOpen(m.userId)}
            defaultSort={{ key: "runs12", dir: "desc" }}
            empty="No members match. Try another search or segment."
            columns={[
              { key: "name", header: "Runner", sortable: true, sortValue: m => m.name.toLowerCase(), render: runnerCell },
              { key: "role", header: "Role", sortable: true, sortValue: m => roleRank(m.role), render: roleCell },
              ...(tablet ? [] : [{ key: "joinedAt", header: "Joined", sortable: true, render: (m: Member) => monthYear(m.joinedAt) }]),
              { key: "runs12", header: "Runs · 12 wks", sortable: true, align: "right" as const, render: (m: Member) => num(m.runs12) },
              ...(tablet ? [] : [{ key: "strip", header: "Last 12 weeks", render: (m: Member) => <Strip data={m.strip} size={6} /> }]),
              { key: "lastRunAt", header: "Last run", sortable: true, sortValue: (m: Member) => m.lastRunAt ?? "", render: (m: Member) => (m.lastRunAt ? ago(m.lastRunAt, now) : <span style={{ color: "var(--text-subtle)" }}>—</span>) },
              { key: "weekKm", header: "This week", sortable: true, render: (m: Member) => (m.weekKm > 0 ? `${m.weekKm.toFixed(1)} km` : <span style={{ color: "var(--text-subtle)" }}>—</span>) },
              { key: "segment", header: "Segment", sortable: true, render: (m: Member) => <SegTag seg={m.segment} /> },
            ]}
          />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 20px 14px", ...kMuted }}>
            <span>Showing {rows.length} of {all.length}</span><span>Gender, health data and exact locations are never shown.</span>
          </div>
        </GlassCard>
      )}

      <MemberDrawer
        member={openMember}
        urls={urls}
        now={now}
        firstWeek={firstWeek}
        thisWeek={thisWeek}
        myRank={myRank}
        givable={givableRoles(myRank)}
        onClose={() => setOpen(null)}
        onChanged={x.reload}
        onAsk={(kind, m) => setConfirm({ kind, targets: [m], skipped: 0 })}
      />

      <Dialog
        open={!!confirm}
        onClose={() => (busy ? undefined : setConfirm(null))}
        tone={confirm?.kind === "ban" ? "danger" : "warning"}
        icon={confirm?.kind === "ban" ? "ban" : "user-minus"}
        title={confirm ? `${confirm.kind === "ban" ? "Ban" : "Remove"} ${confirmNames}?` : ""}
        description={confirm?.kind === "ban"
          ? `They can’t see or rejoin ${host.name}.`
          : `They’re taken out of ${host.name}. They can ask to join again.`}
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>Keep {confirm && confirm.targets.length === 1 ? confirm.targets[0].name : "them"}</Button>
            <Button variant="danger" loading={busy} onClick={runConfirm}>{confirm?.kind === "ban" ? "Ban" : "Remove"} {confirmNames}</Button>
          </>
        }
      />
    </div>
  );
}
