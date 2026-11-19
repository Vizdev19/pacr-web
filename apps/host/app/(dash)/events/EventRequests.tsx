"use client";

// Requests: the runners waiting for a spot at a free event whose host approves
// each one (the editor's "Approve each runner"; pacr 20270129120000). A request
// holds no seat and has no ticket until it is approved, so it is never among
// the attendees. The event's host and co-hosts answer them. Modelled on the
// squad's join requests (members/RequestsTab.tsx).

import { useState } from "react";
import { Avatar, Button, Checkbox, Dialog, EmptyState, GlassCard, Icon } from "@/components/ds";
import { kMuted, kStrong, LoadError, RowsSkeleton, Toolbar } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { ago, num, plural } from "@/lib/format";
import { useHost } from "@/lib/host";
import type { useLoad } from "@/lib/hooks";

export type Waiting = api.EventRequest & { avatar?: string };
export type RequestsData = {
  /** "Approve each runner" is on for the event. */
  on: boolean;
  waiting: number;
  list: Waiting[];
  now: number;
};
/** Null: this database has no approval yet, or the event can't have requests (a draft, a paid event). */
export type RequestsLoad = ReturnType<typeof useLoad<RequestsData | null>>;

/**
 * What the Requests tab shows, and whether there is one. A count on the events list's row says this database has
 * approval; without one the event's own read says, and a database from before approval is asked nothing more.
 */
export async function loadRequests(e: api.HostedEvent): Promise<RequestsData | null> {
  const known = e.requests_waiting > 0;
  // A draft has no runners yet, and a paid ticket is bought, not asked for.
  if (e.status === "draft" || (e.is_paid && !known)) return null;
  const approval = api.eventApproval(e.id);
  if (!known && (await approval) === null) return null;
  const [on, r] = await Promise.all([approval, api.eventRequests(e.id)]);
  if (!r) return null;
  const faces = await api.signedUrls("avatars", r.requests.map(x => x.avatar_path));
  return {
    on: on === true, waiting: r.waiting, now: Date.now(),
    list: r.requests.map(x => ({ ...x, avatar: x.avatar_path ? faces.get(x.avatar_path) : undefined })),
  };
}

/** More seats than the ticket type has left: it can't be approved until some free up. */
const short = (r: Waiting) => r.seats_left != null && r.qty > r.seats_left;

