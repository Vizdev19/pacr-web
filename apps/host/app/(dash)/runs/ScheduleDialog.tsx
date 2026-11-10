"use client";

import { useState } from "react";
import { Button, Dialog, Input, Select, Skeleton, Switch } from "@/components/ds";
import * as api from "@/lib/api";
import { dayTime } from "@/lib/format";
import { isStaff, useHost } from "@/lib/host";
import { useLoad } from "@/lib/hooks";
import { kMuted } from "@/components/shell/kit";
import { PlaceSearch } from "@/components/places/PlaceSearch";

const OTHER = "other";

/** The Schedule a run form, with the same rules as the pacr app's own. */
export function ScheduleDialog({ onClose, onScheduled }: { onClose: () => void; onScheduled: () => void }) {
  const { me, host, notify, notifyError } = useHost();
  const staff = isStaff(host.roleKey);
  const lists = useLoad(async () => {
    const [places, members] = await Promise.all([
      api.listPlaces(host.id),
      staff ? api.membersLite(host.id) : Promise.resolve([] as api.MemberLite[]),
    ]);
    return { places, leaders: members.filter(m => api.roleRank(m.role) >= 1) };
  }, `schedule:${host.key}`);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [clock, setClock] = useState("06:00");
  const [placeKey, setPlaceKey] = useState<string | null>(null);
  const [dist, setDist] = useState("");
  const [pace, setPace] = useState("");
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [women, setWomen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [lateAt, setLateAt] = useState<string | null>(null);

  const places = lists.data?.places ?? [];
  const home = places.find(p => p.is_home) ?? null;
  const ordered = home ? [home, ...places.filter(p => p.id !== home.id)] : places;
  const key = placeKey ?? home?.id ?? (ordered.length === 0 ? OTHER : "");
  const chosen = ordered.find(p => p.id === key) ?? null;
  const leaders = lists.data?.leaders ?? [];
  const leader = leaderId ?? me.id;

  const km = parseFloat(dist.replace(",", "."));
  const when = date && clock ? new Date(`${date}T${clock}`) : null;
  const errors = {
    title: !title.trim() ? "Give the run a name." : title.length > 120 ? "Keep it to 120 characters." : "",
    when: !when || Number.isNaN(when.getTime()) ? "Pick a date and start time." : "",
    place: key === OTHER ? "Find the meeting place and save it, or pick a saved one." : !chosen ? "Pick where to meet." : "",
    dist: !(km > 0) ? "Enter a distance in km." : km > 200 ? "That’s over 200 km." : "",
    pace: pace.length > 30 ? "Keep it to 30 characters." : "",
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (tried ? errors[k] : "") || undefined;

  const submit = async () => {
    setTried(true);
    if (invalid || !when) return;
    if (when.getTime() <= Date.now()) { setLateAt(`${date}T${clock}`); return; }
    setBusy(true);
    try {
      await api.scheduleRun(host.id, {
        title: title.trim(), eventAt: when, distanceKm: km, paceLabel: pace,
        meetingPoint: chosen?.name ?? "", placeId: chosen?.id ?? null,
        repeatWeekly: repeat, womenOnly: women, leaderId: staff ? leader : null,
      });
      notify("success", "Run scheduled", `${title.trim()} · ${dayTime(when)}`);
      onScheduled();
    } catch (e) {
      notifyError("Couldn’t schedule the run", e);
    } finally {
      setBusy(false);
    }
  };

  const placeOptions = [
    ...ordered.map(p => ({ value: p.id, label: p.is_home ? `${p.name} · Home base` : p.name })),
    { value: OTHER, label: "Somewhere else…" },
  ];
  const past = lateAt === `${date}T${clock}`;

  return (
    <Dialog open onClose={busy ? undefined : onClose} width={600} icon="footprints" title="Schedule a run"
      description="Members get a push when you publish. RSVPs open right away."
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Not now</Button>
        <Button loading={busy} disabled={lists.status !== "ready"} onClick={submit}>Schedule run</Button>
      </>}>
      {lists.status === "loading" ? <Skeleton lines={5} height={38} gap={14} /> : lists.status === "error" ? (
        <div style={{ ...kMuted, color: "var(--danger-text)" }}>Couldn’t load your meeting places. Close this and try again.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Title" placeholder="Saturday long run" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} error={show("title")} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
            <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} error={show("when") ?? (past ? "Pick a time in the future." : undefined)} />
            <Input label="Start time" type="time" value={clock} onChange={e => setClock(e.target.value)} />
          </div>
          <Select label="Meeting place" value={key} options={placeOptions} placeholder="Pick a place" onChange={setPlaceKey}
            hint={show("place") ? <span style={{ color: "var(--danger-text)" }}>{show("place")}</span> : undefined} />
          {key === OTHER ? (
            <PlaceSearch circleId={host.id} title="Find the meeting place" saveLabel="Use this place"
              near={home?.lat != null && home.lng != null ? { lat: home.lat, lng: home.lng } : null}
              onCancel={() => setPlaceKey(home?.id ?? ordered[0]?.id ?? "")}
              onSaved={p => {
                lists.set(d => ({ ...d, places: d.places.some(x => x.id === p.id) ? d.places : [...d.places, p] }));
                setPlaceKey(p.id);
              }} />
          ) : chosen ? (
            <div style={{ ...kMuted, display: "flex", alignItems: "center", gap: 6, marginTop: -6 }}>
              {chosen.lat == null ? "No map pin: runners won’t get directions." : chosen.address ?? "On the map"}
              {api.mapsUrl(chosen) ? <a href={api.mapsUrl(chosen)!} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-strong)", textDecoration: "underline" }}>View on map</a> : null}
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 }}>
            <Input label="Distance (km)" type="number" inputMode="decimal" min={0} step={0.1} placeholder="10" value={dist} onChange={e => setDist(e.target.value)} error={show("dist")} />
            <Input label="Pace (optional)" placeholder="6:00 /km" value={pace} maxLength={30} onChange={e => setPace(e.target.value)} error={show("pace")} />
          </div>
          {staff ? (
            <Select label="Run leader" value={leaders.some(l => l.userId === leader) ? leader : ""} placeholder="Pick a leader"
              options={leaders.map(l => ({ value: l.userId, label: l.isSelf ? `${l.name} (you)` : l.name }))} onChange={setLeaderId} />
          ) : (
            <Input label="Run leader" value={me.name} readOnly hint="Run leaders lead the runs they schedule." />
          )}
          <Switch checked={repeat} onChange={setRepeat} label="Repeat every week" />
          <Switch checked={women} onChange={setWomen} label="Women only" />
        </div>
      )}
    </Dialog>
  );
}
