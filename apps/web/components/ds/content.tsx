"use client";
// components/content/* (DateTile, SquadCard, RunCard, EventCard) and
// components/data/WeekList, plus the post, comment, runner, stat, achievement,
// order, ticket and live-run components, of the pacr Web Design System, ported to TSX.
import { useState, type CSSProperties, type ReactNode } from "react";
import { Avatar, AvatarGroup, Badge, Button, Card, Icon, IconButton, Media, TrustTag, VerifiedMark } from "./core";
import { MapEmbed, QRBlock, type MapPoint } from "./actions";
import { Menu, type MenuItem } from "./nav";

/* DateTile */
export function DateTile({ dow, day, month, time, today = false, size = "md" }: { dow: string; day: string; month: string; time?: string; today?: boolean; size?: "sm" | "md" }) {
  return <div className={"pw-datetile" + (today ? " pw-datetile--today" : "") + (size === "sm" ? " pw-datetile--sm" : "")} aria-label={[dow, day, month, time].filter(Boolean).join(" ")}>
    <span className="pw-datetile__dow">{today ? "Today" : dow}</span><span className="pw-datetile__d">{day}</span><span className="pw-datetile__m">{month}</span>{time ? <span className="pw-datetile__t">{time}</span> : null}</div>;
}

/* SquadCard */
export type SquadCardProps = {
  layout?: "grid" | "row"; name: string; href?: string; cover?: string | null; photo?: string | null; verified?: boolean;
  area?: string | null; city?: string | null; members?: number | null; nextRun?: string | null; womenOnly?: boolean;
  policy?: "open" | "ask" | "invite" | null; children?: ReactNode;
};
export function SquadCard({ layout = "grid", name, href, cover, photo, verified = false, area, city, members, nextRun, womenOnly = false, policy = "open", children }: SquadCardProps) {
  const where = [area, city].filter(Boolean).join(", ");
  const count = members != null ? members.toLocaleString("en-IN") + (members === 1 ? " member" : " members") : null;
  const tags = <div className="pw-tags">{policy ? <TrustTag kind={policy} size="sm" /> : null}{womenOnly ? <TrustTag kind="women-only" size="sm" /> : null}</div>;
  if (layout === "row") return <Card href={href} pad={false} interactive className="pw-squad pw-squad--row">
    <div className="pw-squad__tile"><Media ratio="1:1" tile src={photo} alt="" /></div>
    <div className="pw-squad__body"><h3 className="pw-squad__name">{name}{verified ? <VerifiedMark /> : null}</h3>
      <div className="pw-meta" style={{ fontSize: 13.5 }}><span>{where}</span>{count ? <span className="pw-dotsep">{count}</span> : null}</div>
      {nextRun ? <div className="t-caption" style={{ color: "var(--text-secondary)" }}>Next run <b style={{ color: "var(--text-primary)" }}>{nextRun}</b></div> : null}{tags}</div>
    {children ? <div style={{ flex: "none" }}>{children}</div> : null}
  </Card>;
  return <Card href={href} pad={false} interactive className="pw-squad">
    <div className="pw-squad__cover">{cover ? <Media ratio="5:2" src={cover} alt="" label={null} />
      // No cover photo: the brand's lime and slash, not an empty picture frame.
      : <div className="pw-media pw-squad__fallback" style={{ "--ratio": "5 / 2" } as CSSProperties} aria-hidden="true" />}
      <div className="pw-squad__tile"><Media ratio="1:1" tile src={photo} alt="" /></div></div>
    <div className="pw-squad__body">
      <h3 className="pw-squad__name">{name}{verified ? <VerifiedMark /> : null}</h3>
      <div className="pw-meta">{where ? <span><Icon name="map-pin" size={15} />{where}</span> : null}{count ? <span><Icon name="users-round" size={15} />{count}</span> : null}</div>
      {tags}
      {nextRun ? <div className="pw-squad__next"><Icon name="calendar" size={16} /><span>Next run <b>{nextRun}</b></span></div> : <div className="pw-squad__next"><span>No runs on the calendar yet</span></div>}
      {children}
    </div>
  </Card>;
}

