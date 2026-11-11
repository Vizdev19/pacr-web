# pacr.life community site (apps/web)

The multi-page, community-first pacr.life, built on the **pacr Web Design System**
(claude.ai/design project `1066e016-fe1d-4b85-8978-9fcdb1f972f1`, lime theme).

```bash
npm install
npm run dev        # http://localhost:3200
npm run typecheck && npm run lint && npm run build
```

## Design system rules

- **Every UI piece comes from the design system.**
  - `design-system/` is a verbatim copy of the project's tokens, component CSS (`pw-` classes), the website kit's `site.css` and the logo art.
  - `components/ds/*.tsx` are TSX ports of the kit's React components, with the same props, markup and classes.
  - Check the design project before inventing a component.
- **Components never hard-code colour, font or radius; they use tokens.**
  - The brand swap tokens are in `design-system/tokens/brand.css`.
  - `app/globals.css` only points the font tokens at next/font's Lexend and Geist Mono.
- **The home page is the kit's `ui_kits/home-lime` design.**
  - Its CSS is `app/home.css`, scoped to `.hl-page`; the header comment lists the changes.
  - Its photos are crops of pacr's own welcome posters, in `public/home/`.
- **Store badges are Apple's and Google's own artwork** (`public/badges/`), not the kit's drawn pills.
- **Icons are Lucide**, through `components/ds/icons.ts`. Add a name there when a page needs a new icon.
- **Content rules** (from the design system's readme):
  - lowercase **pacr**, sentence case
  - "Sat, 14 Nov · 6:00 am" in IST
  - ₹ with Indian grouping, and "+ fee and GST" on paid tickets
  - no made-up numbers
  - no raw ids anywhere a person can see them: squads are slugs, runs and events are 22-character refs

## Data

Public pages read anon RPCs only (`lib/data.ts`):
- `list_cities`, `directory_clubs`, `city_runs` and `site_stats`, from the app repo's `20261223120000_web_directory.sql`
- `city_events`

Pictures go through pacr.life's proxies (`/s/<slug>/photo`, `/cover`, `/e/<ref>/poster`). Anything this app doesn't serve falls back to pacr.life (`next.config.ts`), so local builds show the real share pages, sign-in, feed and host dashboard.

The session is shared with `/signin` and `/host` through the `pacr.web.auth` localStorage key (`lib/supabase.ts`).

## Built

Every page on pacr.life except the host dashboard (`/host`, plus its event editor at `/host/new`, `/host/e/*` and `/host/apply`, which keep their own design system).

| Area | Routes |
|---|---|
| Discover | `/`, `/clubs/<city>`, `/runs/<city>`, `/events/<city>` |
| Share pages | `/s/<slug>` (`?run=`, `?invite=`), `/e/<ref>`, `/p/<ref>`, `/u/<handle>`, `/live?t=` |
| Pictures | `/s/<slug>/photo`, `/cover`, `/card`, `/e/<ref>/poster`, `/course`, `/p/<ref>/photo`, `/avatar`, `/u/<handle>/photo` |
| Signed in | `/feed`, `/feed/<ref>`, `/profile` (`?r=`), `/activity/<ref>`, `/squads`, `/tickets`, `/notifications`, `/runbuddies`, `/routes`, `/shoes`, `/settings` |
| Static | `/signin`, `/support`, `/app`, `/hosts`, `/safety`, `/about`, `/plans/<distance>`, `/privacy`, `/terms`, `/community-rules` |

The old URLs `/*-training-plan`, `/running-coach-app`, `/social` and `/downloads` redirect (`next.config.ts`).

**Exception: `/download` keeps the old link-in-bio page**, by choice. It is the old `download.html`, copied unchanged into `public/legacy/` with its favicons, avatar and PostHog script, and served at `/download` by a rewrite in `next.config.ts`. It is not built with the design system.

## Not built yet (needs a decision or a deploy)

- **Squad member view:** feed, chat, announcements, leaderboard and members tabs. Members are pointed to the app for now.
- **Paid event checkout:** needs CORS on the `event-checkout` edge function and Razorpay on the web. Free tickets work.
- **Directory map view.**
- **Analytics:** PostHog is not in this app yet.

## Deploying

Not set up yet. The plan is a `pacr-web` Vercel project with pacr.life's `vercel.json` rewriting the paths this app owns (as it does for `/host`). That is a separate decision: it changes the live home page.
