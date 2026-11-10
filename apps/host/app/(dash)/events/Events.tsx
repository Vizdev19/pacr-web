"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type KeyboardEvent } from "react";
import { DateTile, EmptyState, GlassCard, Icon, ProgressBar, Skeleton, StatusTag, Tabs } from "@/components/ds";
import { kMuted, kStrong, LoadError, Meta, Toolbar } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { num, tile, time } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { decodeRef, encodeRef, eventNewHref } from "@/lib/refs";
import { EventDetail } from "./EventDetail";
import { kindLabel, isOver, Poster, tagOf } from "./shared";

type Tab = "draft" | "up" | "past";

export function Events() {
  const { host } = useHost();
  const params = useSearchParams();
  const router = useRouter();
  const { phone } = useViewport();
  const [tab, setTab] = useState<Tab>("up");

  const ev = useLoad(async () => {
    const all = await api.hostedEvents(true);
    const mine = all.filter(e => e.host?.kind === host.kind && e.host?.id === host.id);
    const covers = await api.signedUrls("event-covers", mine.map(e => e.cover_path));
    return { events: mine, covers, now: Date.now() };
  }, `events:${host.key}`);

  const canCreate = host.kind === "squad" ? host.verified : host.status === "approved";
  const focus = decodeRef(params.get("event"));

  const groups = useMemo(() => {
    if (ev.status !== "ready") return { draft: [], up: [], past: [] };
    const { events, now } = ev.data;
    const byStart = (a: api.HostedEvent, b: api.HostedEvent) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    return {
      draft: events.filter(e => e.status === "draft").sort(byStart),
      up: events.filter(e => e.status === "published" && !isOver(e, now)).sort(byStart),
      past: events.filter(e => e.status !== "draft" && isOver(e, now)).sort((a, b) => byStart(b, a)),
    };
  }, [ev]);

  if (ev.status === "loading") return <ListSkeleton />;
  if (ev.status === "error") return <LoadError what="events" error={ev.error} onRetry={ev.reload} />;

  const { events, covers, now } = ev.data;

  if (params.get("event")) {
    const found = focus ? events.find(e => e.id === focus) : undefined;
    if (!found) {
      return (
        <EmptyState
          icon="ticket" title="Event not found" message="It may belong to another squad or account, or it was removed."
          action={{ label: "Back to events", variant: "secondary", onClick: () => router.push("/events") }} style={{ marginTop: 24 }}
        />
      );
    }
    return <EventDetail event={found} cover={found.cover_path ? covers.get(found.cover_path) : undefined} now={now} initialTab={params.get("tab") === "sales" ? "sales" : "attendees"} />;
  }

  const createButton = canCreate ? (
    <a className="pc-btn pc-btn--primary" href={eventNewHref} style={{ textDecoration: "none" }}>
      <Icon name="plus" size={17} />Create event
    </a>
  ) : null;

  const head = (
    <Toolbar>
      <Tabs
        value={tab} onChange={v => setTab(v as Tab)} style={{ flex: 1 }}
        tabs={[
          { value: "draft", label: "Drafts", count: groups.draft.length },
          { value: "up", label: "Upcoming", count: groups.up.length },
          { value: "past", label: "Past", count: groups.past.length },
        ]}
      />
      {createButton}
    </Toolbar>
  );

  const cannot = !canCreate ? (
    <div style={{ ...kMuted, marginBottom: 12 }}>
      {host.kind === "squad"
        ? <>Only verified squads host events. The owner can ask for the badge in <Link href="/settings" style={{ color: "inherit", textDecoration: "underline" }}>Settings</Link>.</>
        : "You can create events once your organizer account is approved."}
    </div>
  ) : null;

  if (events.length === 0) {
    return (
      <div>
        {head}{cannot}
        <EmptyState
          icon="ticket" title="No events yet"
          message="Events are ticketed or free one-offs: races, trail days, socials. Runners buy on pacr."
          style={{ padding: "56px 24px" }}
          {...(canCreate ? { action: { label: "Create your first event", icon: "plus" as const, onClick: () => window.location.assign(eventNewHref) } } : {})}
        />
      </div>
    );
  }

  const list = groups[tab];
  const empty: Record<Tab, [string, string]> = {
    draft: ["No drafts", "Events you start but haven’t published wait here."],
    up: ["Nothing coming up", "Published events show here until they end."],
    past: ["No past events yet", "Ended and cancelled events show here."],
  };

  return (
    <div>
      {head}{cannot}
      {list.length === 0 ? (
        <EmptyState icon="ticket" title={empty[tab][0]} message={empty[tab][1]} style={{ padding: "40px 24px" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map(e => (
            <EventRow key={e.id} e={e} cover={e.cover_path ? covers.get(e.cover_path) : undefined} now={now} phone={phone}
              onOpen={() => router.push(`/events?event=${encodeRef(e.id)}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ e, cover, now, phone, onOpen }: { e: api.HostedEvent; cover?: string; now: number; phone: boolean; onOpen: () => void }) {
  const t = tile(e.starts_at);
  const status = tagOf(e, now);
  const onKey = (ev: KeyboardEvent) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(); } };
  return (
    <GlassCard interactive padding={12} onClick={onOpen} onKeyDown={onKey} role="button" tabIndex={0}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: phone ? "wrap" : "nowrap" }}>
        <Poster src={cover} title={e.title} cancelled={status === "Cancelled"} />
        <DateTile day={t.day} date={t.date} month={t.month} kind="event" />
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ ...kStrong, fontSize: 15 }}>{e.title}</span><StatusTag status={status} />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
            <Meta icon="clock">{time(e.starts_at)}</Meta>
            {e.place_name ? <Meta icon="map-pin">{e.place_name}</Meta> : null}
            <Meta icon="tag">{kindLabel(e.kind)}</Meta>
            <Meta icon="indian-rupee">{e.is_paid ? "Paid" : "Free"}</Meta>
          </div>
        </div>
        <div style={{ width: phone ? "100%" : 190, flex: "none" }}>
          {e.capacity != null ? (
            <ProgressBar tone={e.sold >= e.capacity ? "warning" : "pop"} value={e.sold} max={e.capacity} showValue
              label={<span style={kMuted}>Tickets</span>} valueLabel={`${num(e.sold)} / ${num(e.capacity)}`} />
          ) : (
            <span style={kMuted}>{num(e.sold)} going</span>
          )}
        </div>
        <div style={{ width: 92, flex: "none", textAlign: phone ? "left" : "right" }}>
          <div style={{ font: "500 16px var(--font-sans)", color: e.checked_in > 0 ? "var(--text-strong)" : "var(--text-subtle)" }}>{e.checked_in > 0 ? num(e.checked_in) : "—"}</div>
          <div style={kMuted}>checked in</div>
        </div>
      </div>
    </GlassCard>
  );
}

function ListSkeleton() {
  return (
    <div>
      <Toolbar><Skeleton width={260} height={32} radius={8} /></Toolbar>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1, 2].map(i => (
          <GlassCard key={i} padding={12}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Skeleton width={52} height={78} radius={6} /><Skeleton width={56} height={60} radius={10} />
              <div style={{ flex: 1 }}><Skeleton width="45%" height={14} /><Skeleton width="70%" height={10} style={{ marginTop: 10 }} /></div>
              <Skeleton width={180} height={10} />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
