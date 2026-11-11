"use client";
// /s/<slug> in the browser: picks the view (squad page, run view, invite
// card, not found) and does the signed-in actions with the app's own RPCs:
//   Join squad / Ask to join   request_to_join (app/club.tsx does the same for
//                              both: an open squad joins, a request squad asks)
//   ?invite=<code>             join_circle_by_code
//   RSVP                       announcement_rsvps insert / delete
// Every refusal the server can give (women only, banned, a dead invite) gets
// its own message.
import { useCallback, useRef, useState } from "react";
import { ShareMenu } from "@/components/ds/actions";
import { ErrorState } from "@/components/ds/feedback";
import { useToast } from "@/components/ds/overlays";
import { signinHref } from "@/lib/auth";
import { istParts } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import { SITE, decodeRef, squadQuery, type Squad, type SquadEventCard, type SquadRun } from "@/lib/squad";
import { GetAppSheet, InviteCard, JoinSheet, useAppLink, type JoinState } from "./parts";
import { RunView } from "./RunView";
import { SquadView } from "./SquadView";
import { useSquad } from "./useSquad";

type ToastIn = { title: string; message?: string; tone?: "success" | "error" | "info" | "neutral"; action?: string; onAction?: () => void };

const WOMEN_SQUAD: ToastIn = { title: "Women-only squad", message: "This squad is for women. If that's you, set your gender in Settings in the pacr app, then try again.", tone: "error" };
const WOMEN_RUN: ToastIn = { title: "Women-only run", message: "This run is for women. If that's you, set your gender in Settings in the pacr app, then try again.", tone: "error" };

/** A join refusal, in words. */
function joinFail(m: string): ToastIn {
  if (/women_only/.test(m)) return WOMEN_SQUAD;
  if (/\bbanned\b/.test(m)) return { title: "You can't join this squad", message: "Its organisers have closed it to you.", tone: "error" };
  if (/invite_code_not_found/.test(m)) return { title: "This invite no longer works", message: "Ask the organiser for a fresh link.", tone: "error" };
  if (/email_required/.test(m)) return { title: "Your account needs an email", message: "Add an email address in Settings in the pacr app, then try again.", tone: "error" };
  if (/answers_required/.test(m)) return { title: "Answer every question", message: "Each question needs an answer before you send your request.", tone: "error" };
  if (/blocked_content|blocked_term/.test(m)) return { title: "We can't send that", message: "One of your answers has words our community rules don't allow. Change it and try again.", tone: "error" };
  if (/club_not_public|approval_required/.test(m)) return { title: "You can't join from here", message: "Ask the organisers for an invite link.", tone: "error" };
  return { title: "Couldn't join", message: "Check your connection and try again.", tone: "error" };
}

