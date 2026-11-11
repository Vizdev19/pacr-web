"use client";
// /routes: your saved routes (my_routes) and public routes near you
// (nearby_public_routes). Saving and editing routes stays in the app; the web
// reads them and lets you delete your own. Location is asked for only when the
// runner taps "Use my location", used once for the query and never stored.
import { useCallback, useState, type ReactNode } from "react";
import { Avatar, Badge, Button, Card } from "@/components/ds/core";
import { EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { ChipSelect, FieldMessage } from "@/components/ds/forms";
import { MapEmbed } from "@/components/ds/actions";
import { SegmentedControl, Tabs } from "@/components/ds/nav";
import { Dialog, useToast } from "@/components/ds/overlays";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { encodeRef } from "@/lib/refs";
import { dateLong, useLoad } from "@/lib/profile";
import { awayLabel, deleteRoute, getMyRoutes, getNearbyRoutes, KIND_LABEL, type Route, type RouteKind } from "@/lib/routes";

export function RoutesPage() {
  return <RequireSignIn title="Sign in to see routes" body="Your saved routes, and routes other runners have shared near you.">
    {auth => <Routes key={auth.uid} />}
  </RequireSignIn>;
}

type Tab = "mine" | "near";
const RADII = [{ id: "5", label: "5 km" }, { id: "10", label: "10 km" }, { id: "25", label: "25 km" }];
const KINDS = [{ id: "all", label: "All" }, { id: "loop", label: "Loops" }, { id: "out-and-back", label: "Out and back" }, { id: "one-way", label: "One way" }];

function Routes() {
  const [tab, setTab] = useState<Tab>("mine");
  return <div className="pw-container pw-page">
    <div className="sec-h" style={{ marginBottom: "var(--space-4)" }}>
      <div><h1 className="t-h1">Routes</h1><p>Routes are saved from a run in the app. Here you can look through yours and find ones near you.</p></div>
    </div>
    <div style={{ marginBottom: "var(--space-6)" }}>
      <Tabs value={tab} onChange={id => setTab(id as Tab)} tabs={[{ id: "mine", label: "Your routes" }, { id: "near", label: "Near you" }]} />
    </div>
    {tab === "mine" ? <Mine /> : <Near />}
  </div>;
}

function routeMeta(r: Route): string {
  return [`${r.distanceKm.toFixed(1)} km`, KIND_LABEL[r.kind], r.elevGainM != null ? `+${r.elevGainM} m` : null].filter(Boolean).join(" · ");
}

function RouteCard({ r, children }: { r: Route; children?: ReactNode }) {
  return <Card pad={false}>
    {r.shape ? <MapEmbed ratio="16:9" route={r.shape} radius={0} label={`Shape of ${r.name}`} /> : null}
    <div className="stack" style={{ padding: "var(--space-4)", gap: "var(--space-2)" }}>
      <b style={{ overflowWrap: "anywhere" }}>{r.name}</b>
      <div className="t-body-s t-secondary num">{routeMeta(r)}</div>
      {children}
    </div>
  </Card>;
}

function Mine() {
  const toast = useToast();
  const { data: routes, failed, retry, update } = useLoad(getMyRoutes);
  const [ask, setAsk] = useState<Route | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!ask) return;
    setBusy(true);
    const ok = await deleteRoute(ask.id);
    setBusy(false);
    if (ok) { update(rs => rs.filter(x => x.id !== ask.id)); toast({ title: "Route deleted" }); setAsk(null); }
    else toast({ title: "Couldn't delete the route", message: "Something went wrong. Try again.", tone: "error" });
  };

  if (failed) return <ErrorState title="Couldn't load your routes" body="Check your connection and try again." onRetry={retry} />;
  if (!routes) return <div className="grid-cards"><Skeleton variant="squad" /><Skeleton variant="squad" /></div>;
  if (!routes.length) return <EmptyState boxed icon="route" title="You haven't saved a route yet." body="Open a run in the app and save it as a route. It shows up here, and near you for other runners if you keep it public." />;

  return <>
    <div className="grid-cards">{routes.map(r => <RouteCard key={r.id} r={r}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="row" style={{ gap: "var(--space-2)" }}>
          {r.isPublic ? <Badge size="sm" icon="globe">Public</Badge> : <Badge size="sm" icon="lock">Only you</Badge>}
          {r.createdAt ? <span className="t-caption">Saved {dateLong(r.createdAt)}</span> : null}
        </span>
        <Button variant="ghost" size="sm" icon="trash-2" onClick={() => setAsk(r)}>Delete</Button>
      </div>
    </RouteCard>)}</div>
    <p className="t-caption" style={{ marginTop: "var(--space-4)" }}>Rename a route, or change who can see it, in the app.</p>
    <Dialog open={!!ask} onClose={() => !busy && setAsk(null)} title="Delete this route?"
      actions={<><Button variant="secondary" disabled={busy} onClick={() => setAsk(null)}>Cancel</Button><Button variant="destructive" loading={busy} onClick={() => void remove()}>Delete route</Button></>}>
      <p style={{ margin: 0 }}><b>{ask?.name}</b> is removed from your routes, and from Routes near you for everyone else. Your runs stay as they are. This can&apos;t be undone.</p>
    </Dialog>
  </>;
}

