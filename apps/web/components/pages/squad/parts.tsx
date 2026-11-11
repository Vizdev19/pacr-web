"use client";
// Pieces the squad page and the run view share: the join button in every
// state, the Join / Ask to join sheet, the invite card, the members' "it's in
// the app" banner and the run card props.
import { useEffect, useState } from "react";
import { Button, Card, Media, VerifiedMark } from "@/components/ds/core";
import type { RunCardProps } from "@/components/ds/content";
import { BottomSheet } from "@/components/ds/feedback";
import { Checkbox, TextArea } from "@/components/ds/forms";
import { StoreBadges } from "@/components/ds/nav";
import { Banner } from "@/components/ds/overlays";
import { istParts, km, pace, TZ } from "@/lib/format";
import { appLink, plural, type Policy, type Squad, type SquadRun } from "@/lib/squad";

export type JoinState = "loading" | "signed-out" | "member" | "sent" | "banned" | "invite-only" | "open" | "request" | "invite-code";

/** The kit's JoinAction, with the states the app has: signed out, banned, an invite code. */
export function JoinAction({ state, policy, signin, onJoin, busy = false, block = false }:
  { state: JoinState; policy: Policy; signin: string; onJoin: () => void; busy?: boolean; block?: boolean }) {
  const size = block ? "lg" : "md";
  if (state === "member") return <Button variant="secondary" icon="check" block={block} size={size} aria-disabled="true">Member</Button>;
  if (state === "sent") return <Button variant="secondary" icon="clock" disabled block={block} size={size}>Request sent</Button>;
  if (state === "banned") return <div className="stack" style={{ gap: 6 }}><Button variant="secondary" icon="lock" disabled block={block} size={size}>You can&apos;t join</Button><span className="t-caption">Its organisers have closed it to you.</span></div>;
  if (state === "invite-only") return <div className="stack" style={{ gap: 6 }}><Button variant="secondary" icon="lock" disabled block={block} size={size}>Invite only</Button><span className="t-caption">Members join by invite from the organisers.</span></div>;
  if (state === "signed-out") return <Button icon="log-in" href={signin} block={block} size={size}>Sign in to join</Button>;
  const ask = state === "request" || (state === "loading" && policy === "request");
  return <Button icon={ask ? "message-circle-question" : "user-plus"} onClick={onJoin} loading={busy || state === "loading"} block={block} size={size}>{ask ? "Ask to join" : "Join squad"}</Button>;
}

/** The line under the join button in the side card. */
export function joinNote(state: JoinState, squad: Squad): string | null {
  const women = squad.womenOnly ? " For women, by the gender in your pacr profile." : "";
  if (state === "open") return "Free. Leave any time." + women;
  if (state === "request") return (squad.joinQuestions.length
    ? `The organisers will see your answers to ${plural(squad.joinQuestions.length, "short question")}.`
    : "The organisers approve each new member.") + women;
  if (state === "invite-code") return "You were invited, so you're in straight away." + women;
  if (state === "signed-out") return "Free. Sign in with the account you use in the app." + women;
  if (state === "sent") return `${squad.organiserName ?? "The organiser"} will review your request.`;
  return null;
}

/** Join / Ask to join: the squad's questions (request squads) and rules (I agree), as the app's JoinSheet. Render it only while open. */
export function JoinSheet({ open, onClose, name, organiser, questions, rules, requesting, busy, onSubmit }:
  { open: boolean; onClose: () => void; name: string; organiser: string | null; questions: string[]; rules: string[]; requesting: boolean; busy: boolean; onSubmit: (answers: string[], agreed: boolean) => void }) {
  // Mounted only while open, so every opening starts a fresh form.
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [agreed, setAgreed] = useState(false);
  const ready = questions.every((_, i) => (answers[i] || "").trim()) && (rules.length === 0 || agreed);
  return <BottomSheet open={open} onClose={onClose} title={`${requesting ? "Ask to join" : "Join"} ${name}`}
    footer={<Button block size="lg" disabled={!ready} loading={busy} onClick={() => onSubmit(answers.map(a => a.trim()), rules.length > 0)}>{requesting ? "Send request" : "Join squad"}</Button>}>
    <div className="stack" style={{ gap: 16 }}>
      <p className="t-body-s t-secondary" style={{ margin: 0 }}>{requesting
        ? `${organiser ?? "The organisers"} and the organisers will see your answers and your profile.`
        : "Read the squad's rules before you join."}</p>
      {questions.map((q, i) => <TextArea key={i} label={`${i + 1}. ${q}`} rows={2} maxLength={300} value={answers[i] || ""}
        onChange={e => setAnswers(a => questions.map((_, j) => (j === i ? e.target.value : a[j] || "")))} />)}
      {rules.length ? <div className="stack" style={{ gap: 10 }}>
        <span className="t-overline">Squad rules</span>
        <ol className="rules">{rules.map((r, i) => <li key={i}>{r}</li>)}</ol>
        <Checkbox label="I agree to the squad's rules" checked={agreed} onChange={setAgreed} />
      </div> : null}
    </div>
  </BottomSheet>;
}

