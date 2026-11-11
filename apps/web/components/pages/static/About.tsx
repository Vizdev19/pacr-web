// /about: who makes pacr. The company facts are the terms' (Pacr Life,
// Bengaluru, support@pacr.life); the socials are download.html's.
import { Button, Card, Media } from "@/components/ds/core";
import { SOCIALS } from "@/lib/config";
import { Band, FactList, Hero, SecHead, Steps } from "./blocks";

export function About() {
  return <>
    <Hero
      overline="About"
      title="Built in India, for Indian cities"
      lead="pacr is a running app for runners in Indian cities: track your runs, train for a race, and find people to run with. It's made by Pacr Life, in Bengaluru."
      actions={<div className="row" style={{ gap: "var(--space-3)" }}>
        <Button size="lg" href="/app">See the app</Button>
        <Button size="lg" variant="secondary" href="/clubs">Find squads</Button>
      </div>}
      visual={<Media src="/home/track.jpg" ratio="1:1" radius="var(--radius-card)" alt="A running shoe on a track beside a lime line" />}
    />

    <section className="sec" style={{ paddingTop: 0 }}>
      <div className="pw-container">
        <SecHead overline="What we make" title="One app for the whole run" sub="Find your people. Run with squads in your city." />
        <Steps numbered={false} items={[
          { icon: "route", title: "Run", body: "GPS tracking, a voice coach, live sharing and share cards." },
          { icon: "calendar-check", title: "Train", body: "Training plans from 5K to marathon, written for you and checked by rules." },
          { icon: "users-round", title: "Together", body: "Squads, weekly group runs, run buddies and events with tickets." },
          { icon: "layout-dashboard", title: "Host", body: "Tools for the people who run squads and events." },
        ]} />
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container split">
        <div>
          <SecHead overline="How we work" title="What you can count on" />
          <ul className="rules" style={{ gap: "var(--space-3)" }}>
            <li>pacr is free to use today, apart from event tickets.</li>
            <li>We never sell your data, and there are no ads.</li>
            <li>Accounts are made in the app, with Apple, Google or email, and the same account signs you in on pacr.life.</li>
            <li>Email support@pacr.life and a human will reply.</li>
          </ul>
          <div className="row" style={{ marginTop: "var(--space-6)" }}>
            <Button variant="ghost" href="/privacy">Privacy policy</Button>
            <Button variant="ghost" href="/terms">Terms</Button>
            <Button variant="ghost" href="/community-rules">Community rules</Button>
          </div>
        </div>
        <Card variant="raised" style={{ padding: "var(--space-6)" }}>
          <p className="t-overline" style={{ margin: "0 0 var(--space-4)" }}>Company</p>
          <FactList rows={[
            ["Name", "Pacr Life"],
            ["Based in", "Bengaluru, Karnataka, India"],
            ["Email", <a key="e" href="mailto:support@pacr.life">support@pacr.life</a>],
            ["Grievances", <a key="g" href="/terms#grievance">Grievance Officer</a>],
            ...SOCIALS.map(so => [so.label, <a key={so.id} href={so.url} target="_blank" rel="noopener">{so.handle}</a>] as [string, React.ReactNode]),
          ]} />
        </Card>
      </div>
    </section>

    <Band title="Get pacr" body="Free on iPhone and Android." />
  </>;
}