/* RunCard */
export type RunCardProps = {
  title: string; squad?: string; squadVerified?: boolean; dow: string; day: string; month: string; time?: string; today?: boolean;
  place?: string | null; distance?: string | null; pace?: string | null; leader?: string | null; going?: string[]; goingCount?: number;
  rsvp?: "none" | "going" | "blocked"; onRsvp?: () => void; womenOnly?: boolean; repeats?: string | null; cancelled?: boolean;
  checkinOpen?: boolean; href?: string; showCta?: boolean; note?: ReactNode;
};
export function RunCard({ title, squad, squadVerified = false, dow, day, month, time, today = false, place, distance, pace, leader, going = [], goingCount, rsvp = "none", onRsvp, womenOnly = false, repeats, cancelled = false, checkinOpen = false, href, showCta = true, note }: RunCardProps) {
  const n = goingCount != null ? goingCount : going.length;
  return <Card pad={false} interactive={!!href} href={href} className={"pw-run" + (cancelled ? " pw-run--cancelled" : "")}>
    <DateTile dow={dow} day={day} month={month} time={time} today={today} />
    <div className="pw-run__main">
      {squad ? <span className="pw-run__squad">{squad}{squadVerified ? <VerifiedMark size={14} /> : null}</span> : null}
      <h3 className="pw-run__title">{title}</h3>
      {place ? <div className="pw-meta"><span><Icon name="map-pin" size={15} />{place}</span></div> : null}
      <div className="pw-run__stats">{distance ? <span><Icon name="route" size={15} />{distance} km</span> : null}{pace ? <span><Icon name="gauge" size={15} />{pace}</span> : null}{leader ? <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}><Icon name="flag" size={15} />{leader}</span> : null}</div>
      {(womenOnly || repeats || cancelled || checkinOpen) ? <div className="pw-tags">{cancelled ? <TrustTag kind="cancelled" size="sm" /> : null}{checkinOpen ? <TrustTag kind="checkin-open" size="sm" /> : null}{womenOnly ? <TrustTag kind="women-only" size="sm" /> : null}{repeats ? <TrustTag kind="repeats" size="sm">{repeats}</TrustTag> : null}</div> : null}
      {!cancelled ? <div className="pw-run__foot">
        {n > 0 ? <>{going.length ? <AvatarGroup names={going} total={n} max={3} size={26} /> : null}<span className="pw-run__going">{n} going</span></> : <span className="pw-run__going">{note || "Be the first to RSVP"}</span>}
        {showCta ? <span className="pw-run__cta">{rsvp === "blocked" ? <span className="t-caption">Women only</span> : <Button size="sm" variant={rsvp === "going" ? "secondary" : "primary"} className="pw-rsvp" aria-pressed={rsvp === "going"} icon={rsvp === "going" ? "check" : undefined} onClick={e => { e.preventDefault(); e.stopPropagation(); onRsvp?.(); }}>{rsvp === "going" ? "Going" : "RSVP"}</Button>}</span> : null}
      </div> : null}
    </div>
  </Card>;
}

/* EventCard */
export function EventCard({ layout = "poster", title, type = "Race", date, venue, price, status, poster, host, href = "#" }:
  { layout?: "poster" | "row"; title: string; type?: string; date: string; venue?: string | null; price: string; status?: "sold-out" | "few-left" | "cancelled" | null; poster?: string | null; host?: string | null; href?: string }) {
  const p = status === "sold-out" ? "Sold out" : price;
  const parts = p.split(" + ");
  return <a href={href} className={"pw-event" + (layout === "row" ? " pw-event--row" : "") + (status === "sold-out" ? " pw-event--soldout" : "") + (status === "cancelled" ? " pw-event--cancelled" : "")}>
    <div className="pw-event__poster"><Media ratio="2:3" src={poster} alt="" label={layout === "row" ? null : "Event poster"} />
      {layout !== "row" ? <div className="pw-event__over"><Badge variant="overlay">{type}</Badge>{status ? <TrustTag kind={status} variant={status === "sold-out" ? "solid" : undefined} /> : null}</div> : null}</div>
    <div style={{ minWidth: 0 }}>
      <div className="pw-event__date">{date}</div>
      <h3 className="pw-event__title">{title}</h3>
      <div className="t-caption" style={{ color: "var(--text-secondary)", marginBottom: 6 }}>{venue}{host ? " · " + host : ""}</div>
      {layout === "row" && status ? <div style={{ marginBottom: 6 }}><TrustTag kind={status} size="sm" /></div> : null}
      <div className="pw-event__price">{parts[0]}{parts[1] ? <small> + {parts[1]}</small> : null}</div>
    </div>
  </a>;
}

