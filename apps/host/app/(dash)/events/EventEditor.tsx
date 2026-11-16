"use client";

// Create an event, or edit one: the pacr app's Create event form
// (app/event-create.tsx) in the dashboard, over the same calls
// (lib/eventEditor.ts).
//
//   /events?new=1                 a new event for the host picked in the sidebar
//   /events?event=<ref>&edit=1    a draft, or a live event
//
//   Details        name, description, type, tags, the 2:3 poster
//   Date and time  start, end and the time zone; fixed once the event is live
//   Location       a Google place with a pin, or one used before; where to meet
//   Who can see it everyone · anyone with the link · squad members only
//   Tickets        free or paid; ticket types (name, limit, price while nobody
//                  has bought it) and each type's sale options; a paid event
//                  shows what the runner pays and needs payout details; the
//                  cancellation and refund note
//   Registration   when it closes, and tickets per booking
//   Questions      what is asked for each ticket: a choice, text, or an
//                  emergency contact; up to six
//   Who can join   age and gender
//   Race details   surface, terrain, distances (the tags add theirs), chip timed
//   Event day      the timeline: time · what happens · note, up to 12
//   Course         a 16:9 course map and up to 6 facts
//   Good to know   up to 8 questions and answers
//   Included       one per line, up to 12
//   Co-hosts       the host only
//   Bar            what's missing · Save draft · Publish event (a draft), or
//                  Save changes (a live event). Publishing asks first, with the
//                  prices and pacr's fee in front of the host.
//
// Not here, and so never changed by a save: the past-event photos (the app's).
// Everything the older web editor had is here, and that editor is retired: its
// addresses redirect here (apps/web next.config.ts): /host/new to a new event,
// /host/e/<ref> to the event's page. A database older than this page is coped with: see
// lib/eventEditor.ts.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, EmptyState, GlassCard, Icon, Skeleton, StatusTag } from "@/components/ds";
import { kMuted, kStrong, KV } from "@/components/shell/kit";
import * as api from "@/lib/api";
import {
  DEFAULT_FEES, GENDER_LABEL, EditorError, andList, blankForm, checkForm, clockNow, deleteDraft, editorFailCopy, eventRules, feeMinorOf, loadEvent,
  minAgeOf, myVenues, otherTags, partialCopy, priceMinorOf, saveEvent, totalCapacity, type SaveStage,
  type EditorFail, type EventForm, type EventPlace, type Features, type FeeRules, type GenderRule, type Loaded, type Saved,
} from "@/lib/eventEditor";
import { wallText, zoneShort } from "@/lib/eventZone";
import { paise, plural } from "@/lib/format";
import { useHost } from "@/lib/host";
import { useLoad } from "@/lib/hooks";
import { encodeRef } from "@/lib/refs";
import { Cohosts } from "./editor/Cohosts";
import { Course, EventDay, GoodToKnow, Included, RaceDetails } from "./editor/PageSections";
import { Area } from "./editor/parts";
import { Basics, Registration, Visible, When, WhoCanJoin } from "./editor/Details";
import { PlaceField } from "./editor/PlaceField";
import { PosterField } from "./editor/PosterField";
import { Questions } from "./editor/Questions";
import { Tickets } from "./editor/Tickets";

type Init = {
  loaded: Loaded | null;
  rules: { paidAllowed: boolean; fees: FeeRules };
  venues: EventPlace[];
  hosting: api.Hosting | null;
  /** When this was read: "in the future" is judged against it while typing, and against the clock at a save. */
  now: number;
};

