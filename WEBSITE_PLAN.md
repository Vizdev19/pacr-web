# pacr.life — Website Plan

> Living plan for the Pacr marketing website. Covers top strategy, goals,
> audience, page structure, copy direction, CTAs, image strategy, and build
> phases. Update as decisions evolve.

---

## 0. Top strategy (read first)

Everything below this section is execution detail. This section is the
layer above it: why the website exists, how growth compounds, and what
gets measured.

### 0.1 The core bet

Pacr does not grow app-first. It grows **club-first, city-by-city**. The
website is the front door to that loop — not an app landing page with a
download button. An app install is a low-trust, low-retention event; a
person who shows up to a Saturday run and then installs the app is a
high-retention user with a social anchor. The site's job is to start
that relationship, which is why club signup is the primary CTA and early
access is deliberately secondary.

### 0.2 The flywheel

```
Channel post / forward / share card
        → pacr.life visit
        → club signup (name, city, frequency, WhatsApp)
        → WhatsApp group join
        → first Saturday run attended
        → app early access offered in person / in group
        → coached runs → share cards posted (app feature, §spec)
        → friends see it → channel post / forward …
```

Two properties make this compound: the app's 9:16 share cards are the
organic creative for the top of the funnel, and every run produces photo
+ quote material for the site and Instagram. The loop feeds itself once
one city is spinning.

### 0.3 Beachhead: Bangalore first

Prove the full loop in one city before promoting any other. Other metros
stay listed on the site ("Joining soon — be the first") to capture
intent, but zero marketing effort goes to them until Bangalore has:
~50 signups, 2+ runs actually held, and ≥10 app early-access users from
runs. Replication to city #2 starts only when a captain is identified
there (the 5-days/week signal from the club form).

### 0.4 Channels, ranked by expected yield

1. **WhatsApp forwards** — the signup confirmation and group are built to
   be forwarded ("Bringing a friend Saturday? Send them this."). Lowest
   cost, highest trust, India-native.
2. **Instagram** — run reels, share-card reposts, route photos. Needs 3–4
   posts seeded before site launch (open decision §9.3 → resolve as yes).
3. **Existing running communities** — Bangalore run clubs, corporate run
   groups, apartment running WhatsApp groups. Partner framing, not
   poaching: "a coached Saturday run" is additive to their calendar.
4. **Share cards in the wild** — app users posting runs; the card carries
   the wordmark. Passive; grows with app usage.
5. **SEO** — city pages (Phase 3) target "running group in {city}" /
   "running coach app India". Long-tail; build for it, don't wait on it.

No paid acquisition until the organic loop's conversion numbers are
known — paid traffic into an unmeasured funnel just buys noise.

### 0.5 Funnel, metrics, and instrumentation

| Stage | Conversion to next | Early target | Instrument |
|---|---|---|---|
| Visit → club signup | primary site metric | ≥ 8% of city-intent traffic | PostHog web (reuse app project) + UTM discipline on every link |
| Signup → WhatsApp joined | confirmation flow quality | ≥ 70% | join-link click tracking |
| WhatsApp → first run attended | the make-or-break step | ≥ 30% within 3 weeks | manual headcount per run |
| Attendee → early access taken | in-person offer | ≥ 50% | signup source tag |
| Early access → first coached run | app activation | ≥ 60% in week 1 | existing app PostHog events |

Review weekly, per city, in one place. The single number that matters
early: **runners at the last Saturday run**. Everything else is upstream
or downstream of it.

Follow-up rules: signup → WhatsApp/email confirmation within minutes
(automated), with the next run's date in the first message. A signup
that hears nothing for 48h is dead. Every early-access email includes
the Play alpha invite directly (Android-only for now — no TestFlight
until iOS distribution exists).

### 0.6 Launch gate

Do not put the site live until: (a) the first Bangalore run has a date,
(b) the WhatsApp group exists, (c) Instagram has 3–4 posts, (d) the
signup → confirmation flow is tested end-to-end. The site's present-tense
copy ("Pacr runs happen Saturday mornings") is a promise; launching
before a scheduled run makes it false on day one.

### 0.7 What this strategy deliberately ignores

