"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Avatar, Badge, Button, DataTable, DateTile, EmptyState, GlassCard, Icon, Input, ProgressBar, SegmentChip, Skeleton, StatusTag, Switch, Tabs,
} from "@/components/ds";
import { KV, LoadError, Meta, kMuted, kStrong } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { ago, dayTime, tile, time } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad, useViewport } from "@/lib/hooks";
import { encodeRef } from "@/lib/refs";
import { CancelRunDialog } from "./CancelRunDialog";
import { distanceText, runLink, weekdayLong, who } from "./helpers";

type Detail = {
  run: api.SquadRunDetail | null;
  rsvps: Map<string, string>;
  urls: Map<string, string>;
  checkins: api.RunCheckins | null;
  now: number;
};

export default function RunDetail({ id, initialTab }: { id: string | null; initialTab: string | null }) {
  const { host } = useHost();
  const router = useRouter();
  const back = () => router.replace("/runs");
  const d = useLoad<Detail>(async () => {
    if (!id) return { run: null, rsvps: new Map(), urls: new Map(), checkins: null, now: 0 };
    const [run, rsvpRows] = await Promise.all([api.getRun(id), api.runRsvps(id)]);
    if (!run) return { run: null, rsvps: new Map(), urls: new Map(), checkins: null, now: 0 };
    const checkins = run.can_check_in ? await api.runCheckins(id).catch(() => null) : null;
    const urls = await api.signedUrls("avatars", [...(run.goers ?? []).map(g => g.avatar_path), ...(checkins?.people ?? []).map(p => p.avatar_path)]);
    return { run, rsvps: new Map(rsvpRows.map(r => [r.user_id, r.created_at])), urls, checkins, now: Date.now() };
  }, `run:${host.key}:${id ?? "none"}`);

  if (d.status === "loading") {
    return (
      <div>
        <GlassCard padding={16} style={{ marginBottom: 12 }}><Skeleton width="50%" height={48} /></GlassCard>
        <Skeleton height={220} radius={16} />
      </div>
    );
  }
  if (d.status === "error") return <LoadError what="this run" error={d.error} onRetry={d.reload} />;
  if (!d.data.run) {
    return <EmptyState icon="footprints" title="We can’t find that run" message="It may have been cancelled, or the link is out of date."
      action={{ label: "Back to runs", icon: "arrow-left", onClick: back }} />;
  }
  return <Body run={d.data.run} data={d.data} reload={d.reload} initialTab={initialTab} />;
}

function Body({ run, data, reload, initialTab }: { run: api.SquadRunDetail; data: Detail; reload: () => void; initialTab: string | null }) {
  const { notify } = useHost();
  const router = useRouter();
  const { phone } = useViewport();
  const [tab, setTab] = useState(initialTab === "checkin" || initialTab === "going" ? initialTab : "overview");
  const [cancelling, setCancelling] = useState(false);
  const t = tile(run.event_at);
  const dist = distanceText(run);
  const effective = tab === "checkin" && !run.can_check_in ? "overview" : tab;
  const ref = encodeRef(run.id);

  // While check-in is open, scans from the phone app should show up here.
  const open = data.checkins?.open ?? false;
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [open, reload]);

  const copy = async () => {
    if (!run.circle_slug || !ref) return;
    try {
      await navigator.clipboard.writeText(runLink(run.circle_slug, ref));
      notify("success", "Link copied", "Anyone with it can see this run on pacr.life.");
    } catch {
      notify("warning", "Couldn’t copy the link", "Your browser blocked clipboard access.");
    }
  };

  return (
    <div>
      <Link href="/runs" style={{ ...kMuted, textDecoration: "none", display: "inline-flex", gap: 4, alignItems: "center", marginBottom: 10 }}>
        <Icon name="arrow-left" size={13} />All runs
      </Link>
      <GlassCard padding={16} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <DateTile day={t.day} date={t.date} month={t.month} />
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ font: "500 20px/1.2 var(--font-sans)", color: "var(--text-strong)", letterSpacing: "-.015em" }}>{run.title}</span>
              {run.repeat_weekly ? <Badge tone="neutral" icon="repeat">Every {t.day}</Badge> : <Badge tone="neutral" variant="outline">One-off</Badge>}
              {run.women_only ? <Badge tone="neutral">Women only</Badge> : null}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
              <Meta icon="clock">{time(run.event_at)}</Meta>
              {run.meeting_point ? <Meta icon="map-pin">{run.meeting_point}</Meta> : <span style={{ color: "var(--warning-text)" }}><Meta icon="map-pin">No meeting place</Meta></span>}
              {dist ? <Meta icon="route">{dist}</Meta> : null}
              {run.pace_label ? <Meta icon="gauge">{run.pace_label}</Meta> : null}
              <Meta icon="users">{run.going_count} going</Meta>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {run.circle_slug && ref ? <Button variant="secondary" icon="link" onClick={copy}>Copy run link</Button> : null}
            {run.can_cancel ? <Button variant="secondary" icon="ban" onClick={() => setCancelling(true)}>Cancel run</Button> : null}
          </div>
        </div>
      </GlassCard>

      <Tabs value={effective} onChange={setTab} style={{ marginBottom: 12 }}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "going", label: "Going", count: run.going_count },
          ...(run.can_check_in ? [{ value: "checkin", label: "Check-in" }] : []),
        ]} />

      {effective === "overview" ? <Overview run={run} /> : effective === "going" ? <Going run={run} data={data} phone={phone} /> : (
        <CheckIn run={run} data={data} reload={reload} phone={phone} />
      )}

      <CancelRunDialog run={cancelling ? run : null} onClose={() => setCancelling(false)} onCancelled={() => { setCancelling(false); router.replace("/runs"); }} />
    </div>
  );
}

