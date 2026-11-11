// /support: support.html (email us, a human replies; 7 days, 30 days for
// verified data requests; Bengaluru, India) plus topic cards that point to
// the answer in the terms, privacy policy and community rules.
import { Button, Card, Icon } from "@/components/ds/core";

const MAIL = "support@pacr.life";
const mail = (subject?: string) => `mailto:${MAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;

const TOPICS: { icon: string; title: string; body: string; link: [string, string] }[] = [
  { icon: "circle-alert", title: "Something isn't working", body: "Tell us what happened, on which phone, and what you expected. A screenshot helps.", link: ["Email about a bug", mail("Bug")] },
  { icon: "key-round", title: "Your account", body: "Accounts are made in the app, with Apple, Google or email. Signing in on pacr.life uses the same account.", link: ["Sign in", "/signin"] },
  { icon: "file-text", title: "Your data", body: "Ask for a copy of your data, a correction, or deletion. You can also delete your account in the app, under Profile → Settings.", link: ["Read the privacy policy", "/privacy"] },
  { icon: "ticket", title: "Tickets and refunds", body: "Only the host can refund a booking. If the host cancels the event, every paid booking is refunded in full. Ask the host first; if you can't reach them, email us.", link: ["Ticket terms", "/terms#tickets"] },
  { icon: "flag", title: "Report a post or a runner", body: "Use Report on it in the app or on pacr.life. Reporting hides it from you straight away, and we review every report.", link: ["Community rules", "/community-rules"] },
  { icon: "scale", title: "Grievances", body: "A complaint about how we handled a report, your data, a payment or a host goes to our Grievance Officer. We acknowledge complaints within 24 hours.", link: ["How grievances work", "/terms#grievance"] },
  { icon: "shield-check", title: "Safety", body: "How squads, run buddies and live sharing keep runs safer, and what they can't do. In an emergency, call 112.", link: ["Safety on pacr", "/safety"] },
  { icon: "layout-dashboard", title: "Hosting runs and events", body: "Run your squad from the host dashboard, get verified, and apply to sell event tickets.", link: ["For hosts", "/hosts"] },
];

export function Support() {
  return <>
    <section className="hero">
      <div className="pw-container hero__grid">
        <div>
          <p className="t-overline" style={{ margin: "0 0 var(--space-3)" }}>Support</p>
          <h1 className="t-display-2">Talk to us.</h1>
          <p className="lead">Bugs, account questions, data requests, anything else — email us and a human will reply.</p>
        </div>
        <Card variant="raised" style={{ padding: "var(--space-6)" }}>
          <div className="stack" style={{ gap: "var(--space-4)" }}>
            <span className="step__n" style={{ margin: 0 }}><Icon name="mail" /></span>
            <a className="t-h3" href={mail()} style={{ overflowWrap: "anywhere" }}>{MAIL}</a>
            <Button href={mail()} size="lg" block icon="mail">Email support</Button>
            <p className="t-body-s t-secondary" style={{ margin: 0 }}>We aim to respond within 7 days, and to fulfil verified data requests within 30 days.</p>
          </div>
        </Card>
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <div className="sec-h"><div><h2 className="t-h2">Find your answer</h2><p>The common questions, and where the full answer lives.</p></div></div>
        <div className="grid-cards">
          {TOPICS.map(t => <Card key={t.title}>
            <div className="stack" style={{ height: "100%" }}>
              <span className="step__n" style={{ margin: 0 }}><Icon name={t.icon} /></span>
              <h3 className="t-h4">{t.title}</h3>
              <p className="t-body-s t-secondary" style={{ margin: 0, flex: 1 }}>{t.body}</p>
              <a href={t.link[1]} className="t-body-s" style={{ fontWeight: "var(--weight-semibold)" }}>{t.link[0]}</a>
            </div>
          </Card>)}
        </div>
        <p className="t-caption" style={{ marginTop: "var(--space-12)" }}>
          pacr · Bengaluru, India · <a href="/privacy">Privacy policy</a> · <a href="/terms">Terms</a> · <a href="/community-rules">Community rules</a>
        </p>
      </div>
    </section>
  </>;
}