export function EventEditor({ eventId, onChanged }: {
  /** null = a new event. */
  eventId: string | null;
  /** The events list is out of date: an event was made, saved, published or deleted. */
  onChanged: () => void;
}) {
  const { host } = useHost();
  const router = useRouter();
  const init = useLoad(async (): Promise<Init> => {
    const [rules, venues, hosting, loaded] = await Promise.all([
      eventRules(), myVenues(), api.myHosting().catch(() => null), eventId ? loadEvent(eventId) : Promise.resolve(null),
    ]);
    return { loaded, rules, venues, hosting, now: Date.now() };
  }, `editor:${eventId ?? "new"}:${host.key}`);

  const back = () => router.push("/events");
  if (init.status === "loading") return <EditorSkeleton />;
  if (init.status === "error") {
    const c = editorFailCopy(init.error instanceof EditorError ? init.error.fail : "error");
    return (
      <EmptyState variant="error" icon="ticket" title={c.title} message={c.body} style={{ marginTop: 24 }}
        action={{ label: "Try again", onClick: init.reload }} secondaryAction={{ label: "Back to events", onClick: back }} />
    );
  }
  if (!eventId) {
    // A new event is the host's to make: a verified squad, or an approved organizer account.
    const why = host.roleKey === "cohost" ? `You co-host events for ${host.name}. Creating one is for the host.`
      : host.kind === "squad" && !host.verified ? "Only verified squads host events. The squad’s owner can ask for the badge in Settings."
      : host.kind === "organizer" && host.status !== "approved" ? "You can create events once pacr approves your organizer account."
      : null;
    if (why) {
      return <EmptyState variant="locked" title="Can’t create an event here yet" message={why} action={{ label: "Back to events", variant: "secondary", onClick: back }} style={{ marginTop: 24 }} />;
    }
  }
  // A fresh read (another event, or this one read again) starts the form over.
  return <Form key={`${eventId ?? "new"}:${init.data.now}`} init={init.data} onChanged={onChanged} />;
}

