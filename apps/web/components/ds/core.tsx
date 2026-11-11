// components/core/* of the pacr Web Design System, ported to TSX.
// Markup and pw- classes match the kit; styles come from
// design-system/components/core/core.css.
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from "react";
import { ICONS } from "./icons";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* Icon */
export type IconProps = {
  name: string; size?: number | string; strokeWidth?: number; color?: string; fill?: string;
  className?: string; style?: CSSProperties; title?: string;
};
export function Icon({ name, size = 20, strokeWidth = 1.75, color = "currentColor", fill = "none", className, style, title }: IconProps) {
  const C = ICONS[name];
  if (!C) {
    if (process.env.NODE_ENV !== "production") console.warn(`Icon "${name}" isn't in components/ds/icons.ts`);
    return null;
  }
  return <C className={cx("pw-icon", className)} size={size} strokeWidth={strokeWidth} color={color} fill={fill}
    style={style} aria-hidden={title ? undefined : true} aria-label={title} role={title ? "img" : undefined} />;
}

/* Button */
type BtnBase = {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "inverse"; size?: "sm" | "md" | "lg";
  icon?: string; iconRight?: string; loading?: boolean; block?: boolean; className?: string; children?: ReactNode;
};
export type ButtonProps = BtnBase & ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement> | { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>);
export function Button({ variant = "primary", size = "md", icon, iconRight, loading = false, block = false, className, children, ...rest }: ButtonProps) {
  const cls = cx("pw-btn", "pw-btn--" + variant, size !== "md" && "pw-btn--" + size, block && "pw-btn--block", loading && "is-loading", className);
  const is = size === "lg" ? 20 : 18;
  const inner = <>{loading ? <span className="pw-spinner" /> : icon ? <Icon name={icon} size={is} /> : null}{children != null && <span>{children}</span>}{iconRight && !loading ? <Icon name={iconRight} size={is} /> : null}</>;
  if ("href" in rest && rest.href) {
    const a = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return <a className={cls} {...a}>{inner}</a>;
  }
  const b = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return <button type="button" className={cls} {...b} disabled={b.disabled || loading} aria-busy={loading || undefined}>{inner}</button>;
}

/* IconButton */
type IconBtnBase = {
  icon: string; label: string; variant?: "ghost" | "secondary" | "primary" | "overlay"; size?: "sm" | "md";
  square?: boolean; dot?: boolean; count?: number; className?: string;
};
export type IconButtonProps = IconBtnBase & ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> | { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>);
export function IconButton({ icon, label, variant = "ghost", size = "md", square = false, dot = false, count, className, ...rest }: IconButtonProps) {
  const cls = cx("pw-iconbtn", variant !== "ghost" && "pw-iconbtn--" + variant, size === "sm" && "pw-iconbtn--sm", square && "pw-iconbtn--square", className);
  const inner = <><Icon name={icon} size={size === "sm" ? 18 : 20} />{dot && !count ? <span className="pw-iconbtn__dot" /> : null}{count ? <span className="pw-iconbtn__count">{count > 99 ? "99+" : count}</span> : null}</>;
  if ("href" in rest && rest.href) return <a className={cls} aria-label={label} title={label} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>{inner}</a>;
  return <button type="button" className={cls} aria-label={label} title={label} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>{inner}</button>;
}

/* Badge */
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "live" | "verified";
export function Badge({ tone = "neutral", variant = "soft", size = "md", icon, dot = false, className, children, ...rest }:
  { tone?: Tone; variant?: "soft" | "solid" | "outline" | "overlay"; size?: "sm" | "md" | "lg"; icon?: string; dot?: boolean } & HTMLAttributes<HTMLSpanElement>) {
  const cls = cx("pw-badge", "pw-badge--" + tone, variant !== "soft" && "pw-badge--" + variant, size !== "md" && "pw-badge--" + size, className);
  return <span className={cls} {...rest}>{dot ? <span className="pw-badge__dot" /> : null}{icon ? <Icon name={icon} size={size === "sm" ? 12 : 14} strokeWidth={2} /> : null}{children}</span>;
}

