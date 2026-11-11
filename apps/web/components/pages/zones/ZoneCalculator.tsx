"use client";
// pacr.life/zones: the zone calculator (lead magnet for the "easy runs are too
// fast" reel). Everything runs in the browser; nothing is stored or sent
// except the four PostHog events below.
import Script from "next/script";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Button, Card } from "@/components/ds/core";
import { FieldMessage, Input, Select } from "@/components/ds/forms";
import { StoreBadges } from "@/components/ds/nav";
import { calculate, fmtPace, raceKm, RACES, type ZoneErrors, type ZoneForm, type ZoneResult } from "@/lib/zones";

type PH = { capture: (event: string, props?: Record<string, unknown>, opts?: Record<string, unknown>) => void };

/** PostHog event, carrying the visit's UTM source and campaign. */
function track(event: string, beacon = false) {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  const props: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign"]) { const v = q.get(k); if (v) props[k] = v; }
  (window as unknown as { posthog?: PH }).posthog?.capture(event, props, beacon ? { transport: "sendBeacon" } : undefined);
}

const DELAY_MS = 180;

const tabular: CSSProperties = { fontVariantNumeric: "tabular-nums" };

function hatch(color: string): string {
  const c = `color-mix(in oklab, ${color} 18%, transparent)`;
  return `repeating-linear-gradient(135deg, ${c} 0 6px, transparent 6px 13px)`;
}

function ZoneRowCard({ z }: { z: ZoneResult["zones"][number] }) {
  const grey = z.n === 3;
  return <Card variant="outline" pad={false} style={{
    padding: "var(--space-4) var(--space-5)",
    borderLeft: `6px solid ${z.color}`,
    background: grey ? `${hatch(z.color)}, var(--surface-1)` : undefined,
  }}>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3) var(--space-6)" }}>
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <p className="t-overline" style={{ margin: 0, color: "var(--text-muted)" }}>Zone {z.n}</p>
        <h3 className="t-h4" style={{ margin: "2px 0 var(--space-1)" }}>{z.name}</h3>
        <p className="t-body-s t-secondary" style={{ margin: 0 }}>{z.use}</p>
      </div>
      <div style={{ flex: "0 0 auto", ...tabular }}>
        <div style={{ fontSize: "var(--text-h3)", lineHeight: "var(--lh-h3)", fontWeight: "var(--weight-bold)" as CSSProperties["fontWeight"] }}>
          {z.bpm[0]}–{z.bpm[1]} <span className="t-body-s t-muted" style={{ fontWeight: "var(--weight-regular)" as CSSProperties["fontWeight"] }}>bpm</span>
        </div>
        <div className="t-body-s t-secondary">{z.paceText} /km</div>
      </div>
    </div>
  </Card>;
}

function HmPaceLine({ pace }: { pace: number }) {
  return <div role="separator" aria-label={`Half marathon pace ${fmtPace(pace)} per km`}
    style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", margin: "var(--space-1) 0" }}>
    <span style={{ flex: 1, height: 3, background: "var(--accent)", borderRadius: "var(--radius-pill)" }} />
    <span className="t-caption" style={{ background: "var(--accent)", color: "var(--on-accent)", padding: "4px var(--space-3)", borderRadius: "var(--radius-pill)", fontWeight: "var(--weight-semibold)" as CSSProperties["fontWeight"], whiteSpace: "nowrap", ...tabular }}>
      Half marathon pace {fmtPace(pace)} /km
    </span>
    <span style={{ flex: 1, height: 3, background: "var(--accent)", borderRadius: "var(--radius-pill)" }} />
  </div>;
}

