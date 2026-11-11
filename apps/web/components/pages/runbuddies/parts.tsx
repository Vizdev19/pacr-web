"use client";
// Run buddies building blocks: the run row, the safety card, the app bar and
// the report dialog. Design-system parts only (pw-run, Card, TrustTag…).
import { useState } from "react";
import { Avatar, AvatarGroup, Badge, Button, Card, Icon, TrustTag } from "@/components/ds/core";
import { DateTile } from "@/components/ds/content";
import { OpenInAppBar } from "@/components/ds/actions";
import { RadioGroup, TextArea } from "@/components/ds/forms";
import { Dialog, useToast } from "@/components/ds/overlays";
import { encodeRef } from "@/lib/refs";
import { istParts } from "@/lib/format";
import {
  PACE_LABEL, REPORT_REASONS, failCopy, hostLine, kmLabel, reportOpenRun,
  type MyOpenRun, type MyStatus, type OpenRunCard, type PastRun, type ReportReason,
} from "@/lib/runbuddies";

export const runHref = (id: string, past = false) => `/runbuddies?run=${encodeRef(id) ?? ""}${past ? "&past=1" : ""}`;
export const personHref = (id: string | null) => (id ? `/profile?r=${encodeRef(id) ?? ""}` : undefined);

export function StatusTag({ s }: { s: MyStatus }) {
  if (s === "host") return <TrustTag kind="organiser" size="sm">Hosting</TrustTag>;
  if (s === "accepted") return <TrustTag kind="going" size="sm" />;
  if (s === "pending") return <TrustTag kind="request-sent" size="sm" />;
  if (s === "invited") return <Badge tone="accent" size="sm" icon="mail">Invited</Badge>;
  return null;
}

/** Women only, 1:1, host approves: the run's rules as tags. */
export function RuleTags({ womenOnly, cap, approval, hosting }: { womenOnly: boolean; cap: number; approval: boolean; hosting?: boolean }) {
  return <>
    {womenOnly ? <TrustTag kind="women-only" size="sm" /> : null}
    {cap === 2 ? <Badge size="sm" icon="users">1:1</Badge> : null}
    {approval && !hosting ? <TrustTag kind="ask" size="sm">Host approves</TrustTag> : null}
  </>;
}

function Tile({ iso, now }: { iso: string; now: number }) {
  const p = istParts(iso);
  return <DateTile dow={p.dow} day={p.day} month={p.month} time={p.time} today={!!now && p.ymd === istParts(new Date(now)).ymd} />;
}

/** One run near you: when, where (or "Spot shared on approval"), distance, pace, the host and the spots left. */
export function OpenRunRow({ r, now }: { r: OpenRunCard; now: number }) {
  const hosting = r.myStatus === "host";
  const open = r.cap - r.acceptedCount;
  return <Card pad={false} href={runHref(r.id)} className="pw-run">
    <Tile iso={r.startsAt} now={now} />
    <div className="pw-run__main">
      <h3 className="pw-run__title">{r.title}</h3>
      <div className="pw-meta"><span><Icon name={r.isExact ? "map-pin" : "lock"} size={15} />{r.isExact ? r.placeName : "Spot shared on approval"}</span>
        <span className="pw-dotsep">{r.isExact ? `${r.awayKm.toFixed(1)} km away` : `About ${r.awayKm.toFixed(1)} km away`}</span></div>
      <div className="pw-run__stats"><span><Icon name="route" size={15} />{kmLabel(r.distanceKm)}</span><span><Icon name="gauge" size={15} />{PACE_LABEL[r.pace]}</span></div>
      <div className="pw-tags"><RuleTags womenOnly={r.womenOnly} cap={r.cap} approval={r.approval} hosting={hosting} /><StatusTag s={r.myStatus} /></div>
      <div className="pw-run__foot">
        <Avatar name={r.hostName} src={r.hostAvatar} size={28} />
        <span className="pw-run__going" style={{ flex: 1, minWidth: 0 }}><b style={{ color: "var(--text-primary)" }}>{hosting ? "You" : r.hostName}</b> · {hosting ? "Waiting for buddies" : hostLine(r.host) + (r.ranWith ? ` · ran together ${r.ranWith}×` : "")}</span>
        <span className="t-caption">{open > 0 ? `${open} of ${r.cap} open` : "Full"}</span>
      </div>
    </div>
  </Card>;
}

/** A run you're in, asked to join or invited to. */
export function MyRunRow({ m, now }: { m: MyOpenRun; now: number }) {
  const hosting = m.myStatus === "host";
  return <Card pad={false} href={runHref(m.id)} className={"pw-run" + (m.status === "cancelled" ? " pw-run--cancelled" : "")}>
    <Tile iso={m.startsAt} now={now} />
    <div className="pw-run__main">
      <h3 className="pw-run__title">{m.title}</h3>
      <div className="pw-meta"><span><Icon name={m.placeName ? "map-pin" : "lock"} size={15} />{m.placeName ?? "Spot shared on approval"}</span></div>
      <div className="pw-tags">
        {m.status === "cancelled" ? <TrustTag kind="cancelled" size="sm" /> : <StatusTag s={m.myStatus} />}
        <RuleTags womenOnly={m.womenOnly} cap={m.cap} approval={m.approval} hosting={hosting} />
        {hosting && m.pendingRequests > 0 ? <Badge tone="warning" size="sm">{m.pendingRequests} {m.pendingRequests === 1 ? "request" : "requests"}</Badge> : null}
      </div>
      <div className="pw-run__foot">
        <Avatar name={m.hostName} src={m.hostAvatar} size={28} />
        <span className="pw-run__going" style={{ flex: 1 }}>{hosting ? "You're hosting" : `Hosted by ${m.hostName}`}</span>
        <span className="t-caption">{m.acceptedCount} of {m.cap} going</span>
      </div>
    </div>
  </Card>;
}

