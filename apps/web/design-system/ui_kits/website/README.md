# pacr.life website — UI kit (layout reference)

The design project's click-through site, saved here so builders can read the
page layouts. These .jsx files use the kit's global `window.PacrWebDesignSystem_1066e0`
and sample data (`window.PACR`); they are **references, not code to import**.
Build pages with the TSX ports in `components/ds/`.

- `Shell.jsx` (not saved) — header/footer/sheets; see components/site/Shell.tsx
- `Directory.jsx` (not saved) — built: components/pages/Directory.tsx, RunsWeek.tsx, Events.tsx
- `Squad.jsx` — squad page, public + member view, join / ask-to-join sheet
- `Run.jsx` — run page, RSVP, check-in QR, "no longer on the calendar"
- `Event.jsx` — event page + checkout (hold timer, Razorpay, QR per seat)
- `Feed.jsx` — feed page (the Composer is deliberately not built on the web)
- `Account.jsx` — tickets, sign in
- `site.css` — page-layout classes (split, sticky, sec, block, dl, mbar, ent-cover/ent-head, faq, steps, feature, phone, band)

Not in the kit (design from the brief + these patterns): city SEO intro, post page,
live run page (LiveRunPanel exists), runner profile, /app, /plans, /hosts, /safety,
about/help/download, legal reading template, run buddies, your squads, own profile,
activity detail, routes, shoes, settings, notifications, 404.