/** pacr://… on iPhone, intent://… on Android (falls back to the Play Store). Set after mount. */
export function useAppLink(slug: string, query: string): string {
  const [android, setAndroid] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the user agent is only known in the browser
  useEffect(() => { setAndroid(/Android/i.test(navigator.userAgent)); }, []);
  return appLink(slug, query, android);
}

/** Members: the parts of a squad the web doesn't have yet live in the app. */
export function MemberBanner({ appHref }: { appHref: string }) {
  return <Banner tone="info" icon="smartphone" title="Chat, announcements and the leaderboard are in the app"
    actions={<Button size="sm" href={appHref}>Open in pacr</Button>}>
    RSVP to runs here or in the app. Both see the same list.
  </Banner>;
}

/** Above a public squad's page when the link carries an invite. */
export function InviteBanner({ name, signedIn, appHref }: { name: string; signedIn: boolean; appHref: string }) {
  return <Banner tone="info" icon="user-plus" title={`You're invited to ${name}`}
    actions={signedIn ? undefined : <Button size="sm" variant="secondary" icon="smartphone" href={appHref}>Open in pacr</Button>}>
    {signedIn ? "This link lets you join straight away, without waiting for approval." : "Sign in to join with this link, or open it on your phone in the pacr app."}
  </Banner>;
}

/** A hidden squad's invite: no public page to show, so a card that joins with the code. */
export function InviteCard({ preview, state, signin, appHref, onJoin, busy, hasRun }:
  { preview: { name: string; photo: string | null; verified: boolean; memberCount: number; womenOnly: boolean } | null;
    state: JoinState; signin: string; appHref: string; onJoin: () => void; busy: boolean; hasRun: boolean }) {
  const title = preview ? `Join ${preview.name}` : "Join a squad on pacr";
  const body = state === "banned" ? "Its organisers have closed it to you."
    : `This squad is invite-only, so its runs and members stay private until you join.${hasRun ? " Join to see the run you were sent." : ""}`;
  return <div className="pw-container sec" style={{ maxWidth: 560 }}>
    <Card>
      <div className="stack" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
          {preview ? <div style={{ width: 64, flex: "none" }}><Media ratio="1:1" tile src={preview.photo} alt="" /></div> : null}
          <div style={{ minWidth: 0 }}>
            <span className="t-overline">You&apos;re invited</span>
            <h1 className="t-h2" style={{ margin: "4px 0 0", display: "flex", alignItems: "center", gap: 8 }}>{title}{preview?.verified ? <VerifiedMark size={20} /> : null}</h1>
            {preview ? <div className="t-caption" style={{ marginTop: 4 }}>{plural(preview.memberCount, "member")}{preview.womenOnly ? " · Women only" : ""}</div> : null}
          </div>
        </div>
        <p className="t-secondary" style={{ margin: 0 }}>{body}</p>
        {state === "member" ? <Button href={appHref} block size="lg">Open in pacr</Button>
          : state === "banned" ? null
          : state === "signed-out" ? <div className="stack"><Button href={signin} icon="log-in" block size="lg">Sign in to join</Button><Button href={appHref} variant="secondary" block>Open in pacr</Button></div>
          : <Button icon="user-plus" block size="lg" onClick={onJoin} loading={busy || state === "loading"}>Join squad</Button>}
        {state === "signed-out" ? <div className="stack" style={{ gap: 8 }}><span className="t-caption">No pacr yet? Get the app, then open this link again.</span><StoreBadges size="sm" /></div> : null}
      </div>
    </Card>
  </div>;
}

function fullDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long" }).format(new Date(iso));
}

/** A squad run → the kit's RunCard props. */
export function runCardProps(r: SquadRun, o: { today: string; squadWomenOnly: boolean; href?: string; rsvp?: RunCardProps["rsvp"]; onRsvp?: () => void; showCta?: boolean }): RunCardProps {
  const p = istParts(r.startsAt);
  return {
    title: r.title, dow: p.dow, day: p.day, month: p.month, time: p.time, today: p.ymd === o.today,
    place: r.meetingPoint, distance: km(r.distanceKm), pace: pace(r.paceLabel), leader: r.leaderName, goingCount: r.goingCount,
    womenOnly: r.womenOnly && !o.squadWomenOnly, repeats: r.repeatWeekly ? `Every ${fullDay(r.startsAt)}` : null,
    href: o.href, rsvp: o.rsvp, onRsvp: o.onRsvp, showCta: o.showCta ?? true,
  };
}
