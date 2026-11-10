"use client";

import { Icon } from "@/components/ds";
import type { HostedEvent } from "@/lib/api";

/** The event's poster: its cover image, else a quiet striped placeholder. Never a made-up poster. */
export function Poster({ src, title, cancelled, w = 52 }: { src?: string; title: string; cancelled?: boolean; w?: number }) {
  return (
    <div
      role="img"
      aria-label={src ? `${title} poster` : "No poster yet"}
      style={{
        width: w, aspectRatio: "2 / 3", flex: "none", borderRadius: 6, overflow: "hidden",
        background: src ? `url(${src}) center/cover` : "var(--surface-locked)",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid var(--border-subtle)", filter: cancelled ? "grayscale(1)" : "none",
      }}
    >
      {src ? null : <Icon name="ticket" size={Math.round(w / 3)} color="var(--text-muted)" />}
    </div>
  );
}

/** "half_marathon" → "Half marathon". */
export function kindLabel(kind: string): string {
  const s = String(kind ?? "").replace(/[_-]+/g, " ").trim().toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

export type EventTagStatus = "Draft" | "Published" | "Cancelled" | "Ended";

/** Published events whose end (or start) has passed read as Ended. */
export function isOver(e: HostedEvent, now: number): boolean {
  if (e.status === "ended" || e.status === "cancelled") return true;
  if (e.status !== "published") return false;
  return new Date(e.ends_at ?? e.starts_at).getTime() < now;
}

export function tagOf(e: HostedEvent, now: number): EventTagStatus {
  if (e.status === "draft") return "Draft";
  if (e.status === "cancelled") return "Cancelled";
  return isOver(e, now) ? "Ended" : "Published";
}
