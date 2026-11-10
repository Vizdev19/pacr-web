"use client";

import type { CSSProperties, ReactNode } from "react";
import { Badge, type BadgeTone, type BadgeVariant } from "./Badge";

const MAP: Record<string, [BadgeTone, BadgeVariant?]> = {
  Draft: ["neutral", "outline"], Published: ["lime"], Live: ["lime"], Open: ["lime"], Approved: ["lime"], Verified: ["lime"], Paid: ["lime"], Sent: ["lime"], "Checked in": ["lime"], Active: ["lime"], Completed: ["lime"],
  Scheduled: ["yellow"], Pending: ["orange"], "Pending review": ["orange"], Processing: ["yellow"], "Almost full": ["orange"], Waitlist: ["orange"], Requested: ["orange"], Slipping: ["orange"],
  Cancelled: ["red"], Rejected: ["red"], Declined: ["red"], Banned: ["red"], Failed: ["red"], "No-show": ["neutral"],
  Ended: ["neutral", "solid"], Refunded: ["neutral"], Lapsed: ["neutral"], New: ["neutral", "outline"], Regular: ["lime"],
};

export interface StatusTagProps {
  status: string;
  children?: ReactNode;
  dot?: boolean;
  size?: "md" | "lg";
  style?: CSSProperties;
}

export function StatusTag({ status, children, dot = true, size = "md", style }: StatusTagProps) {
  const [tone, variant] = MAP[status] || ["neutral"];
  return <Badge tone={tone} variant={variant || "soft"} dot={dot && variant !== "solid"} size={size} style={style}>{children || status}</Badge>;
}
