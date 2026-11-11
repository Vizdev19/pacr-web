// /app: what the pacr app does, section by section (Run, Train, Health,
// Together). Only what it really does today; see lib/content.ts.
import { Button, Card, Icon, Media } from "@/components/ds/core";
import { StoreBadges } from "@/components/ds/nav";
import { PLAN_ORDER, PLANS } from "@/lib/content";
import { Band, Faq, Feature, Hero, Phone, SecHead, Steps } from "./blocks";
import { SpyNav } from "./SpyNav";

const SECTIONS = [{ id: "run", label: "Run" }, { id: "train", label: "Train" }, { id: "health", label: "Health" }, { id: "together", label: "Together" }, { id: "start", label: "Get started" }];

const CONNECT: { icon: string; title: string; body: string }[] = [
  { icon: "heart-pulse", title: "Apple Health", body: "Import from Apple Health on iPhone." },
  { icon: "heart-pulse", title: "Health Connect", body: "Import from Health Connect on Android." },
  { icon: "watch", title: "Garmin", body: "Connect your Garmin account." },
  { icon: "activity", title: "WHOOP", body: "Connect your WHOOP account." },
];

export function AppPage() {
  return <>
    <Hero
      overline="The app"
      title="Run, train and run together"
      lead="pacr tracks your runs, writes your training plan and finds you a squad in your city. Free on iPhone and Android."
      actions={<StoreBadges />}
      facts={[["Free", "to use"], ["iPhone", "and Android"], ["Built in India", "for Indian cities"]]}
      visual={<Phone src="/home/night.jpg" alt="A runner on a path at night, on the pacr welcome screen" />}
    />

    <SpyNav sections={SECTIONS} />

    <section className="sec">
      <div className="pw-container">
        <Feature
          id="run"
          overline="Run"
          title="Every run, tracked and shared"
          items={[
            { icon: "navigation", title: "GPS tracking with auto-pause", body: "The clock stops when you stop and starts when you run. You can switch it off." },
            { icon: "message-circle", title: "A voice coach", body: "Speaks your splits and pace while you run." },
            { icon: "link", title: "Live location sharing", body: "Send a pacr.life/live link so someone can follow your run. Off until you turn it on, for each run." },
            { icon: "smartphone", title: "Stats on the lock screen", body: "A Live Activity on iPhone and a notification on Android." },
            { icon: "image", title: "Share cards", body: "A story card with your route on a map or as a line, and your stats." },
            { icon: "play", title: "Run flyover", body: "A video that flies along your route." },
            { icon: "route", title: "Saved and public routes", body: "Save a run as a route to run again, or share it as a public route." },
          ]}
          visual={<Media src="/home/track.jpg" ratio="1:1" radius="var(--radius-card)" alt="A running shoe on a track beside a lime line" />}
        />
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <Feature
          id="train"
          overline="Train"
          title="A training plan written for you"
          body="Answer a few questions: your goal race, your date, how much you run now and the days you have. pacr's coach, an AI, writes the plan, and the app's training rules check every week of it."
          items={[
            { icon: "calendar-check", title: "5K to marathon", body: "Finish a distance, race it for a time, get faster or build a base." },
            { icon: "watch", title: "Workouts on Apple Watch", body: "Plan workouts can go to your Watch." },
            { icon: "medal", title: "Personal bests and badges", body: "Your best 5K, 10K, half and marathon, and badges as you go." },
            { icon: "footprints", title: "Shoe mileage", body: "See how far each pair has gone." },
          ]}
          visual={<Card variant="raised" style={{ padding: "var(--space-6)" }}>
            <div className="stack" style={{ gap: "var(--space-2)" }}>
              <p className="t-overline" style={{ margin: "0 0 var(--space-2)" }}>Training plans</p>
              {PLAN_ORDER.map(s => <a key={s} href={`/plans/${s}`} className="pw-listrow">
                <Icon name="calendar-check" />{PLANS[s].name}<span className="pw-listrow__meta">{PLANS[s].km.toLocaleString("en-IN")} km</span><Icon name="chevron-right" size={18} />
              </a>)}
            </div>
          </Card>}
        />
      </div>
    </section>

    <section className="sec" id="health" style={{ scrollMarginTop: "calc(var(--header-h) + var(--space-12))" }}>
      <div className="pw-container">
        <SecHead overline="Health" title="Bring your other apps" sub="pacr works with the health apps and devices you already use." />
        <div className="steps">
          {CONNECT.map(c => <div key={c.title} className="step">
            <span className="step__n"><Icon name={c.icon} /></span>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
          </div>)}
        </div>
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <Feature
          id="together"
          overline="Together"
          title="Squads, group runs and people to run with"
          body="Find the running clubs in your city on pacr, join one and turn up."
          items={[
            { icon: "users-round", title: "Squads", body: "Running clubs with their own join rules and questions, and an owner, organisers and run leaders." },
            { icon: "calendar-days", title: "Weekly group runs", body: "Runs at set meeting places. RSVP, then check in with a QR code at the start." },
            { icon: "messages-square", title: "Chat and announcements", body: "Squad chat with pinned messages, and announcements from the organisers." },
            { icon: "trophy", title: "Leaderboards", body: "See where you stand in your squad by distance." },
            { icon: "badge-check", title: "Verified and women-only", body: "Verified squads are the real club, not a lookalike. Women-only squads and runs are for women." },
            { icon: "heart", title: "A feed", body: "Runs and posts from your squads and the people you follow, with kudos and comments." },
            { icon: "handshake", title: "Run buddies", body: "Find someone to run with near you, with safety check-ins and reporting." },
            { icon: "ticket", title: "Events with tickets", body: "One QR per seat. Paid tickets carry a 5% pacr fee and 18% GST on the fee." },
          ]}
          visual={<Phone src="/home/runners.jpg" alt="Runners gathered at the start of a group run, on the pacr welcome screen" />}
          action={<div className="row"><Button href="/clubs" iconRight="arrow-right">Find squads</Button><Button variant="ghost" href="/safety">Safety on pacr</Button></div>}
        />
      </div>
    </section>

    <section className="sec" id="start" style={{ scrollMarginTop: "calc(var(--header-h) + var(--space-12))" }}>
      <div className="pw-container">
        <SecHead overline="Get started" title="From download to your first run" />
        <Steps items={[
          { icon: "download", title: "Get the app", body: "Free on the App Store and Google Play." },
          { icon: "log-in", title: "Make your account", body: "Sign up with Apple, Google or email. The same account signs you in on pacr.life." },
          { icon: "users-round", title: "Find a squad or a plan", body: "Join a squad in your city, or build a training plan." },
          { icon: "navigation", title: "Go for a run", body: "Start a run, or turn up to a group run and check in." },
        ]} />
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <SecHead title="Questions about the app" />
        <Faq items={[
          { q: "Is pacr free?", a: "Yes. pacr is free to use today, apart from event tickets. Paid tickets carry a 5% pacr fee and 18% GST on that fee, shown before you pay." },
          { q: "Which phones does it work on?", a: "iPhone and Android." },
          { q: "Can I use pacr on the web?", a: "Yes. Browse squads, runs and events on pacr.life, and sign in with your app account. Accounts are made in the app." },
          { q: "Does the coach talk to me during a run?", a: "Yes. The voice coach speaks your splits and pace while you run." },
          { q: "Is live sharing a safety service?", a: "No. It's a convenience: it updates only while your phone has a connection, and it notifies nobody. In an emergency, call 112." },
          { q: "Does pacr sell my data?", a: "No. We never sell your data, and there are no ads. The privacy policy has the details." },
        ]} />
      </div>
    </section>

    <Band title="Get pacr" body="Free on iPhone and Android." />
  </>;
}
