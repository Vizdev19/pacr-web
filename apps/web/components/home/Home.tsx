"use client";
// The home page: design-system/ui_kits/home-lime/index.html as React, with
// real data in place of the kit's sample rows. Photos are crops of pacr's own
// welcome posters (public/home/); squad pictures come from /s/<slug>/photo.
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, IconButton } from "@/components/ds/core";
import { CityPicker, MobileMenuSheet, StoreBadges } from "@/components/ds/nav";
import { rememberCity, useSessionUser } from "@/components/site/session";
import { INSTAGRAM_URL } from "@/lib/config";
import type { SiteCity } from "@/lib/cities";

export type HomeRun = { href: string; title: string; place: string; tags: string[]; when: string; peek: string };
export type HomeSquadPic = { name: string; src: string };

export function Home({ cities, city, runs, pics }: { cities: SiteCity[]; city: string; runs: HomeRun[]; pics: HomeSquadPic[] }) {
  const router = useRouter();
  const [cityOpen, setCityOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [user, signOut] = useSessionUser();
  const [peek, setPeek] = useState<{ top: number; src: string } | null>(null);
  const runsRef = useRef<HTMLElement>(null);
  const cityName = cities.find(c => c.id === city)?.name ?? "Bengaluru";
  const withSquads = [...cities].filter(c => c.squads > 0).sort((a, b) => b.squads - a.squads);
  const cityLine = withSquads.length
    ? withSquads.length > 3 ? `${withSquads.slice(0, 3).map(c => c.name).join(", ")} and more` : joinAnd(withSquads.map(c => c.name))
    : cityName;

  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") || "").trim();
    const hit = q && cities.find(c => c.name.toLowerCase().startsWith(q.toLowerCase()) || c.id === q.toLowerCase());
    if (hit) { rememberCity(hit.id); router.push(`/clubs/${hit.id}`); return; }
    router.push(`/clubs/${city}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };
  const pick = (id: string) => { rememberCity(id); setCityOpen(false); setMenu(false); router.refresh(); };
  const showPeek = (tr: HTMLTableRowElement, src: string) => {
    const s = runsRef.current?.getBoundingClientRect(); const r = tr.getBoundingClientRect();
    if (s) setPeek({ top: r.top - s.top + r.height / 2 - 55, src });
  };

  return <div className="hl-page">
    <div className="hl-frame">
      <header className="hl-nav">
        <nav className="hl-nav__l" aria-label="Main"><Link className="hl-pill hl-pill--active" href="/" aria-current="page">Home</Link><a className="hl-pill" href={`/clubs/${city}`}>Squads</a><a className="hl-pill" href={`/runs/${city}`}>Runs</a></nav>
        <Link className="hl-logo" href="/" aria-label="pacr home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/pacr-wordmark-on-light.svg" alt="pacr" />
        </Link>
        <div className="hl-nav__r">
          <button className="hl-pill" onClick={() => setCityOpen(true)} aria-haspopup="dialog">{cityName} <Icon name="chevron-down" /></button>
          <a className="hl-pill" href={`/events/${city}`}>Events</a>
          {user ? <a className="hl-pill" href="/feed">Feed</a> : <a className="hl-pill" href="/signin">Sign in</a>}
          <a className="hl-pill hl-pill--line" href="/download">Get the app</a>
          <IconButton className="hl-only-m" icon="menu" label="Menu" onClick={() => setMenu(true)} />
        </div>
      </header>

      <section className="hl-hero">
        <div className="hl-panel hl-lime">
          <div className="hl-eyebrow"><Icon name="asterisk" />pacr · running squads</div>
          <h1 className="hl-h1">Find your squad <span className="hl-inlineicon"><Icon name="arrow-up-right" /></span> &amp; run your city <u>together</u>.</h1>
          <form className="hl-form" onSubmit={search}><input className="hl-input" name="q" placeholder="Search your city or a squad" aria-label="City or squad" /><button className="hl-btn hl-btn--flat" type="submit">Find squads <Icon name="arrow-right" /></button></form>
          <div className="hl-cities">
            {pics.length ? <div className="hl-avs">{pics.slice(0, 3).map(p => <span key={p.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" />
            </span>)}</div> : null}
            <div>Squads in {cityLine}</div>
          </div>
          <div className="hl-notch hl-scroll" aria-hidden="true"><Icon name="mouse" /></div>
        </div>
        <div className="hl-panel hl-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hl-fill" src="/home/track.jpg" alt="A runner's shoe on a track with a lime line" />
          <div className="hl-notch hl-notch--tl"><div className="hl-volcard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/home/runners.jpg" alt="" />
            <div><span className="hl-dot" /><br />Run leaders<br />&amp; squads</div>
            <a className="hl-volcard__arrow" href={`/clubs/${city}`} aria-label="See squads"><Icon name="arrow-up-right" /></a></div></div>
          <span className="hl-photo__icon" aria-hidden="true"><Icon name="footprints" /></span>
          <div className="hl-hot" style={{ top: "28%", right: "9%" }}><span className="hl-hot__ring" /><span className="hl-hot__label">Group runs</span></div>
          <div className="hl-hot" style={{ top: "37%", left: "9%" }}><span className="hl-hot__ring" /><span className="hl-hot__label">Run buddies</span></div>
          <div className="hl-hot" style={{ top: "50%", left: "44%" }}><span className="hl-hot__ring" /><span className="hl-hot__label">Events</span></div>
          <div className="hl-social"><a href={INSTAGRAM_URL} aria-label="pacr on Instagram"><Icon name="instagram" /></a>Follow pacr</div>
          <div className="hl-notch hl-notch--bc" style={{ left: "12%", fontSize: 11.5, lineHeight: 1.3 }}>Join a group run<br />this weekend</div>
          <div className="hl-notch hl-notch--br" style={{ width: "46%", fontSize: 12.5, lineHeight: 1.35 }}>pacr helps runners find squads, group runs and events in their city.</div>
        </div>
      </section>

      <section className="hl-mission" id="squads">
        {/* eslint-disable @next/next/no-img-element */}
        {pics.length >= 4 ? <>
          <div className="hl-bubble" style={{ left: "calc(50% - 470px)", top: "28%" }}><img src={pics[0].src} alt="" /></div>
          <div className="hl-bubble" style={{ left: "calc(50% - 400px)", top: "50%" }}><img src={pics[1].src} alt="" /></div>
          <div className="hl-bubble" style={{ right: "calc(50% - 470px)", top: "28%" }}><img src={pics[2].src} alt="" /></div>
          <div className="hl-bubble" style={{ right: "calc(50% - 400px)", top: "50%" }}><img src={pics[3].src} alt="" /></div>
        </> : null}
        {/* eslint-enable @next/next/no-img-element */}
        <h2 className="hl-h2">Every pace is welcome. Your squad is one run away.</h2>
        <p className="hl-lede">Find <b>verified squads</b> and <b>women-only runs</b> near you, RSVP in a tap and meet at the start line.</p>
        <div className="hl-actions"><a className="hl-btn" href={`/clubs/${city}`}>Browse squads <Icon name="arrow-right" /></a><a className="hl-learn" href="/download">Get the app</a></div>
      </section>

      <section className="hl-strip" aria-label="We run together">
        <div className="hl-strip__item hl-strip__grey" style={{ color: "var(--ink)" }}>We</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="hl-strip__item"><img className="hl-fill" src="/home/runners.jpg" alt="" /><span>Run</span></div>
        <div className="hl-strip__item hl-strip__lime"><Icon name="arrow-right" /></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="hl-strip__item"><img className="hl-fill" src="/home/night.jpg" alt="" /><span>Together</span></div>
      </section>

      <section className="hl-runs" id="runs" ref={runsRef}>
        <div className="hl-runs__head"><h3 className="hl-h3">Group runs this week</h3><p className="hl-note">What squads in {cityName} are running in the next 7 days. Pick one to see the meeting point.</p></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className={"hl-peek" + (peek ? " on" : "")} style={peek ? { top: peek.top } : undefined}><div className="hl-peek__back" /><div className="hl-peek__img">{peek ? <img className="hl-fill" src={peek.src} alt="" /> : null}</div></div>
        {runs.length ? <table className="hl-table">
          <thead><tr><th style={{ width: "38%" }}>Run</th><th style={{ width: "26%" }}>Tags</th><th>Date</th><th /></tr></thead>
          <tbody onMouseLeave={() => setPeek(null)}>
            {runs.map(r => <tr key={r.href} onClick={() => router.push(r.href)} onMouseEnter={e => showPeek(e.currentTarget, r.peek)}>
              <td><a className="hl-runname" href={r.href} onClick={e => e.stopPropagation()}>{r.title}</a><div className="hl-runplace">{r.place}</div></td>
              <td><div className="hl-tags">{r.tags.map(t => <span key={t} className="hl-tag">{t}</span>)}</div></td>
              <td className="hl-date">{r.when}</td>
              <td><span className="hl-go"><Icon name="arrow-right" /></span></td>
            </tr>)}
          </tbody>
        </table> : <p className="hl-lede" style={{ margin: 0, maxWidth: "none", textAlign: "left" }}>No group runs in {cityName} this week yet. <a href={`/clubs/${city}`} style={{ textDecoration: "underline" }}>See squads in {cityName}</a></p>}
        {runs.length ? <div className="hl-actions" style={{ justifyContent: "flex-start", marginTop: 28 }}><a className="hl-btn" href={`/runs/${city}`}>All runs this week <Icon name="arrow-right" /></a></div> : null}
      </section>

      <section className="hl-cards">
        {/* eslint-disable @next/next/no-img-element */}
        <article className="hl-card"><img className="hl-fill" src="/home/runners.jpg" alt="" /><div className="hl-card__scrim" /><div className="hl-card__top"><div className="hl-card__chips"><span className="hl-chip">Verified squads</span><span className="hl-chip">Women-only runs</span></div><a className="hl-arrow hl-arrow--lime" href={`/clubs/${city}`} aria-label="Squads"><Icon name="arrow-right" /></a></div><div className="hl-card__body"><h4 className="hl-card__title">Running<br />squads</h4><p className="hl-card__text">Running clubs in your city, from first-5K crews to marathon groups.</p><a className="hl-explore" href={`/clubs/${city}`}>Find squads <Icon name="chevron-right" /></a></div></article>
        <article className="hl-card"><img className="hl-fill" src="/home/night.jpg" alt="" /><div className="hl-card__scrim" /><div className="hl-card__top"><a className="hl-arrow" href={`/runs/${city}`} aria-label="Group runs"><Icon name="arrow-up-right" /></a></div><div className="hl-card__body"><h4 className="hl-card__title">Group<br />runs</h4><p className="hl-card__text">RSVP, see the meeting point and check in with one tap.</p><a className="hl-explore" href={`/runs/${city}`}>See runs <Icon name="chevron-right" /></a></div></article>
        <article className="hl-card"><img className="hl-fill" src="/home/ribbon.jpg" alt="" /><div className="hl-card__scrim" /><div className="hl-card__top"><a className="hl-arrow" href={`/events/${city}`} aria-label="Events"><Icon name="arrow-up-right" /></a></div><div className="hl-card__body"><h4 className="hl-card__title">Races &amp;<br />events</h4><p className="hl-card__text">Run fests and races with tickets in the app.</p><a className="hl-explore" href={`/events/${city}`}>See events <Icon name="chevron-right" /></a></div></article>
        <article className="hl-card"><img className="hl-fill" src="/home/track.jpg" alt="" /><div className="hl-card__scrim" /><div className="hl-card__top"><a className="hl-arrow" href="/download" aria-label="Run buddies"><Icon name="arrow-up-right" /></a></div><div className="hl-card__body"><h4 className="hl-card__title">Run<br />buddies</h4><p className="hl-card__text">Find someone near you who runs your pace. In the app.</p><a className="hl-explore" href="/download">Get the app <Icon name="chevron-right" /></a></div></article>
        {/* eslint-enable @next/next/no-img-element */}
      </section>

      <footer className="hl-app" id="app">
        <div className="hl-app__grid"><div><span className="hl-label">get the app</span></div><div><p className="hl-app__h">RSVP to runs, chat with your squad and check in with one tap in the pacr app.</p><div className="hl-app__row"><StoreBadges /></div></div></div>
        <div className="hl-foot"><span>© {new Date().getFullYear()} pacr</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/pacr-wordmark-on-light.svg" alt="pacr" />
          <div className="hl-foot__r"><a href={INSTAGRAM_URL}>Instagram</a><a href="/support">Help</a><a href="/community-rules">Community rules</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div></div>
      </footer>
    </div>
    <CityPicker open={cityOpen} city={city} cities={cities} onClose={() => setCityOpen(false)} onSelect={pick} />
    <MobileMenuSheet open={menu} onClose={() => setMenu(false)} cityName={cityName} onCity={() => { setMenu(false); setCityOpen(true); }} user={user} onSignOut={async () => { await signOut(); setMenu(false); }} />
  </div>;
}

function joinAnd(xs: string[]) {
  return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}
