"use client";
// components/actions/{QRBlock,ShareMenu,OpenInAppBar} and components/maps/*
// of the pacr Web Design System, ported to TSX.
//
// Two deliberate changes from the kit:
// - QRBlock draws a real, scannable code (qrcode-generator) in the kit's frame;
//   the kit's version is a decorative pattern.
// - MapEmbed draws real route shapes (0–1 points) on the kit's token-coloured
//   base map; PlaceMap shows a real Google map of one place.
import { useMemo, useState, type CSSProperties } from "react";
import qrcode from "qrcode-generator";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/config";
import { Button, Icon, IconButton } from "./core";

/* QRBlock */
export function QRBlock({ value, size = 168, caption, refCode, large = false, brightnessHint = false }: { value: string; size?: number; caption?: string; refCode?: string; large?: boolean; brightnessHint?: boolean }) {
  const { n, path } = useMemo(() => {
    const qr = qrcode(0, "M"); qr.addData(value); qr.make();
    const n = qr.getModuleCount(); let p = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) p += `M${c} ${r}h1v1h-1z`;
    return { n, path: p };
  }, [value]);
  return <figure className={"pw-qr" + (large ? " pw-qr--large" : "")} style={{ margin: 0 }}>
    <div className="pw-qr__plate"><svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label={caption || "QR code"}><path d={path} fill="var(--qr-fg)" /></svg></div>
    {refCode ? <span className="pw-qr__ref">{refCode}</span> : null}
    {caption ? <figcaption className="pw-qr__cap">{caption}</figcaption> : null}
    {brightnessHint ? <span className="pw-qr__hint"><Icon name="sun" size={16} />Turn your screen brightness up</span> : null}
  </figure>;
}

/* ShareMenu: WhatsApp, copy, the phone's own share sheet */
export function ShareMenu({ open, onClose, url, title = "Share", text }: { open: boolean; onClose: () => void; url: string; title?: string; text?: string }) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const full = url.startsWith("http") ? url : `https://pacr.life${url}`;
  const copy = async () => { try { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ } };
  const more = async () => { try { await navigator.share({ title, text, url: full }); } catch { /* cancelled */ } };
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  return <><div className="pw-scrim" onClick={onClose} /><div className="pw-sheet pw-sheet--adaptive" role="dialog" aria-modal="true" aria-label={title}><div className="pw-sheet__grab" /><div className="pw-sheet__head"><h2 className="pw-sheet__title">{title}</h2><IconButton icon="x" label="Close" onClick={onClose} /></div>
    <div className="pw-sheet__body">
      <div className="pw-share" style={{ gridTemplateColumns: `repeat(${canShare ? 3 : 2}, 1fr)` }}>
        <a className="pw-share__opt" href={`https://wa.me/?text=${encodeURIComponent((text ? text + " " : "") + full)}`} target="_blank" rel="noopener"><span className="pw-share__ico"><Icon name="message-circle" size={22} /></span>WhatsApp</a>
        <button className="pw-share__opt" onClick={copy}><span className="pw-share__ico"><Icon name={copied ? "check" : "link"} size={22} /></span>{copied ? "Copied" : "Copy link"}</button>
        {canShare ? <button className="pw-share__opt" onClick={more}><span className="pw-share__ico"><Icon name="ellipsis" size={22} /></span>More</button> : null}
      </div>
      <div className="pw-share__link"><span>{full.replace(/^https:\/\//, "")}</span><Button size="sm" variant="ghost" icon={copied ? "check" : "copy"} onClick={copy}>{copied ? "Copied" : "Copy"}</Button></div>
    </div></div></>;
}

/* OpenInAppBar: "Get pacr" for phones without the app, "Open in pacr" with a deep link. */
export function storeUrl(): string {
  if (typeof navigator === "undefined") return "/download";
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) ? APP_STORE_URL : /Android/i.test(ua) ? PLAY_STORE_URL : "/download";
}
export function OpenInAppBar({ title = "Get pacr", sub = "Free on iPhone and Android", href, onDismiss, fixed = true, card = false, action = "Get" }:
  { title?: string; sub?: string; href?: string; onDismiss?: () => void; fixed?: boolean; card?: boolean; action?: string }) {
  return <div className={"pw-openapp" + (fixed ? " pw-openapp--fixed" : "") + (card ? " pw-openapp--card" : "")} role="region" aria-label="pacr app">
    {onDismiss ? <IconButton icon="x" size="sm" label="Dismiss" onClick={onDismiss} style={{ marginLeft: -6 }} /> : null}
    <span className="pw-openapp__icon" aria-hidden="true" /><span className="pw-openapp__text"><b>{title}</b><span>{sub}</span></span>
    <Button size="sm" href={href || "/download"}>{action}</Button>
  </div>;
}

