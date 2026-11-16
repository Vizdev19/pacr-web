// ─────────────────────────────────────────────────────────────────────────────
// pacr.life/host/apply — ask to host events as a brand, coach, store or race
// organiser (apply_organizer); pacr staff decide in pacr-admin.
//
// This page was the first host dashboard: home, a new event, the event editor
// and attendees. All of that is the Next.js dashboard in apps/host now
// (/host/events, /host/events?new=1, /host/events?event=<ref>&edit=1), and the
// old addresses /host/new and /host/e/* redirect there (apps/web/next.config.ts).
// Only the request to host is left here, because the dashboard has no form for
// it: apps/web sends /host/apply to this page (host-events.html).
// ─────────────────────────────────────────────────────────────────────────────

import { mountHeaderAuth, signinHref } from '../auth.js';
import { sessionUser, myHosting, applyOrganizer } from './api.js';
import { $, esc, say } from './util.js';

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
    if (parts[0] === 'apply' && parts.length === 1) return await apply(app);
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
      <p class="lede">Your events are in the host dashboard now.</p>
      <a class="btn" href="/host/events">Your events</a>
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
