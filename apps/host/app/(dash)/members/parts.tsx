"use client";

import type { SquadRole } from "@/lib/api";
import { roleRank } from "@/lib/api";
import type { RoleKey } from "@/lib/host";

export const SEG_MARK: Record<string, string> = {
  New: "var(--yellow-500)", Regulars: "var(--lime-500)", Active: "var(--lime-300)", Slipping: "var(--orange-500)", Lapsed: "var(--ink-300)",
};

/** One cell per week, oldest first. */
export function Strip({ data, size = 10 }: { data: number[]; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }} title="Last 12 weeks, oldest first">
      {data.map((v, i) => <span key={i} style={{ width: size, height: size + 6, borderRadius: 2, background: v ? "var(--fill-lime)" : "var(--chart-track)" }} />)}
    </span>
  );
}

export function SegTag({ seg }: { seg: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "400 12px var(--font-sans)", color: "var(--text-strong)" }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: SEG_MARK[seg] }} />{seg === "New" ? "New · not yet run" : seg}
    </span>
  );
}

/** Your rank in the squad: owner 3, organiser 2, run leader 1. */
export function myRankOf(roleKey: RoleKey): number {
  const r: SquadRole = roleKey === "owner" ? "owner" : roleKey === "organiser" ? "organiser" : roleKey === "leader" ? "run_leader" : "member";
  return roleRank(r);
}

/** Roles you may give: those below your own rank (organiser needs the owner). */
export function givableRoles(rank: number): { value: Exclude<SquadRole, "owner">; label: string }[] {
  const out: { value: Exclude<SquadRole, "owner">; label: string }[] = [];
  if (rank >= 3) out.push({ value: "organiser", label: "Organiser" });
  if (rank >= 2) out.push({ value: "run_leader", label: "Run leader" }, { value: "member", label: "Member" });
  return out;
}

export const roleNoun = (role: string) => (role === "organiser" ? "an organiser" : role === "run_leader" ? "a run leader" : "a member");