/* DirectionsLink */
export function DirectionsLink({ address, lat, lng, placeId, variant = "link", label = "Directions" }: { address?: string | null; lat?: number | null; lng?: number | null; placeId?: string | null; variant?: "link" | "button"; label?: string }) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(address || "");
  const href = `https://www.google.com/maps/dir/?api=1&destination=${dest}${placeId ? `&destination_place_id=${encodeURIComponent(placeId)}` : ""}`;
  if (variant === "button") return <a className="pw-btn pw-btn--secondary pw-btn--sm" href={href} target="_blank" rel="noopener"><Icon name="navigation" size={16} />{label}</a>;
  return <a href={href} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, textDecoration: "none" }}><Icon name="navigation" size={15} />{label}<Icon name="arrow-up-right" size={14} /></a>;
}

/* MapEmbed: the kit's base map with real route shapes, pins and a live dot. */
const RATIO: Record<string, string> = { "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1 / 1", "5:2": "5 / 2", "2:1": "2 / 1" };
export type MapPoint = [number, number];
export function MapEmbed({ ratio = "16:9", route, live = false, pins = [], radius, label = "Map", style }:
  { ratio?: string; route?: MapPoint[] | null; live?: boolean; pins?: { x: number; y: number; label?: string; active?: boolean; icon?: string }[]; radius?: number | string; label?: string; style?: CSSProperties }) {
  const st = { "--ratio": RATIO[ratio] || ratio, ...(radius != null ? { "--map-r": typeof radius === "number" ? radius + "px" : radius } : {}), ...style } as CSSProperties;
  const W = 1000, H = 1000;
  const fitted = useMemo(() => fitRoute(route, ratio), [route, ratio]);
  const poly = fitted ? fitted.map(q => (q[0] * W).toFixed(1) + "," + (q[1] * H).toFixed(1)).join(" ") : "";
  const end = fitted ? fitted[fitted.length - 1] : null;
  return <div className="pw-map" style={st} role="img" aria-label={label}>
    {fitted ? <svg className="pw-map__route" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={poly} fill="none" stroke="var(--surface-1)" strokeWidth="9" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={poly} fill="none" stroke="var(--map-route)" strokeWidth="5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg> : null}
    {fitted && !live ? <span className="pw-map__dot" style={{ left: fitted[0][0] * 100 + "%", top: fitted[0][1] * 100 + "%", background: "var(--success)", animation: "none", width: 12, height: 12 }} /> : null}
    {fitted && live && end ? <span className="pw-map__dot" style={{ left: end[0] * 100 + "%", top: end[1] * 100 + "%" }} /> : null}
    {pins.map((p, i) => <span key={i} className={"pw-map__pin" + (p.active ? " pw-map__pin--active" : "")} style={{ left: p.x * 100 + "%", top: p.y * 100 + "%" }}><i><Icon name={p.icon || "map-pin"} size={p.active ? 18 : 15} strokeWidth={2} /></i>{p.label ? <span>{p.label}</span> : null}</span>)}
  </div>;
}

/** Fit 0–1 points into the frame with a margin, keeping the shape's aspect. */
function fitRoute(route: MapPoint[] | null | undefined, ratio: string): MapPoint[] | null {
  const P = (route || []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (P.length < 2) return null;
  const [rw, rh] = (RATIO[ratio] || "16 / 9").split("/").map(Number);
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1e-6, h = maxY - minY || 1e-6;
  const m = 0.12, boxW = rw, boxH = rh;
  const s = Math.min((boxW * (1 - 2 * m)) / w, (boxH * (1 - 2 * m)) / h);
  const ox = (boxW - w * s) / 2, oy = (boxH - h * s) / 2;
  return P.map(([x, y]) => [((x - minX) * s + ox) / boxW, ((y - minY) * s + oy) / boxH]);
}

/** A real map of one place (Google's keyless embed), with the kit's failed state. */
export function PlaceMap({ lat, lng, label, ratio = "16:9" }: { lat?: number | null; lng?: number | null; label?: string | null; ratio?: string }) {
  if (lat == null || lng == null) return <div className="pw-map pw-map--failed" style={{ "--ratio": RATIO[ratio] || ratio } as CSSProperties}><div className="pw-map__fail"><Icon name="map-pinned" size={28} /><b style={{ color: "var(--text-primary)" }}>No pin for this place</b>{label ? <span>{label}</span> : null}</div></div>;
  return <div className="pw-map" style={{ "--ratio": RATIO[ratio] || ratio, backgroundImage: "none" } as CSSProperties}>
    <iframe title={label ? `Map: ${label}` : "Map"} src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
  </div>;
}
