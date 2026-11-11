"use client";
// components/navigation/* and components/actions/StoreBadges of the pacr Web
// Design System, ported to TSX. The header and footer list only pages that
// exist; the kit's /app, /hosts, /about pages aren't built yet.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { APP_STORE_URL, INSTAGRAM_URL, PLAY_STORE_URL } from "@/lib/config";
import { Avatar, Button, Icon, IconButton, Logo } from "./core";
import { useEscape } from "./feedback";

/* StoreBadges: Apple's and Google's own badge artwork (the kit's Lucide glyphs are stand-ins). */
export function StoreBadges({ size = "md" }: { size?: "sm" | "md" }) {
  const h = size === "sm" ? 40 : 48;
  return <div className={"pw-stores" + (size === "sm" ? " pw-stores--sm" : "")}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <a href={APP_STORE_URL} aria-label="Download on the App Store"><img src="/badges/app-store.svg" alt="Download on the App Store" height={h} style={{ height: h, width: "auto" }} /></a>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <a href={PLAY_STORE_URL} aria-label="Get it on Google Play"><img src="/badges/google-play.png" alt="Get it on Google Play" height={h} style={{ height: h, width: "auto" }} /></a>
  </div>;
}

/* CityButton + CityPicker */
export function CityButton({ city, onClick, inline = false }: { city: string; onClick?: () => void; inline?: boolean }) {
  return <button className={"pw-city" + (inline ? " pw-city--inline" : "")} onClick={onClick} aria-haspopup="dialog">{!inline && <Icon name="map-pin" size={16} />}{city}<Icon name="chevron-down" size={inline ? "0.6em" : 16} strokeWidth={inline ? 2.5 : 1.75} /></button>;
}
export type CityOption = { id: string; name: string; meta?: string };
export function CityPicker({ open, city, cities, onSelect, onClose }: { open: boolean; city: string; cities: CityOption[]; onSelect: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  useEscape(open, onClose);
  if (!open) return null;
  const list = cities.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
  return <>
    <div className="pw-scrim" onClick={onClose} />
    <div className="pw-sheet pw-sheet--adaptive" role="dialog" aria-modal="true" aria-label="Choose your city">
      <div className="pw-sheet__grab" />
      <div className="pw-sheet__head"><h2 className="pw-sheet__title">Choose your city</h2><IconButton icon="x" label="Close" onClick={onClose} /></div>
      <div className="pw-sheet__body">
        <label className="pw-field__box" style={{ marginBottom: 8 }}><Icon name="search" size={18} /><input className="pw-field__input" placeholder="Search cities" value={q} onChange={e => setQ(e.target.value)} autoFocus /></label>
        <div role="listbox" aria-label="Cities">{list.map(c => <button key={c.id} role="option" aria-selected={c.id === city} className="pw-listrow" onClick={() => onSelect(c.id)}>{c.name}
          <span className="pw-listrow__meta" style={c.id === city ? { color: "var(--accent-text)" } : undefined}>{c.id === city ? <Icon name="check" size={18} /> : c.meta}</span></button>)}
          {!list.length && <p className="t-caption" style={{ padding: 12 }}>pacr isn&apos;t in &quot;{q}&quot; yet.</p>}</div>
      </div>
    </div>
  </>;
}

/* Menu */
export type MenuItem = { id: string; label: string; icon?: string; meta?: string; danger?: boolean } | "-";
export function Menu({ open, onClose, items, onSelect, align = "right", header, children }: { open: boolean; onClose: () => void; items: MenuItem[]; onSelect: (id: string) => void; align?: "left" | "right"; header?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEscape(open, onClose);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onClose]);
  return <span className="pw-menu-wrap" ref={ref}>{children}
    {open ? <div className={"pw-menu pw-menu--" + align} role="menu">{header ? <><div className="pw-menu__head">{header}</div><div className="pw-menu__sep" /></> : null}
      {items.map((it, i) => it === "-" ? <div key={i} className="pw-menu__sep" /> : <button key={it.id} role="menuitem" className={"pw-listrow" + (it.danger ? " pw-listrow--danger" : "")} onClick={() => onSelect(it.id)}>{it.icon ? <Icon name={it.icon} size={18} /> : null}{it.label}{it.meta ? <span className="pw-listrow__meta">{it.meta}</span> : null}</button>)}
    </div> : null}</span>;
}