- Paid ads (until funnel numbers exist)
- App store optimization (closed alpha; irrelevant for now)
- National PR / press (nothing to show until one city works)
- Any city beyond the beachhead (capture intent, spend nothing)

---

## 1. Goals

### Primary
- **Club signups** — capture name, city, email/WhatsApp from runners across
  India who want to run with Pacr in their city. This is the wide top of funnel.

### Secondary
- **App early access** — convert visitors who are already sold on the AI
  coaching product directly.

### What the website is NOT trying to do
- Explain every feature
- Drive immediate app installs (that comes after club relationship is built)
- Appeal to trackers, fitness data nerds, or military/grit-culture runners

---

## 2. Target audience

Urban Indian runners, 25–45, who run 2–5 times a week and want to improve
without becoming a hobby athlete. They're in Bangalore, Mumbai, Delhi, Pune,
Hyderabad, Chennai and similar metros. They've probably used Strava or Nike
Run Club and felt like something was missing — either the community was
passive, or the app felt generic and Western.

**The moment we're speaking to:** "I want to run more consistently and
actually get better, but I don't know what I should be doing, and running
alone every day gets old."

---

## 3. Positioning

Pacr is a running coach, not a running tracker. The club and the app are
two sides of the same thing — the app coaches you individually every day,
the club puts you on the road with others in your city.

**Frame for the website:** Pacr runs are happening across India. Join the
runners in your city.

This framing assumes momentum and community already exist — even if a city
has 10 signups, the language implies they're a group, not a list.

### Tone
Calm, direct, confident. Coach voice from the product spec carries into the
website. No hustle language, no military framing, no exclamation points in
body copy. India-specific without being hyper-local.

---

## 4. Page structure

### Section 1 — Hero

**Goal:** Communicate what Pacr is and get the signup in the first 5 seconds.

- **Headline:** "Your city runs with Pacr."
- **Subhead:** "AI-coached runs, real routes, runners like you — find your
  city's group and join the next run."
- **Primary CTA:** `JOIN RUNNERS IN YOUR CITY` → opens club signup form
- **Secondary CTA:** `GET EARLY ACCESS →` (quieter, text link style) → opens
  early access form
- **Visual:** Hero image — real runners, Indian urban environment, early
  morning light. (See §7 image plan.)

---

### Section 2 — What Pacr is

**Goal:** Break the "another running app" mental model in 3 lines.

Three points, no bullets — short prose or 3-column layout:

1. **Coach, not tracker** — Every morning, Pacr tells you exactly what to
   run today and why. Not a generic plan — adapted to your recent runs,
   your goal, and what your body's ready for.
2. **Voice-first** — The phone stays in your pocket. Pacr talks you through
   your run: pace, splits, intervals. You run, it coaches.
3. **Built for Indian cities** — AQI warnings, local routes, real weather.
   On bad-air days, Pacr adapts your workout automatically. No generic
   Western fitness app built for San Francisco parks.

---

### Section 3 — The runs

**Goal:** Make the club feel real and joinable.

- Short description of what a Pacr run looks like: "Saturday mornings.
  6:30 AM. A curated route, a coached workout, and a group of runners in
  your city doing the same thing."
- City list — all major Indian metros shown. Active cities show runner
  count ("47 runners in Bangalore"). Upcoming cities show "Joining soon —
  be the first."
- This section doubles as social proof as signups grow.

---

### Section 4 — App preview

**Goal:** Show the AI coaching experience concretely.

- One real app screenshot: the Home screen prescription card. Caption: "Here's
  what Pacr told a runner in Bangalore on a Tuesday morning."
- One real screenshot: bad-AQI state showing the indoor workout adaptation.
  This is a unique, conversation-starting moment — nobody else does this.
- Keep this section tight. Two screenshots, two captions, move on.

---

### Section 5 — Social proof

**Goal:** Show real people, real reactions.

- 3–4 quotes from alpha testers. Short, specific, in their own voice.
  ("I stopped thinking about what to run. Pacr just tells me." is better
  than "Great app!")
- One candid group photo from a run, if available.

---

### Section 6 — Early access CTA

**Goal:** Convert the bottom-of-page visitors who are fully convinced.

- Full-width section.
- Headline: "Be among the first coached runners on Pacr."
- Subhead: "Early access is limited. Join the list."
- CTA: `GET EARLY ACCESS`
- Capture: name + email + city.