type Spot = { lat: number; lng: number };

function Near() {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [radius, setRadius] = useState("10");
  const [kind, setKind] = useState("all");

  const locate = () => {
    if (!("geolocation" in navigator)) { setLocError("This browser can't share a location. Open Routes near you in the app instead."); return; }
    setLocating(true); setLocError(null);
    navigator.geolocation.getCurrentPosition(
      pos => { setLocating(false); setSpot({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      err => {
        setLocating(false);
        setLocError(err.code === err.PERMISSION_DENIED
          ? "Location is blocked for this site. Allow it in your browser's site settings, then try again."
          : "We couldn't get your location. Try again in a moment.");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
    );
  };

  const fetchNear = useCallback(() => (spot ? getNearbyRoutes(spot.lat, spot.lng, Number(radius)) : Promise.resolve([])), [spot, radius]);
  const { data: routes, failed, retry } = useLoad<Route[]>(fetchNear);

  if (!spot) return <Card style={{ maxWidth: 560 }}>
    <div className="stack">
      <h2 className="t-h3">Find routes near you</h2>
      <p className="t-body-s t-secondary" style={{ margin: 0 }}>pacr needs your location once, in this browser, to find routes that start near you. It isn&apos;t saved, and nobody sees where you are.</p>
      <Button icon="locate-fixed" loading={locating} onClick={locate} style={{ alignSelf: "flex-start" }}>Use my location</Button>
      {locError ? <FieldMessage tone="error">{locError}</FieldMessage> : null}
    </div>
  </Card>;

  const shown = (routes ?? []).filter(r => kind === "all" || r.kind === (kind as RouteKind));
  return <div className="stack" style={{ gap: "var(--space-5)" }}>
    <div className="row" style={{ gap: "var(--space-4)", justifyContent: "space-between" }}>
      <ChipSelect multi={false} scroll value={kind} onChange={v => setKind(v[0] ?? "all")} options={KINDS} label="Kind of route" />
      <SegmentedControl size="sm" label="Search radius" value={radius} onChange={setRadius} options={RADII} />
    </div>
    {failed ? <ErrorState title="Couldn't load routes near you" body="Check your connection and try again." onRetry={retry} />
      : !routes ? <div className="grid-cards"><Skeleton variant="squad" /><Skeleton variant="squad" /></div>
      : !shown.length ? <EmptyState boxed icon="map" title={routes.length ? "No routes of that kind here." : "No routes near you yet."}
          body={routes.length ? "Try another kind, or a wider radius." : "Save a run as a route in the app and it shows up here for everyone."} />
      : <div className="grid-cards">{shown.map(r => <RouteCard key={r.id} r={r}>
          <div className="row" style={{ gap: "var(--space-2)" }}>
            {awayLabel(r.awayKm) ? <span className="t-caption">{awayLabel(r.awayKm)}</span> : null}
            {r.isMine ? <Badge size="sm">Yours</Badge>
              : r.creator ? <a href={`/profile?r=${encodeRef(r.creator.id) ?? ""}`} className="row" style={{ gap: "var(--space-2)", textDecoration: "none", color: "inherit" }}>
                <Avatar name={r.creator.name} src={r.creator.avatar} size={22} /><span className="t-body-s">{r.creator.name}</span></a> : null}
          </div>
        </RouteCard>)}</div>}
    <p className="t-caption" style={{ margin: 0 }}>Open a route in the app to run it with the line on your map.</p>
  </div>;
}
