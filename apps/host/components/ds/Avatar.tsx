"use client";

import type { HTMLAttributes } from "react";

const GRADS: [string, string][] = [
  ["#E3F2CA", "#36560D"], ["#FAF5B8", "#5E5708"], ["#FFE3CA", "#8A430B"], ["#EDEDED", "#3A3A3A"], ["#CDE6A2", "#2F4A0B"], ["#FDCFA6", "#7A3C08"], ["#232323", "#FFFFFF"],
];
const STATUS: Record<AvatarStatus, string> = { online: "var(--success)", away: "var(--warning)", offline: "var(--ink-300)" };

export type AvatarStatus = "online" | "away" | "offline";

function initials(name: string) {
  const p = String(name || "?").trim().split(/\s+/);
  return ((p[0] || "")[0] || "").toUpperCase() + (p.length > 1 ? (p[p.length - 1][0] || "").toUpperCase() : "");
}
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name?: string;
  src?: string;
  size?: number;
  status?: AvatarStatus;
  ring?: boolean;
}

export function Avatar({ name = "", src, size = 36, status, ring = false, className = "", style, ...rest }: AvatarProps) {
  const pal = GRADS[hash(name) % GRADS.length];
  const bg = src ? "url(" + src + ") center/cover" : pal[0];
  return (
    <span className={"pc-avatar" + (ring ? " pc-avatar--ring" : "") + (className ? " " + className : "")} title={name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: bg, color: pal[1], ...style }} {...rest}>
      {src ? null : initials(name)}
      {status ? <span className="pc-avatar__status" style={{ background: STATUS[status] }} /> : null}
    </span>
  );
}

export interface AvatarGroupProps {
  names?: string[];
  size?: number;
  max?: number;
}

export function AvatarGroup({ names = [], size = 28, max = 4 }: AvatarGroupProps) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="pc-avatar-group">
      {shown.map((n, i) => <Avatar key={i} name={n} size={size} />)}
      {extra > 0 ? <span className="pc-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: "var(--ink-100)", color: "var(--ink-700)" }}>+{extra}</span> : null}
    </span>
  );
}