function Form({ init, onChanged }: { init: Init; onChanged: () => void }) {
  const { host, notify } = useHost();
  const router = useRouter();
  const [form, setForm] = useState<EventForm>(() => init.loaded?.form ?? blankForm(new Date(init.now)));
  const [saved, setSaved] = useState<Saved | null>(init.loaded?.saved ?? null);
  const [fees, setFees] = useState<FeeRules>(init.loaded?.fees ?? init.rules.fees ?? DEFAULT_FEES);
  const [features, setFeatures] = useState<Features>(init.loaded?.features ?? { saleOptions: null, questions: null });
  const [gallery, setGallery] = useState(init.loaded?.galleryCount ?? 0);
  const [dirty, setDirty] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "publish" | "save" | "delete">(null);
  const [asking, setAsking] = useState<null | "publish" | "delete" | "leave">(null);
  /** The clock the form's "in the future" checks read: moved on at each save. */
  const [now, setNow] = useState(init.now);

  /** The last refusal, kept in the bar until the form changes or is saved: a toast is gone in a few seconds. */
  const [refused, setRefused] = useState<{ title: string; body: string } | null>(null);

  const patch = (p: Partial<EventForm>) => { setForm(f => ({ ...f, ...p })); setDirty(true); setRefused(null); };
  const setDetails = (p: Partial<EventForm["details"]>) => { setForm(f => ({ ...f, details: { ...f.details, ...p } })); setDirty(true); setRefused(null); };
  const refuse = (title: string, body: string) => notify("warning", title, body);

  // Leaving with unsaved changes asks first: closing or reloading the tab (the browser asks), and anything in the
  // dashboard that would take the page away (a sidebar link, another host in the switcher, a Create or account menu
  // item), which is held while the "Leave without saving?" dialog asks and then carried out if the host says leave.
  // (The browser's own back button inside the dashboard isn't caught.)
  const leaving = useRef(false);
  const pending = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { if (!leaving.current) e.preventDefault(); };
    const click = (e: MouseEvent) => {
      if (leaving.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(
        "a[href]:not([target=_blank]):not([download]), .pc-hostsw__opt:not(.is-active), button.shell-menuitem");
      if (!el || el.closest(".pc-dialog")) return;
      if (el instanceof HTMLAnchorElement && (el.getAttribute("href") ?? "").startsWith("#")) return;
      e.preventDefault();
      e.stopPropagation();
      pending.current = el;
      setAsking("leave");
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty]);
  /** The host said leave: carry out what was held, or go back to where the form came from. */
  const leaveNow = () => {
    leaving.current = true;
    setAsking(null);
    const el = pending.current;
    pending.current = null;
    if (el && el.isConnected) el.click();
    else router.push(saved && live && ref ? `/events?event=${ref}` : "/events");
    // Still here a moment later (a menu item that didn't take the page away): the guard is back on.
    window.setTimeout(() => { leaving.current = false; }, 1500);
  };

  // Who the event is for: its own host once saved, else the one picked in the sidebar.
  const evHost = saved?.host ?? { kind: host.kind, id: host.id, name: host.name };
  const live = saved?.status === "published";
  const started = live && Date.parse(saved.startsAt) <= now;
  const squadWomen = evHost.kind === "squad" && !!init.hosting?.squads.find(s => s.id === evHost.id)?.women_only;
  const gender: GenderRule = squadWomen ? "women" : form.gender;
  const womenOnly = gender === "women";

  // A paid event needs somewhere to pay its host: asked once Paid is on, and again when the host comes back to this tab
  // (payout details are added on the Money page). No answer (a co-host isn't told) leaves it to the database at publish.
  const payout = useLoad(
    () => (form.paid ? api.payoutAccount(evHost.kind, evHost.id).catch(() => null) : Promise.resolve(null)),
    `payout:${form.paid}:${evHost.kind}:${evHost.id}`,
  );
  const reloadPayout = payout.reload;
  useEffect(() => {
    if (!form.paid) return;
    const f = () => { if (document.visibilityState === "visible") reloadPayout(); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [form.paid, reloadPayout]);
  const pay = payout.status === "ready" ? payout.data : null;
  // What this host owes pacr: over the limit, a paid event can't go on sale.
  const owes = useLoad(
    () => (form.paid && !live ? api.hostOwes(evHost.kind, evHost.id) : Promise.resolve(null)),
    `owes:${form.paid && !live}:${evHost.kind}:${evHost.id}`,
  );
  const owesBlocked = owes.status === "ready" && !!owes.data?.blocked;
  // Razorpay keeps its fee on a refunded payment. A new event or a draft takes the rule that the host pays it when it
  // goes live; one already live keeps the rule it was sold under, so it is asked, not assumed.
  const livePayer = useLoad(
    () => (live && form.paid && saved ? api.refundCost(saved.id) : Promise.resolve(null)),
    `payer:${live && form.paid ? saved?.id : ""}`,
  );
  const refundCharged = form.paid && (!live || (livePayer.status === "ready" && livePayer.data?.payer === "host"));

  const effective = { ...form, gender };
  const check = checkForm(effective, saved, fees, { payoutReady: pay ? pay.ready : null, womenOnly, now });
  const ok = check.missing.length === 0;
  const title = form.title.trim();
  const ref = saved ? encodeRef(saved.id) : null;

  // ── Saving ──
  const failed = (reason: EditorFail, stage: SaveStage = "none", publishing = false) => {
    const c = partialCopy(reason, stage, publishing);
    setRefused(c);
    notify("danger", c.title, c.body);
  };

  /** What the server has now, into the form. False when it couldn't be read: the form keeps what the save gave it. */
  const reread = async (id: string): Promise<boolean> => {
    try {
      const fresh = await loadEvent(id);
      setForm(fresh.form);
      setSaved(fresh.saved);
      setFees(fresh.fees);
      setFeatures(fresh.features);
      setGallery(fresh.galleryCount);
      return true;
    } catch {
      return false;
    }
  };

  const run = async (publish: boolean) => {
    if (busy) return;
    const at = clockNow();
    setNow(at);
    // The clock has moved since the form was read: check once more against it.
    const again = checkForm(effective, saved, fees, { payoutReady: pay ? pay.ready : null, womenOnly, now: at });
    if (publish || live ? again.missing.length : again.draftMissing.length) { setShow(true); setAsking(null); return; }
    setBusy(publish ? "publish" : live ? "save" : "draft");
    setRefused(null);
    const wasNew = !saved;
    const res = await saveEvent(effective, saved, { host: evHost, publish, features });
    const out = res.ok ? res.value : res.partial;
    if (out) {
      setForm(out.form);
      setSaved(out.saved);
      // What this database turned out not to have is known now, and stays out of the form.
      if (out.questionsOff || out.saleOff) setFeatures(f => ({ saleOptions: out.saleOff ? false : f.saleOptions, questions: out.questionsOff ? false : f.questions }));
    }
    setAsking(null);
    if (!res.ok) {
      setBusy(null);
      failed(res.reason, res.stage, publish);
      // Part of the save landed (a new draft, or everything but what failed): the list is out of date, and this page
      // keeps editing that event, with what was typed still in it.
      if (res.stage !== "none") onChanged();
      return;
    }
    setDirty(false);
    setShow(false);
    onChanged();
    const id = res.value.saved.id;
    if (res.value.questionsOff) notify("warning", "Questions not saved", "Registration questions aren’t switched on yet. Everything else was saved.");
    if (res.value.saleOff) notify("warning", "Sale options not saved", "Sale options aren’t switched on yet. Everything else was saved.");
    if (publish && !live) {
      notify("success", "Event published", `${title} is live${form.visibility === "public" ? " and listed in the pacr app’s Events tab" : form.visibility === "squad" ? " for the squad’s members" : ". Share its link to invite runners"}.`);
      // The list is being read again (onChanged above); the event's page waits for it rather than saying "not found".
      router.push(`/events?event=${encodeRef(id)}&fresh=${clockNow()}`);
      return;
    }
    notify("success", live ? "Changes saved" : "Draft saved", live ? "Runners see them on the event’s page now." : "Publish it when it’s ready.");
    if (wasNew) {
      // The page becomes this draft's editor: a reload comes back to it, not to an empty form.
      router.replace(`/events?event=${encodeRef(id)}&edit=1`);
      return;
    }
    await reread(id);
    setBusy(null);
  };

  const saveDraft = () => {
    if (check.draftMissing.length) { setShow(true); refuse("Not saved yet", `Add ${andList(check.draftMissing)} to save a draft.`); return; }
    void run(false);
  };
  const askPublish = () => {
    if (!ok) { setShow(true); return; }
    setAsking("publish");
  };
  const saveLive = () => {
    if (!ok) { setShow(true); return; }
    void run(false);
  };
  const remove = async () => {
    if (!saved || busy) return;
    setBusy("delete");
    const r = await deleteDraft(saved.id);
    setBusy(null);
    setAsking(null);
    if (!r.ok) { failed(r.reason); return; }
    setDirty(false);
    notify("success", "Draft deleted", `${title || "The draft"} and its pictures are gone.`);
    onChanged();
    router.push("/events");
  };
  const leave = () => {
    if (dirty && !busy) { setAsking("leave"); return; }
    if (!busy) router.push(saved && live && ref ? `/events?event=${ref}` : "/events");
  };

  const wrong = (show && !ok) || !!refused;
  const hint = show && !ok ? `Add ${andList(check.missing)} to ${live ? "save" : "publish"}.`
    : refused ? `${refused.title}. ${refused.body}`
    : live ? (dirty ? "Runners see changes as soon as you save." : "Live. Nothing unsaved.")
    : check.start ? `${wallText(check.start, form.zone)} ${zoneShort(form.zone, check.start)}${form.place ? ` · ${form.place.name}` : ""}` : "";
  const seats = totalCapacity(form.tiers);
  const shownTiers = form.tiers.filter(t => !t.hidden);

  return (
    <div style={{ maxWidth: 880 }}>
      <button type="button" onClick={leave} style={{ ...kMuted, display: "inline-flex", gap: 4, alignItems: "center", marginBottom: 10, background: "none", border: 0, padding: 0, cursor: "pointer" }}>
        <Icon name="arrow-left" size={13} />{saved && live ? "Back to the event" : "All events"}
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <GlassCard padding={14}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ font: "500 20px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>{live ? "Edit event" : saved ? "Edit draft" : "New event"}</span>
                {saved ? <StatusTag status={live ? "Published" : "Draft"} /> : null}
              </div>
              <div style={{ ...kMuted, marginTop: 4 }}>
                Hosted by {evHost.name}{saved && !saved.isHost ? " · you co-host this event" : ""}
              </div>
            </div>
            {saved && ref ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {live ? <a className="pc-btn pc-btn--secondary" href={`/e/${ref}`} target="_blank" rel="noreferrer"><Icon name="external-link" size={17} />View page</a> : null}
              </div>
            ) : null}
          </div>
        </GlassCard>

        {/* Nothing in the form changes while a save is on its way: what comes back replaces it. */}
        <fieldset disabled={!!busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <Basics form={form} patch={patch} check={check} show={show} otherTags={otherTags(saved?.tags ?? [])} galleryCount={gallery}
          poster={<PosterField cover={form.cover} onChange={c => patch({ cover: c })} onRefuse={refuse} />} />
        <When form={form} patch={patch} check={check} show={show} live={live} />
        <PlaceField place={form.place} text={form.placeText} venues={init.venues} live={live}
          error={show && check.noPin ? (form.placeText.trim() ? "Pick the place from the list so it has a pin." : "Runners need to know where to go.") : undefined}
          onPick={p => patch({ place: p, placeText: "" })} onText={t => patch({ placeText: t })} onClear={() => patch({ place: null, placeText: "" })}
          meetNote={form.details.meetNote} onMeetNote={v => setDetails({ meetNote: v })} />
        <Visible form={form} patch={patch} squadHost={evHost.kind === "squad"} hostName={evHost.name} />

        <Tickets form={form} patch={patch} fees={fees} check={check} show={show} paidAllowed={init.rules.paidAllowed || form.paid}
          saleOptions={features.saleOptions} live={live} refundCharged={refundCharged} onRefuse={refuse}>
          <Area label="Cancellation and refund note (optional)" value={form.details.refundNote} max={300} rows={2}
            placeholder="Can’t make it? Give your spot back in the app so someone else can come." onChange={v => setDetails({ refundNote: v })} />
          {form.paid ? (
            <PayoutCard state={payout.status === "loading" ? "loading" : pay} hostName={evHost.name} squad={evHost.kind === "squad"}
              need={show && check.needPayout} onCheck={reloadPayout} />
          ) : null}
          {form.paid && owesBlocked ? (
            <div role="alert" style={{ display: "flex", gap: 8, alignItems: "flex-start", font: "400 13px/1.45 var(--font-sans)", color: "var(--danger-text)" }}>
              <Icon name="circle-alert" size={15} style={{ marginTop: 2, flex: "none" }} /><span>{editorFailCopy("host_owes").body}</span>
            </div>
          ) : null}
        </Tickets>

        <Registration form={form} patch={patch} check={check} show={show} fees={fees} womenOnly={womenOnly} />
        <Questions form={form} patch={patch} show={show} available={features.questions} started={started} />
        <WhoCanJoin form={form} patch={patch} show={show} squadWomen={squadWomen} hostName={evHost.name} />
        <RaceDetails details={form.details} set={setDetails} check={check} show={show} />
        <EventDay details={form.details} set={setDetails} check={check} show={show} />
        <Course details={form.details} set={setDetails} check={check} show={show} onRefuse={refuse} />
        <GoodToKnow details={form.details} set={setDetails} check={check} show={show} />
        <Included details={form.details} set={setDetails} check={check} show={show} />
        {saved?.isHost ?? true ? <Cohosts cohosts={form.cohosts} onChange={c => patch({ cohosts: c })} /> : null}
        </fieldset>

        {/* The bar stays in reach; the page's own colour under it keeps the form from showing through around it. */}
        <div style={{ position: "sticky", bottom: 0, zIndex: 10, padding: "6px 0 12px", background: "var(--surface-panel)" }}>
          <GlassCard strong padding={12} style={{ boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span role={wrong ? "alert" : undefined}
                style={{ flex: "1 1 260px", minWidth: 0, font: "400 13px/1.4 var(--font-sans)", color: wrong ? "var(--danger-text)" : "var(--text-muted)" }}>{hint}</span>
              {live ? (
                <Button icon="save" loading={busy === "save"} disabled={!dirty || !!busy} onClick={saveLive}>Save changes</Button>
              ) : (
                <>
                  {saved?.isHost ? <Button variant="ghost" icon="trash-2" disabled={!!busy} onClick={() => setAsking("delete")}>Delete draft</Button> : null}
                  <Button variant="secondary" loading={busy === "draft"} disabled={!!busy} onClick={saveDraft}>Save draft</Button>
                  <Button icon="send" loading={busy === "publish"} disabled={!!busy} onClick={askPublish}>Publish event</Button>
                </>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      <Dialog open={asking === "publish"} onClose={busy ? undefined : () => setAsking(null)} icon="send" title={`Publish ${title || "this event"}?`} width={540}
        description={check.start ? `${wallText(check.start, form.zone)} ${zoneShort(form.zone, check.start)}${form.place ? ` · ${form.place.name}` : ""}` : undefined}
        footer={<>
          <Button variant="ghost" onClick={() => setAsking(null)} disabled={!!busy}>Keep editing</Button>
          <Button icon="send" loading={busy === "publish"} onClick={() => { void run(true); }}>Publish event</Button>
        </>}>
        <KV k="Who can see it" v={form.visibility === "public" ? "Everyone" : form.visibility === "squad" ? "Squad members only" : "Anyone with the link"} />
        <KV k="Who can join" v={`${GENDER_LABEL[gender]}${minAgeOf(form) != null ? ` · ${minAgeOf(form)}+` : ""}`} />
        <KV k="Seats" v={seats == null ? "No limit" : plural(seats, "seat")} />
        {shownTiers.map(t => {
          const pm = form.paid ? priceMinorOf(t.price) : null;
          return (
            <KV key={t.key} k={t.name.trim() || "General entry"}
              v={pm == null ? "Free" : <span>Runner pays <span style={kStrong}>{paise(pm + feeMinorOf(pm, fees))}</span> · you get <span style={kStrong}>{paise(pm)}</span></span>} />
          );
        })}
        <p style={{ font: "400 13px/1.5 var(--font-sans)", color: "var(--text-body)", margin: "12px 0 0" }}>
          {form.paid
            ? `Runners pay a ${fees.bps / 100}% pacr fee on top of each price, plus ${fees.gstBps / 100}% GST on that fee; the price is yours, paid out a day after the event ends. That fee is fixed for this event once it’s live. `
            : ""}
          Once it’s live the date and time can’t be moved{form.paid ? ", and a ticket’s price can’t change after someone has bought it" : ""}.
          {refundCharged ? " Refunds you make, and cancelling the event, carry Razorpay’s payment charge: about 2.4% of each refunded booking, taken from your payout." : ""}
        </p>
      </Dialog>

      <Dialog open={asking === "delete"} onClose={busy ? undefined : () => setAsking(null)} icon="trash-2" tone="danger" title="Delete this draft?"
        description="The draft and its pictures are removed. This can’t be undone."
        footer={<>
          <Button variant="ghost" onClick={() => setAsking(null)} disabled={!!busy}>Keep it</Button>
          <Button variant="danger" loading={busy === "delete"} onClick={() => { void remove(); }}>Delete draft</Button>
        </>} />

      <Dialog open={asking === "leave"} onClose={() => { pending.current = null; setAsking(null); }} icon="circle-alert" tone="warning"
        title={saved ? "Leave without saving?" : "Discard this event?"}
        description={saved ? "The changes you made since the last save will be lost." : "Nothing has been saved yet."}
        footer={<>
          <Button variant="ghost" onClick={() => { pending.current = null; setAsking(null); }}>Keep editing</Button>
          <Button variant="danger" onClick={leaveNow}>{saved ? "Leave" : "Discard"}</Button>
        </>} />
    </div>
  );
}

/** Where a paid event's money goes: masked, or what is still needed before it can go live. */
function PayoutCard({ state, hostName, squad, need, onCheck }: {
  state: "loading" | api.PayoutAccount | null; hostName: string; squad: boolean; need: boolean; onCheck: () => void;
}) {
  if (state === null) return null;
  const s = state === "loading" ? null : state;
  const acc = s?.account ?? null;
  const main = !s ? "Checking…"
    : acc ? (acc.method === "upi" ? `UPI · ${acc.upi ?? ""}` : `Bank account ···· ${acc.account_last4 ?? ""}${acc.ifsc ? ` · ${acc.ifsc}` : ""}`)
    : s.ready ? "On file, added by the owner" : "Not added yet";
  const sub = !s ? ""
    : acc ? acc.account_name
    : s.ready ? `${hostName}’s ticket money goes to the owner’s account.`
    : s.can_edit ? "Where pacr sends your ticket money. Needed to publish: add them on the Money page."
    : squad ? `${hostName}’s owner has to add them on the Money page before this can go live.` : "Needed before this can go live.";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: 14, borderRadius: 12, background: "var(--surface-panel)",
      border: `1px solid ${need ? "var(--danger-text)" : "var(--border-subtle)"}` }}>
      <Icon name="wallet" size={18} color="var(--text-muted)" />
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <div style={kMuted}>Payout details</div>
        <div style={kStrong}>{main}</div>
        {sub ? <div style={kMuted}>{sub}</div> : null}
      </div>
      {s && !s.ready ? <Button variant="ghost" size="sm" icon="refresh-cw" onClick={onCheck}>Check again</Button> : null}
      {s?.can_edit ? (
        <Link className="pc-btn pc-btn--secondary pc-btn--sm" href="/money" target="_blank"><Icon name="external-link" size={15} />{s.ready ? "Change in Money" : "Add in Money"}</Link>
      ) : null}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div style={{ maxWidth: 880, display: "flex", flexDirection: "column", gap: 12 }}>
      <Skeleton width={90} height={12} />
      {[0, 1, 2].map(i => (
        <GlassCard key={i}>
          <Skeleton width={140} height={16} /><Skeleton lines={3} height={12} gap={12} style={{ marginTop: 16 }} />
        </GlassCard>
      ))}
    </div>
  );
}
