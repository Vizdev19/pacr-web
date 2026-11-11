// The reading template for /privacy, /terms and /community-rules: a title
// block, the text in the reading measure and, on desktop, an "On this page"
// rail (SectionNav rail) that follows the scroll. The terms and community
// rules are the old pages' words, word for word; the privacy policy was
// rewritten on 11 November 2026 (privacy.tsx). Only the presentation is the
// design system's.
import type { ReactNode } from "react";
import { SectionNav } from "@/components/ds/nav";
import { SpyNav } from "../static/SpyNav";

export type LegalSection = { id: string; nav: string; num?: string; title: string; body: ReactNode };
export type LegalDoc = {
  overline: string;
  title: string;
  lede?: ReactNode;
  dates?: string[];
  sections: LegalSection[];
  foot?: ReactNode;
};

/* Body pieces, so the text files stay text. */
export const P = ({ children }: { children: ReactNode }) => <p>{children}</p>;
export const H3 = ({ children }: { children: ReactNode }) =>
  <h3 className="t-h4" style={{ margin: "var(--space-6) 0 var(--space-3)" }}>{children}</h3>;
export const UL = ({ children }: { children: ReactNode }) =>
  <ul className="rules" style={{ marginBottom: "var(--space-4)" }}>{children}</ul>;
export const OL = ({ children }: { children: ReactNode }) =>
  <ol className="rules" style={{ marginBottom: "var(--space-4)" }}>{children}</ol>;
export function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return <div style={{ overflowX: "auto", margin: "0 0 var(--space-4)" }}>
    <table className="pw-table">
      <thead><tr>{head.map((h, i) => <th key={i} style={{ whiteSpace: "normal" }}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ verticalAlign: "top" }}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

const ANCHOR = { scrollMarginTop: "calc(var(--header-h) + var(--space-6))" };

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const nav = doc.sections.map(s => ({ id: s.id, label: s.nav }));
  return <div className="pw-container pw-page">
    <header style={{ maxWidth: "var(--grid-reading)", padding: "var(--space-8) 0 var(--space-10)" }}>
      <p className="t-overline" style={{ margin: "0 0 var(--space-3)" }}>{doc.overline}</p>
      <h1 className="t-h1">{doc.title}</h1>
      {doc.lede ? <p className="t-body-l t-secondary" style={{ margin: "var(--space-4) 0 0" }}>{doc.lede}</p> : null}
      {doc.dates ? <div className="row t-caption" style={{ gap: "var(--space-2) var(--space-6)", marginTop: "var(--space-4)" }}>
        {doc.dates.map(d => <span key={d}>{d}</span>)}
      </div> : null}
    </header>
    <div className="only-md" style={{ margin: "0 0 var(--space-8)" }}><SectionNav sections={nav} /></div>
    <div className="split">
      <article className="prose" style={{ maxWidth: "var(--grid-reading)" }}>
        {doc.sections.map((s, i) => <section key={s.id} id={s.id} style={{ ...ANCHOR, marginTop: i ? "var(--space-12)" : 0 }}>
          {s.num ? <p className="t-overline" style={{ margin: "0 0 var(--space-2)" }}>{s.num}</p> : null}
          <h2 className="t-h2" style={{ marginBottom: "var(--space-4)" }}>{s.title}</h2>
          {s.body}
        </section>)}
        {doc.foot ? <div className="t-caption" style={{ marginTop: "var(--space-12)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--border-subtle)" }}>{doc.foot}</div> : null}
      </article>
      <aside className="sticky hide-md" style={{ maxHeight: "calc(100vh - var(--header-h) - var(--space-10))", overflowY: "auto" }}>
        <p className="t-overline" style={{ margin: "0 0 var(--space-3)" }}>On this page</p>
        <SpyNav rail sections={nav} />
      </aside>
    </div>
  </div>;
}