export function SquadPage({ slug, invite, runRef, initial, events: initialEvents, today }:
  { slug: string; invite: string | null; runRef: string | null; initial: Squad | null; events: SquadEventCard[]; today: string }) {
  const { auth, squad, events, viewer, circleId, reload, patchRun, setViewer } = useSquad({ slug, invite, initial, events: initialEvents });
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<null | "squad" | "run">(null);
  // Signed out, Join and RSVP open this: both happen in the app.
  const [getApp, setGetApp] = useState<null | "join" | "rsvp">(null);
  const pending = useRef(new Set<string>());

  const query = squadQuery(invite, runRef);
  const signin = signinHref(`/s/${slug}${query}`);
  const appHref = useAppLink(slug, query);
  const isPublic = !!initial;
  const squadHref = `/s/${slug}${squadQuery(invite, null)}`;
  const runHref = useCallback((ref: string) => `/s/${slug}${squadQuery(invite, ref)}`, [slug, invite]);
  const signedIn = auth.status === "signed-in";
  const notWoman = viewer.gender === "male" || viewer.gender === "other";
  const name = squad?.name ?? viewer.preview?.name ?? "the squad";

  const joinState: JoinState = (() => {
    const policy = squad?.joinPolicy ?? "invite";
    if (auth.status === "loading" || (signedIn && !viewer.ready)) return "loading";
    if (!signedIn) return !invite && policy === "invite" ? "invite-only" : "signed-out";
    if (viewer.isMember) return "member";
    if (viewer.banned) return "banned";
    if (invite && viewer.preview) return "invite-code";
    if (viewer.requested) return "sent";
    if (!squad || policy === "invite") return "invite-only";
    return policy === "request" ? "request" : "open";
  })();
  const viaCode = joinState === "invite-code";
  // The invite banner, unless the code turned out dead for this runner.
  const invited = !!invite && (!signedIn || !viewer.ready || !!viewer.preview);
  const rules = squad?.rules.length ? squad.rules : viewer.preview?.rules ?? [];
  const questions = !viaCode && squad?.joinPolicy === "request" ? squad.joinQuestions : [];

  async function doJoin(answers: string[], agreed: boolean) {
    if (busy) return;
    setBusy(true);
    const sb = getSupabase();
    let err: string | null = null;
    let outcome: "joined" | "requested" = "joined";
    if (viaCode && invite) {
      const { data, error } = await sb.rpc("join_circle_by_code", { p_invite_code: invite, p_accept_rules: agreed });
      if (error || !data) err = error?.message ?? "invite_code_not_found";
    } else if (circleId.current) {
      const { data, error } = await sb.rpc("request_to_join", {
        p_circle_id: circleId.current, p_answers: answers.length ? answers : null, p_accept_rules: agreed,
      });
      if (error || !data) err = error?.message ?? "error";
      else if (data === "requested") outcome = "requested";
    } else err = "error";
    setBusy(false);
    if (err) {
      if (!/answers_required|blocked_content|blocked_term/.test(err)) setSheet(false);
      toast(joinFail(err));
      return;
    }
    setSheet(false);
    if (outcome === "requested") {
      setViewer(v => ({ ...v, requested: true }));
      toast({ title: "Request sent", message: questions.length ? "The organisers will review your answers." : "The organisers will review your request.", tone: "info" });
      return;
    }
    toast({ title: "You're in", message: `Welcome to ${name}` });
    await reload();
  }

  function startJoin() {
    if (busy || !["open", "request", "invite-code"].includes(joinState)) return;
    const womenOnly = squad?.womenOnly ?? viewer.preview?.womenOnly ?? false;
    if (womenOnly && notWoman) { toast(WOMEN_SQUAD); return; }
    if (rules.length || questions.length) { setSheet(true); return; }
    void doJoin([], false);
  }

  async function rsvp(r: SquadRun) {
    if (!signedIn || !auth.uid) { setGetApp("rsvp"); return; }
    if (!viewer.ready) return;
    if (!viewer.isMember) {
      const canJoin = ["open", "request", "invite-code"].includes(joinState);
      toast({ title: `Join ${name} to RSVP`, message: "Runs are for the squad's members.", tone: "info", action: canJoin ? (joinState === "request" ? "Ask to join" : "Join squad") : undefined, onAction: canJoin ? startJoin : undefined });
      return;
    }
    const going = !r.goingByMe;
    if (going && r.womenOnly && notWoman) { toast(WOMEN_RUN); return; }
    const id = decodeRef(r.ref);
    if (!id || pending.current.has(r.ref)) return;
    pending.current.add(r.ref);
    patchRun(r.ref, going);
    const sb = getSupabase();
    const { error } = going
      ? await sb.from("announcement_rsvps").upsert({ announcement_id: id, user_id: auth.uid }, { onConflict: "announcement_id,user_id", ignoreDuplicates: true })
      : await sb.from("announcement_rsvps").delete().eq("announcement_id", id).eq("user_id", auth.uid);
    pending.current.delete(r.ref);
    if (error) {
      patchRun(r.ref, !going);
      toast(/women_only/.test(error.message) ? WOMEN_RUN : { title: "Couldn't save your RSVP", message: "Check your connection and try again.", tone: "error" });
      return;
    }
    if (going) {
      const t = istParts(r.startsAt);
      toast({ title: "You're going", message: `${r.title} · ${t.dow}, ${t.time}` });
    }
  }

  const joinSheet = sheet && <JoinSheet open onClose={() => setSheet(false)} name={name} organiser={squad?.organiserName ?? null}
    questions={questions} rules={rules} requesting={!viaCode && squad?.joinPolicy === "request"} busy={busy} onSubmit={(a, agreed) => void doJoin(a, agreed)} />;

  // No public page: a hidden squad's invite, or nothing at all.
  if (!squad) {
    if (invite) {
      if (signedIn && viewer.ready && !viewer.preview) return <div className="pw-container sec"><ErrorState kind="notfound" title="This invite link doesn't work any more" body="Ask the organiser for a fresh link." action="Browse squads" href="/clubs" /></div>;
      return <>
        <InviteCard preview={viewer.preview} state={joinState === "invite-only" ? "invite-code" : joinState} signin={signin} appHref={appHref} onJoin={startJoin} busy={busy} hasRun={!!runRef} />
        {joinSheet}
      </>;
    }
    return <div className="pw-container sec"><ErrorState kind="notfound" title="We can't find that squad" body="It may be invite-only, or the link may be old. Ask a member for an invite link." action="Browse squads" href="/clubs" /></div>;
  }

  const shareUrl = share === "run" && runRef
    ? `/s/${slug}${squadQuery(isPublic ? null : invite, runRef)}`
    : `/s/${slug}${isPublic ? "" : squadQuery(invite, null)}`;
  const canShare = isPublic || !!invite;
  const picked = runRef ? squad.runs.find(x => x.ref === runRef) ?? null : null;

  return <>
    {runRef
      ? <RunView squad={squad} run={picked} today={today} signedIn={signedIn} authLoading={auth.status === "loading"} invited={invited}
        joinState={joinState} busy={busy} onJoin={startJoin} signin={signin} squadHref={squadHref} runHref={runHref}
        canRsvp={x => !(x.womenOnly && notWoman)} onRsvp={x => void rsvp(x)} onShare={() => setShare("run")} canShare={canShare} myName={viewer.name} appHref={appHref}
        onGetApp={() => setGetApp("rsvp")} />
      : <SquadView squad={squad} events={events} today={today} signedIn={signedIn} invited={invited} joinState={joinState} busy={busy}
        onJoin={startJoin} onGetApp={() => setGetApp("join")} signin={signin} appHref={appHref} staff={viewer.role === "owner" || viewer.role === "organiser"}
        followNames={viewer.followNames} followCount={viewer.followCount} runHref={runHref}
        rsvpOf={x => (signedIn && viewer.isMember ? (x.goingByMe ? "going" : x.womenOnly && notWoman ? "blocked" : "none") : "none")}
        onRsvp={x => void rsvp(x)} onShare={() => setShare("squad")} canShare={canShare} />}
    {joinSheet}
    <GetAppSheet open={!!getApp && !signedIn} onClose={() => setGetApp(null)} name={squad.name} action={getApp ?? "join"} subject={runRef ? "run" : "squad"}
      signin={signin} appHref={appHref} pageUrl={`${SITE}/s/${slug}${query}`} />
    <ShareMenu open={!!share && canShare} onClose={() => setShare(null)} url={shareUrl}
      title={share === "run" ? "Share this run" : "Share this squad"}
      text={share === "run" && picked ? `${picked.title} with ${squad.name} on pacr` : `${squad.name} on pacr`} />
  </>;
}
