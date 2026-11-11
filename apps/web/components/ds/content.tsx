"use client";
// components/content/* (DateTile, SquadCard, RunCard, EventCard) and
// components/data/WeekList of the pacr Web Design System, ported to TSX.
import type { ReactNode } from "react";
import { AvatarGroup, Badge, Button, Card, Icon, Media, TrustTag, VerifiedMark } from "./core";

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
    <div className="pw-squad__cover"><Media ratio="5:2" src={cover} alt="" label={null} /><div className="pw-squad__tile"><Media ratio="1:1" tile src={photo} alt="" /></div></div>
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
