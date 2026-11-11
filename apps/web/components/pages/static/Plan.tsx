// /plans/<distance>: one template, data per distance (lib/content.ts).
// What the plan builder really does: questions, an AI-written plan, and the
// app's training rules checking every week. No daily rewrites, no heat
// offsets, no talking back to the coach.
import { Button, Card, Icon, Media } from "@/components/ds/core";
import { StoreBadges } from "@/components/ds/nav";
import { LEVELS, PLAN_FAQ, PLAN_ORDER, PLAN_WEEKS, PLANS, type PlanInfo } from "@/lib/content";
import { Band, Faq, Feature, Hero, Phone, SecHead, Steps } from "./blocks";

const km = (n: number) => `${n.toLocaleString("en-IN")} km`;
const weeks = (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`;

function Limits({ plan }: { plan: PlanInfo }) {
  return <Card variant="raised" style={{ padding: "var(--space-6)" }}>
    <div className="stack" style={{ gap: "var(--space-4)" }}>
      <div>
        <h3 className="t-h4">The numbers behind a {plan.noun} plan</h3>
        <p className="t-caption" style={{ margin: "var(--space-1) 0 0" }}>From the app&apos;s training rules.</p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="pw-table">
          <thead><tr><th>You are</th><th className="r">Weeks it needs</th><th className="r">Longest run</th></tr></thead>
          <tbody>{LEVELS.map(([k, label]) => <tr key={k}><td>{label}</td><td className="r">{weeks(plan.minWeeks[k])}</td><td className="r">{km(plan.longRunKm[k])}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="t-caption" style={{ margin: 0 }}>
        With fewer weeks, the builder tells you the plan is a stretch before it builds. The longest run is the most the plan will ever schedule, and less if you set a time limit. The taper is up to {weeks(plan.taperWeeks)}, less on a short plan.
      </p>
    </div>
  </Card>;
}

export function PlanPage({ plan }: { plan: PlanInfo }) {
  const others = PLAN_ORDER.filter(s => s !== plan.slug).map(s => PLANS[s]);
  return <>
    <Hero
      overline="Training plans"
      title={`${plan.name} training plan`}
      lead={plan.lead}
      actions={<div className="stack" style={{ gap: "var(--space-6)" }}>
        <StoreBadges />
        <nav className="row" aria-label="Training plans">
          {PLAN_ORDER.map(s => <Button key={s} size="sm" variant={s === plan.slug ? "primary" : "ghost"} href={`/plans/${s}`}
            aria-current={s === plan.slug ? "page" : undefined}>{PLANS[s].name}</Button>)}
        </nav>
      </div>}
      facts={[["Free", "in the pacr app"], [`${PLAN_WEEKS.min} to ${PLAN_WEEKS.max}`, "weeks"], ["2 or more", "run days a week"]]}
      visual={<Phone src="/home/night.jpg" alt="A runner on a path at night, on the pacr welcome screen" />}
    />

    <section className="sec sec--alt">
      <div className="pw-container">
        <SecHead overline="How it works" title="A few questions, then your plan" sub="The plan builder in the app asks what a coach would, in this order." />
        <Steps items={[
          { icon: "flag", title: "Your goal", body: `Finish a ${plan.noun}, or race it for a time.` },
          { icon: "calendar-days", title: "Your date", body: "Race day, or how many weeks you have." },
          { icon: "activity", title: "Your running now", body: "Your experience, how much you run today and any recent results." },
          { icon: "calendar-check", title: "Your days", body: "Which days you can run, your long-run day and how long a run can be." },
        ]} />
      </div>
    </section>

    <section className="sec">
      <div className="pw-container">
        <Feature
          id="rules"
          overline="Written by AI, checked by rules"
          title="A plan you can actually follow"
          body="pacr's coach writes your weeks from your answers. Before you see them, the app checks every week against its training rules and fixes anything that breaks one."
          items={[
            { icon: "footprints", title: "Starts where you are", body: "Week one is close to what you run now." },
            { icon: "chart-line", title: "Grows gently", body: "No week jumps far past your biggest week so far, and three weeks that climbed earn a lighter one." },
            { icon: "route", title: "One long run a week", body: "Never past the cap for your level, and never a sudden leap." },
            { icon: "zap", title: "Hard days apart", body: "Quality sessions are capped each week, never back to back, and none in race week." },
            { icon: "heart-pulse", title: "Careful after a break", body: "Coming back from an injury or illness? The plan starts light, with no hard sessions." },
            { icon: "timer", title: "Inside your limits", body: "Runs only on your run days, within the minutes you have, at paces between what you run today and your goal." },
          ]}
          visual={<Limits plan={plan} />}
        />
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <SecHead overline="The block" title={`How a ${plan.noun} plan is built`} sub="Every plan moves through four phases. How long each one lasts depends on the weeks you have." />
        <Steps items={[
          { icon: "sunrise", title: "Base", body: plan.phases.base },
          { icon: "chart-line", title: "Build", body: plan.phases.build },
          { icon: "mountain", title: "Peak", body: plan.phases.peak },
          { icon: "flag", title: "Taper", body: plan.phases.taper },
        ]} />
      </div>
    </section>

    <section className="sec">
      <div className="pw-container">
        <Feature
          overline="Run it"
          title="From week one to the start line"
          items={[
            { icon: "watch", title: "On your wrist", body: "Plan workouts can go to Apple Watch." },
            { icon: "message-circle", title: "A voice coach", body: "Speaks your splits and pace while you run." },
            { icon: "medal", title: "Personal bests and badges", body: "pacr keeps your best 5K, 10K, half and marathon, and badges as you go." },
            { icon: "heart-pulse", title: "Your other apps", body: "Import from Apple Health and Health Connect, and connect Garmin and WHOOP." },
            { icon: "footprints", title: "Shoe mileage", body: "See how far each pair has gone." },
          ]}
          visual={<Media src="/home/runners.jpg" ratio="4:5" radius="var(--radius-card)" alt="Runners gathered at the start of a group run" />}
          action={<Button variant="secondary" href="/app" iconRight="arrow-right">Everything in the app</Button>}
        />
      </div>
    </section>

    <section className="sec sec--alt">
      <div className="pw-container">
        <SecHead title={`${plan.name} training questions`} />
        <Faq items={[...plan.faq, ...PLAN_FAQ]} />
        <div style={{ marginTop: "var(--space-16)" }}>
          <SecHead title="Training for a different distance?" sub="Same builder, same rules, different limits." />
          <div className="grid-cards">
            {others.map(o => <Card key={o.slug} href={`/plans/${o.slug}`}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <div><p className="t-overline" style={{ margin: 0 }}>{km(o.km)}</p><h3 className="t-h3">{o.name} plan</h3></div>
                <Icon name="arrow-right" />
              </div>
            </Card>)}
          </div>
        </div>
      </div>
    </section>

    <Band title={`Build your ${plan.noun} plan in the app`} body="Free on iPhone and Android. Answer the questions and pacr writes your plan." />
  </>;
}
