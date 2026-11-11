// /download: download.html (the link-in-bio page) on the design system:
// both stores, a QR code for phones on desktop, and pacr's socials.
import { Button, Card, Icon } from "@/components/ds/core";
import { QRBlock } from "@/components/ds/actions";
import { StoreBadges } from "@/components/ds/nav";
import { SOCIALS } from "@/lib/config";
import { BrandIcon } from "@/components/ds/brands";

const WHAT: { icon: string; title: string; body: string; href: string }[] = [
  { icon: "route", title: "Run", body: "GPS tracking with auto-pause, a voice coach that calls your splits and pace, live sharing by link and share cards.", href: "/app#run" },
  { icon: "calendar-check", title: "Train", body: "Answer a few questions and get a training plan for a 5K, 10K, half or marathon, checked against safe-training rules.", href: "/app#train" },
  { icon: "users-round", title: "Run together", body: "Squads in your city, weekly group runs with RSVP and QR check-in, events with tickets, and run buddies near you.", href: "/app#together" },
];

export function Download() {
  return <>
    <section className="hero">
      <div className="pw-container hero__grid">
        <div>
          <p className="t-overline" style={{ margin: "0 0 var(--space-3)" }}>Download</p>
          <h1 className="t-display-2">Get pacr</h1>
          <p className="lead">India&apos;s own running app. Free on iPhone and Android.</p>
          <StoreBadges />
          <p className="t-body-s t-secondary" style={{ margin: "var(--space-6) 0 0" }}>
            Already have the app? <a href="/signin">Sign in on the web</a> with the same account.
          </p>
        </div>
        <div className="hide-md" style={{ display: "grid", placeItems: "center" }}>
          <Card style={{ padding: "var(--space-8)", textAlign: "center" }}>
            <QRBlock value="https://pacr.life/download" size={200} large caption="Scan with your phone's camera to get pacr" />
          </Card>
        </div>
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <div className="sec-h"><div><h2 className="t-h2">What&apos;s in the app</h2><p>Everything you need to run on your own or with a squad.</p></div>
          <Button variant="ghost" href="/app" iconRight="arrow-right">See the app</Button></div>
        <div className="grid-cards">
          {WHAT.map(w => <Card key={w.title} href={w.href}>
            <div className="stack">
              <span className="step__n" style={{ margin: 0 }}><Icon name={w.icon} /></span>
              <h3 className="t-h3">{w.title}</h3>
              <p className="t-secondary" style={{ margin: 0 }}>{w.body}</p>
            </div>
          </Card>)}
        </div>
      </div>
    </section>

    <section className="sec--tight">
      <div className="pw-container row" style={{ justifyContent: "space-between", gap: "var(--space-4)" }}>
        <div><h2 className="t-h3">Follow pacr</h2><p className="t-secondary" style={{ margin: "var(--space-1) 0 0" }}>pacr running, on the socials.</p></div>
        <div className="row">
          {SOCIALS.map(so => <a key={so.id} className="pw-btn pw-btn--secondary pw-btn--sm" href={so.url} target="_blank" rel="noopener"><BrandIcon name={so.id} size={16} /><span>{so.label}</span></a>)}
        </div>
      </div>
    </section>
  </>;
}
