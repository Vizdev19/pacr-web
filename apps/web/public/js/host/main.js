// ─────────────────────────────────────────────────────────────────────────────
// pacr.life/host — the event host dashboard (pacr: plan "Pacr Events", phase 1).
//
// Hosting is set up here; the app runs the day (tickets, the check-in
// scanner, cancelling at the start line). Signed-in only, and only accounts
// the app made can sign in (js/auth.js) — there is no sign-up on the web.
//
//   /host                     home: who I can host as (squads where I'm a run
//                             leader or above, my organizer and its status),
//                             New event, and my events — drafts, upcoming, past
//   /host/apply               ask to host outside a squad (apply_organizer);
//                             Pacr staff decide in pacr-admin
//   /host/new                 a new event (js/host/editor.js) — created as a
//                             draft, then edited in full
//   /host/e/<ref>             edit an event: details, place, tickets, the
//                             detail page's content, poster; publish, cancel
//   /host/e/<ref>/attendees   who has a ticket and who's checked in
//
// The dashboard itself (overview, runs, members, money…) is the Next.js app in
// apps/host; vercel.json sends only /host/new, /host/apply and /host/e/* here
// (host-events.html). This file reads
// location.pathname and draws the view. Links between views are ordinary
// page loads.
// ─────────────────────────────────────────────────────────────────────────────

import { mountHeaderAuth, signinHref } from '../auth.js';
import {
  sessionUser, myHosting, myHostedEvents, applyOrganizer, getEventForEdit, listAttendees, avatarUrls, imageUrls,
} from './api.js';
import {
  $, esc, decodeRef, editHref, attendeesHref, when, dateTile, STATUS, KIND, goingLine, say, clock,
} from './util.js';
import { renderEditor } from './editor.js';

const ROLE = { owner: 'Owner', organiser: 'Organiser', run_leader: 'Run leader' };

export async function initHost() {
  const user = await sessionUser();
  if (!user) {
    location.replace(signinHref(location.pathname + location.search));
    return;
  }
  mountHeaderAuth($('authSlot'), { className: 'nav-a', signOutTo: '/' });

  const app = $('app');
  const parts = location.pathname.replace(/\/+$/, '').split('/').slice(2); // after "host"
  try {
    if (parts.length === 0) return await home(app);
    if (parts[0] === 'apply' && parts.length === 1) return await apply(app);
    if (parts[0] === 'new' && parts.length === 1) return await renderEditor(app, { id: null });
    if (parts[0] === 'e' && parts[1]) {
      const id = decodeRef(parts[1]);
      if (!id) return notFound(app);
      if (parts.length === 2) return await renderEditor(app, { id });
      if (parts.length === 3 && parts[2] === 'attendees') return await attendees(app, id);
    }
    notFound(app);
  } catch (e) {
    console.error('[pacr] host failed', e);
    app.innerHTML = `<div class="wrap"><p class="msg err">Something went wrong. Refresh to try again.</p></div>`;
  }
}

function notFound(app) {
  app.innerHTML = `
    <div class="wrap narrow">
      <div class="eyebrow">Host</div>
      <h1 class="h1">Not found</h1>
      <p class="lede">That link doesn’t lead to one of your events.</p>
      <a class="btn" href="/host/events">Your events</a>
    </div>`;
}

// ── Home ────────────────────────────────────────────────────────────────────

async function home(app) {
  app.innerHTML = `<div class="wrap"><div class="skel"><div></div></div></div>`;
  const [h, ev] = await Promise.all([myHosting(), myHostedEvents(true)]);
  if (!h.ok) {
    app.innerHTML = `<div class="wrap"><p class="msg err">${esc(h.text)}</p></div>`;
    return;
  }
  const hosting = h.value ?? {};
  const squads = hosting.squads ?? [];
  const org = hosting.organizer ?? null;
  const canHost = !!hosting.can_host;
  const events = ev.ok ? ev.value ?? [] : [];
  const applied = new URLSearchParams(location.search).get('applied') === '1';

  const now = Date.now();
  const drafts = events.filter(e => e.status === 'draft');
  const upcoming = events.filter(e => e.status === 'published' && Date.parse(e.ends_at) > now);
  const past = events.filter(e => e.status !== 'draft' && !upcoming.includes(e))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const posters = await imageUrls(events.map(e => e.cover_path));

  app.innerHTML = `
    <div class="wrap">
      <header class="page-head">
        <div>
          <div class="eyebrow">Host</div>
          <h1 class="h1">Your events</h1>
          <p class="lede">Set up races, clinics and socials here. Runners get tickets in the PACR app, and you check them in with the app’s scanner on the day.</p>
        </div>
        ${canHost ? `<a class="btn" href="/host/new">New event</a>` : ''}
      </header>

      ${applied ? `<p class="msg ok">Thanks — your request to host is with the PACR team. We’ll let you know in the app.</p>` : ''}

      <section class="section">
        <h2 class="h2">You can host as</h2>
        <div class="hosts">
          ${squads.map(s => `
            <div class="host-card">
              <div class="host-face">${esc(initialsOf(s.name))}</div>
              <div class="host-text">
                <div class="host-name">${esc(s.name)}${s.verified ? ' <span class="seal" title="Verified club">✓</span>' : ''}</div>
                <div class="host-sub">Squad · ${esc(ROLE[s.role] ?? s.role)}</div>
              </div>
            </div>`).join('')}
          ${organizerCard(org)}
        </div>
        ${!squads.length ? `<p class="fine">Run a squad in the app? Owners, organisers and run leaders can host for it here.</p>` : ''}
      </section>

      ${section('Drafts', drafts, posters, 'Nothing in progress.')}
      ${section('Upcoming', upcoming, posters, canHost ? 'No upcoming events. Make one with New event.' : 'No upcoming events.')}
      ${past.length ? section('Past', past, posters, '') : ''}
    </div>`;
}

