"use client";

import type { ReactNode } from "react";
import { Avatar, Icon } from "@/components/ds";
import { plural } from "@/lib/format";
import type { Host } from "@/lib/host";

/**
 * Who a run or event is being made for: the squad's (or organizer's) picture,
 * name, verified tick and your role, at the top of every create form, so
 * nobody schedules for the wrong squad after switching hosts.
 */
export function HostCard({ host, label = "Hosting as", extra }: { host: Host; label?: string; extra?: ReactNode }) {
  const sub = [
    host.role,
    host.kind === "squad" && host.members != null ? plural(host.members, "member") : null,
  ].filter(Boolean).join(" · ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: "var(--surface-panel)", border: "1px solid var(--border-subtle)" }}>
      <Avatar name={host.name} src={host.avatarUrl} size={44} style={{ borderRadius: host.kind === "squad" ? 12 : 999, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: "var(--type-caption)", color: "var(--text-muted)" }}>{label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{host.name}</span>
          {host.verified ? <span title="Verified" aria-label="Verified" style={{ display: "inline-flex", flexShrink: 0 }}><Icon name="badge-check" size={16} /></span> : null}
        </div>
        <div style={{ font: "var(--type-caption)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
        {extra ? <div style={{ font: "var(--type-caption)", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>{extra}</div> : null}
      </div>
    </div>
  );
}
