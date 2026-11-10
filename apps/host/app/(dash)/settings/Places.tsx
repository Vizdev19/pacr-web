"use client";

// Home base and meeting places: the app's Manage → Home base + Meeting places
// (app/squad-manage.tsx). Changes save at once, not with Save changes.
//   • anyone here (owners and organisers) adds and removes places
//   • only the owner sets or changes the home base, and the home base can't
//     be removed until another place is home
// Moving a pin by hand is app-only for now (it needs a draggable map).

import { useState } from "react";
import { Badge, Button, Dialog, GlassCard, Icon, IconButton } from "@/components/ds";
import { LoadError, RowsSkeleton, kMuted, kStrong } from "@/components/shell/kit";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import * as api from "@/lib/api";
import { useLoad } from "@/lib/hooks";
import { useHost } from "@/lib/host";

export function PlacesCard({ circleId, squadKey, owner }: { circleId: string; squadKey: string; owner: boolean }) {
  const { notify, notifyError } = useHost();
  const x = useLoad(() => api.listPlaces(circleId), `places:${squadKey}`);
  const [finding, setFinding] = useState<"home" | "place" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<api.Place | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const subtitle = "Where runners meet. Runners nearby find the squad by its home base.";
  if (x.status === "loading") return <GlassCard title="Home base & meeting places" subtitle={subtitle}><RowsSkeleton rows={3} /></GlassCard>;
  if (x.status === "error") return <GlassCard title="Home base & meeting places" subtitle={subtitle}><LoadError what="meeting places" error={x.error} onRetry={x.reload} /></GlassCard>;

  const places = x.data;
  const home = places.find(p => p.is_home) ?? null;
  const ordered = home ? [home, ...places.filter(p => p.id !== home.id)] : places;
  const near = home?.lat != null && home.lng != null ? { lat: home.lat, lng: home.lng } : null;
  const full = places.length >= api.MAX_PLACES;

  const keep = (p: api.Place) => x.set(cur => (cur.some(c => c.id === p.id) ? cur : [...cur, p]));

  async function makeHome(p: api.Place) {
    setBusyId(p.id);
    try {
      await api.setHomePlace(circleId, p.id);
      x.set(cur => cur.map(c => ({ ...c, is_home: c.id === p.id })));
      notify("success", "Home base set", `${p.name} · runners nearby find the squad from here.`);
    } catch (e) {
      notifyError("Couldn’t set the home base", e);
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await api.removePlace(removing.id);
      x.set(cur => cur.filter(c => c.id !== removing.id));
      notify("success", "Place removed", `${removing.name} · runs that met there keep the name.`);
      setRemoving(null);
    } catch (e) {
      notifyError("Couldn’t remove the place", e);
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <GlassCard title="Home base & meeting places" subtitle={subtitle}
      actions={<span style={kMuted}>{places.length} of {api.MAX_PLACES}</span>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!home ? (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 12, background: "var(--surface-panel)" }}>
            <Icon name="circle-alert" size={16} />
            <div style={{ flex: 1, font: "400 13px/1.45 var(--font-sans)", color: "var(--text-body)" }}>
              No home base yet. Runs can’t be scheduled without one, and runners nearby won’t find the squad.
              {owner ? null : " Only the owner sets it."}
            </div>
          </div>
        ) : home.lat == null ? (
          <div style={{ ...kMuted, display: "flex", gap: 6, alignItems: "center" }}>
            <Icon name="map-pin-off" size={14} />The home base has no map pin, so runners nearby won’t see the squad.{owner ? " Search for it again below." : ""}
          </div>
        ) : null}

        {ordered.length ? (
          <div style={{ display: "flex", flexDirection: "column", borderRadius: 12, border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
            {ordered.map((p, i) => {
              const url = api.mapsUrl(p);
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i ? "1px solid var(--border-subtle)" : 0, flexWrap: "wrap" }}>
                  <Icon name={p.is_home ? "house" : p.lat == null ? "map-pin-off" : "map-pin"} size={16} />
                  <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                    <div style={{ ...kStrong, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ ...kMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.lat == null ? "No map pin" : p.address ?? "On the map"}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {p.is_home ? <Badge tone="success">Home base</Badge> : owner ? (
                      <Button size="sm" variant="ghost" loading={busyId === p.id} disabled={!!busyId} onClick={() => makeHome(p)}>Make home</Button>
                    ) : null}
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.name} in Google Maps`} title="Open in Google Maps"
                        className="pc-btn pc-btn--ghost pc-btn--sm pc-iconbtn"><Icon name="external-link" size={16} /></a>
                    ) : null}
                    {!p.is_home ? <IconButton size="sm" icon="trash-2" label={`Remove ${p.name}`} disabled={!!busyId} onClick={() => setRemoving(p)} /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {finding ? (
          <PlaceSearch key={finding} circleId={circleId} near={near}
            title={finding === "home" ? (home ? "Change the home base" : "Find the home base") : "Add a meeting place"}
            saveLabel={finding === "home" ? "Make home base" : "Save place"}
            onCancel={() => setFinding(null)}
            onSaved={async p => {
              keep(p);
              setFinding(null);
              if (finding === "home") await makeHome(p);
              else notify("success", "Place saved", `${p.name} · pick it when you schedule a run.`);
            }} />
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {owner ? <Button size="sm" variant={home ? "secondary" : "primary"} icon="house" disabled={full} onClick={() => setFinding("home")}>{home ? "Change home base" : "Set home base"}</Button> : null}
            <Button size="sm" variant="secondary" icon="plus" disabled={full} onClick={() => setFinding("place")}>Add a meeting place</Button>
            {full ? <span style={kMuted}>That’s 20 places. Remove one to add another.</span> : null}
          </div>
        )}
      </div>

      <Dialog open={!!removing} onClose={removeBusy ? undefined : () => setRemoving(null)} icon="trash-2" tone="danger"
        title={removing ? `Remove ${removing.name}?` : ""}
        description="Runs that met there keep the name. You can add it again any time."
        footer={<>
          <Button variant="ghost" disabled={removeBusy} onClick={() => setRemoving(null)}>Not now</Button>
          <Button variant="danger" loading={removeBusy} onClick={remove}>Remove place</Button>
        </>} />
    </GlassCard>
  );
}