---

### Footer

- pacr.life wordmark
- Links: Instagram / Twitter (if active)
- "Made in India" — single line, no fuss
- Privacy policy link (required for Play Store compliance)

---

## 5. CTAs — detail

### Club signup form
Triggered by the hero primary CTA and the city section.

Fields:
- Name
- City (free text or dropdown of Indian metros)
- How often do you run? (2–3 / 3–4 / 5+ days a week)
- WhatsApp number or email (one field, their choice)

Notes:
- "How often do you run?" is the captain-identification signal. Don't flag
  this intent — it looks like personalization, not a screening question.
- WhatsApp is the right channel for India. Give the option but don't force it.

### Early access form
Triggered by secondary CTA in hero and the bottom-of-page section.

Fields:
- Name
- Email
- City

Notes:
- Shorter than the club form — this person is converting to app, not community.
- Follow-up email should include TestFlight / Play alpha invite.

---

## 6. Copy principles

- Present tense everywhere. "Pacr runs happen on Saturday mornings" not
  "we're planning to organize runs."
- Never use: launching, building, planning, waitlist, coming soon (except
  for non-active cities).
- Selectivity language for the club: "Join runners in your city" not
  "sign up to be notified."
- Sentence case for body copy. ALL CAPS only for CTAs (≤3 words) — consistent
  with the app's voice rules.
- No exclamation points in default copy.
- India-specific signals: mention cities by name, reference AQI, use
  morning run culture framing.

---

## 7. Image plan

### What's needed

| Slot | Description | Priority |
|---|---|---|
| Hero | Real runners, Indian urban environment, early morning | Critical |
| Group pre-run | 4–6 people at a start point, candid, not posed | High |
| Mid-run solo | One person running, city visible | High |
| Post-run moment | People talking / checking phones after a run | Medium |
| App screenshot 1 | Home screen prescription card | Critical |
| App screenshot 2 | Bad-AQI indoor workout state | High |
| Phone-in-use | Runner glancing at app before tucking phone away | Medium |

### Plan

**Option A (recommended): Small shoot**
One morning, 4–6 friends who run, Cubbon Park or similar Bangalore location.
Phone camera is fine — candid quality reads as authentic, not staged.
Captures: group start, mid-run, post-run, phone moment. ~90 minutes total.

**Option B: Sourced photos**
Unsplash for atmospheric city/running shots. Filter for Indian urban density
and skin tones — not Western trail running. Supplement with real app
screenshots which are already available.

**Recommendation:** Do the shoot for the hero and group shots. App screenshots
are already available. Use sourced photos only for the atmospheric city slot.

---

## 8. Build phases

### Phase 1 — Launch page (build first)
Single scrolling page at pacr.life. All six sections. Both CTAs live.
Signups collected via a simple form backend (Typeform, Tally, or a lightweight
custom form posting to Supabase). City counts shown statically until signup
volume warrants dynamic rendering.

**Goal:** Live within 1–2 weeks. Start collecting signups.

### Phase 2 — Dynamic city counts
Once signups exist, replace static city counts with live numbers pulled from
the signup database. Adds social proof automatically as momentum builds.

**Goal:** When any city hits 20+ signups.

### Phase 3 — City pages
Individual pages per city (pacr.life/bangalore, pacr.life/mumbai, etc.) with
city-specific run details, upcoming dates, and local captain info once
captains are identified.

**Goal:** When the first run is organized in a city.

---

## 9. Open decisions

1. **Form backend** — Tally/Typeform (fastest) vs custom Supabase form
   (keeps all data in one place with the app backend). Lean: Supabase,
   since the backend is already live and avoids a third-party data silo.
2. **WhatsApp group structure** — one national group, or per-city groups?
   Per-city is better for club feel but harder to manage early. Start
   national, split by city at ~50 members per city.
3. **Instagram presence** — resolved by §0.4/§0.6: yes, with 3–4 posts
   seeded before the site goes live. It's a launch gate, not optional.
4. **Captain identification timeline** — at what signup threshold per city
   do you start DM'ing the 5-days/week runners to gauge captain interest?

---

*End of plan. Update this document as decisions land.*
