"use client";

// Co-hosts: squadmates and mutual follows the host adds to this event (up to
// five). They can edit it and check runners in; sales, refunds and the co-host
// list itself stay with the host. Only the host sees this section.

import { useEffect, useState } from "react";
import { Avatar, Button, Input } from "@/components/ds";
import { kMuted, kStrong } from "@/components/shell/kit";
import { MAX_COHOSTS, cohostCandidates, editorFailCopy, EditorError, type Person } from "@/lib/eventEditor";
import { Section } from "./parts";

export function Cohosts({ cohosts, onChange }: { cohosts: Person[]; onChange: (next: Person[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; people: Person[] } | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const typed = q.trim();
  const full = cohosts.length >= MAX_COHOSTS;

  useEffect(() => {
    if (!open) return;
    let on = true;
    const t = setTimeout(async () => {
      try {
        const people = await cohostCandidates(typed);
        if (on) { setFound({ q: typed, people }); setFail(null); }
      } catch (e) {
        if (on) { setFound(null); setFail(editorFailCopy(e instanceof EditorError ? e.fail : "error").body); }
      }
    }, typed ? 250 : 0);
    return () => { on = false; clearTimeout(t); };
  }, [open, typed]);

  const chosen = new Set(cohosts.map(c => c.userId));
  const results = found && found.q === typed ? found.people.filter(p => !chosen.has(p.userId)).slice(0, 8) : null;

  return (
    <Section title="Co-hosts" right={<span style={kMuted}>{cohosts.length} of {MAX_COHOSTS}</span>}
      note="They can edit this event and check runners in. Sales, refunds and this list stay with you.">
      {cohosts.map(c => (
        <div key={c.userId} style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Avatar name={c.name} src={c.avatarUrl} size={32} />
          <span style={{ ...kStrong, flex: 1, minWidth: 0 }}>{c.name}</span>
          <Button variant="ghost" size="sm" onClick={() => onChange(cohosts.filter(x => x.userId !== c.userId))} aria-label={`Remove ${c.name}`}>Remove</Button>
        </div>
      ))}
      {!open ? (
        full ? <span style={kMuted}>That’s the most co-hosts an event can have.</span>
          : <div><Button variant="secondary" icon="user-plus" onClick={() => setOpen(true)}>{cohosts.length ? "Add another co-host" : "Add co-host"}</Button></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--surface-panel)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input icon="search" type="search" autoFocus autoComplete="off" placeholder="Search squadmates and friends" aria-label="Search for a co-host"
              value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setQ(""); }}>Done</Button>
          </div>
          {fail ? <span style={{ ...kMuted, color: "var(--danger-text)" }}>{fail}</span>
            : full ? <span style={kMuted}>That’s the most co-hosts an event can have.</span>
            : !results ? <span style={kMuted}>Looking…</span>
            : results.length === 0 ? <span style={kMuted}>{typed ? "No one matches." : "Co-hosts are your squadmates and people you follow who follow you back."}</span>
            : results.map(p => (
              <div key={p.userId} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Avatar name={p.name} src={p.avatarUrl} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={kStrong}>{p.name}</div>
                  {p.meta ? <div style={kMuted}>{p.meta}</div> : null}
                </div>
                <Button variant="secondary" size="sm" onClick={() => onChange([...cohosts, p])} aria-label={`Add ${p.name}`}>Add</Button>
              </div>
            ))}
        </div>
      )}
    </Section>
  );
}