function initialsOf(name) {
  const p = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  return !p.length ? '?' : p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function organizerCard(org) {
  if (!org) {
    return `
      <div class="host-card ask">
        <div class="host-text">
          <div class="host-name">Host outside a squad</div>
          <div class="host-sub">For brands, coaches and race organisers. The PACR team approves each one.</div>
        </div>
        <a class="btn-outline" href="/host/apply">Ask to host</a>
      </div>`;
  }
  const status = {
    pending: ['Waiting for approval', 'The PACR team is looking at your request.'],
    approved: ['Organizer', 'Approved — you can host as this name.'],
    rejected: ['Not approved', org.decision_note ? org.decision_note : 'Your request wasn’t approved this time.'],
    suspended: ['Suspended', 'Hosting is paused for this name. Write to support@pacr.life.'],
  }[org.status] ?? ['', ''];
  const again = org.status === 'rejected' && (!org.cooldown_until || Date.parse(org.cooldown_until) < Date.now());
  return `
    <div class="host-card${org.status === 'approved' ? '' : ' muted'}">
      <div class="host-face org">${esc(initialsOf(org.name))}</div>
      <div class="host-text">
        <div class="host-name">${esc(org.name)} <span class="tag tag-${esc(org.status)}">${esc(status[0])}</span></div>
        <div class="host-sub">${esc(status[1])}</div>
      </div>
      ${again ? `<a class="btn-outline" href="/host/apply">Ask again</a>` : ''}
    </div>`;
}

function section(title, list, posters, empty) {
  return `
    <section class="section">
      <h2 class="h2">${esc(title)} <span class="count">${list.length}</span></h2>
      ${list.length ? `<div class="rows">${list.map(e => row(e, posters)).join('')}</div>` : `<p class="fine">${esc(empty)}</p>`}
    </section>`;
}

function row(e, posters) {
  const t = dateTile(e.starts_at);
  const poster = e.cover_path ? posters.get(e.cover_path) : null;
  const meta = [
    e.host?.name,
    KIND[e.kind] ?? e.kind,
    e.status === 'draft' ? null : goingLine(e.sold ?? 0, e.capacity ?? null),
    e.checked_in ? `${e.checked_in} checked in` : null,
  ].filter(Boolean).join(' · ');
  return `
    <div class="row">
      <a class="row-main" href="${editHref(e.id)}">
        <div class="poster-thumb">${poster ? `<img src="${esc(poster)}" alt="">` : ''}</div>
        <div class="tile"><span>${t.mon}</span><b>${t.day}</b></div>
        <div class="row-text">
          <div class="row-title">${esc(e.title)} <span class="tag tag-${esc(e.status)}">${esc(STATUS[e.status] ?? e.status)}</span>${e.checkin_open ? ' <span class="tag tag-live">Check-in open</span>' : ''}</div>
          <div class="row-sub">${esc(when(e.starts_at))} · ${esc(e.place_name ?? '')}</div>
          <div class="row-sub">${esc(meta)}</div>
        </div>
      </a>
      <div class="row-acts">
        <a class="btn-quiet" href="${editHref(e.id)}">Edit</a>
        ${e.status !== 'draft' ? `<a class="btn-quiet" href="${attendeesHref(e.id)}">Attendees</a>` : ''}
      </div>
    </div>`;
}

// ── Ask to host ─────────────────────────────────────────────────────────────

async function apply(app) {
  const h = await myHosting();
  const org = h.ok ? h.value?.organizer : null;
  if (org && org.status !== 'rejected') {
    app.innerHTML = `
      <div class="wrap narrow">
        <a class="back" href="/host/events">← Your events</a>
        <div class="eyebrow">Ask to host</div>
        <h1 class="h1">${esc(org.name)}</h1>
        <p class="lede">${org.status === 'pending' ? 'Your request is with the PACR team. We’ll let you know in the app.'
          : org.status === 'approved' ? 'You’re approved. Make an event from Your events.' : 'Hosting is paused for this name.'}</p>
        <a class="btn" href="/host/events">Your events</a>
      </div>`;
    return;
  }
  app.innerHTML = `
    <div class="wrap narrow">
      <a class="back" href="/host/events">← Your events</a>
      <div class="eyebrow">Ask to host</div>
      <h1 class="h1">Host on PACR</h1>
      <p class="lede">Squads host for themselves. To host as a brand, coach, store or race organiser, tell us who you are — the PACR team reads every request.</p>
      <form id="applyForm" class="form" novalidate>
        <label class="field"><span>Name runners will see</span>
          <input name="name" maxlength="60" required placeholder="Trail Tribe Bengaluru"></label>
        <label class="field"><span>About you <i>optional</i></span>
          <textarea name="bio" maxlength="300" rows="3" placeholder="What you organise, and for whom"></textarea></label>
        <label class="field"><span>Instagram <i>optional</i></span>
          <input name="instagram" maxlength="31" placeholder="@trailtribe"></label>
        <label class="field"><span>Anything we should know <i>optional</i></span>
          <textarea name="note" maxlength="300" rows="3" placeholder="Past events, how many people come, a website"></textarea></label>
        <p class="msg" id="applyMsg" hidden></p>
        <div class="acts"><button class="btn" type="submit">Send request</button></div>
      </form>
    </div>`;
  const form = $('applyForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());
    if (!String(f.name ?? '').trim()) return say($('applyMsg'), 'Give your organisation a name.', 'err');
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    const r = await applyOrganizer({
      name: String(f.name).trim(), bio: String(f.bio ?? '').trim(),
      instagram: String(f.instagram ?? '').trim(), note: String(f.note ?? '').trim(),
    });
    btn.disabled = false;
    if (!r.ok) return say($('applyMsg'), r.text, 'err');
    location.href = '/host?applied=1';
  });
}

