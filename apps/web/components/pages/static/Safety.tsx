// /safety: what pacr does to make running with people you don't know yet
// safer, and what it can't do. Every line is the app's behaviour or a line
// from the terms, privacy policy or community rules.
import { Button, Card, Icon, Media } from "@/components/ds/core";
import { Band, FactList, Feature, Hero, SecHead, Steps } from "./blocks";

export function Safety() {
  return <>
    <Hero
      overline="Safety"
      title="Running with people you've just met"
      lead="pacr puts you on runs with squads, run buddies and people at events. Here's what it does to make that safer, and what it can't do."
      actions={<div className="row" style={{ gap: "var(--space-3)" }}>
        <Button size="lg" variant="secondary" href="/community-rules">Community rules</Button>
        <Button size="lg" variant="ghost" href="/support">Get help</Button>
      </div>}
      visual={<Card variant="raised" style={{ padding: "var(--space-8)" }}>
        <div className="stack" style={{ gap: "var(--space-4)" }}>
          <span className="step__n" style={{ margin: 0 }}><Icon name="shield-alert" /></span>
          <h2 className="t-h2">In an emergency, call 112</h2>
          <p className="t-secondary" style={{ margin: 0 }}>Or your local emergency number. pacr can&apos;t send help: live run sharing notifies nobody, and it updates only while your phone has a connection.</p>
          <Button href="tel:112" variant="destructive" icon="smartphone">Call 112</Button>
        </div>
      </Card>}
    />

    <section className="sec sec--alt">
      <div className="pw-container">
        <SecHead overline="Before you meet anyone" title="Use your judgement" sub="We don't run background checks on anyone, and we aren't at the runs." />
        <Steps items={[
          { icon: "map-pin", title: "Meet in public", body: "A park, a lake, a track or a landmark, not someone's door." },
          { icon: "message-circle", title: "Tell someone", body: "Say where you're going and when you'll be back." },
          { icon: "badge-check", title: "Check the squad", body: "Look for the verified badge, read the squad's rules, see who's going." },
          { icon: "door-open", title: "Leave if it feels wrong", body: "You never owe anyone a run." },
        ]} />
      </div>
    </section>

    <section className="sec">
      <div className="pw-container">
        <Feature
          id="squads"
          overline="Squads and group runs"
          title="Know who you're running with"
          items={[
            { icon: "badge-check", title: "Verified squads", body: "The badge means pacr checked that a club is who it says it is. It's not a promise about any person, run or event." },
            { icon: "message-circle-question", title: "Join rules and questions", body: "Owners decide who can join, and can ask questions before letting someone in." },
            { icon: "user-x", title: "Owners can remove members", body: "Squad rules sit on top of pacr's rules, never instead of them." },
            { icon: "scan-line", title: "Check-in at the start", body: "A QR check-in shows who actually turned up to a group run." },
            { icon: "shield-check", title: "Women-only squads and runs", body: "For women runners. Women-only run buddies runs are hidden from everyone else." },
          ]}
          visual={<Media src="/home/runners.jpg" ratio="4:5" radius="var(--radius-card)" alt="Runners gathered at the start of a group run" />}
        />
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <Feature
          id="run-buddies"
          overline="Run buddies"
          title="Small runs with someone new"
          body="Run buddies finds you two to five people to run with near you. It's the part of pacr that puts strangers in the same place, so most of its rules are about safety."
          items={[
            { icon: "map-pin", title: "Public places", body: "Runs start at a park, lake, track or landmark." },
            { icon: "lock", title: "The exact spot stays private", body: "When the host approves who joins, only accepted runners see the exact meeting point." },
            { icon: "user-check", title: "One-to-one runs need a yes", body: "A run for just two always needs the host's approval." },
            { icon: "message-circle", title: "Your plan, to someone you trust", body: "Text a trusted contact where and when you're running, from your own phone. Their number stays on your phone." },
            { icon: "circle-check", title: "I'm safe", body: "After the run, tap I'm safe. The app reminds you if you haven't." },
            { icon: "flag", title: "Reports that count", body: "Two separate reports of unsafe behaviour or harassment pause someone's run buddies until we've looked." },
            { icon: "messages-square", title: "Chat that closes", body: "Run chat is for members only, and closes a day after the run." },
          ]}
          visual={<Media src="/home/track.jpg" ratio="1:1" radius="var(--radius-card)" alt="A running shoe on a track beside a lime line" />}
        />
      </div>
    </section>

    <section className="sec">
      <div className="pw-container">
        <Feature
          id="live"
          overline="Live run sharing"
          title="Let someone follow one run"
          body="Share a single run as a link, so one person can see where you are while you run."
          items={[
            { icon: "eye-off", title: "Off until you turn it on", body: "Live sharing is off by default, and has to be switched on before each run." },
            { icon: "link", title: "A private link", body: "It has a random secret, isn't listed anywhere and is kept out of search engines. Send it only to people you trust." },
            { icon: "trash-2", title: "Stop it any time", body: "Stopping the share kills the link and deletes the stored route. Each run gets its own link." },
            { icon: "wifi-off", title: "Not a safety service", body: "It updates only while your phone has a connection, and it notifies nobody." },
          ]}
          visual={<Card variant="raised" style={{ padding: "var(--space-6)" }}>
            <p className="t-overline" style={{ margin: "0 0 var(--space-4)" }}>What the link shows</p>
            <FactList rows={[
              ["Where you are", "Your position and the route so far"],
              ["Your run", "Distance and time"],
              ["Who you are", "Your display name"],
            ]} />
          </Card>}
        />
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <SecHead overline="Report, block, get help" title="If something goes wrong" sub="Report the runner in the app and, if it's serious, contact the police. We'll help where we can." />
        <Steps numbered={false} items={[
          { icon: "flag", title: "Report", body: "Long-press a post or comment in the app, or open the ··· menu on pacr.life. Reporting hides it from you straight away." },
          { icon: "ban", title: "Block", body: "Immediate and mutual: neither of you sees the other's posts or comments." },
          { icon: "eye-off", title: "Hidden while we look", body: "Posts that enough runners report are hidden automatically while we review them." },
          { icon: "scale", title: "Grievance Officer", body: "Anything else goes to support@pacr.life. We acknowledge complaints within 24 hours and aim to resolve them within 15 days." },
        ]} />
      </div>
    </section>

    <Band title="Questions about safety?" body="Write to support@pacr.life and a human will reply.">
      <div className="row" style={{ gap: "var(--space-3)" }}>
        <Button href="mailto:support@pacr.life" icon="mail">Email support</Button>
        <Button variant="secondary" href="/terms#together">Running with others, in the terms</Button>
      </div>
    </Band>
  </>;
}