/* WeekList */
export function WeekList({ days = [], emptyText = "No runs this day" }: { days: { label: string; note?: string; items: ReactNode[]; empty?: string }[]; emptyText?: string }) {
  return <div className="pw-week">{days.map((d, i) => <section key={i} className="pw-week__day" aria-label={d.label}><h3 className="pw-week__h">{d.label}{d.note ? <span>{d.note}</span> : null}</h3>
    {d.items && d.items.length ? d.items : <div className="pw-week__empty">{d.empty || emptyText}</div>}</section>)}</div>;
}

/* RunSummary: the run card inside posts. `route` is 0–1 points (route_shape / 1000). */
export function RunSummary({ distance, duration, pace, route, ratio = "16:9", title }: { distance?: string | null; duration?: string | null; pace?: string | null; route?: MapPoint[] | null; ratio?: string; title?: string | null }) {
  return <div className="pw-runsum">
    {title ? <div style={{ padding: "12px 16px 0", fontWeight: 600, fontSize: 15 }}>{title}</div> : null}
    <div className="pw-runsum__stats">
      <div><span className="t-caption">Distance</span><b>{distance ?? "—"}<small>km</small></b></div>
      <div><span className="t-caption">Time</span><b>{duration ?? "—"}</b></div>
      <div><span className="t-caption">Pace</span><b>{pace ?? "—"}<small>/km</small></b></div>
    </div>
    {route && route.length > 1 ? <MapEmbed route={route} ratio={ratio} radius={0} label="Route" /> : null}
  </div>;
}

/* PostCard. The kit's card with real data hooks: the picture variants the app
   draws (4:5 card, route map, an old 9:16 story over a blur), the liked-by line
   and a caller-supplied ⋮ menu. */
