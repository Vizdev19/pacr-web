// ─────────────────────────────────────────────────────────────────────────────
// One reusable dialog — the rules gate, the report sheet, and every confirm.
//
// Lifted out of feed.js when /profile needed the same "this cannot be undone"
// confirm for post retraction. A second copy would have been 50 lines of
// dialog plumbing free to drift from the first, which is exactly the kind of
// divergence a shared page should not have.
//
// The host element is `<div id="modal" hidden>`, which every page carrying a
// modal already has in its markup.
// ─────────────────────────────────────────────────────────────────────────────

import { esc } from './supabase.js';

export function closeModal() {
  const host = document.getElementById('modal');
  if (!host) return;
  host.hidden = true;
  host.innerHTML = '';
}

/**
 * Options are rendered as buttons; the returned promise resolves with the
 * chosen value, or null if dismissed.
 */
export function openModal({ title, body, options, dismissable = true }) {
  return new Promise((resolve) => {
    const host = document.getElementById('modal');
    if (!host) return resolve(null);
    // Built as a detached element and attached to *it*, not to the persistent
    // host: listeners bound to the host would survive closeModal() and stack up
    // one deeper per open.
    const wrap = document.createElement('div');
    wrap.style.display = 'contents';
    wrap.innerHTML = `
      <div class="modal-scrim" data-close="${dismissable ? '1' : ''}"></div>
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <h2 class="modal-title">${esc(title)}</h2>
        ${body ? `<div class="modal-body">${body}</div>` : ''}
        <div class="modal-acts">
          ${options.map((o, i) => `
            <button type="button" class="${o.primary ? 'btn' : 'btn-quiet'}" data-i="${i}">
              ${esc(o.label)}
            </button>`).join('')}
        </div>
      </div>`;
    host.innerHTML = '';
    host.appendChild(wrap);
    host.hidden = false;

    function onKey(e) { if (e.key === 'Escape') done(null); }
    function done(value) {
      // Always unbind: a leaked Escape handler would close whichever modal
      // happened to be open next.
      document.removeEventListener('keydown', onKey);
      closeModal();
      resolve(value);
    }

    wrap.addEventListener('click', (e) => {
      if (e.target.dataset.close === '1') return done(null);
      const btn = e.target.closest('button[data-i]');
      if (btn) done(options[Number(btn.dataset.i)].value);
    });
    if (dismissable) document.addEventListener('keydown', onKey);
    wrap.querySelector('button')?.focus();
  });
}
