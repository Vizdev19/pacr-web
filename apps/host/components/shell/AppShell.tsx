"use client";

// The dashboard shell (ui_kits/host/Shell.jsx): white sidebar with the host
// switcher and grouped nav, a sticky topbar with breadcrumbs, search, Create
// and the profile menu. Under 1100px the sidebar is an icon rail; under 720px
// it becomes a menu sheet.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, Badge, Button, EmptyState, HostSwitcher, Icon, IconButton, Input, Sidebar, type IconName, type SidebarItem } from "@/components/ds";
import { signOut } from "@/lib/api";
import { hostOptions, isStaff, useHost, type Host } from "@/lib/host";
import { useViewport } from "@/lib/hooks";
import { eventNewHref, organizerApplyHref } from "@/lib/refs";
import { goSite } from "@/lib/supabase";
import { LOCKED, ORDER, PAGES, WHO, pageOf, type PageId } from "./nav";

export function Popover({ open, onClose, children, align = "right", width = 260 }: {
  open: boolean; onClose: () => void; children: ReactNode; align?: "left" | "right"; width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const t = window.setTimeout(() => document.addEventListener("mousedown", f), 0);
    return () => { window.clearTimeout(t); document.removeEventListener("mousedown", f); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className="shell-popover" style={{ [align]: 0, width }}>{children}</div>
  );
}
export function MenuItem({ icon, label, sub, onClick, href, danger }: {
  icon?: IconName; label: string; sub?: string; onClick?: () => void; href?: string; danger?: boolean;
}) {
  const inner = (
    <>
      {icon ? <Icon name={icon} size={16} /> : null}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", font: "400 13px/1.2 var(--font-sans)" }}>{label}</span>
        {sub ? <span style={{ display: "block", font: "var(--type-caption)", color: "var(--text-muted)", marginTop: 2 }}>{sub}</span> : null}
      </span>
    </>
  );
  const cls = "shell-menuitem" + (danger ? " is-danger" : "");
  // Links here leave the dashboard for the static site (/host/new, /profile), so they are plain anchors.
  return href ? <a className={cls} href={href} onClick={onClick}>{inner}</a> : <button type="button" className={cls} onClick={onClick}>{inner}</button>;
}

function navItems(host: Host, counts: { requests: number; reports: number }): SidebarItem[] {
  const locked = LOCKED[host.roleKey];
  const badge: Partial<Record<PageId, number>> = { requests: counts.requests, moderation: counts.reports };
  return ORDER.map(k => {
    if (!(k in PAGES)) return { section: k };
    const id = k as PageId, p = PAGES[id], isLocked = locked.includes(id);
    return { id, label: p.label, icon: p.icon, href: p.href, locked: isLocked, badge: isLocked ? null : badge[id] ?? null };
  });
}

function SideNav({ page, collapsed, onNavigate }: { page: PageId; collapsed?: boolean; onNavigate?: () => void }) {
  const { hosts, host, setHost, counts, notify } = useHost();
  const router = useRouter();
  return (
    <Sidebar items={navItems(host, counts)} activeId={page} onSelect={onNavigate} collapsed={collapsed} brandTag="host"
      logo={<Image src="/host/logo-dark.png" alt="pacr" width={63} height={28} unoptimized priority />}
      logoMark={<Image src="/host/logo-mark-dark.png" alt="pacr" width={21} height={28} unoptimized priority />}
      header={
        <HostSwitcher hosts={hostOptions(hosts)} value={host.key}
          onChange={key => {
            const next = hosts.find(h => h.key === key);
            if (!next || next.key === host.key) return;
            setHost(key);
            onNavigate?.();
            // A page the new role can't open would only show a locked panel: start at Overview.
            if (LOCKED[next.roleKey].includes(page)) router.push("/");
            notify("neutral", `Switched to ${next.name}`, `You’re ${next.role.toLowerCase()} here.`);
          }}
          footer={<a className="pc-hostsw__opt shell-hostsw-foot" href={organizerApplyHref}><Icon name="plus" size={15} />Apply as an organizer</a>} />
      }
      footer={!collapsed && host.kind === "squad" ? (
        <a className="shell-appcard" href="/download">
          <div style={{ display: "flex", justifyContent: "space-between", font: "500 13px var(--font-sans)", color: "var(--text-strong)" }}>Phone app<Icon name="smartphone" size={15} /></div>
          <div style={{ font: "var(--type-caption)", color: "var(--text-muted)", marginTop: 4 }}>Check in runners at the start line by scanning their QR.</div>
        </a>
      ) : null}
      style={{ height: "100%" }} />
  );
}

function Topbar({ page, onMenu }: { page: PageId; onMenu: () => void }) {
  const { me, host, greeting } = useHost();
  const { phone, tablet } = useViewport();
  const router = useRouter();
  const [menu, setMenu] = useState<"create" | "me" | null>(null);
  const [q, setQ] = useState("");
  const tog = (k: "create" | "me") => setMenu(m => (m === k ? null : k));
  const close = () => setMenu(null);
  const p = PAGES[page];
  const title = page === "overview" ? greeting : p.label;
  const crumbs = [host.name, ...(p.group ? [p.group] : []), p.label];
  const squad = host.kind === "squad";
  const canMembers = squad && isStaff(host.roleKey);
  const canHostEvents = host.kind === "organizer" ? host.status === "approved" : host.verified;
  return (
    <header className="shell-topbar">
      {phone ? <IconButton icon="menu" label="Menu" variant="secondary" onClick={onMenu} /> : null}
      <div style={{ minWidth: 0, flex: "0 1 auto" }}>
        {!phone ? (
          <div className="shell-crumbs">
            {crumbs.map((c, i) => <span key={i} className="shell-crumb">{i ? <Icon name="chevron-right" size={12} /> : null}<span style={i === crumbs.length - 1 ? { color: "var(--text-body)" } : undefined}>{c}</span></span>)}
          </div>
        ) : null}
        <h1 className="shell-title">{title}</h1>
      </div>
      <div style={{ flex: 1 }} />
      {canMembers && !phone ? (
        <form onSubmit={e => { e.preventDefault(); if (q.trim()) router.push(`/members?q=${encodeURIComponent(q.trim())}`); }}>
          <Input icon="search" placeholder="Search members" aria-label="Search members" value={q} onChange={e => setQ(e.target.value)} style={{ width: tablet ? 200 : "min(320px, 26vw)" }} />
        </form>
      ) : null}
      <div style={{ position: "relative" }}>
        {phone ? <IconButton icon="plus" label="Create" variant="primary" onClick={() => tog("create")} /> : <Button icon="plus" iconRight="chevron-down" onClick={() => tog("create")}>Create</Button>}
        <Popover open={menu === "create"} onClose={close} width={270}>
          {squad ? <MenuItem icon="footprints" label="Schedule run" sub="One-off or every week" onClick={() => { close(); router.push("/runs?new=1"); }} /> : null}
          {canHostEvents
            ? <MenuItem icon="ticket" label="Create event" sub="Ticketed or free" href={eventNewHref} onClick={close} />
            : <MenuItem icon="ticket" label="Create event" sub={squad ? "Only verified squads host events" : "Opens once you’re approved"} onClick={() => { close(); router.push("/settings"); }} />}
          {canMembers ? <MenuItem icon="megaphone" label="New announcement" sub="Push to every member" onClick={() => { close(); router.push("/messages?new=1"); }} /> : null}
        </Popover>
      </div>
      <div style={{ position: "relative" }}>
        <button type="button" className="shell-me" onClick={() => tog("me")} aria-label="Your account">
          <Avatar name={me.name} src={me.avatarUrl} size={30} />
          {!phone && !tablet ? (
            <span style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left", whiteSpace: "nowrap" }}>
              <span style={{ font: "500 13px/1 var(--font-sans)", color: "var(--text-strong)" }}>{me.name}</span>
              {me.handle ? <span style={{ font: "400 11px/1 var(--font-sans)", color: "var(--text-muted)" }}>@{me.handle}</span> : null}
            </span>
          ) : null}
          <Icon name="chevron-down" size={14} color="var(--text-muted)" />
        </button>
        <Popover open={menu === "me"} onClose={close} width={230}>
          <MenuItem icon="user" label="Your profile" href="/profile" onClick={close} />
          <MenuItem icon="smartphone" label="Get the phone app" sub="Check-in and quick approvals" href="/download" onClick={close} />
          <div style={{ height: 1, background: "var(--border-subtle)", margin: "6px -6px" }} />
          <MenuItem icon="log-out" label="Sign out" onClick={async () => { close(); await signOut(); goSite("/"); }} />
        </Popover>
      </div>
    </header>
  );
}

function LockedPage({ page }: { page: PageId }) {
  const { host } = useHost();
  const router = useRouter();
  return (
    <div style={{ maxWidth: 640, margin: "40px auto" }}>
      <EmptyState variant="locked" title={`${PAGES[page].label} isn’t part of your role here`}
        message={`${WHO[host.roleKey] ?? ""}${host.kind === "squad" ? " Ask the squad’s owner if you need access." : ""}`}
        secondaryAction={{ label: "Back to overview", icon: "arrow-left", onClick: () => router.push("/") }} />
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14, font: "var(--type-caption)", color: "var(--text-muted)" }}>
        You’re signed in as <Badge tone="neutral">{host.role}</Badge> in {host.name}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { host } = useHost();
  const page = pageOf(usePathname());
  const { phone, tablet } = useViewport();
  const [sheet, setSheet] = useState(false);
  const locked = LOCKED[host.roleKey].includes(page);
  return (
    <div className="shell">
      {!phone ? <div className="shell-side"><SideNav page={page} collapsed={tablet} /></div> : null}
      {phone && sheet ? (
        <>
          <div className="pc-drawer-scrim" onClick={() => setSheet(false)} />
          <div className="shell-sheet">
            <div style={{ position: "absolute", right: 10, top: 14, zIndex: 2 }}><IconButton icon="x" label="Close menu" variant="ghost" size="sm" onClick={() => setSheet(false)} /></div>
            <SideNav page={page} onNavigate={() => setSheet(false)} />
          </div>
        </>
      ) : null}
      <div className="shell-main">
        <Topbar page={page} onMenu={() => setSheet(true)} />
        {/* Keyed by page and host, so switching either starts the page fresh. */}
        <main key={page + host.key} className="shell-content">{locked ? <LockedPage page={page} /> : children}</main>
      </div>
    </div>
  );
}
