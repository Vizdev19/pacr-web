// ─────────────────────────────────────────────────────────────────────────────
// PostHog (plan §0.5) — loaded by every public page.
//
// Snippet form, because the site has no bundler for posthog-js imports. It is a
// classic (non-module) script so window.posthog exists before any page code
// runs; the real library loads async from PostHog's asset host.
//
// The project key is a public, write-only ingestion key — safe in the browser.
// ─────────────────────────────────────────────────────────────────────────────

!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_vE4EK369fZXYVFcYrNJafAYpVncxtftr2XrEWxdQVNtx', {
  api_host: 'https://us.i.posthog.com',
  defaults: '2026-05-30'
});

// Which short link brought the visitor in. /social and /downloads are Vercel
// redirects (vercel.json) that tag the destination with ?via=…, since no page
// script runs on a redirect. Registered for the session so later events —
// store clicks, other pages — carry it too.
var via = new URLSearchParams(location.search).get('via');
if (via) posthog.register_for_session({ via: via });

// Outbound store and social clicks. Delegated from the document so it covers
// every such link on every page, including ones rendered later by JS, without
// tagging markup. `placement` is an explicit data-play-place when a link has
// one, else the id of the nearest section around it, else the enclosing
// header/nav/footer/section; PostHog adds the page URL.
var OUTBOUND = [
  ['play.google.com', 'play_store_click'],
  ['apps.apple.com', 'app_store_click'],
  ['instagram.com', 'social_click', 'instagram'],
  ['x.com', 'social_click', 'x'],
  ['linkedin.com', 'social_click', 'linkedin']
];
document.addEventListener('click', function (ev) {
  var el = ev.target.closest && ev.target.closest('a[href]');
  if (!el || !el.hostname) return;
  for (var i = 0; i < OUTBOUND.length; i++) {
    var host = OUTBOUND[i][0];
    if (el.hostname !== host && el.hostname.slice(-host.length - 1) !== '.' + host) continue;
    var section = el.closest('[id]');
    var landmark = el.closest('header, nav, footer, main, section');
    var props = {
      placement: el.getAttribute('data-play-place') ||
        (section ? section.id : landmark ? landmark.tagName.toLowerCase() : null)
    };
    if (OUTBOUND[i][2]) props.network = OUTBOUND[i][2];
    posthog.capture(OUTBOUND[i][1], props);
    return;
  }
}, true);
