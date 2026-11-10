"use client";

import { useState } from "react";
import { Avatar, Button, Drawer, Icon, Select } from "@/components/ds";
import { roleRank, setMemberRole, type Member, type SquadRole } from "@/lib/api";
import { firstName, km, monthYear, plural, roleLabel, ago } from "@/lib/format";
import { useHost } from "@/lib/host";
import { encodeRef } from "@/lib/refs";
import { kMuted, kStrong } from "@/components/shell/kit";
import { roleNoun, SegTag, Strip } from "./parts";

type Props = {
  member: Member | null;
  urls: Map<string, string>;
  now: number;
  firstWeek: string;
  thisWeek: string;
  myRank: number;
  givable: { value: Exclude<SquadRole, "owner">; label: string }[];
  onClose: () => void;
  onChanged: () => void;
  onAsk: (kind: "remove" | "ban", m: Member) => void;
};

export default function MemberDrawer({ member: m, urls, now, firstWeek, thisWeek, myRank, givable, onClose, onChanged, onAsk }: Props) {
  const { host, notify, notifyError } = useHost();
  const [busy, setBusy] = useState(false);
  if (!m) return null;
  const outranks = !m.isSelf && myRank > roleRank(m.role);
  const ref = encodeRef(m.userId);

  const change = async (value: string) => {
    if (value === m.role) return;
    setBusy(true);
    try {
      await setMemberRole(host.id, m.userId, value as Exclude<SquadRole, "owner">);
      notify("success", "Role changed", `${m.name} is now ${roleNoun(value)}.`);
      onChanged();
    } catch (e) {
      notifyError("Couldn’t change the role", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      leading={<Avatar name={m.name} src={(m.avatarPath && urls.get(m.avatarPath)) || undefined} size={44} />}
      title={m.name}
      subtitle={`${m.handle ? `@${m.handle} · ` : ""}joined ${monthYear(m.joinedAt)}`}
      footer={outranks ? (
        <>
          <Button variant="ghost" icon="user-minus" onClick={() => onAsk("remove", m)}>Remove</Button>
          <div style={{ flex: 1 }} />
          <Button variant="danger" icon="ban" onClick={() => onAsk("ban", m)}>Ban</Button>
        </>
      ) : null}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {([["Runs logged · 12 wks", String(m.runs12)], ["Km · 12 wks", km(m.km12)], ["Last run", m.lastRunAt ? ago(m.lastRunAt, now) : "—"]] as const).map(([k, v]) => (
          <div key={k} style={{ padding: 12, borderRadius: 10, background: "var(--surface-panel)" }}>
            <div style={kMuted}>{k}</div>
            <div style={{ font: "500 18px var(--font-sans)", color: "var(--text-strong)", marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: "18px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={kStrong}>Last 12 weeks</span><SegTag seg={m.segment} />
      </div>
      <Strip data={m.strip} size={20} />
      <div style={{ display: "flex", justifyContent: "space-between", ...kMuted, marginTop: 6 }}><span>{firstWeek}</span><span>{thisWeek}</span></div>
      <div style={{ ...kMuted, marginTop: 10 }}>This week: {km(m.weekKm)} km in {plural(m.weekRuns, "run")}</div>
      <div style={{ margin: "18px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={kStrong}>Role</span>
        {outranks && givable.length ? (
          <Select size="sm" value={m.role} disabled={busy} options={givable.map(g => ({ value: g.value, label: g.label }))} style={{ width: 150 }} onChange={change} />
        ) : <span style={{ font: "400 13px var(--font-sans)", color: "var(--text-strong)" }}>{roleLabel(m.role)}{m.title ? ` · ${m.title}` : ""}</span>}
      </div>
      {ref ? <a href={`/profile?r=${ref}`} style={{ font: "500 13px var(--font-sans)", color: "var(--text-strong)", textDecoration: "underline" }}>View profile</a> : null}
      <div style={{ ...kMuted, marginTop: 14, display: "flex", gap: 6 }}>
        <Icon name="shield" size={13} />Only what {firstName(m.name)} chose to share. No health data or exact location.
      </div>
    </Drawer>
  );
}
