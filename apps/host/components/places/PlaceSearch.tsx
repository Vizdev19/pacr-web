"use client";

// Find a place on Google and save it to the squad: the web twin of the app's
// src/components/squads/PlaceSearch.tsx.
//
//   search    type → Google suggestions near the squad's home base
//   confirm   a small Google map at the pin, the label runners see
//             (Google's name to start with) and the address, then Save place
//   fallback  "Use “…” without a map pin" keeps plain text working when Google
//             has nothing or search is down; runners get no directions to it
//
// Suggestions shown off a Google map carry "Powered by Google" (Google's
// attribution rule). The map in the confirm step is Google's own embed, so
// Places data only ever sits on a Google map.

import { useEffect, useRef, useState } from "react";
import { Button, Icon, Input } from "@/components/ds";
import { kMuted, kStrong } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { useHost } from "@/lib/host";

type Draft = api.PlaceDraft;

// Maps Embed API (no usage charge). The key is a browser key restricted to
// pacr.life's referrers and to the Maps Embed API only; NEXT_PUBLIC_ values
// are baked in at build, from the pacr-host Vercel project's variables. A
// build without it falls back to Google's keyless embed link.
//
// The variable must NOT be "sensitive" in Vercel: CI builds after
// `vercel pull`, which gets only the text "[SENSITIVE]" for those (add it
// with `vercel env add … --no-sensitive`). Anything that isn't a Google key
// counts as no key, so a placeholder can't break the map.
const RAW_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY ?? "";
const EMBED_KEY = /^AIza[0-9A-Za-z_-]{35}$/.test(RAW_KEY) ? RAW_KEY : "";

function embedUrl(d: { lat: number; lng: number; googlePlaceId: string | null }): string {
  if (!EMBED_KEY) return `https://maps.google.com/maps?q=${d.lat},${d.lng}&z=16&output=embed`;
  // A Google place shows its own name card; a bare pin shows the coordinates.
  const q = d.googlePlaceId ? `place_id:${d.googlePlaceId}` : `${d.lat},${d.lng}`;
  return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(EMBED_KEY)}&q=${encodeURIComponent(q)}&zoom=16`;
}

export function PlaceSearch({ circleId, title, near, saveLabel = "Save place", onSaved, onCancel }: {
  circleId: string;
  title: string;
  /** Bias suggestions here (the home base). */
  near: { lat: number; lng: number } | null;
  saveLabel?: string;
  onSaved: (place: api.Place) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { notifyError } = useHost();
  const session = useRef(api.newPlacesSession());
  const [query, setQuery] = useState("");
  const [list, setList] = useState<{ q: string; items: api.PlaceSuggestion[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = query.trim();

  useEffect(() => {
    if (draft || typed.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const items = await api.searchPlaces(typed, session.current, near);
        if (live) { setList({ q: typed, items }); setFail(null); }
      } catch (e) {
        if (live) { setList(null); setFail(api.failText(e)); }
      } finally {
        if (live) setSearching(false);
      }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [typed, draft, near]);

  async function pick(s: api.PlaceSuggestion) {
    setBusy(true);
    try {
      const p = await api.placeDetails(s.placeId, session.current);
      setDraft({ name: (p.name || s.main).slice(0, 60), address: p.address || s.secondary || null, lat: p.lat, lng: p.lng, googlePlaceId: p.placeId || s.placeId });
      setFail(null);
    } catch (e) {
      setFail(api.failText(e));
    } finally {
      session.current = api.newPlacesSession();   // a details call closes the session
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const place = await api.addPlace(circleId, draft);
      await onSaved(place);
    } catch (e) {
      notifyError("Couldn’t save the place", e);
      setBusy(false);
    }
  }

  const nameOk = !!draft && draft.name.trim().length >= 1 && draft.name.trim().length <= 60;
  const shown = list && list.q === typed && typed.length >= 2 ? list.items : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, borderRadius: 14, border: "1px solid var(--border-subtle)", background: "var(--surface-panel)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="map-pin" size={16} />
        <span style={{ ...kStrong, flex: 1 }}>{title}</span>
      </div>

      {draft ? (
        <>
          {draft.lat != null && draft.lng != null ? (
            <iframe
              title={`Map of ${draft.name}`}
              src={embedUrl({ lat: draft.lat, lng: draft.lng, googlePlaceId: draft.googlePlaceId })}
              referrerPolicy="no-referrer-when-downgrade"
              style={{ width: "100%", height: 190, border: 0, borderRadius: 12, background: "var(--surface-sunken)" }}
            />
          ) : (
            <div style={{ ...kMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="map-pin-off" size={14} />No map pin, so runners won’t get directions to it.
            </div>
          )}
          <Input label="Name runners see" value={draft.name} maxLength={60} autoFocus
            error={!nameOk ? "Use 1 to 60 characters" : undefined}
            hint={draft.address ?? undefined}
            onChange={e => setDraft(d => d && { ...d, name: e.target.value })} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setDraft(null)}>Back to search</Button>
            <Button size="sm" loading={busy} disabled={!nameOk} onClick={save}>{saveLabel}</Button>
          </div>
        </>
      ) : (
        <>
          <Input icon="search" type="search" autoFocus autoComplete="off" placeholder="Search for a park, stadium, café…"
            aria-label="Search for the place" value={query} onChange={e => setQuery(e.target.value)}
            trailing={searching ? <span className="pc-spinner" aria-hidden="true" /> : undefined} />
          {fail ? <div style={{ ...kMuted, color: "var(--danger-text)" }}>{fail}</div> : null}
          {shown ? (
            <div role="listbox" aria-label="Places" style={{ display: "flex", flexDirection: "column", borderRadius: 12, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
              {shown.length ? shown.map((s, i) => (
                <button key={s.placeId} type="button" role="option" aria-selected={false} disabled={busy} onClick={() => pick(s)} className="host-place-opt"
                  style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left", padding: "10px 12px", border: 0, borderTop: i ? "1px solid var(--border-subtle)" : 0, background: "transparent", cursor: "pointer" }}>
                  <span style={kStrong}>{s.main}</span>
                  <span style={kMuted}>{[s.kind, s.secondary, s.distanceKm != null ? `${s.distanceKm < 10 ? s.distanceKm.toFixed(1) : Math.round(s.distanceKm)} km away` : null].filter(Boolean).join(" · ")}</span>
                </button>
              )) : <div style={{ ...kMuted, padding: "10px 12px" }}>No places match. Try the park’s or stadium’s full name.</div>}
              <div style={{ ...kMuted, fontSize: 11, padding: "6px 12px", borderTop: "1px solid var(--border-subtle)", textAlign: "right" }}>Powered by Google</div>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            {typed.length >= 2 ? (
              <Button variant="ghost" size="sm" icon="map-pin-off" disabled={busy}
                onClick={() => setDraft({ name: typed.slice(0, 60), address: null, lat: null, lng: null, googlePlaceId: null })}>
                Use “{typed.length > 28 ? `${typed.slice(0, 28)}…` : typed}” without a map pin
              </Button>
            ) : <span />}
            <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>Not now</Button>
          </div>
        </>
      )}
    </div>
  );
}