export function ZoneCalculator({ initial }: { initial: ZoneForm }) {
  const [form, setForm] = useState<ZoneForm>(initial);
  const [errors, setErrors] = useState<ZoneErrors>(() => { const r = calculate(initial); return "errors" in r ? r.errors : {}; });
  const [result, setResult] = useState<ZoneResult | null>(() => { const r = calculate(initial); return "result" in r ? r.result : null; });
  const [copied, setCopied] = useState(false);
  const edited = useRef(false);
  const calculatedSent = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const id = window.setTimeout(() => {
      const r = calculate(form);
      if ("errors" in r) { setErrors(r.errors); return; } // keep the last good chart
      setErrors({});
      setResult(r.result);
      if (edited.current && !calculatedSent.current) { calculatedSent.current = true; track("zones_calculated"); }
    }, DELAY_MS);
    return () => window.clearTimeout(id);
  }, [form]);

  const set = (k: keyof ZoneForm) => (v: string) => { edited.current = true; setForm(f => ({ ...f, [k]: v })); };

  // A click on either store badge. /js/posthog.js also logs app_store_click
  // or play_store_click for it.
  function storeClick(e: MouseEvent<HTMLDivElement>) {
    const a = (e.target as HTMLElement).closest("a");
    if (a) track("zones_cta_clicked", true);
  }

  async function copyLink() {
    const url = new URL(window.location.href);
    for (const k of ["age", "max", "d", "t"]) url.searchParams.delete(k);
    url.searchParams.set("age", form.age.trim());
    if (form.max.trim()) url.searchParams.set("max", form.max.trim());
    url.searchParams.set("d", String(raceKm(form.d)));
    url.searchParams.set("t", form.t.trim());
    const text = url.toString();
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    track("zones_link_copied");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return <>
    <Script src="/js/posthog.js" strategy="afterInteractive" onLoad={() => track("zones_page_view")} />

    <section className="sec" style={{ paddingBottom: "var(--space-10)" }}>
      <div className="pw-reading">
        <p className="t-overline" style={{ margin: "0 0 var(--space-3)" }}>Free zone calculator</p>
        <h1 className="t-display-2" style={{ margin: "0 0 var(--space-4)" }}>Find your real easy</h1>
        <p className="t-body-l t-secondary" style={{ margin: 0, textWrap: "pretty" }}>
          Enter your age and a recent or goal race time. You&apos;ll get your heart rate and pace for every kind of run, including the grey zone to stay out of on easy days.
        </p>

        <Card variant="raised" style={{ marginTop: "var(--space-8)", padding: "var(--space-6)" }}>
          <form onSubmit={e => e.preventDefault()} noValidate aria-label="Your details"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "var(--space-4)" }}>
            <Input label="Age" id="z-age" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={3}
              value={form.age} onChange={e => set("age")(e.target.value)} error={errors.age} />
            <Input label="Max heart rate" optional id="z-max" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={3}
              placeholder="From your watch" suffix="bpm" value={form.max} onChange={e => set("max")(e.target.value)} error={errors.max}
              hint={errors.max ? undefined : "Leave it empty to estimate from your age."} />
            <Select label="Race" id="z-race" value={String(raceKm(form.d))} onChange={set("d")}
              options={RACES.map(r => ({ value: String(r.km), label: r.label }))} />
            <Input label="Time" id="z-time" type="text" inputMode="numeric" autoComplete="off" placeholder="h:mm:ss"
              value={form.t} onChange={e => set("t")(e.target.value)} error={errors.time} />
          </form>
          {errors.pace ? <div style={{ marginTop: "var(--space-4)" }}><FieldMessage tone="error">{errors.pace}</FieldMessage></div> : null}
        </Card>
      </div>
    </section>

    {result ? <section className="sec" style={{ paddingTop: 0 }} aria-labelledby="z-ladder">
      <div className="pw-reading">
        <h2 id="z-ladder" className="t-h2" style={{ margin: "0 0 var(--space-2)" }}>Your zones</h2>
        <p className="t-body t-secondary" style={{ margin: "0 0 var(--space-6)", ...tabular }} aria-live="polite">
          {result.maxEntered ? `Using your max heart rate of ${result.maxHr} bpm` : `Estimated max heart rate: ${result.maxHr} bpm`}
          {" · "}Half marathon pace {fmtPace(result.hmPace)} /km
        </p>

        <div className="stack" style={{ gap: "var(--space-3)" }}>
          {result.zones.map(z => <div key={z.n} className="stack" style={{ gap: "var(--space-3)" }}>
            {z.n === 4 ? <HmPaceLine pace={result.hmPace} /> : null}
            <ZoneRowCard z={z} />
          </div>)}
        </div>

        <ul className="t-body t-secondary" style={{ margin: "var(--space-8) 0 0", paddingLeft: "var(--space-5)", display: "grid", gap: "var(--space-2)" }}>
          <li><b style={{ color: "var(--text-primary)" }}>Most of your running goes in Easy:</b> roughly 80% of your week, at a pace where you can talk in full sentences.</li>
          <li><b style={{ color: "var(--text-primary)" }}>Stay out of the grey zone on easy days.</b></li>
          <li><b style={{ color: "var(--text-primary)" }}>Save Threshold and Hard</b> for one or two sessions a week.</li>
        </ul>

        <div className="row" style={{ marginTop: "var(--space-6)", gap: "var(--space-3)", alignItems: "center" }}>
          <Button variant="secondary" icon={copied ? "check" : "copy"} onClick={copyLink}>{copied ? "Link copied" : "Copy link to my zones"}</Button>
          <span className="sr-only" role="status">{copied ? "Link copied" : ""}</span>
        </div>
      </div>
    </section> : null}

    <section className="sec" style={{ paddingTop: 0 }}>
      <div className="pw-reading">
        <div style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: "var(--radius-card)", padding: "var(--space-8) var(--space-6)" }}>
          <h2 className="t-h2" style={{ margin: "0 0 var(--space-2)" }}>Run your zones with pacr</h2>
          <p className="t-body" style={{ margin: "0 0 var(--space-6)", maxWidth: 520 }}>
            Log every run and see your heart rate and pace, with your runs from Garmin, WHOOP, Apple Health or Health Connect in one place.
          </p>
          <div onClickCapture={storeClick}><StoreBadges /></div>
        </div>

        <p className="t-caption t-muted" style={{ margin: "var(--space-8) 0 0", textWrap: "pretty" }}>
          Without a max heart rate, we estimate it from your age with the Tanaka formula (208 − 0.7 × age). Your real max can be 10 or more beats higher or lower, so if you know yours from a hard race or a test, enter it. Paces come from your race time with Riegel&apos;s formula and are estimates: heat, hills, sleep and fatigue all change them on the day. This is general guidance, not medical advice. If you have a heart condition, or any doubt about exercising hard, check with a doctor first.
        </p>
      </div>
    </section>
  </>;
}
