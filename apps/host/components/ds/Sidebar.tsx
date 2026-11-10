"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./Avatar";

export type SidebarItem =
  | { section: string }
  | { id: string; label: string; icon: IconName; href?: string; badge?: number | string | null; locked?: boolean };

export interface SidebarUser {
  name: string;
  role?: ReactNode;
  src?: string;
}

export interface SidebarProps {
  items?: SidebarItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  collapsed?: boolean;
  brandTag?: ReactNode;
  logo?: ReactNode;
  logoMark?: ReactNode;
  header?: ReactNode;
  user?: SidebarUser;
  footer?: ReactNode;
  footerAction?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Sidebar({ items = [], activeId, onSelect, collapsed = false, brandTag = "host", logo, logoMark, header, user, footer, footerAction, className = "", style }: SidebarProps) {
  return (
    <aside className={"pc-sidebar" + (collapsed ? " is-collapsed" : "") + (className ? " " + className : "")} style={style}>
      <div className="pc-sidebar__brand" style={collapsed ? { justifyContent: "center", padding: "0 0 14px" } : undefined}>
        {logo ? (collapsed ? (logoMark || logo) : logo) : <span className="pc-wordmark" style={collapsed ? { fontSize: 22 } : undefined}>{collapsed ? "p" : "pacr"}</span>}
        {brandTag ? <span className="pc-sidebar__tag">{brandTag}</span> : null}
      </div>
      {header ? <div className="pc-sidebar__header">{header}</div> : null}
      <nav className="pc-sidebar__nav">
        {items.map((it, i) => {
          if ("section" in it) return <div key={"s" + i} className="pc-sidebar__section">{it.section}</div>;
          const cls = "pc-nav" + (it.id === activeId ? " is-active" : "") + (it.locked ? " is-locked" : "");
          const title = collapsed ? it.label + (it.locked ? " (not available for your role)" : "") : it.locked ? "Not available for your role" : undefined;
          const current = it.id === activeId ? "page" : undefined;
          const onClick = () => { if (onSelect) onSelect(it.id); };
          const kids = (
            <>
              <span className="pc-nav__icon"><Icon name={it.icon} size={18} /></span>
              <span className="pc-nav__label">{it.label}</span>
              {it.locked ? <span className="pc-nav__lock"><Icon name="lock" size={13} /></span> : it.badge != null && it.badge !== 0 ? <span className="pc-nav__badge">{it.badge}</span> : null}
            </>
          );
          return it.href ? (
            <Link key={it.id} href={it.href} className={cls} title={title} onClick={onClick} aria-current={current}>{kids}</Link>
          ) : (
            <button key={it.id} type="button" className={cls} title={title} onClick={onClick} aria-current={current}>{kids}</button>
          );
        })}
      </nav>
      {footer ? footer : null}
      {user ? (
        <div className="pc-sidebar__foot" style={collapsed ? { justifyContent: "center", padding: 8 } : undefined}>
          <Avatar name={user.name} src={user.src} size={34} />
          <div className="pc-sidebar__foot-text">
            <span className="pc-sidebar__foot-name">{user.name}</span>
            {user.role ? <span className="pc-sidebar__foot-role">{user.role}</span> : null}
          </div>
          {!collapsed ? footerAction : null}
        </div>
      ) : null}
    </aside>
  );
}