/** A run you were in, with the people you ran with. */
export function PastRunRow({ p, now }: { p: PastRun; now: number }) {
  const names = p.people.map(x => x.name);
  return <Card pad={false} href={runHref(p.id, true)} className={"pw-run" + (p.outcome === "cancelled" ? " pw-run--cancelled" : "")}>
    <Tile iso={p.startsAt} now={now} />
    <div className="pw-run__main">
      <h3 className="pw-run__title">{p.title}</h3>
      {p.placeName ? <div className="pw-meta"><span><Icon name="map-pin" size={15} />{p.placeName}</span></div> : null}
      <div className="pw-run__stats"><span><Icon name="route" size={15} />{kmLabel(p.distanceKm)}</span><span><Icon name="gauge" size={15} />{PACE_LABEL[p.pace]}</span></div>
      <div className="pw-tags">
        {p.outcome === "cancelled" ? <TrustTag kind="cancelled" size="sm" /> : p.outcome === "left" ? <Badge size="sm">You left</Badge> : <Badge tone="success" size="sm" icon="check">Ran</Badge>}
        {p.isHost ? <TrustTag kind="organiser" size="sm">Hosted</TrustTag> : null}
        {p.womenOnly ? <TrustTag kind="women-only" size="sm" /> : null}
      </div>
      <div className="pw-run__foot">
        {names.length ? <><AvatarGroup names={names} max={4} size={26} /><span className="pw-run__going">With {names.slice(0, 2).join(", ")}{names.length > 2 ? ` and ${names.length - 2} more` : ""}</span></>
          : <span className="pw-run__going">{p.departed ? "The others have left pacr" : "Nobody else was in this run"}</span>}
      </div>
    </div>
  </Card>;
}

/** How Run buddies keeps strangers safe, from the open-runs rules (20261020120000 and later). */
export function SafetyCard() {
  return <Card><div className="stack">
    <div className="row"><Icon name="shield-check" size={20} /><b>Running with people you haven&apos;t met</b></div>
    <ul className="rules">
      <li>Runs meet at public places: parks, lakes, tracks and landmarks. Nobody can drop a pin at a front door.</li>
      <li>When the host approves who joins, the exact spot shows only after you&apos;re let in.</li>
      <li>1:1 runs always need the host&apos;s approval.</li>
      <li>Women-only runs are seen only by women.</li>
      <li>Names show as first name and initial until you&apos;ve run together.</li>
      <li>Runs with anyone you&apos;ve blocked don&apos;t show up.</li>
      <li>In the app: tap I&apos;m here at the start, text your plan to a trusted contact, mark yourself safe after, or call 112.</li>
      <li>Report anyone who made you feel unsafe. Reports can pause someone&apos;s open runs while the pacr team looks into it.</li>
    </ul>
  </div></Card>;
}

export function AppBar({ title = "Post a run in the app", sub = "Posting, run chat and safety check-ins are in pacr." }: { title?: string; sub?: string }) {
  return <OpenInAppBar fixed={false} card title={title} sub={sub} />;
}

/** Report a run or a runner: report_open_run, the app's call. Only the pacr team sees it. */
export function ReportDialog({ open, onClose, runId, people, defaultUser }: {
  open: boolean; onClose: () => void; runId: string; people: { userId: string; name: string }[]; defaultUser: string | null;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [who, setWho] = useState<string>(defaultUser ?? "unsure");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!reason) return;
    setBusy(true);
    const res = await reportOpenRun({ runId, reason, userId: who === "unsure" ? null : who, note });
    setBusy(false);
    if (!res.ok) { toast({ title: failCopy(res.reason), tone: "error" }); return; }
    toast({ title: "Report sent", message: "Only the pacr team sees this." });
    setReason(""); setNote(""); onClose();
  }
  return <Dialog open={open} onClose={onClose} title="Report this run" width={480}
    actions={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!reason} loading={busy} onClick={() => void send()}>Send report</Button></>}>
    <div className="stack" style={{ gap: 16 }}>
      <p className="t-secondary" style={{ margin: 0 }}>Only the pacr team sees this.</p>
      {people.length ? <b className="t-body-s">Who is this about?</b> : null}
      {people.length ? <RadioGroup name="who" label="Who is this about?" value={who} onChange={setWho}
        options={[...people.map(p => ({ value: p.userId, label: p.name })), ...(people.length > 1 ? [{ value: "unsure", label: "Not sure" }] : [])]} /> : null}
      <b className="t-body-s">What happened?</b>
      <RadioGroup name="reason" label="What happened" value={reason} onChange={v => setReason(v as ReportReason)}
        options={REPORT_REASONS.map(([value, label]) => ({ value, label }))} />
      <TextArea label="Anything else" optional rows={3} maxLength={400} value={note} onChange={e => setNote(e.target.value)}
        placeholder="What happened? Add anything that helps us look into it." />
    </div>
  </Dialog>;
}
