"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, DateTile, Drawer, Icon, Skeleton, StatusTag } from "@/components/ds";
import { KV, kMuted, kStrong } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { num, tile, time } from "@/lib/format";
import { useLoad } from "@/lib/hooks";
import { useHost } from "@/lib/host";
import { encodeRef } from "@/lib/refs";
import { CancelRunDialog } from "../runs/CancelRunDialog";
import { distanceText, weekdayLong, who } from "../runs/helpers";
import type { CalItem } from "./dates";

const sentence = (s: string) => { const t = s.replace(/_/g, " ").trim(); return t ? t[0].toUpperCase() + t.slice(1) : ""; };
const STATUS: Record<string, string> = { draft: "Draft", published: "Published", cancelled: "Cancelled", ended: "Ended" };

export function ItemDrawer({ item, onClose, onChanged }: { item: CalItem; onClose: () => void; onChanged: () => void }) {
  return item.kind === "event" && item.event
    ? <EventDrawer item={item} event={item.event} onClose={onClose} />
    : item.run ? <RunDrawer item={item} run={item.run} onClose={onClose} onChanged={onChanged} /> : null;
}

function EventDrawer({ item, event, onClose }: { item: CalItem; event: api.HostedEvent; onClose: () => void }) {
  const router = useRouter();
  const t = tile(item.at);
  const ref = encodeRef(event.id);
  return (
    <Drawer open onClose={onClose} leading={<DateTile day={t.day} date={t.date} month={t.month} kind="event" size="sm" />}
      title={event.title} subtitle={time(item.at)}
      footer={ref ? <Button iconRight="arrow-right" onClick={() => router.push(`/events?event=${ref}`)}>Open event</Button> : null}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <KV k="Type" v={sentence(event.kind)} />
        <KV k="Status" v={<StatusTag status={STATUS[event.status] ?? sentence(event.status)} />} />
        <KV k="Tickets" v={event.capacity != null ? `${num(event.sold)} / ${num(event.capacity)}` : `${num(event.sold)} sold`} />
        <KV k="Checked in" v={num(event.checked_in)} />
        {event.place_name ? <KV k="Place" v={event.place_name} /> : null}
      </div>
    </Drawer>
  );
}

function RunDrawer({ item, run, onClose, onChanged }: { item: CalItem; run: api.SquadRun; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const { host } = useHost();
  const [cancelling, setCancelling] = useState(false);
  const full = useLoad(async () => {
    const detail = await api.getRun(run.id);
    const urls = await api.signedUrls("avatars", (detail?.goers ?? []).map(g => g.avatar_path));
    return { detail, urls };
  }, `caldrawer:${host.key}:${run.id}`);
  const t = tile(item.at);
  const ref = encodeRef(run.id);
  const dist = distanceText(run);
  const detail = full.data?.detail ?? null;
  const goers = detail?.goers ?? run.goers ?? [];
  const maps = run.meeting_lat != null && run.meeting_lng != null ? `https://www.google.com/maps/search/?api=1&query=${run.meeting_lat},${run.meeting_lng}` : null;
  const canCancel = !item.projected && !!detail?.can_cancel;

  return (
    <>
      <Drawer open onClose={onClose} leading={<DateTile day={t.day} date={t.date} month={t.month} kind="run" size="sm" />}
        title={run.title} subtitle={`${time(item.at)}${run.repeat_weekly ? ` · Every ${weekdayLong(item.at)}` : ""}`}
        footer={<>
          {canCancel ? <Button variant="secondary" icon="ban" onClick={() => setCancelling(true)}>Cancel run</Button> : null}
          <div style={{ flex: 1 }} />
          {ref ? <Button iconRight="arrow-right" onClick={() => router.push(`/runs?run=${ref}`)}>Open run</Button> : null}
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <KV k="Distance" v={dist ?? "Not set"} />
          <KV k="Pace" v={run.pace_label || "Not set"} />
          <KV k="Run leader" v={run.leader_name || "Not set"} />
          <KV k="Going" v={item.projected ? "RSVPs not open yet" : num(run.going_count)} />
        </div>
        <div style={{ margin: "16px 0 8px", ...kStrong }}>Meeting place</div>
        {run.meeting_point ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Icon name="map-pin" size={16} />
            <span style={{ flex: 1, minWidth: 0, font: "400 13px/1.4 var(--font-sans)", color: "var(--text-strong)" }}>{run.meeting_point}</span>
            {maps ? <a href={maps} target="_blank" rel="noreferrer" className="pc-btn pc-btn--secondary pc-btn--sm"><Icon name="external-link" size={15} />Open in Maps</a> : null}
          </div>
        ) : <div style={{ ...kMuted, color: "var(--warning-text)" }}>No meeting place set.</div>}

        {item.projected ? (
          <div style={{ display: "flex", gap: 8, marginTop: 18, padding: 12, borderRadius: 10, background: "var(--surface-panel)" }}>
            <Icon name="repeat" size={16} />
            <div style={{ flex: 1, font: "400 13px/1.4 var(--font-sans)" }}>
              This run repeats every {weekdayLong(item.at)}.
              <div style={kMuted}>RSVPs open after the previous run.</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 8px" }}>
              <span style={kStrong}>Going</span><span style={kMuted}>{num(run.going_count)} going</span>
            </div>
            {full.status === "loading" && goers.length === 0 ? <Skeleton lines={3} height={26} gap={10} /> : goers.length === 0 ? (
              <div style={kMuted}>No one has RSVP’d yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {goers.map(g => (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border-subtle)" }}>
                    <Avatar name={who(g.name)} src={g.avatar_path ? full.data?.urls.get(g.avatar_path) : undefined} size={26} />
                    <span style={{ flex: 1, font: "400 13px var(--font-sans)", color: "var(--text-strong)" }}>{who(g.name)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Drawer>
      <CancelRunDialog run={cancelling ? run : null} onClose={() => setCancelling(false)} onCancelled={() => { setCancelling(false); onChanged(); onClose(); }} />
    </>
  );
}