// ── Attendees ───────────────────────────────────────────────────────────────

async function attendees(app, id) {
  app.innerHTML = `<div class="wrap"><div class="skel"><div></div></div></div>`;
  const [ev, at] = await Promise.all([getEventForEdit(id), listAttendees(id)]);
  if (!ev.ok) return notFound(app);
  const e = ev.value;
  const rows = at.ok ? at.value ?? [] : [];
  const valid = rows.filter(r => r.ticket_status === 'valid');
  const inCount = valid.filter(r => r.checked_in_at).length;
  const faces = await avatarUrls('avatars', rows.map(r => r.avatar_path));

  app.innerHTML = `
    <div class="wrap">
      <a class="back" href="${editHref(id)}">← ${esc(e.title)}</a>
      <header class="page-head">
        <div>
          <div class="eyebrow">Attendees</div>
          <h1 class="h1">${esc(e.title)}</h1>
          <p class="lede">${esc(when(e.starts_at))} · ${esc(e.place?.name ?? '')}</p>
        </div>
      </header>
      <div class="stats">
        <div><b>${valid.length}</b><span>tickets</span></div>
        <div><b>${inCount}</b><span>checked in</span></div>
        <div><b>${rows.length - valid.length}</b><span>gave up or cancelled</span></div>
      </div>
      <p class="fine">Check people in from the PACR app: open the event and tap Check-in, then scan each runner’s QR.</p>
      ${!at.ok ? `<p class="msg err">${esc(at.text)}</p>` : ''}
      <input id="who" class="search" type="search" placeholder="Search by name" ${rows.length ? '' : 'hidden'}>
      <div class="people" id="people">
        ${rows.length ? rows.map(r => person(r, faces)).join('') : `<p class="fine">No tickets yet.</p>`}
      </div>
    </div>`;
  const input = $('who');
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    for (const node of $('people').children) {
      node.hidden = !!q && !String(node.dataset.name ?? '').includes(q);
    }
  });
}

function person(r, faces) {
  const face = r.avatar_path ? faces.get(r.avatar_path) : null;
  const status = r.ticket_status !== 'valid'
    ? `<span class="tag tag-cancelled">${r.ticket_status === 'refunded' ? 'Refunded' : 'Gave up'}</span>`
    : r.checked_in_at ? `<span class="tag tag-live">In · ${esc(clock(r.checked_in_at))}</span>` : `<span class="tag">Not yet</span>`;
  return `
    <div class="person" data-name="${esc(String(r.name ?? '').toLowerCase())}">
      <div class="face">${face ? `<img src="${esc(face)}" alt="">` : esc(initialsOf(r.name))}</div>
      <div class="person-text">
        <div class="person-name">${esc(r.name ?? 'Runner')}</div>
        <div class="person-sub">${esc(r.tier_name ?? '')}</div>
      </div>
      ${status}
    </div>`;
}