function Overview({ run }: { run: api.SquadRunDetail }) {
  const dist = distanceText(run);
  return (
    <div style={{ maxWidth: 560 }}>
      <GlassCard title="Details">
        <KV k="Date" v={dayTime(run.event_at)} />
        <KV k="Distance" v={dist ?? "Not set"} />
        <KV k="Pace" v={run.pace_label || "Not set"} />
        <KV k="Meeting place" v={run.meeting_point || "Not set"} />
        <KV k="Run leader" v={run.leader_name || "Not set"} />
        <KV k="Repeats" v={run.repeat_weekly ? `Every ${weekdayLong(run.event_at)}` : "Doesn’t repeat"} />
      </GlassCard>
      <p style={{ ...kMuted, marginTop: 10 }}>Runs can’t be edited after scheduling. To change one, cancel it and schedule again.</p>
    </div>
  );
}

function Going({ run, data, phone }: { run: api.SquadRunDetail; data: Detail; phone: boolean }) {
  const goers = run.goers ?? [];
  const checked = new Map((data.checkins?.people ?? []).map(p => [p.user_id, p.checked_in_at]));
  const showCheck = run.can_check_in && data.checkins !== null;
  if (goers.length === 0) {
    return <EmptyState icon="users" title="No one is going yet" message="RSVPs show up here as members respond." />;
  }
  const rsvpAt = (g: api.Goer) => { const at = data.rsvps.get(g.id); return at ? `RSVP’d ${ago(at, data.now)}` : ""; };
  const src = (g: api.Goer) => (g.avatar_path ? data.urls.get(g.avatar_path) : undefined);
  const status = (g: api.Goer) => (checked.get(g.id) ? <StatusTag status="Checked in" /> : <Badge tone="neutral" variant="outline">Not yet</Badge>);
  if (phone) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {goers.map(g => (
          <GlassCard key={g.id} padding={12}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={who(g.name)} src={src(g)} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={kStrong}>{who(g.name)}</div><div style={kMuted}>{rsvpAt(g)}</div></div>
              {showCheck ? status(g) : null}
            </div>
          </GlassCard>
        ))}
      </div>
    );
  }
  return (
    <GlassCard flush>
      <DataTable rows={goers} rowKey="id" columns={[
        { key: "name", header: "Runner", sortable: true, sortValue: g => who(g.name), render: g => (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={who(g.name)} src={src(g)} size={28} /><span style={{ ...kStrong, fontSize: 13 }}>{who(g.name)}</span></span>
        ) },
        { key: "rsvp", header: "RSVP’d", render: g => { const at = data.rsvps.get(g.id); return at ? ago(at, data.now) : ""; } },
        ...(showCheck ? [{ key: "check", header: "Check-in", align: "right" as const, render: status }] : []),
      ]} />
    </GlassCard>
  );
}