export type PostMenuItem = MenuItem;
export type PostPhoto = { src: string; mode?: "fill" | "story" };
export function PostCard({ author, href, time, context, title, body, photo, photoAlt, run, kudos = 0, kudosGiven = false, likedLine, comments = 0, commentHref, onKudos, menu, onMenu }:
  { author: { name: string; avatar?: string | null; href?: string }; href?: string; time: string; context?: ReactNode; title?: string | null; body?: ReactNode; photo?: PostPhoto | null; photoAlt?: string;
    run?: { distance?: string | null; duration?: string | null; pace?: string | null; route?: MapPoint[] | null } | null; kudos?: number; kudosGiven?: boolean; likedLine?: ReactNode; comments?: number; commentHref?: string;
    onKudos?: (give: boolean) => void; menu?: PostMenuItem[]; onMenu?: (id: string) => void }) {
  const [burst, setBurst] = useState(false); const [open, setOpen] = useState(false);
  const dbl = () => { if (!kudosGiven) onKudos?.(true); setBurst(true); setTimeout(() => setBurst(false), 600); };
  const name = author.href ? <a href={author.href} style={{ color: "inherit", textDecoration: "none" }}><b>{author.name}</b></a> : <b>{author.name}</b>;
  return <Card pad={false} className="pw-post">
    <div className="pw-post__head"><Avatar name={author.name} src={author.avatar} size={40} />
      <div className="pw-post__who">{name} <span className="t-caption" style={{ display: "inline" }}>· {href ? <a href={href} style={{ color: "inherit", textDecoration: "none" }}>{time}</a> : time}</span>
        {context ? <span className="t-caption">{context}</span> : null}</div>
      {menu && menu.length ? <Menu open={open} onClose={() => setOpen(false)} items={menu} onSelect={id => { setOpen(false); onMenu?.(id); }}><IconButton icon="ellipsis-vertical" label="Post options" size="sm" onClick={() => setOpen(!open)} /></Menu> : null}
    </div>
    {title ? <p className="pw-post__text" style={{ fontWeight: 600, paddingBottom: body ? 0 : undefined }}>{title}</p> : null}
    {body ? <p className="pw-post__text">{body}</p> : null}
    {photo ? <div className="pw-post__media" onDoubleClick={dbl}>
      <Media ratio="4:5" src={photo.mode === "story" ? null : photo.src} alt={photoAlt || "Photo by " + author.name} label={null}>
        {photo.mode === "story" ? <>
          {/* eslint-disable @next/next/no-img-element */}
          <img src={photo.src} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(24px) brightness(.8)", transform: "scale(1.1)" }} />
          <img src={photo.src} alt={photoAlt || "Photo by " + author.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
          {/* eslint-enable @next/next/no-img-element */}
        </> : null}
      </Media>
      {burst ? <div className="pw-post__burst"><Icon name="heart" size={96} fill="currentColor" strokeWidth={0} /></div> : null}</div> : null}
    {run ? <div className="pw-post__run"><RunSummary {...run} /></div> : null}
    <div className="pw-post__acts">
      <button className="pw-btn pw-btn--ghost pw-btn--sm pw-kudos" aria-pressed={kudosGiven} onClick={() => onKudos?.(!kudosGiven)}><Icon name="heart" size={18} /><span className="pw-post__count">{kudos > 0 ? kudos : "Kudos"}</span></button>
      {commentHref ? <a className="pw-btn pw-btn--ghost pw-btn--sm" href={commentHref}><Icon name="message-circle" size={18} /><span className="pw-post__count">{comments > 0 ? comments : "Comment"}</span></a> : null}
    </div>
    {likedLine ? <div className="t-caption" style={{ padding: "0 16px 14px", marginTop: -2 }}>{likedLine}</div> : null}
  </Card>;
}

/* CommentRow + CommentComposer */
export function CommentRow({ author, time, text, kudos = 0, kudosGiven = false, onReply, onKudos, own = false, onDelete, onReport, tag, indent = false, hidden = false }:
  { author: { name: string; avatar?: string | null; href?: string }; time: string; text: ReactNode; kudos?: number; kudosGiven?: boolean; onReply?: () => void; onKudos?: () => void; own?: boolean; onDelete?: () => void; onReport?: () => void; tag?: string; indent?: boolean; hidden?: boolean }) {
  return <div className="pw-comment" style={indent ? { paddingLeft: 46 } : undefined}><Avatar name={author.name} src={author.avatar} size={indent ? 30 : 36} />
    <div className="pw-comment__bubble"><div className="pw-comment__head">{author.href ? <a href={author.href} style={{ color: "inherit", textDecoration: "none" }}><b>{author.name}</b></a> : <b>{author.name}</b>}{tag ? <Badge size="sm">{tag}</Badge> : null}<span className="t-caption">{time}</span></div>
      <p className="pw-comment__text" style={hidden ? { color: "var(--text-muted)", fontStyle: "italic" } : undefined}>{hidden ? "Hidden by a squad organiser" : text}</p>
      <div className="pw-comment__acts">
        {onKudos ? <button onClick={onKudos} style={kudosGiven ? { color: "var(--live)" } : undefined}>{kudos > 0 ? "Kudos · " + kudos : "Kudos"}</button> : null}
        {onReply ? <button onClick={onReply}>Reply</button> : null}
        {own ? (onDelete ? <button onClick={onDelete}>Delete</button> : null) : onReport ? <button onClick={onReport}>Report</button> : null}</div></div>
  </div>;
}
export function CommentComposer({ name, avatar, placeholder = "Add a comment", replyingTo, onCancelReply, value, onChange, onSubmit, busy = false, suggestions }:
  { name: string; avatar?: string | null; placeholder?: string; replyingTo?: string | null; onCancelReply?: () => void; value: string; onChange: (v: string) => void; onSubmit: () => void; busy?: boolean; suggestions?: ReactNode }) {
  return <div>{replyingTo ? <div className="pw-composer__reply">Replying to <b>{replyingTo}</b><button onClick={onCancelReply} style={{ border: 0, background: "none", color: "var(--accent-text)", cursor: "pointer", font: "inherit" }}>Cancel</button></div> : null}
    {suggestions}
    <form className="pw-composer" onSubmit={e => { e.preventDefault(); if (value.trim() && !busy) onSubmit(); }}><Avatar name={name} src={avatar} size={36} />
      <div className="pw-composer__box"><textarea rows={1} placeholder={placeholder} value={value} maxLength={1000} onChange={e => onChange(e.target.value)} aria-label={placeholder} /><IconButton icon="send-horizontal" label="Post comment" variant={value.trim() ? "primary" : "ghost"} size="sm" type="submit" disabled={!value.trim() || busy} /></div></form></div>;
}

/* RunnerRow */
export function RunnerRow({ name, avatar, href, sub, role, isYou = false, action }: { name: string; avatar?: string | null; href?: string; sub?: ReactNode; role?: string; isYou?: boolean; action?: ReactNode }) {
  return <div className="pw-runner"><Avatar name={name} src={avatar} size={44} />
    <div className="pw-runner__who"><b>{href ? <a href={href} style={{ color: "inherit", textDecoration: "none" }}>{name}</a> : name}{isYou ? <span className="t-caption" style={{ fontWeight: 500 }}>(you)</span> : null}</b>{sub ? <span>{sub}</span> : null}</div>
    {role ? <TrustTag kind={role} size="sm" /> : null}
    {action}
  </div>;
}

/* StatTile */
export function StatTile({ label, value, unit, delta, deltaLabel = "vs last week", size = "md", flat = false }: { label: string; value: ReactNode; unit?: string; delta?: string | null; deltaLabel?: string; size?: "sm" | "md"; flat?: boolean }) {
  const up = delta != null && delta.trim().startsWith("+"); const down = delta != null && delta.trim().startsWith("-");
  return <div className={"pw-stat" + (flat ? " pw-stat--flat" : "") + (size === "sm" ? " pw-stat--sm" : "")}>
    <span className="pw-stat__label">{label}</span>
    <span className="pw-stat__val">{value}{unit ? <small>{unit}</small> : null}</span>
    {delta != null ? <span className={"pw-stat__delta" + (up ? " pw-stat__delta--up" : down ? " pw-stat__delta--down" : "")}>{up ? <Icon name="arrow-up-right" size={14} strokeWidth={2.2} /> : down ? <Icon name="arrow-down-right" size={14} strokeWidth={2.2} /> : null}{delta} <span>{deltaLabel}</span></span> : null}
  </div>;
}

/* AchievementTile */
export function AchievementTile({ type = "record", label, value, title, date, state = "earned", icon = "medal" }: { type?: "record" | "badge"; label?: string; value?: string; title?: string; date?: string; state?: "earned" | "locked" | "new"; icon?: string }) {
  const locked = state === "locked";
  return <div className={"pw-ach" + (locked ? " pw-ach--locked" : "") + (state === "new" ? " pw-ach--new" : "")}>
    {state === "new" ? <span className="pw-ach__new"><Badge tone="accent" variant="solid" size="sm">New</Badge></span> : null}
    {type === "badge" ? <><span className="pw-ach__ico"><Icon name={locked ? "lock" : icon} size={24} /></span><span className="pw-ach__t">{title}</span><span className="pw-ach__d">{locked ? date || "Locked" : date}</span></>
      : <><span className="pw-ach__k">{label}</span><span className="pw-ach__v">{locked ? "—" : value}</span><span className="pw-ach__d">{locked ? "No " + label + " yet" : date}</span></>}
  </div>;
}

/* OrderSummary: amounts in paise, the way the database stores them. */
const inrMinor = (m: number) => "₹" + (m / 100).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: (m % 100) ? 2 : 0 });
export function OrderSummary({ lines, feeMinor, gstMinor, totalMinor, note = "Tickets are issued in your name." }: { lines: { label: string; qty: number; priceMinor: number }[]; feeMinor: number; gstMinor: number; totalMinor?: number; note?: string | null }) {
  const sub = lines.reduce((s, l) => s + l.qty * l.priceMinor, 0);
  return <div className="pw-order">
    {lines.filter(l => l.qty > 0).map((l, i) => <div key={i} className="pw-order__row"><span>{l.label} × {l.qty}</span><span>{l.priceMinor ? inrMinor(l.qty * l.priceMinor) : "Free"}</span></div>)}
    <div className="pw-order__row pw-order__row--sub"><span>Tickets</span><span>{inrMinor(sub)}</span></div>
    <div className="pw-order__row"><span>pacr fee</span><span>{inrMinor(feeMinor)}</span></div>
    <div className="pw-order__row"><span>GST (18% on the fee)</span><span>{inrMinor(gstMinor)}</span></div>
    <div className="pw-order__row pw-order__row--total"><span>Total</span><span>{inrMinor(totalMinor ?? sub + feeMinor + gstMinor)}</span></div>
    {note ? <div className="pw-order__note">{note}</div> : null}
  </div>;
}

