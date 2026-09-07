// ─────────────────────────────────────────────────────────────────────────────
// /signin — the standalone sign-in page
//
// Owns the two-step form; the flow itself and its error copy live in auth.js so
// that nothing here has to know about Supabase. Lands on ?next= when it is a
// safe same-origin path, otherwise on the "you're signed in" panel.
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabase } from './supabase.js';
import {
  EMAIL_RE, RESEND_COOLDOWN_SEC, currentUser, isSigninPath, nextFromQuery,
  sendCode, verifyCode, signOut,
} from './auth.js';

const $ = (id) => document.getElementById(id);

let pendingEmail = '';
let cooldownTimer = null;

function say(text, kind) {
  const el = $('msg');
  if (!text) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = text;
  el.className = `msg ${kind ?? ''}`.trim();
}

function show(pane) {
  for (const id of ['paneBoot', 'paneForm', 'paneDone']) $(id).hidden = id !== pane;
}

/** Where to go once signed in. */
function land() {
  const next = nextFromQuery();
  // A next that points back at sign-in would just bounce to here again.
  if (next && !isSigninPath(next)) { location.replace(next); return; }
  show('paneDone');
}

// ── Resend cooldown ─────────────────────────────────────────────────────────

function startCooldown() {
  const btn = $('resendBtn');
  let left = RESEND_COOLDOWN_SEC;
  clearInterval(cooldownTimer);
  btn.disabled = true;
  const tick = () => {
    btn.textContent = left > 0 ? `Resend in ${left}s` : 'Resend code';
    if (left <= 0) { clearInterval(cooldownTimer); btn.disabled = false; }
    left -= 1;
  };
  tick();
  cooldownTimer = setInterval(tick, 1000);
}

// ── Steps ───────────────────────────────────────────────────────────────────

async function requestCode(email, { resend } = {}) {
  const btn = resend ? $('resendBtn') : $('sendBtn');
  btn.disabled = true;
  say(resend ? 'Sending a new code…' : 'Sending…');

  const res = await sendCode(email);
  if (!res.ok) {
    btn.disabled = false;
    if (resend) $('resendBtn').textContent = 'Resend code';
    return say(res.text, 'err');
  }

  pendingEmail = email;
  $('codeEmail').textContent = email;
  $('formEmail').hidden = true;
  $('formCode').hidden = false;
  $('sendBtn').disabled = false;
  say(resend ? 'New code sent.' : 'Code sent. It expires in an hour.', 'ok');
  startCooldown();
  $('code').focus();
}

async function submitCode() {
  const token = $('code').value.trim();
  if (!/^\d{6}$/.test(token)) return say('Enter the six digits from the email.', 'err');

  const btn = $('verifyBtn');
  btn.disabled = true;
  say('Checking…');
  const res = await verifyCode(pendingEmail, token);
  btn.disabled = false;
  if (!res.ok) {
    $('code').select();
    return say(res.text, 'err');
  }
  clearInterval(cooldownTimer);
  say('');
  land();
}

// ── Wiring ──────────────────────────────────────────────────────────────────

export async function initSignin() {
  // The header's Sign in link is static, so someone can arrive here even when
  // the backend is unreachable or unconfigured. Say so plainly instead of
  // showing a form that cannot work.
  if (!(await getSupabase())) {
    $('paneBoot').innerHTML =
      '<div class="eyebrow">Account</div>' +
      '<h1 class="disp">Sign-in is down.</h1>' +
      '<p class="lede">We can\'t reach the server right now, so signing in isn\'t ' +
      'possible. Please try again in a little while — the app still works.</p>';
    return;
  }

  // Already signed in? Honour ?next= immediately rather than making someone
  // re-authenticate to reach a page they can already see.
  const user = await currentUser();
  if (user) { land(); return; }

  show('paneForm');
  $('email').focus();

  $('formEmail').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('email').value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return say('Enter a valid email address.', 'err');
    requestCode(email);
  });

  $('formCode').addEventListener('submit', (e) => { e.preventDefault(); submitCode(); });

  $('resendBtn').addEventListener('click', () => {
    if (pendingEmail) requestCode(pendingEmail, { resend: true });
  });

  $('backBtn').addEventListener('click', () => {
    clearInterval(cooldownTimer);
    $('resendBtn').disabled = false;
    $('resendBtn').textContent = 'Resend code';
    $('formCode').hidden = true;
    $('formEmail').hidden = false;
    $('code').value = '';
    say('');
    $('email').focus();
  });

  // Typing or pasting six digits is the whole intent — submit on it rather
  // than making someone reach for the button. Strip anything non-numeric so a
  // pasted "123 456" or a code copied with stray whitespace still lands.
  $('code').addEventListener('input', (e) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (cleaned !== e.target.value) e.target.value = cleaned;
    if (cleaned.length === 6) submitCode();
  });

  $('doneSignOut').addEventListener('click', async () => {
    await signOut();
    location.reload();
  });
}
