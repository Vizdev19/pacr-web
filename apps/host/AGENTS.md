# pacr host — the dashboard for squad owners and event hosts (pacr.life/host)

Next.js app with `basePath: "/host"`, deployed as the Vercel project `pacr-host`; pacr.life's
`vercel.json` rewrites `/host` and `/host/*` to it, except `/host/new`, `/host/apply` and
`/host/e/*`, which are still the original event pages (`host-events.html`, `js/host/`).

## Design system: pacr Squad Host Design System (the only one)

Every screen uses the **pacr Squad Host Design System** (claude.ai/design project
`d59ab816-50f4-4ad3-b2ce-f617fd6242da`).

- `design-system/` holds the project's `tokens/*.css`, `components/components.css` and
  `components/host/host.css` **verbatim**. Change them in the design project first, then copy them back.
- `components/ds/` holds its React components ported to TSX (same props; icons are Lucide by
  kebab-case name through the map in `Icon.tsx`: add a name there before using a new icon).
- `components/shell/` is the shell from the kit's `ui_kits/host/Shell.jsx` (sidebar, host switcher,
  topbar) plus the helpers its pages share (`kit.tsx`). `app/globals.css` is only the app layer.
- Pages follow the kit's `ui_kits/host/*.jsx` for layout and its readme for voice: sentence case,
  lowercase **pacr**, "squad", "runners", `·` between metadata, `₹2,41,300`, `Sat 14 Nov`, `6:00 am`,
  no emoji; toasts are a past-tense title plus the outcome; a confirm button repeats the dialog's verb.
- Light only. Runs and events are told apart by shape and icon, never colour.

## Data

- Pages are static shells; everything is fetched in the browser as the signed-in host through
  `lib/api.ts`, the same tables and RPCs the pacr app uses. The session is the one pacr.life/signin
  stores (`lib/supabase.ts`, storageKey `pacr.web.auth`); there is no server-side auth here.
- **No sample data, ever.** If the database can't provide something the kit shows, leave it out or
  show an honest empty state. `lib/api.ts` comments say what each call can and can't do.
- **Never show a raw id.** URLs carry 22-character refs (`lib/refs.ts`); message bodies go through
  `plainMentions()`. Never show members' gender, health data, exact location or email.
- Role rules live in the database; `components/shell/nav.ts` only mirrors them to lock pages.