/* Header */
export const SITE_NAV: [string, string, string][] = [["squads", "Squads", "/clubs"], ["runs", "Runs", "/runs"], ["events", "Events", "/events"], ["app", "App", "/download"], ["hosts", "For hosts", "/host"]];
export type HeaderUser = { name: string; handle?: string | null; avatar?: string | null };
export function SiteHeader({ active, cityName, onCity, onMenu, user, onAvatarAction }:
  { active?: string; cityName: string; onCity: () => void; onMenu: () => void; user: HeaderUser | null; onAvatarAction: (id: string) => void }) {
  const [menu, setMenu] = useState(false);
  const items: MenuItem[] = [{ id: "feed", label: "Feed", icon: "newspaper" }, { id: "profile", label: "Profile", icon: "user-round" }, { id: "host", label: "Host dashboard", icon: "layout-dashboard", meta: "/host" }, "-", { id: "signout", label: "Sign out", icon: "log-out" }];
  return (
    <header className="pw-header">
      <div className="pw-container pw-header__in">
        <Logo height={26} href="/" />
        <span className="pw-header__d"><CityButton city={cityName} onClick={onCity} /></span>
        <nav className="pw-header__nav" aria-label="Main">
          {SITE_NAV.map(([id, l, h]) => <a key={id} className="pw-header__link" href={h} aria-current={active === id ? "page" : undefined}>{l}</a>)}
        </nav>
        <span className="pw-header__spacer" />
        <div className="pw-header__actions">
          {user ? <span className="pw-header__d">
            <Menu open={menu} onClose={() => setMenu(false)} align="right" items={items} onSelect={id => { setMenu(false); onAvatarAction(id); }}
              header={<div><div style={{ fontWeight: 600 }}>{user.name}</div>{user.handle ? <div className="t-caption">@{user.handle}</div> : null}</div>}>
              <button className="pw-header__avatar" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Avatar name={user.name} src={user.avatar} size={32} /><Icon name="chevron-down" size={16} /></button>
            </Menu>
          </span> : <span className="pw-header__d"><Button variant="ghost" size="sm" href="/signin">Sign in</Button></span>}
          <Button size="sm" href="/download">Get the app</Button>
          <IconButton className="pw-header__menu" icon="menu" label="Menu" onClick={onMenu} />
        </div>
      </div>
    </header>
  );
}

