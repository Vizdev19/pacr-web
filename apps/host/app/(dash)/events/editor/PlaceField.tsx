"use client";

// Where the event is: a Google place picked from the search, so it has a pin
// runners can navigate to (an event can't go live without one), or one of the
// places this host has used before. The search runs through the app's
// `places` function, as the squad's place search does
// (components/places/PlaceSearch.tsx); suggestions carry "Powered by Google".

import { useEffect, useRef, useState } from "react";
import { Button, Icon, Input, SegmentChip } from "@/components/ds";
import { kMuted, kStrong } from "@/components/shell/kit";
import * as api from "@/lib/api";
import type { EventPlace } from "@/lib/eventEditor";
import { eBox, Section } from "./parts";

export function PlaceField({ place, text, venues, error, live, onPick, onText, onClear, meetNote, onMeetNote }: {
  place: EventPlace | null;
  /** What's typed while nothing is picked. */
  text: string;
  venues: EventPlace[];
  error?: string;
  live: boolean;
  onPick: (p: EventPlace) => void;
  onText: (t: string) => void;
  onClear: () => void;
  /** Where exactly to meet: "Gate 2, by the bandstand". */
  meetNote: string;
  onMeetNote: (v: string) => void;
}) {
  const session = useRef<string | null>(null);
  const [list, setList] = useState<{ q: string; items: api.PlaceSuggestion[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const typed = text.trim();

  useEffect(() => {
    if (place || typed.length < 2) return;
    let on = true;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        session.current ??= api.newPlacesSession();
        const items = await api.searchPlaces(typed, session.current, null);
        if (on) { setList({ q: typed, items }); setFail(null); }
      } catch (e) {
        if (on) { setList(null); setFail(api.failText(e)); }
      } finally {
        if (on) setSearching(false);
      }
    }, 250);
    return () => { on = false; clearTimeout(t); };
  }, [typed, place]);

  async function pick(s: api.PlaceSuggestion) {
    setBusy(true);
    try {
      session.current ??= api.newPlacesSession();
      const p = await api.placeDetails(s.placeId, session.current);
      onPick({ name: (p.name || s.main).slice(0, 120), address: p.address || s.secondary || null, lat: p.lat, lng: p.lng, googlePlaceId: p.placeId || s.placeId });
      setFail(null);
    } catch (e) {
      setFail(api.failText(e));
    } finally {
      session.current = null;   // a details call closes the session
      setBusy(false);
    }
  }

  const shown = !place && list && list.q === typed && typed.length >= 2 ? list.items : null;
  const maps = place ? api.mapsUrl({ lat: place.lat, lng: place.lng, google_place_id: place.googlePlaceId }) : null;

  return (
    <Section title="Location" note={live ? "Ticket holders are told when a live event’s location changes." : undefined}>
      {place ? (
        <div style={{ ...eBox, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Icon name={place.lat != null ? "map-pin" : "map-pin-off"} size={18} color="var(--text-muted)" />
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div style={kStrong}>{place.name}</div>
            <div style={kMuted}>{place.lat != null ? place.address ?? "Pinned on the map" : "No map pin yet: search for it to add one."}</div>
          </div>
          {maps ? <a className="pc-btn pc-btn--ghost pc-btn--sm" href={maps} target="_blank" rel="noreferrer"><Icon name="external-link" size={15} />Open in Maps</a> : null}
          <Button variant="secondary" size="sm" onClick={onClear}>Change</Button>
        </div>
      ) : (
        <>
          <Input icon="search" type="search" autoComplete="off" placeholder="Search for a park, stadium, café…" aria-label="Search for the location"
            value={text} onChange={e => onText(e.target.value.slice(0, 120))} error={error}
            trailing={searching || busy ? <span className="pc-spinner" aria-hidden="true" /> : undefined} />
          {fail ? <div style={{ ...kMuted, color: "var(--danger-text)" }}>{fail}</div> : null}
          {shown ? (
            <div role="listbox" aria-label="Places" style={{ display: "flex", flexDirection: "column", borderRadius: 12, background: "var(--surface-card)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
              {shown.length ? shown.map((s, i) => (
                <button key={s.placeId} type="button" role="option" aria-selected={false} disabled={busy} onClick={() => pick(s)} className="host-place-opt"
                  style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left", padding: "10px 12px", border: 0, borderTop: i ? "1px solid var(--border-subtle)" : 0, background: "transparent", cursor: "pointer" }}>
                  <span style={kStrong}>{s.main}</span>
                  <span style={kMuted}>{[s.kind, s.secondary].filter(Boolean).join(" · ")}</span>
                </button>
              )) : <div style={{ ...kMuted, padding: "10px 12px" }}>No places match. Try the park’s or stadium’s full name.</div>}
              <div style={{ ...kMuted, fontSize: 11, padding: "6px 12px", borderTop: "1px solid var(--border-subtle)", textAlign: "right" }}>Powered by Google</div>
            </div>
          ) : null}
          {venues.length ? (
            <div className="pc-field">
              <span className="pc-label">Places you’ve used</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {venues.slice(0, 6).map(v => <SegmentChip key={`${v.googlePlaceId ?? ""}|${v.name}|${v.lat ?? ""}|${v.lng ?? ""}`} icon="map-pin" label={v.name} onClick={() => onPick(v)} />)}
              </div>
            </div>
          ) : null}
          <span style={kMuted}>
            {typed && !shown?.length
              ? "A draft can keep the name as typed. To publish, pick the place from the search so runners get a pin."
              : "Pick the place from the search so it has a pin runners can navigate to."}
          </span>
        </>
      )}
      <Input label="Where to meet" value={meetNote} maxLength={120} placeholder="Gate 2, by the bandstand"
        hint={live ? "Optional. Ticket holders are told when it changes." : "Optional."} onChange={e => onMeetNote(e.target.value)} />
    </Section>
  );
}