/* TicketCard: `qr` is the seat's real check-in code. */
const VOID: Record<string, string> = { cancelled: "Event cancelled · refund on the way", refunded: "Refunded" };
export function TicketCard({ event, date, venue, holder, ticketType, seat = 1, seats = 1, status = "valid", qr, showQR = true }:
  { event: string; date: string; venue?: string | null; holder: string; ticketType?: string | null; seat?: number; seats?: number; status?: "valid" | "checked-in" | "cancelled" | "refunded"; qr: string; showQR?: boolean }) {
  return <div className="pw-ticket">
    <div className="pw-ticket__top">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><span className="t-overline">{ticketType ? ticketType + " · " : ""}Seat {seat} of {seats}</span>
        {status === "valid" ? <TrustTag kind="going" size="sm">Valid</TrustTag> : status === "checked-in" ? <TrustTag kind="checked-in" size="sm" /> : status === "cancelled" ? <TrustTag kind="cancelled" size="sm" /> : <TrustTag kind="request-sent" size="sm">Refunded</TrustTag>}</div>
      <h3 className="t-h3" style={{ marginTop: 4 }}>{event}</h3>
      <div className="t-body-s t-secondary">{date}{venue ? <><br />{venue}</> : null}</div>
      <div className="t-caption">Ticket holder · <b style={{ color: "var(--text-primary)" }}>{holder}</b></div>
    </div>
    <div className="pw-ticket__perf" />
    {showQR ? <div className="pw-ticket__qr"><QRBlock value={qr} size={200} large refCode={`SEAT ${seat} OF ${seats}`} brightnessHint={status === "valid"} />
      {VOID[status] || status === "checked-in" ? <div className="pw-ticket__void">{VOID[status] || "Checked in · enjoy the run"}</div> : null}</div> : null}
  </div>;
}

