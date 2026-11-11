"use client";

import { parseMentionSegments } from "@/lib/mentions";
import { encodeRef } from "@/lib/refs";

/** A post or comment body with "@[Name](uuid)" tokens shown as "@Name", linked by ref. The uuid never reaches the page. */
export function MentionText({ body }: { body: string }) {
  return <>{parseMentionSegments(body).map((s, i) => s.type === "mention" && s.userId
    ? <a key={i} href={`/profile?r=${encodeRef(s.userId) ?? ""}`}>@{s.text}</a>
    : <span key={i}>{s.text}</span>)}</>;
}
