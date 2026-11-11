// /hosts: hosting a squad and selling event tickets on pacr. The dashboard
// is the host app at /host; organisers outside a squad apply at /host/apply.
import { Button, Card, TrustTag } from "@/components/ds/core";
import { StoreBadges } from "@/components/ds/nav";
import { Band, Faq, FactList, Feature, Hero, Phone, SecHead, Steps } from "./blocks";

export function Hosts() {
  return <>
    <Hero
      overline="For hosts"
      title="Host your squad on pacr"
      lead="Schedule weekly runs, check runners in at the start, keep members in the loop and sell event tickets, in the app and on the host dashboard at pacr.life/host."
      actions={<div className="row" style={{ gap: "var(--space-3)" }}>
        <Button size="lg" href="/host" icon="layout-dashboard">Open the host dashboard</Button>
        <Button size="lg" variant="secondary" href="/download">Start a squad in the app</Button>
      </div>}
      visual={<Phone src="/home/runners.jpg" alt="Runners gathered at the start of a group run, on the pacr welcome screen" />}
    />

    <section className="sec sec--alt">
      <div className="pw-container">
        <SecHead overline="Start hosting" title="From a squad to a weekly run" />
        <Steps items={[
          { icon: "users-round", title: "Start a squad", body: "Make it in the app. As owner you decide who can join, and the questions people answer when they ask." },
          { icon: "map-pin", title: "Save your meeting places", body: "Add the spots you start from, so every run has a meeting point runners can find." },
          { icon: "calendar-plus", title: "Schedule weekly runs", body: "Members RSVP in the app and see where to meet." },
          { icon: "scan-line", title: "Check runners in", body: "QR check-in at the start shows who actually turned up." },
        ]} />
      </div>
    </section>

    <section className="sec">
      <div className="pw-container">
        <Feature
          id="dashboard"
          overline="The host dashboard"
          title="Your squad on a bigger screen"
          body="Sign in at pacr.life/host with your pacr account to run the squad from a laptop."
          items={[
            { icon: "calendar-days", title: "Calendar and scheduling", body: "Plan runs at your saved meeting places, week by week." },
            { icon: "qr-code", title: "QR check-in", body: "See who checked in at the start of each run." },
            { icon: "user-check", title: "Members and join requests", body: "Answer requests, read the answers to your questions, and manage members." },
            { icon: "megaphone", title: "Announcements", body: "Tell the whole squad at once." },
            { icon: "shield-alert", title: "Moderation", body: "Review reports, and remove posts or members." },
            { icon: "chart-line", title: "Insights and a sponsor report", body: "See how the squad is doing, and download a sponsor report as a PDF." },
            { icon: "crown", title: "Team roles", body: "Share the work with organisers and run leaders." },
            { icon: "wallet", title: "Money and payouts", body: "Ticket sales and payouts for your events." },
          ]}
          action={<Button href="/host" iconRight="arrow-right">Open the dashboard</Button>}
          visual={<Card variant="raised" style={{ padding: "var(--space-6)" }}>
            <div className="stack" style={{ gap: "var(--space-4)" }}>
              <p className="t-overline" style={{ margin: 0 }}>Roles in a squad</p>
              <div className="row"><TrustTag kind="owner" /><TrustTag kind="organiser" /><TrustTag kind="run-leader" /></div>
              <p className="t-body-s t-secondary" style={{ margin: 0 }}>The owner made the squad and can apply to verify it. Organisers and run leaders help run it.</p>
            </div>
          </Card>}
        />
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <Feature
          id="verified"
          overline="Get verified"
          title="Show runners you're the real club"
          body="A verified badge next to your squad's name tells runners this is the real club, not a lookalike."
          items={[
            { icon: "badge-check", title: "Apply from the app", body: "The squad's owner applies from the squad's Manage page. Only public squads can be verified." },
            { icon: "instagram", title: "Prove it's yours", body: "Link the squad's Instagram and put the code pacr gives you in its bio while staff check." },
            { icon: "ticket", title: "Host events", body: "Only verified squads host events with tickets on pacr." },
            { icon: "triangle-alert", title: "Keep it", body: "Changing the squad's name or Instagram removes the badge, so the app asks first." },
          ]}
          visual={<Card variant="raised" style={{ padding: "var(--space-6)" }}>
            <div className="stack" style={{ gap: "var(--space-4)" }}>
              <TrustTag kind="verified" size="lg" />
              <p className="t-body-s t-secondary" style={{ margin: 0 }}>The badge means pacr checked that a club is who it says it is. It is not a promise about any person, run or event.</p>
            </div>
          </Card>}
        />
      </div>
    </section>

    <section className="sec">
      <div className="pw-container">
        <Feature
          id="tickets"
          overline="Events and tickets"
          title="Sell tickets to your races and run fests"
          body="Runners book on pacr, pay with Razorpay, and get a ticket for every seat."
          items={[
            { icon: "ticket", title: "One QR per seat", body: "Each seat gets its own ticket and QR code, to scan at the event." },
            { icon: "indian-rupee", title: "Clear pricing", body: "Runners pay your ticket price plus a 5% pacr fee and 18% GST on that fee, shown before they pay." },
            { icon: "wallet", title: "Payouts", body: "About a day after the event ends, you're paid the ticket price of every ticket sold, minus refunds, to your UPI ID or bank account." },
            { icon: "undo-2", title: "Refunds", body: "You can refund a booking until the event is paid out. Cancel the event and every paid booking is refunded in full." },
            { icon: "user-plus", title: "Not a squad?", body: "Organisers can ask to host at pacr.life/host/apply." },
          ]}
          action={<div className="row"><Button href="/host/apply" iconRight="arrow-right">Apply to host events</Button><Button variant="ghost" href="/terms#hosting">Hosting terms</Button></div>}
          visual={<Card variant="raised" style={{ padding: "var(--space-6)" }}>
            <p className="t-overline" style={{ margin: "0 0 var(--space-4)" }}>Fees at a glance</p>
            <FactList rows={[
              ["Ticket price", "Set by you, paid out to you"],
              ["pacr fee", "5% on top, paid by the runner"],
              ["GST", "18% on the pacr fee"],
              ["Payments", "Razorpay"],
              ["Payout", "About a day after the event"],
            ]} />
          </Card>}
        />
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <SecHead title="Questions from hosts" />
        <Faq items={[
          { q: "Does hosting cost anything?", a: "No. Squads and runs are free. On paid tickets, runners pay a 5% pacr fee and 18% GST on that fee on top of your price, and you're paid your ticket price." },
          { q: "Who can sell tickets?", a: "Verified squads, and organisers pacr has approved at pacr.life/host/apply." },
          { q: "Can I run the squad from my phone?", a: "Yes. You can make the squad, schedule runs and manage members in the app. The host dashboard at pacr.life/host is there when a bigger screen helps." },
          { q: "Which rules apply to my squad?", a: "Your own join rules and squad rules, on top of pacr's terms and community rules, never instead of them." },
          { q: "Who is responsible for an event?", a: "The host. You're the organiser: the event, the people running it, the route, permits, safety and insurance, and describing it honestly. The hosting section of the terms has the details." },
        ]} />
      </div>
    </section>

    <Band title="Bring your squad to pacr" body="Start the squad in the app, then open the dashboard at pacr.life/host.">
      <div className="stack" style={{ gap: "var(--space-3)" }}>
        <StoreBadges />
        <Button variant="secondary" href="/host" icon="layout-dashboard">Open the host dashboard</Button>
      </div>
    </Band>
  </>;
}