function CheckIn({ run, data, reload, phone }: { run: api.SquadRunDetail; data: Detail; reload: () => void; phone: boolean }) {
  const { notify, notifyError } = useHost();
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "no" | "in">("all");
  const [busy, setBusy] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);
  const c = data.checkins;
  if (!c) return <EmptyState variant="error" title="Couldn’t load check-in" message="Try again in a moment." action={{ label: "Retry", onClick: reload }} />;

  const people = c.people;
  const going = people.filter(p => p.going).length;
  const inCount = people.filter(p => p.checked_in_at).length;
  const notYet = people.filter(p => p.going && !p.checked_in_at).length;
  const shown = people.filter(p => who(p.name).toLowerCase().includes(q.trim().toLowerCase())
    && (f === "all" || (f === "in" ? !!p.checked_in_at : p.going && !p.checked_in_at)));

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      await api.setRunCheckin(run.id, next);
      notify("success", next ? "Check-in opened" : "Check-in closed", next ? "It closes by itself in 12 hours." : run.title);
      reload();
    } catch (e) {
      notifyError("Couldn’t change check-in", e);
    } finally {
      setBusy(false);
    }
  };
  const undo = async (userId: string, name: string) => {
    setUndoing(userId);
    try {
      await api.undoCheckIn(run.id, userId);
      notify("success", "Check-in undone", `${name} is marked as not yet checked in.`);
      reload();
    } catch (e) {
      notifyError("Couldn’t undo the check-in", e);
    } finally {
      setUndoing(null);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1fr) 300px", gap: 12, alignItems: "start" }}>
      <GlassCard>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={kMuted}>Checked in</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <span style={{ font: "var(--type-hero-number)", letterSpacing: "var(--tracking-display)", color: "var(--text-strong)" }}>{inCount}</span>
              <span style={{ font: "400 18px var(--font-sans)", color: "var(--text-muted)" }}>/ {going} going</span>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {c.open ? <Badge tone="lime" dot size="lg">Open · updates live</Badge> : <Badge tone="neutral" variant="outline" size="lg">Closed</Badge>}
        </div>
        <ProgressBar size="lg" tone="pop" value={inCount} max={Math.max(going, 1)} style={{ marginTop: 14 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <Switch checked={c.open} disabled={busy} onChange={toggle} label={c.open ? "Check-in is open" : "Open check-in"} />
          <span style={{ ...kMuted, flex: "1 1 220px" }}>
            Closes by itself 12 hours after opening.
            {c.changed_at ? ` ${c.open ? "Opened" : "Closed"}${c.changed_by_name ? ` by ${c.changed_by_name}` : ""} ${ago(c.changed_at, data.now)}.` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, margin: "16px 0 10px", flexWrap: "wrap" }}>
          <Input icon="search" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} style={{ flex: "1 1 220px" }} />
          <SegmentChip label="All" active={f === "all"} onClick={() => setF("all")} />
          <SegmentChip label="Not yet" count={notYet} active={f === "no"} onClick={() => setF("no")} />
          <SegmentChip label="Checked in" count={inCount} active={f === "in"} onClick={() => setF("in")} />
        </div>
        <div>
          {shown.map(p => (
            <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid var(--border-subtle)" }}>
              <Avatar name={who(p.name)} src={p.avatar_path ? data.urls.get(p.avatar_path) : undefined} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ ...kStrong, fontSize: 13 }}>{who(p.name)}</div></div>
              <span style={{ ...kMuted, textAlign: "right" }}>{p.checked_in_at ? time(p.checked_in_at) : ""}</span>
              {p.checked_in_at ? <Button size="sm" variant="ghost" icon="undo-2" loading={undoing === p.user_id} onClick={() => undo(p.user_id, who(p.name))}>Undo</Button> : null}
            </div>
          ))}
          {shown.length === 0 ? <div style={{ padding: 24, textAlign: "center", ...kMuted }}>{people.length === 0 ? "No one has RSVP’d yet." : q ? `No one matches “${q}”.` : "No one here yet."}</div> : null}
        </div>
      </GlassCard>
      <GlassCard>
        <div style={{ aspectRatio: "1", maxWidth: 160, margin: "0 auto 14px", borderRadius: 12, border: "1.5px dashed var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="scan-qr-code" size={54} strokeWidth={1.25} />
        </div>
        <div style={{ ...kStrong, textAlign: "center" }}>Scanning is faster on your phone</div>
        <div style={{ ...kMuted, textAlign: "center", marginTop: 6 }}>Open pacr, find this run and scan each runner’s QR at the start line. Counts show up here as you go.</div>
      </GlassCard>
    </div>
  );
}
