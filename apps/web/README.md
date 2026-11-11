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

| Route | What |
|---|---|
| `/` | Home (lime design): real city list, squad photos, this week's runs |
| `/clubs`, `/clubs/<city>` | Squad directory: search, day, time, women only, verified and open filters, load more |
| `/runs`, `/runs/<city>` | Runs this week, grouped by day |
| `/events`, `/events/<city>` | Events: type, when and price filters |

## Not built yet

These are in the kit or the brief:
- the squad page `/s/<slug>`
- the run page
- the event page and checkout
- the feed and the other signed-in pages
- `/app`, `/hosts`, `/safety` and `/about`
- the map view on the directory

Until those exist, the cards link to the current share pages on pacr.life.

## Deploying

Not set up yet. The plan is a `pacr-web` Vercel project with pacr.life's `vercel.json` rewriting the paths this app owns (as it does for `/host`). That is a separate decision: it changes the live home page.