/* MobileMenuSheet */
const MOBILE: [string, string, string][] = [["squads", "Squads", "/clubs"], ["runs", "Runs this week", "/runs"], ["events", "Events", "/events"], ["app", "The app", "/download"], ["hosts", "For hosts", "/host"], ["safety", "Community rules", "/community-rules"]];
export function MobileMenuSheet({ open, onClose, active, cityName, onCity, user, onSignOut }:
  { open: boolean; onClose: () => void; active?: string; cityName: string; onCity: () => void; user: HeaderUser | null; onSignOut: () => void }) {
  useEscape(open, onClose);
  if (!open) return null;
  return <div className="pw-sheet pw-sheet--full" role="dialog" aria-modal="true" aria-label="Menu" style={{ zIndex: "var(--z-dialog)" }}>
    <div className="pw-sheet__head" style={{ height: "var(--header-h)", padding: "0 var(--space-3) 0 var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}><span style={{ flex: 1 }}><Logo height={26} /></span><IconButton icon="x" label="Close menu" onClick={onClose} /></div>
    <div className="pw-sheet__body" style={{ padding: "var(--space-4)", flex: 1 }}>
      <button className="pw-listrow" onClick={onCity} style={{ marginBottom: 8, background: "var(--surface-2)" }}><Icon name="map-pin" /><span>City</span><span className="pw-listrow__meta" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{cityName}</span><Icon name="chevron-right" size={18} /></button>
      {MOBILE.map(([id, l, h]) => <a key={id} href={h} className="pw-listrow pw-listrow--big" aria-current={active === id ? "page" : undefined}>{l}</a>)}
      {user ? <><a href="/feed" className="pw-listrow pw-listrow--big">Feed</a><a href="/profile" className="pw-listrow pw-listrow--big">Profile</a></> : null}
    </div>
    <div className="pw-sheet__foot"><Button block size="lg" href="/download">Get the app</Button>
      {user ? <Button block size="lg" variant="secondary" onClick={onSignOut}>Sign out</Button> : <Button block size="lg" variant="secondary" href="/signin">Sign in</Button>}</div>
  </div>;
}

/* Footer */
export function SiteFooter({ cities }: { cities: CityOption[] }) {
  const cols: [string, [string, string][]][] = [
    ["Squads by city", cities.map(c => [c.name, "/clubs/" + c.id])],
    ["Events by city", cities.map(c => [c.name, "/events/" + c.id])],
    ["The app", [["Download", "/download"], ["Runs this week", "/runs"]]],
    ["For hosts", [["Open dashboard", "/host"], ["Ask to host events", "/host/apply"]]],
    ["Help and legal", [["Help", "/support"], ["Community rules", "/community-rules"], ["Privacy", "/privacy"], ["Terms", "/terms"]]],
  ];
  return <footer className="pw-footer"><div className="pw-container">
    <div className="pw-footer__top">
      <div className="pw-footer__brand"><Logo height={30} /><p className="t-body-s t-secondary" style={{ margin: 0, maxWidth: 260 }}>Find your people. Run with squads in your city.</p><StoreBadges size="sm" /></div>
      <div className="pw-footer__links">
        {cols.map(([h, ls]) => <div key={h}><h4>{h}</h4><ul>{ls.map(([l, href]) => <li key={href}><a href={href}>{l}</a></li>)}</ul></div>)}
      </div>
    </div>
    <div className="pw-footer__bottom"><span>© {new Date().getFullYear()} pacr</span><div className="pw-footer__social"><IconButton icon="instagram" label="pacr on Instagram" size="sm" href={INSTAGRAM_URL} /></div></div>
  </div></footer>;
}

/* Breadcrumbs, Tabs, SegmentedControl, LoadMore */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return <nav aria-label="Breadcrumb"><ol className="pw-crumbs">{items.map((it, i) => <li key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
    {i > 0 && <Icon name="chevron-right" size={14} />}{i === items.length - 1 ? <span aria-current="page">{it.label}</span> : <a href={it.href || "#"}>{it.label}</a>}</li>)}</ol></nav>;
}
export function Tabs({ tabs, value, onChange, variant = "underline" }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void; variant?: "underline" | "pill" }) {
  return <div className={"pw-tabs" + (variant === "pill" ? " pw-tabs--pill" : "")} role="tablist">
    {tabs.map(t => <button key={t.id} role="tab" aria-selected={value === t.id} className="pw-tab" onClick={() => onChange(t.id)}>{t.label}{t.count != null ? <span className="pw-tab__count">{t.count}</span> : null}</button>)}
  </div>;
}
export function SegmentedControl({ options, value, onChange, size = "md", label }: { options: { id: string; label: string; icon?: string }[]; value: string; onChange: (id: string) => void; size?: "sm" | "md"; label?: string }) {
  return <div className={"pw-seg" + (size === "sm" ? " pw-seg--sm" : "")} role="radiogroup" aria-label={label}>
    {options.map(op => <button key={op.id} role="radio" aria-checked={value === op.id} className="pw-seg__opt" onClick={() => onChange(op.id)}>{op.icon ? <Icon name={op.icon} size={16} /> : null}{op.label}</button>)}
  </div>;
}
export function LoadMore({ onClick, loading = false, hasMore = true, label = "Load more", endLabel = "That's everything" }: { onClick: () => void; loading?: boolean; hasMore?: boolean; label?: string; endLabel?: string }) {
  return <div className="pw-loadmore">{hasMore ? <Button variant="secondary" loading={loading} onClick={onClick}>{loading ? "Loading" : label}</Button> : <span className="t-caption">{endLabel}</span>}</div>;
}