export function EventRequests({ event: e, closed, load, onDecided }: {
  event: api.HostedEvent;
  /** The event has ended or was cancelled: nothing can be approved any more. */
  closed: "ended" | "cancelled" | null;
  load: RequestsLoad;
  /** A request was answered, or the list turned out to be out of date: the counts and the attendees have moved. */
  onDecided: () => void;
}) {
  const { notify } = useHost();
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<null | "approve" | "decline">(null);
  const [declining, setDeclining] = useState<Waiting[] | null>(null);

  if (load.status === "loading") return <RowsSkeleton rows={4} />;
  if (load.status === "error") return <LoadError what="requests" error={load.error} onRetry={load.reload} />;
  const data = load.data;
  if (!data || data.list.length === 0) {
    return (
      <EmptyState variant="done" title="No requests waiting" style={{ padding: "40px 24px" }}
        message={!data || data.on ? "Runners who ask for a spot show here, with their answers to your questions."
          : "Approve each runner is off for this event, so runners book without asking."} />
    );
  }
  const { list, now } = data;
  const picked = list.filter(r => sel[r.order_id]);
  const canApprove = (r: Waiting) => !closed && !short(r);
  const pickedOk = picked.filter(canApprove);

  const act = async (targets: Waiting[], approve: boolean) => {
    if (!targets.length || busy) return;
    setBusy(approve ? "approve" : "decline");
    const done: string[] = [];
    let at: Waiting | null = null;
    try {
      for (const r of targets) {
        at = r;
        await api.decideEventRequest(r.order_id, approve);
        done.push(r.order_id);
      }
      const one = targets.length === 1 ? targets[0] : null;
      if (approve) {
        notify("success", one ? "Request approved" : `${num(targets.length)} requests approved`,
          one ? `${one.name} has ${one.qty === 1 ? "a ticket" : `${num(one.qty)} tickets`} for ${e.title}.` : `They have their tickets for ${e.title}.`);
      } else {
        notify("neutral", one ? "Request declined" : `${num(targets.length)} requests declined`, one ? `${one.name} has been told.` : "They’ve been told.");
      }
    } catch (x) {
      const before = done.length ? ` ${plural(done.length, "request")} before it ${done.length === 1 ? "was" : "were"} ${approve ? "approved" : "declined"}.` : "";
      notify("danger", `Couldn’t ${approve ? "approve" : "decline"} ${at?.name ?? "that request"}`, api.requestFailText(x) + before);
    } finally {
      // The ones answered leave at once. Everything is then read again, whatever happened: a refusal usually means
      // this list was out of date (a request withdrawn, a co-host got there first, the seats went).
      if (done.length) load.set(d => (d ? { ...d, waiting: Math.max(0, d.waiting - done.length), list: d.list.filter(r => !done.includes(r.order_id)) } : d));
      setSel({});
      setDeclining(null);
      setBusy(null);
      onDecided();
    }
  };

  const one = declining?.length === 1 ? declining[0] : null;
  return (
    <div>
      {closed ? (
        <div style={{ ...kMuted, display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
          <Icon name="lock" size={13} />
          This event {closed === "cancelled" ? "was cancelled" : "has ended"}, so requests can’t be approved. You can still decline them.
        </div>
      ) : null}
      <Toolbar>
        <Checkbox
          label={`Select all ${num(list.length)}`}
          checked={picked.length === list.length}
          indeterminate={picked.length > 0 && picked.length < list.length}
          onChange={v => setSel(v ? Object.fromEntries(list.map(r => [r.order_id, true])) : {})}
        />
        <div style={{ flex: 1 }} />
        <Button variant="secondary" size="sm" disabled={!picked.length || !!busy} onClick={() => setDeclining(picked)}>Decline {picked.length || ""}</Button>
        <Button size="sm" icon="check-check" disabled={!pickedOk.length || !!busy} loading={busy === "approve"} onClick={() => { void act(pickedOk, true); }}>Approve {pickedOk.length || ""}</Button>
      </Toolbar>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 10, alignItems: "start" }}>
        {list.map(r => {
          const bits = [r.tier_name, r.qty > 1 ? plural(r.qty, "ticket") : "", `asked ${ago(r.requested_at, now)}`].filter(Boolean);
          const seats = r.seats.filter(s => s.answers.length > 0);
          return (
            <GlassCard key={r.order_id} padding={16} style={{ outline: sel[r.order_id] ? "1.5px solid var(--ink-900)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Checkbox checked={!!sel[r.order_id]} onChange={v => setSel(s => ({ ...s, [r.order_id]: v }))} />
                <Avatar name={r.name} src={r.avatar} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={kStrong}>{r.name}</div>
                  <div style={kMuted}>{bits.join(" · ")}</div>
                </div>
              </div>
              {seats.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12, padding: 12, borderRadius: 10, background: "var(--surface-panel)" }}>
                  {seats.map(s => (
                    <div key={s.seq} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {r.qty > 1 ? <div style={{ font: "500 12px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>Ticket {num(s.seq)}</div> : null}
                      {s.answers.map((a, i) => <Answer key={i} a={a} />)}
                    </div>
                  ))}
                </div>
              ) : null}
              {r.answers_missing > 0 ? <div style={{ ...kMuted, marginTop: 10 }}>Hasn’t answered every question yet.</div> : null}
              {short(r) ? (
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 10, font: "400 12px/1.4 var(--font-sans)", color: "var(--danger-text)" }}>
                  <Icon name="circle-alert" size={13} style={{ marginTop: 2, flex: "none" }} />
                  <span>
                    {r.seats_left === 0 ? `${r.tier_name} is full.` : `This asks for ${plural(r.qty, "seat")} and ${r.tier_name} has ${num(r.seats_left)} left.`}
                    {" "}It can’t be approved until seats free up.
                  </span>
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Button variant="secondary" style={{ flex: 1 }} disabled={!!busy} onClick={() => setDeclining([r])}>Decline</Button>
                <Button icon="check" style={{ flex: 1 }} disabled={!!busy || !canApprove(r)} onClick={() => { void act([r], true); }}>Approve</Button>
              </div>
            </GlassCard>
          );
        })}
      </div>
      {declining?.length ? (
        <Dialog open onClose={busy ? undefined : () => setDeclining(null)} icon="ban" tone="danger"
          title={one ? `Decline ${one.name}?` : `Decline ${num(declining.length)} requests?`}
          description="They’ll be told you couldn’t give them a spot. They won’t be able to ask again for this event."
          footer={<>
            <Button variant="ghost" onClick={() => setDeclining(null)} disabled={!!busy}>{one ? "Keep request" : "Keep requests"}</Button>
            <Button variant="danger" loading={busy === "decline"} onClick={() => { void act(declining, false); }}>
              {one ? "Decline request" : `Decline ${num(declining.length)} requests`}
            </Button>
          </>} />
      ) : null}
    </div>
  );
}

/** One answer as the host reads it. An emergency contact is only ever "given" or not: the number stays with pacr. */
function Answer({ a }: { a: api.SeatAnswer }) {
  const value = { font: "400 13px/1.4 var(--font-sans)", color: "var(--text-strong)" } as const;
  if (a.kind === "emergency") {
    return <div style={{ ...value, color: a.given ? "var(--text-strong)" : "var(--text-muted)" }}>{a.given ? "Emergency contact given" : "Emergency contact not given"}</div>;
  }
  const answer = a.given ? a.answer : null;
  return (
    <div>
      <div style={kMuted}>{a.label}</div>
      <div style={{ ...value, marginTop: 2, color: answer ? "var(--text-strong)" : "var(--text-muted)" }}>{answer || "No answer yet"}</div>
    </div>
  );
}
