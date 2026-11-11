# Building pages in apps/web (read this first)

pacr.life is being rebuilt on the **pacr Web Design System**. The plan is
`/Users/rvishnuprasath/pacr/docs/web/site-build-plan.md`. Read `README.md` in
this folder too.

## Use the design system, only the design system

- **UI:** comes from `components/ds/*` (core, content, forms, feedback, overlays, nav, data, actions).
- **Classes:** `pw-` classes from `design-system/components/**.css`; page-layout classes from `design-system/ui_kits/website/site.css`:
  - `pw-container`, `pw-page`, `pw-reading`, `sec`, `sec--alt`, `sec-h`
  - `split`, `split--wide`, `split--feed`, `split--ticket`, `sticky`, `stack`, `row`
  - `grid-cards`, `grid-posters`, `block`, `prose`, `dl`, `rules`, `faq`, `steps`, `feature`, `phone`, `band`
  - `ent-cover`, `ent-head`, `mbar`, `ticket-type`, `hide-md`, `only-md`
  - type: `t-h1` … `t-caption`, `t-overline`
- **Layout references:** the kit's page designs are in `design-system/ui_kits/website/*.jsx` (Squad, Run, Event, Feed, Account). Follow them; their sample data is fake.
- **No new CSS** except small `style={{…}}` for spacing, and only with tokens: `var(--space-*)`, `var(--text-*)`, `var(--surface-*)`, `var(--border*)`. **Never raw hex colours, fonts or radii.**
- **Icons:** `<Icon name="kebab-name" />`, registered in `components/ds/icons.ts`. If you need an icon that isn't there, use the closest registered one and list the one you wanted in your report. Don't edit `icons.ts`.

## Files you must not edit (shared)

`components/ds/**`, `components/site/**`, `components/home/**`, `lib/*.ts` that already exist, `app/layout.tsx`, `app/globals.css`, `app/home.css`, `app/page.tsx`, `app/(site)/layout.tsx`, `package.json`, `next.config.ts` (only the sign-in/static builder adds redirects there), `design-system/**`.

If a shared file needs a change, say so in your report instead.

## Where your files go

- **Routes:** `app/(site)/<your routes>/…`. The `(site)` layout gives the header, footer, city picker, mobile menu, toasts (`useToast()` from `components/ds/overlays`) and the signed-in tab bar.
- **Page components:** `components/pages/<area>/*.tsx`.
- **Data helpers:** `lib/<area>.ts` (new file).

## Data rules

- **Supabase:**
  - Public pages: anon, server side, with `createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })` (see `lib/data.ts`).
  - Signed-in pages: client side, with `getSupabase()` from `lib/supabase.ts`. That's the runner's own session (`pacr.web.auth`), so RLS and the RPCs decide what they can see and do.
  - **Never** use a service key.
- **Signed-in pages:** wrap them in `<RequireSignIn title body>{auth => …}</RequireSignIn>` (`components/site/RequireSignIn.tsx`).
- **No raw ids anywhere a person can see or copy:**
  - uuids become 22-character refs (`encodeRef` in `lib/refs.ts`); decode on the server with `Buffer.from(ref, "base64url")` → hex → uuid.
  - squads are slugs, profiles are `/profile?r=<ref>` or `/u/<handle>`.
  - Storage paths contain uuids: sign them (`lib/storage.ts`) or proxy them, never print them.
- **Mentions:** bodies carry `@[Name](uuid)`; render with `MentionText` (`components/site/MentionText.tsx`).
- **Formatting:** `lib/format.ts` and `lib/time.ts`:
  - "Sat, 14 Nov · 6:00 am" (IST)
  - "5 km", "5:42 /km"
  - ₹ with Indian grouping; paid tickets as "₹499 + fee and GST"
- **Copy:**
  - lowercase **pacr**, sentence case, no "!", no emoji.
  - Buttons start with a verb: "Join squad", "Get tickets".
  - Empty states: what's missing, then one way forward.
  - Errors: what happened, then what to do.
  - **No made-up numbers, people or features.** The app does NOT do: an AI that rewrites your plan every morning, heat- or humidity-adjusted pace, or talking back to the coach.
- **Link previews:** server-rendered share pages set `generateMetadata` (title, description, `openGraph`, `twitter`) like the old `api/*.mjs` pages did, with the same image URLs.

## Checking your work (you can't use the browser pane)

- `npx tsc --noEmit` and `npx eslint <your paths>`. Other builders are working at the same time, so ignore errors in files you don't own.
- The dev server is already running at http://localhost:3200. Check your pages with `curl -s -o /dev/null -w "%{http_code}" http://localhost:3200/<route>` and grep the HTML for key text.
- Don't start another server, run `next build`, install packages, or commit. The lead reviews every page in the browser and commits.
- **Report:**
  - routes built
  - which RPCs and tables each uses
  - what you couldn't verify (signed-in states need a real login)
  - shared-file changes you'd want
  - anything you left out, and why
