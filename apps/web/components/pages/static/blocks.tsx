// The marketing-page pieces from ui_kits/website/site.css (hero, steps,
// feature + phone, faq, band), shared by /app, /plans, /hosts, /safety and
// /about. Markup only: every class is the kit's.
import { Fragment, type ReactNode } from "react";
import { Icon, Media } from "@/components/ds/core";
import { StoreBadges } from "@/components/ds/nav";

export type Item = { icon: string; title: string; body: ReactNode };
export type QA = { q: string; a: ReactNode };

export function Hero({ overline, title, lead, actions, facts, visual }:
  { overline: string; title: ReactNode; lead: ReactNode; actions?: ReactNode; facts?: [ReactNode, string][]; visual?: ReactNode }) {
  return <section className="hero">
    <div className="pw-container hero__grid">
      <div>
        <p className="t-overline" style={{ margin: "0 0 var(--space-3)" }}>{overline}</p>
        <h1 className="t-display-2">{title}</h1>
        <p className="lead">{lead}</p>
        {actions}
        {facts?.length ? <div className="hero__facts">{facts.map(([b, rest], i) => <span key={i}><b>{b}</b> {rest}</span>)}</div> : null}
      </div>
      {visual ? <div>{visual}</div> : null}
    </div>
  </section>;
}

/** The kit's phone frame around one of pacr's own welcome posters (the app's first screen). */
export function Phone({ src, alt }: { src: string; alt: string }) {
  return <div className="phone"><div><Media src={src} alt={alt} ratio="9:16" /></div></div>;
}

/** Section heading row: title and supporting line, optional action on the right. */
export function SecHead({ title, sub, action, overline }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; overline?: string }) {
  return <div className="sec-h"><div>
    {overline ? <p className="t-overline" style={{ margin: "0 0 var(--space-2)" }}>{overline}</p> : null}
    <h2 className="t-h2">{title}</h2>{sub ? <p>{sub}</p> : null}</div>{action}</div>;
}

export function Steps({ items, numbered = true }: { items: Item[]; numbered?: boolean }) {
  return <div className="steps">
    {items.map((s, i) => <div key={s.title} className="step">
      <span className="step__n">{numbered ? <b className="num">{i + 1}</b> : <Icon name={s.icon} />}</span>
      <h3>{s.title}</h3>
      <p>{s.body}</p>
    </div>)}
  </div>;
}

/** Text with an icon list beside a visual (stacked under 900 px, text first). */
export function Feature({ id, overline, title, body, items, visual, action }:
  { id?: string; overline?: string; title: ReactNode; body?: ReactNode; items: Item[]; visual: ReactNode; action?: ReactNode }) {
  return <div id={id} className="feature" style={{ scrollMarginTop: "calc(var(--header-h) + var(--space-16))" }}>
    <div>
      {overline ? <p className="t-overline" style={{ margin: "0 0 var(--space-3)" }}>{overline}</p> : null}
      <h2 className="t-h2">{title}</h2>
      {body ? <p className="t-body-l t-secondary" style={{ margin: "var(--space-4) 0 0" }}>{body}</p> : null}
      <ul>{items.map(it => <li key={it.title}><Icon name={it.icon} /><div><b>{it.title}</b><span>{it.body}</span></div></li>)}</ul>
      {action}
    </div>
    <div>{visual}</div>
  </div>;
}

export function Faq({ items }: { items: QA[] }) {
  return <div className="faq">
    {items.map(f => <details key={f.q}>
      <summary>{f.q}<Icon name="plus" /></summary>
      <p>{f.a}</p>
    </details>)}
  </div>;
}

/** The closing call to action: get the app. */
export function Band({ title, body, children }: { title: ReactNode; body?: ReactNode; children?: ReactNode }) {
  return <section className="band">
    <div className="pw-container band__grid">
      <div>
        <h2 className="t-h2">{title}</h2>
        {body ? <p className="t-secondary" style={{ margin: "var(--space-2) 0 0", maxWidth: "var(--grid-reading)" }}>{body}</p> : null}
      </div>
      {children ?? <StoreBadges />}
    </div>
  </section>;
}

/** A card-sized list of facts (dl), for the visual side of a feature. */
export function FactList({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return <dl className="dl">{rows.map(([k, v], i) => <Fragment key={i}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>;
}