/* LiveRunPanel */
export function LiveRunPanel({ runner, avatar, state = "live", distance, time, pace, updated, route }:
  { runner: string; avatar?: string | null; state?: "live" | "finished" | "expired"; distance?: string; time?: string; pace?: string; updated?: string; route?: MapPoint[] | null }) {
  return <Card pad={false} className="pw-live">
    <div className="pw-live__head"><Avatar name={runner} src={avatar} size={40} /><div style={{ flex: 1, lineHeight: 1.3 }}><b>{runner}</b><div className="t-caption">{state === "live" ? "Running now" : state === "finished" ? "Finished this run" : "Sharing has ended"}</div></div>
      {state === "live" ? <TrustTag kind="live" /> : state === "finished" ? <Badge tone="success" icon="flag">Finished</Badge> : <Badge>Expired</Badge>}</div>
    {state === "expired" ? <div style={{ padding: 24, textAlign: "center" }} className="t-body-s t-secondary"><Icon name="clock" size={24} /><p style={{ margin: "8px 0 0" }}>This live link has expired. Live locations are only shared while the run is on.</p></div> : <>
      <MapEmbed route={route} ratio="16:9" radius={0} live={state === "live"} label="Live route" />
      <div className="pw-live__stats"><div><span className="t-caption">Distance</span><b>{distance ?? "—"}<small className="t-caption"> km</small></b></div><div><span className="t-caption">Time</span><b>{time ?? "—"}</b></div><div><span className="t-caption">Pace</span><b>{pace ?? "—"}<small className="t-caption"> /km</small></b></div></div>
      <div className="pw-live__upd">{state === "live" ? <><span className="pw-badge__dot" style={{ color: "var(--live)", animation: "pw-pulse 1.6s infinite" }} />Last updated {updated}</> : <><Icon name="circle-check" size={15} />Final stats</>}</div></>}
  </Card>;
}