/* TrustTag */
const KINDS: Record<string, [Tone, string | null, string, boolean?]> = {
  "verified": ["verified", "badge-check", "Verified"],
  "women-only": ["accent", "shield-check", "Women only"],
  "open": ["success", "door-open", "Open to join"],
  "ask": ["neutral", "message-circle-question", "Ask to join"],
  "invite": ["neutral", "lock", "Invite only"],
  "live": ["live", null, "Live", true],
  "checkin-open": ["live", "scan-line", "Check-in open"],
  "cancelled": ["danger", "ban", "Cancelled"],
  "sold-out": ["neutral", null, "Sold out"],
  "few-left": ["warning", "hourglass", "Few left"],
  "request-sent": ["info", "clock", "Request sent"],
  "checked-in": ["success", "circle-check", "Checked in"],
  "going": ["success", "check", "Going"],
  "repeats": ["neutral", "repeat", "Repeats weekly"],
  "free": ["success", null, "Free"],
  "owner": ["neutral", "crown", "Owner"],
  "organiser": ["neutral", "star", "Organiser"],
  "run-leader": ["neutral", "flag", "Run leader"],
  "private": ["neutral", "lock", "Private"],
};
export function TrustTag({ kind, size = "md", variant, children }: { kind: string; size?: "sm" | "md" | "lg"; variant?: "soft" | "solid" | "outline" | "overlay"; children?: ReactNode }) {
  const k = KINDS[kind] || ["neutral", null, kind];
  return <Badge tone={k[0]} icon={k[1] || undefined} dot={!!k[3]} size={size} variant={variant || (kind === "sold-out" ? "solid" : "soft")}>{children || k[2]}</Badge>;
}

/* VerifiedMark */
export function VerifiedMark({ size = 16, label = "Verified" }: { size?: number; label?: string }) {
  return <span className="pw-verified" role="img" aria-label={label} title={label}><Icon name="badge-check" size={size} strokeWidth={2} fill="currentColor" color="var(--surface-1)" /></span>;
}

/* Avatar */
const TONES = ["--data-1", "--data-2", "--data-3", "--data-4", "--data-5", "--data-6"];
export function initials(n: string): string {
  const p = String(n || "?").trim().split(/\s+/);
  return ((p[0] || "")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function hash(s: string) { let h = 0; for (const c of String(s || "")) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
export function Avatar({ name, src, alt, size = 40, ring = false, className, style }: { name: string; src?: string | null; alt?: string; size?: number; ring?: boolean; className?: string; style?: CSSProperties }) {
  const t = TONES[hash(name) % TONES.length];
  const st = { "--s": size + "px", "--av-bg": `color-mix(in oklab, var(${t}) 20%, var(--surface-1))`, "--av-fg": `color-mix(in oklab, var(${t}), var(--text-primary) 45%)`, ...style } as CSSProperties;
  return <span className={cx("pw-avatar", ring && "pw-avatar--ring", className)} style={st} role="img" aria-label={alt || name}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {src ? <img src={src} alt="" loading="lazy" /> : initials(name)}</span>;
}
export function AvatarGroup({ names = [], max = 4, size = 28, total }: { names?: string[]; max?: number; size?: number; total?: number }) {
  const shown = names.slice(0, max); const extra = (total != null ? total : names.length) - shown.length;
  return <span className="pw-avatar-group" style={{ "--s": size + "px" } as CSSProperties}>{shown.map((n, i) => <Avatar key={i} name={n} size={size} />)}{extra > 0 ? <span className="pw-avatar-group__more">+{extra}</span> : null}</span>;
}

/* Media */
const R: Record<string, string> = { "5:2": "5 / 2", "4:5": "4 / 5", "2:3": "2 / 3", "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1 / 1", "9:16": "9 / 16", og: "1200 / 630" };
export function Media({ ratio = "4:3", src, alt = "", label, tile = false, radius, className, style, children }:
  { ratio?: string; src?: string | null; alt?: string; label?: string | null; tile?: boolean; radius?: number | string; className?: string; style?: CSSProperties; children?: ReactNode }) {
  const st = { "--ratio": R[ratio] || ratio, ...(radius != null ? { "--media-r": typeof radius === "number" ? radius + "px" : radius } : {}), ...style } as CSSProperties;
  return <div className={cx("pw-media", tile && "pw-media--tile", className)} style={st}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {src ? <img src={src} alt={alt} loading="lazy" decoding="async" /> : <div className="pw-media__ph" role="img" aria-label={alt || label || undefined}>{!tile && <Icon name="image" size={20} />}{label && !tile ? <span>{label}</span> : null}</div>}
    {children}</div>;
}

/* Logo */
export function Logo({ height = 28, tone = "auto", href, className }: { height?: number; tone?: "auto" | "on-light" | "on-dark" | "mono-black" | "mono-white"; href?: string; className?: string }) {
  const el = <span className={cx("pw-logo", tone !== "auto" && "pw-logo--" + tone, className)} style={{ "--logo-h": height + "px" } as CSSProperties} role="img" aria-label="pacr" />;
  return href ? <a href={href} aria-label="pacr home" style={{ display: "inline-flex" }}>{el}</a> : el;
}

/* Card */
export function Card({ variant = "outline", pad = true, interactive = false, href, className, children, style }:
  { variant?: "outline" | "flat" | "raised"; pad?: boolean; interactive?: boolean; href?: string; className?: string; children?: ReactNode; style?: CSSProperties }) {
  const cls = cx("pw-card", variant !== "outline" && "pw-card--" + variant, pad && "pw-card--pad", (interactive || href) && "pw-card--interactive", className);
  return href ? <a className={cls} href={href} style={style}>{children}</a> : <div className={cls} style={style}>{children}</div>;
}
