// ─────────────────────────────────────────────────────────────────────────────
// /host — "Where": Google Places search through the app's `places` function
// (the Google key never reaches the browser). Typing asks for suggestions in
// one Places session; picking one asks for its details in the same session,
// which Google bills as one. The place keeps its name, address, coordinates
// and place id — the app's directions and "near you" both need the pin.
// Google's terms want the attribution line under the results.
// ─────────────────────────────────────────────────────────────────────────────

import { searchPlaces, placeDetails, newPlacesSession } from './api.js';
import { esc } from './util.js';

/**
 * Draw the search into `host`. `initial` is the event's current place
 * ({ name, address, lat, lng, google_place_id }) or null. `onPick(place|null)`
 * hears every change.
 */
export function mountPlaceSearch(host, { initial, onPick }) {
  let session = newPlacesSession();
  let timer = null;
  let seq = 0;
  let picked = initial && initial.name ? initial : null;

  const draw = () => {
    if (picked) {
      host.innerHTML = `
        <div class="place-picked">
          <div class="place-pin" aria-hidden="true">●</div>
          <div class="place-text">
            <div class="place-name">${esc(picked.name)}</div>
            <div class="place-sub">${esc(picked.address ?? '')}${picked.lat == null ? ' · no map pin — search again' : ''}</div>
          </div>
          <button type="button" class="btn-quiet" data-change>Change</button>
        </div>`;
      host.querySelector('[data-change]').addEventListener('click', () => { picked = null; draw(); host.querySelector('input')?.focus(); });
      return;
    }
    host.innerHTML = `
      <div class="place-search">
        <input type="search" autocomplete="off" placeholder="Search for a park, stadium, café…" aria-label="Search for the place">
        <div class="place-list" role="listbox" hidden></div>
        <div class="place-msg msg" hidden></div>
      </div>`;
    const input = host.querySelector('input');
    const list = host.querySelector('.place-list');
    const msg = host.querySelector('.place-msg');
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { list.hidden = true; list.innerHTML = ''; return; }
      timer = setTimeout(async () => {
        const mine = ++seq;
        const r = await searchPlaces(q, session, null);
        if (mine !== seq) return;
        if (!r.ok) { msg.textContent = r.text; msg.className = 'place-msg msg err'; msg.hidden = false; list.hidden = true; return; }
        msg.hidden = true;
        const items = r.value ?? [];
        list.innerHTML = items.length
          ? items.map((s, i) => `
              <button type="button" class="place-opt" role="option" data-i="${i}">
                <b>${esc(s.main)}</b><span>${esc([s.kind, s.secondary].filter(Boolean).join(' · '))}</span>
              </button>`).join('') + `<div class="google">Powered by Google</div>`
          : `<div class="place-none">No places match. Try the park’s or stadium’s full name.</div>`;
        list.hidden = false;
        list.querySelectorAll('.place-opt').forEach(b => b.addEventListener('click', async () => {
          const s = items[Number(b.dataset.i)];
          b.disabled = true;
          const d = await placeDetails(s.placeId, session);
          session = newPlacesSession();
          if (!d.ok) { msg.textContent = d.text; msg.className = 'place-msg msg err'; msg.hidden = false; b.disabled = false; return; }
          picked = {
            name: d.value.name || s.main,
            address: d.value.address ?? s.secondary ?? null,
            lat: d.value.lat, lng: d.value.lng,
            google_place_id: d.value.placeId ?? s.placeId,
          };
          onPick(picked);
          draw();
        }));
      }, 250);
    });
  };
  draw();
}
