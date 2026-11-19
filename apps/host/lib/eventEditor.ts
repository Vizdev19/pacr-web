"use client";

// The event editor's data layer: the web twin of the pacr app's
// src/services/eventHosting.ts (app/event-create.tsx), over the same RPCs.
//
//   loadEvent        get_event_for_edit       a draft or a live event as a form
//   saveEvent        create_event (a new one), then save_event (the row and
//                    its setup, whole or not at all), set_event_questions,
//                    and publish_event when asked
//   deleteDraft      delete_draft_event
//   eventRules       event_pricing            paid open? the fee and the limits
//   cohostCandidates event_cohost_candidates  squadmates and mutual follows
//   myVenues         my_event_venues          places this host has used
//
// The rules the app's form keeps are kept here too:
//   · An event's times are times at the event (lib/eventZone.ts). A live
//     event's start and end are fixed (schedule_locked), and its time zone
//     changes only with its time, so for a live event none of the three is sent.
//   · A ticket type's price is fixed once it has sold (price_locked): a sold
//     type's price is left out of the save, which the server reads as "as it is".
//   · A limit can't go under the seats taken (below_sold).
//   · Visibility and the type are sent only when the host picked another.
//   · What this editor doesn't show is never sent, so it stays as it is: the
//     past-event photos (the app's). The older web editor's sections (race
//     details, the event-day schedule, the course map and facts, good to know,
//     what's included, the meeting and refund notes) are here too, sent to
//     update_event only when the host changed them.
//   · The database may be older than this page (pacr migrations 20270119 to
//     20270125 are not live everywhere yet): sale options and registration
//     questions are offered only when the event's own read carries them, and a
//     save that meets a server without them says so instead of failing.

import { ApiError, signedUrls } from "./api";
import { DEFAULT_ZONE, browserZone, instantOf, wallOf, zoneKnown, type Wall } from "./eventZone";
import { getSupabase } from "./supabase";

// ─── Types ──────────────────────────────────────────────────────────────────

export type EventKind = "race" | "run" | "workshop" | "social";
export const EVENT_KINDS: { key: EventKind; label: string; note: string }[] = [
  { key: "race", label: "Race", note: "Timed, with a start and a finish line." },
  { key: "run", label: "Run", note: "A group run: easy, long or a session." },
  { key: "workshop", label: "Workshop", note: "A clinic, a talk or a class." },
  { key: "social", label: "Social", note: "A meet-up where running is optional." },
];
/** The app's tags (the database's event_tag_list, less "Social", which the type took over). */
export const EVENT_TAGS = [
  "5K", "10K", "Half marathon", "Marathon", "Trail", "Track", "Community run", "Long run", "Intervals", "Beginner-friendly",
] as const;
export const MAX_TAGS = 5;
export const MAX_TIERS = 6;
export const MAX_COHOSTS = 5;
export const MAX_QUESTIONS = 6;
/** The database's limits (event_validate), as the older web editor had them. */
export const TITLE_MAX = 80;
export const DESC_MAX = 2000;

export type Visibility = "public" | "link" | "squad";
export type GenderRule = "all" | "women" | "men" | "women_nb";
export type AgeRule = "all" | "16" | "18" | "custom";
export const GENDER_LABEL: Record<GenderRule, string> = {
  all: "Everyone", women: "Women only", men: "Men only", women_nb: "Women and non-binary",
};

export type HostRef = { kind: "squad" | "organizer"; id: string };
export type EventPlace = { name: string; address: string | null; lat: number | null; lng: number | null; googlePlaceId: string | null };
export type Person = { userId: string; name: string; avatarUrl?: string; meta: string };
/** The poster: already stored (path, signed url), or cropped here and not uploaded yet (blob, with an object url). */
export type FormImage = { path: string | null; url: string | null; blob: Blob | null };

export type TierDraft = {
  key: string;
  id: string | null;
  name: string;
  /** As typed. */
  capacity: string;
  unlimited: boolean;
  /** Seats already taken, so the form can say why the limit can't go lower. */
  taken: number;
  /** Rupees, as typed ("499", "99.50"); "" on a free event. What the host gets. */
  price: string;
  /** When this type goes on sale; null = as soon as the event is published. */
  opensAt: Wall | null;
  /** When this type alone stops selling (an early bird's last day); null = with registration. */
  closesEarlyAt: Wall | null;
  /** Goes on sale when the type above it has sold out or stopped selling. */
  afterPrev: boolean;
  /** Not shown or sold: seats the host gives out. */
  hidden: boolean;
};

export type QuestionDraft = {
  key: string;
  id: string | null;
  kind: "choice" | "text" | "emergency";
  label: string;
  /** For a choice, as typed: "S, M, L". */
  options: string;
  required: boolean;
};
/** The questions a race usually asks, one click each. */
export const QUESTION_PRESETS: { name: string; kind: QuestionDraft["kind"]; label: string; options: string }[] = [
  { name: "T-shirt size", kind: "choice", label: "T-shirt size", options: "XS, S, M, L, XL, XXL" },
  { name: "Age group", kind: "choice", label: "Age group", options: "Under 18, 18–34, 35–49, 50 and over" },
  { name: "Name on the bib", kind: "text", label: "Name on the bib", options: "" },
  { name: "Emergency contact", kind: "emergency", label: "Emergency contact", options: "" },
  { name: "Your own question", kind: "text", label: "", options: "" },
];
export const optionsOf = (typed: string): string[] =>
  typed.split(",").map(o => o.trim().replace(/\s+/g, " ")).filter((o, i, a) => o && a.indexOf(o) === i).slice(0, 12);

export type EventForm = {
  visibility: Visibility;
  kind: EventKind;
  title: string;
  description: string;
  /** The event's time zone: every time below is a clock reading there. */
  zone: string;
  startsAt: Wall;
  endsAt: Wall;
  /** When registration closes; null = when the event starts. */
  closesAt: Wall | null;
  /** The most tickets one booking may hold, as typed; "" = pacr's cap. */
  maxPerOrder: string;
  /** A place picked from the search (or a venue used before): it has a pin. */
  place: EventPlace | null;
  /** What's typed in the location field while nothing is picked. */
  placeText: string;
  tags: string[];
  cohosts: Person[];
  /** Free, or every ticket type priced. */
  paid: boolean;
  tiers: TierDraft[];
  age: AgeRule;
  /** The custom minimum age, as typed. */
  ageMin: string;
  gender: GenderRule;
  cover: FormImage | null;
  questions: QuestionDraft[];
  /** The event page's own sections, as the older web editor had them. */
  details: EventDetails;
};

// ─── The event page's sections ──────────────────────────────────────────────
// What runners read on the event's page below the basics (Events.dc.html): the
// race details, the event-day timeline, the course, good to know, what's
// included, and two notes. The database's limits (event_validate,
// event_validate_content): distances up to 6, each 0.1 to 250 km; schedule up
// to 12 × {time 20, label 60, note 160}; course facts up to 6 × {label 20,
// value 30}; FAQ up to 8 × {q 80, a 500}; included up to 12 × 30; terrain 40;
// meeting note 120; refund note 300. A row without its main field is refused.

export type Surface = "" | "road" | "trail" | "track" | "mixed";
export const SURFACES: { value: Surface; label: string }[] = [
  { value: "", label: "Not set" }, { value: "road", label: "Road" }, { value: "trail", label: "Trail" },
  { value: "track", label: "Track" }, { value: "mixed", label: "Mixed" },
];
export type ScheduleRow = { key: string; time: string; label: string; note: string };
export type FactRow = { key: string; label: string; value: string };
export type FaqRow = { key: string; q: string; a: string };
export type EventDetails = {
  /** "Gate 2, by the bandstand". Ticket holders are told when it changes on a live event. */
  meetNote: string;
  refundNote: string;
  surface: Surface;
  terrain: string;
  timed: boolean;
  /** As typed: "5, 10, 21.1". The tags add and take away the distances they stand for. */
  distances: string;
  schedule: ScheduleRow[];
  course: FactRow[];
  faq: FaqRow[];
  /** One per line, as typed. */
  included: string;
  /** The course map, 16:9. */
  courseMap: FormImage | null;
  /** The distances (km × 100) the tags put in, and whether the surface is the tags': only these go when a tag goes. Never sent. */
  tagKm: number[];
  tagSurface: boolean;
};
export const DETAIL_MAX = { schedule: 12, course: 6, faq: 8, included: 12, distances: 6 };
export const emptyDetails = (): EventDetails => ({
  meetNote: "", refundNote: "", surface: "", terrain: "", timed: false, distances: "", schedule: [], course: [], faq: [], included: "", courseMap: null,
  tagKm: [], tagSurface: false,
});

/** "5, 10 21.1" → [5, 10, 21.1]; null when something typed isn't a number. */
export function distancesOf(typed: string): number[] | null {
  const nums = typed.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).map(Number);
  return nums.some(n => !Number.isFinite(n)) ? null : nums;
}
const kmKey = (n: number) => Math.round(n * 100);
const fmtKm = (n: number) => String(kmKey(n) / 100);
const includedOf = (typed: string) => typed.split("\n").map(s => s.trim()).filter(Boolean);

/** The details as update_event stores them: what a save compares, key by key, with what the server has. */
export type DetailsWire = {
  meet_note: string; refund_note: string; surface: string | null; terrain: string; timed: boolean; distances_km: number[];
  schedule: { time: string; label: string; note: string }[]; course_facts: { label: string; value: string }[];
  faq: { q: string; a: string }[]; included: string[];
};
export function detailsWire(d: EventDetails): DetailsWire {
  const km = distancesOf(d.distances) ?? [];
  return {
    meet_note: d.meetNote.trim(), refund_note: d.refundNote.trim(), surface: d.surface || null, terrain: d.terrain.trim(), timed: d.timed,
    distances_km: [...new Set(km.map(kmKey))].sort((a, b) => a - b).map(k => k / 100),
    // A row left wholly empty is dropped; one with only its main field missing is stopped by checkForm first.
    schedule: d.schedule.map(r => ({ time: r.time.trim(), label: r.label.trim(), note: r.note.trim() })).filter(r => r.label),
    course_facts: d.course.map(r => ({ label: r.label.trim(), value: r.value.trim() })).filter(r => r.label),
    faq: d.faq.map(r => ({ q: r.q.trim(), a: r.a.trim() })).filter(r => r.q),
    included: includedOf(d.included),
  };
}

/**
 * The tags stand for some distances and a surface (5K → 5 km, Trail → trail). Turning a tag on adds what it stands
 * for when it isn't there yet, and turning it off takes away only what a tag put there (tagKm, tagSurface): a
 * distance or surface the host typed or picked stays, and a tag turned on and off again leaves the event as it was.
 */
export function withTags(d: EventDetails, oldTags: string[], newTags: string[]): EventDetails {
  const was = derivedFromTags(oldTags).distances_km.map(kmKey), now = derivedFromTags(newTags).distances_km.map(kmKey);
  const wasSurface = derivedFromTags(oldTags).surface, nowSurface = derivedFromTags(newTags).surface;
  const gone = was.filter(k => !now.includes(k) && d.tagKm.includes(k));
  const cur = distancesOf(d.distances);
  let distances = d.distances, tagKm = d.tagKm.filter(k => !gone.includes(k));
  if (cur) {
    const keys = cur.map(kmKey);
    const added = now.filter(k => !was.includes(k) && !keys.includes(k));
    const next = [...new Set([...keys.filter(k => !gone.includes(k)), ...added])].sort((a, b) => a - b);
    if (next.join() !== keys.join()) distances = next.map(k => fmtKm(k / 100)).join(", ");
    tagKm = [...tagKm, ...added];
  } else {
    // Mid-typing ("5, 1O"): what a new tag stands for is added as text; nothing typed is taken away.
    const added = now.filter(k => !was.includes(k));
    if (added.length) distances = [d.distances.trim().replace(/,\s*$/, ""), ...added.map(k => fmtKm(k / 100))].filter(Boolean).join(", ");
    tagKm = [...tagKm, ...added];
  }
  let surface = d.surface, tagSurface = d.tagSurface;
  if (nowSurface !== wasSurface) {
    if (nowSurface && (d.surface === "" || d.tagSurface)) { surface = nowSurface as Surface; tagSurface = true; }
    else if (!nowSurface && d.tagSurface) { surface = ""; tagSurface = false; }
  }
  return { ...d, distances, surface, tagKm: [...new Set(tagKm)], tagSurface };
}

/** What the server has, so a save sends only what changed where that matters. */
export type Saved = {
  id: string;
  status: "draft" | "published";
  /** The event's host, not a co-host: only they change co-hosts. */
  isHost: boolean;
  host: (HostRef & { name: string }) | null;
  startsAt: string;
  endsAt: string;
  zone: string;
  closesAt: string | null;
  coverPath: string | null;
  tags: string[];
  kind: EventKind;
  visibility: Visibility;
  hadQuestions: boolean;
  /** The place as the server has it (placeKey): sent again only when the host picked another. */
  place: string;
  /** The event page's sections as the server has them (detailsWire), and the course map's file. */
  details: DetailsWire;
  mapPath: string | null;
  /** Each ticket type's sale times as the server has them, by type id: sent back exactly when the host didn't change them. */
  saleTimes: Record<string, { opensAt: string | null; closesEarlyAt: string | null }>;
};

/** pacr's fee rate, the GST rate on it, the cap on tickets per booking, and the price range (paise). */
export type FeeRules = { bps: number; gstBps: number; maxPerOrder: number; priceMinMinor: number; priceMaxMinor: number };
export const DEFAULT_FEES: FeeRules = { bps: 500, gstBps: 1800, maxPerOrder: 10, priceMinMinor: 1000, priceMaxMinor: 5000000 };

/** What this database can do for the event. Unknown (null) for one that isn't saved yet. */
export type Features = {
  /** Sale options on a ticket type (pacr 20270124120000). */
  saleOptions: boolean | null;
  /** Registration questions (pacr 20270125120000). */
  questions: boolean | null;
};

export type Loaded = {
  form: EventForm;
  saved: Saved;
  fees: FeeRules;
  features: Features;
  /** Seats sold and kept. */
  sold: number;
  /** Past-event photos on the event: the app's to change, kept as they are here. */
  galleryCount: number;
};

// ─── Refusals ───────────────────────────────────────────────────────────────

export type EditorFail =
  | "squad_not_verified" | "not_allowed" | "email_required" | "organizer_not_approved" | "title_required" | "too_long"
  | "invalid_time" | "place_required" | "invalid_place" | "host_limit" | "blocked_content" | "incomplete"
  | "below_sold" | "tier_has_orders" | "invalid_tiers" | "invalid_capacity" | "invalid_cohost" | "too_many_cohosts"
  | "invalid_sales_close" | "schedule_locked" | "event_closed" | "not_found" | "already_published" | "not_draft"
  | "invalid_price" | "price_locked" | "payout_account_required" | "paid_not_open" | "host_owes" | "host_suspended"
  | "invalid_questions" | "question_has_answers" | "contact_question" | "invalid_sales_open" | "invalid_sale_options"
  | "invalid_max_per_order" | "invalid_tags" | "invalid_age" | "invalid_gender" | "invalid_visibility" | "invalid_kind"
  | "invalid_cover" | "invalid_content" | "invalid_distances" | "invalid_patch" | "upload_failed" | "signed_out" | "unavailable" | "error"
  // Not the database's: a publish held back because this database dropped part of the form (see saveEvent).
  | "sale_options_off" | "questions_off";

const FAILS: EditorFail[] = [
  "squad_not_verified", "not_allowed", "email_required", "organizer_not_approved", "title_required", "too_long",
  "invalid_time", "place_required", "invalid_place", "host_limit", "blocked_content", "incomplete",
  "below_sold", "tier_has_orders", "invalid_tiers", "invalid_capacity", "invalid_cohost", "too_many_cohosts",
  "invalid_sales_close", "schedule_locked", "event_closed", "not_found", "already_published", "not_draft",
  "invalid_price", "price_locked", "payout_account_required", "paid_not_open", "host_owes", "host_suspended",
  "invalid_questions", "question_has_answers", "contact_question", "invalid_sales_open", "invalid_sale_options",
  "invalid_max_per_order", "invalid_tags", "invalid_age", "invalid_gender", "invalid_visibility", "invalid_kind",
  "invalid_cover", "invalid_content", "invalid_distances", "invalid_patch",
];

/** The database's reason from an error message: the code itself, or the longest code the message carries. */
function reasonOf(message: string | undefined | null, code?: string | null): EditorFail {
  const m = String(message ?? "").trim();
  if (/jwt|PGRST301/i.test(m) || code === "PGRST301") return "signed_out";
  if (code === "PGRST202" || m.includes("Could not find the function")) return "unavailable";
  const exact = FAILS.find(f => f === m);
  if (exact) return exact;
  return [...FAILS].sort((a, b) => b.length - a.length).find(f => m.includes(f)) ?? "error";
}

/** Every refusal in plain words: a past-tense-free title and what to do about it. */
export function editorFailCopy(reason: EditorFail): { title: string; body: string } {
  switch (reason) {
    case "email_required": return { title: "Add an email first", body: "Hosting needs an email on your pacr account, so pacr can reach you about your events. Add one in the pacr app: Settings, then Email." };
    case "organizer_not_approved": return { title: "Not approved yet", body: "You can create events once pacr approves your organizer account." };
    case "squad_not_verified": return { title: "Squad not verified", body: "Only verified squads host events. The squad’s owner can ask for the badge in Settings." };
    case "host_suspended": return { title: "Hosting is paused", body: "This organizer account is paused. Write to support@pacr.life." };
    case "not_allowed": return { title: "Not yours to change", body: "You can’t host for this squad or account, or this part of the event is for its host, not co-hosts." };
    case "title_required": return { title: "Add a name", body: "The event needs a name." };
    case "too_long": return { title: "Too long", body: "Shorten the name (80 characters), the description (2,000) or the location’s name (120) and save again." };
    case "invalid_time": return { title: "Check the date and time", body: "The event has to start in the future, end after it starts, and last no more than 14 days." };
    case "place_required": return { title: "Add a location", body: "Runners need to know where to go." };
    case "invalid_place": return { title: "Pick the location again", body: "That place didn’t come with a usable map pin." };
    case "incomplete": return { title: "Pick a place on the map", body: "Choose the location from the search results, so it has a pin runners can navigate to." };
    case "host_limit": return { title: "That’s a lot of events", body: "A host can have 20 drafts and upcoming events at a time. Finish or delete one first." };
    case "blocked_content": return { title: "Can’t use those words", body: "Something on the event isn’t allowed on pacr: look at the name, the description, the ticket names, the questions, the notes and the event page’s sections (event day, course, good to know, included). Change it and save again." };
    case "below_sold": return { title: "The limit is too low", body: "More runners already hold that ticket than the limit you set." };
    case "tier_has_orders": return { title: "That ticket type has runners", body: "A ticket type people have booked can’t be removed." };
    case "invalid_tiers": return { title: "Check the ticket types", body: "Every ticket type needs a name of up to 40 characters, and an event can have up to 6." };
    case "invalid_capacity": return { title: "Check the limit", body: "A limit is a number from 1 to 1,00,000, or no limit." };
    case "schedule_locked": return { title: "The date and time are fixed", body: "A live event can’t be moved. To change when it happens, cancel it and create a new one." };
    case "invalid_sales_close": return { title: "Check when sales stop", body: "Registration, and any ticket type that stops early, has to close before the event starts or when it does." };
    case "invalid_cohost": return { title: "Can’t add that co-host", body: "Co-hosts are your squadmates and people you follow who follow you back." };
    case "too_many_cohosts": return { title: "Too many co-hosts", body: "An event can have up to 5 co-hosts." };
    case "event_closed": return { title: "This event is closed", body: "It has ended or was cancelled, or its registration questions closed when it started, so that can’t be changed." };
    case "not_found": return { title: "Event not found", body: "It may have been deleted." };
    case "already_published": return { title: "Already live", body: "This event is published." };
    case "not_draft": return { title: "Can’t delete this", body: "Only a draft nobody has booked can be deleted. Cancel a live event instead." };
    case "paid_not_open": return { title: "Paid tickets aren’t open yet", body: "pacr is still switching paid tickets on. Make the event free for now, or keep it as a draft." };
    case "invalid_price": return { title: "Check the price", body: "A ticket costs between ₹10 and ₹50,000." };
    case "price_locked": return { title: "That price is fixed", body: "Runners have already bought this ticket, so its price can’t change. Add a new ticket type instead." };
    case "payout_account_required": return { title: "Add payout details first", body: "A paid event needs somewhere to send the ticket money. The squad’s owner, or the organizer, adds it in Money." };
    case "host_owes": return { title: "This host owes pacr money", body: "Refund charges and refunds from earlier events add up to more than ₹500 beyond what pacr is holding. Settle it with support@pacr.life to publish paid events again." };
    case "invalid_questions": return { title: "Check the questions", body: "Each question needs its own words (no two the same, up to 60 characters), and a choice needs 2 to 12 options of up to 30 characters each." };
    case "contact_question": return { title: "That question can’t be asked", body: "pacr doesn’t pass runners’ phone numbers, emails or handles to hosts. For the day itself, add an emergency contact question, which pacr keeps." };
    case "question_has_answers": return { title: "Runners have answered that", body: "A question someone has answered can be reworded or given more options, but not removed, and an option someone chose has to stay." };
    case "invalid_sales_open": return { title: "Check when tickets go on sale", body: "A ticket type has to go on sale before the event starts, and before it stops selling." };
    case "invalid_sale_options": return { title: "Check the sale options", body: "A ticket type can open after the one above only if that one has a limit or a last day, and isn’t hidden. At least one type has to be on show." };
    case "invalid_max_per_order": return { title: "Check tickets per booking", body: "Leave it empty for pacr’s limit, or set a number from 1 up to that limit." };
    case "invalid_tags": return { title: "Check the tags", body: "Pick up to 5 tags from the list." };
    case "invalid_age": return { title: "Check the minimum age", body: "A minimum age is between 5 and 80." };
    case "invalid_gender": return { title: "Check who can join", body: "Pick one of the choices under Who can join." };
    case "invalid_visibility": return { title: "Check who can see it", body: "Squad members only is for events a squad hosts." };
    case "invalid_kind": return { title: "Check the type", body: "Pick race, run, workshop or social." };
    case "invalid_cover": return { title: "Couldn’t use that picture", body: "Add the poster or the course map again." };
    case "invalid_content": return { title: "Check the event’s details", body: "Each event-day step needs what happens, each course fact a name and each answer its question, and what’s included is up to 12 lines of 30 characters." };
    case "invalid_distances": return { title: "Check the distances", body: "Up to 6 distances, each from 0.1 to 250 km." };
    case "upload_failed": return { title: "Couldn’t upload a picture", body: "Everything else is as you left it. Check your connection and save again." };
    case "signed_out": return { title: "You’ve been signed out", body: "Sign in again, then save." };
    case "sale_options_off": return { title: "Saved as a draft, not published", body: "Sale options aren’t switched on yet, so the ticket types were saved without them. Look the tickets over, then publish." };
    case "questions_off": return { title: "Saved as a draft, not published", body: "Registration questions aren’t switched on yet, so the event was saved without them. Publish it as it is if that’s fine." };
    case "unavailable": return { title: "Not switched on yet", body: "This part of events isn’t switched on yet. Nothing was changed." };
    default: return { title: "Couldn’t reach pacr", body: "Check your connection and try again. Nothing was changed." };
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false; reason: EditorFail };

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  try {
    const { data, error } = await getSupabase().rpc(fn, args);
    if (error) {
      console.warn(`[host] ${fn} failed`, error.message);
      return { ok: false, reason: reasonOf(error.message, error.code) };
    }
    return { ok: true, value: data as T };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** For useLoad: a refusal as the ApiError its callers already handle (signed_out goes to /signin). */
export class EditorError extends ApiError {
  fail: EditorFail;
  constructor(fail: EditorFail) {
    super(fail);
    this.fail = fail;
  }
}
function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new EditorError(r.reason);
  return r.value;
}

// ─── Small things ───────────────────────────────────────────────────────────

/** The time now, for a save: "in the future" is judged when the host presses the button, not when the page was read. */
export const clockNow = () => Date.now();

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;
const numOrNull = (v: unknown) => (v == null || v === "" ? null : Number(v));
type Json = Record<string, unknown>;
const list = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** "499" → 49900; null when it isn't a price. */
export function priceMinorOf(typed: string): number | null {
  const n = Number(typed);
  return typed.trim() !== "" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}
/** What pacr adds on top of one ticket: its fee plus the GST on it (the server's event_fee_minor). */
export function feeMinorOf(priceMinor: number, fees: FeeRules): number {
  const fee = Math.round(priceMinor * fees.bps / 10000);
  return fee + Math.round(fee * fees.gstBps / 10000);
}
/** A sold ticket type keeps its price (the server's price_locked). */
export const priceLocked = (t: TierDraft) => !!t.id && t.taken > 0;
/** A price as typed: digits, one point, two decimals. */
export const cleanPrice = (v: string) => {
  const [a, ...b] = v.replace(/[^\d.]/g, "").split(".");
  return a.slice(0, 6) + (b.length ? `.${b.join("").slice(0, 2)}` : "");
};
const rupees = (minor: number) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

export const minAgeOf = (f: Pick<EventForm, "age" | "ageMin">): number | null =>
  f.age === "all" ? null : f.age === "custom" ? parseInt(f.ageMin, 10) || null : Number(f.age);

/** Every type's limit added up; null when any has none. */
export function totalCapacity(tiers: TierDraft[]): number | null {
  if (tiers.some(t => t.unlimited)) return null;
  return tiers.reduce((n, t) => n + (parseInt(t.capacity, 10) || 0), 0);
}

/** What the tags say about the event, for the Events grid's filters: distances and surface. */
function derivedFromTags(tags: string[]): { distances_km: number[]; surface: string | null } {
  const km: number[] = [];
  if (tags.includes("5K")) km.push(5);
  if (tags.includes("10K")) km.push(10);
  if (tags.includes("Half marathon")) km.push(21.1);
  if (tags.includes("Marathon")) km.push(42.2);
  const trail = tags.includes("Trail"), track = tags.includes("Track");
  return { distances_km: km, surface: trail && track ? "mixed" : trail ? "trail" : track ? "track" : null };
}
const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every(t => b.includes(t));
const knownTags = (tags: string[]) => tags.filter(t => (EVENT_TAGS as readonly string[]).includes(t));
/** Tags on the event this form doesn't offer (an older "Social"): kept on every save, and counted in the five. */
export const otherTags = (tags: string[]) => tags.filter(t => !(EVENT_TAGS as readonly string[]).includes(t));
/**
 * Whether a time in the form is the one the server has, read on a clock in the zone the server has: the form is to
 * the minute, and a saved time with seconds, or in an hour that happens twice when clocks go back, hasn't "moved".
 */
const sameWall = (w: Wall | null, saved: string | null, zone: string) =>
  !w || !saved ? !w && !saved : (() => { const x = wallOf(saved, zone); return x.date === w.date && x.time === w.time; })();

export const newTier = (name = "", capacity = "20"): TierDraft => ({
  key: newKey(), id: null, name, capacity, unlimited: false, taken: 0, price: "", opensAt: null, closesEarlyAt: null, afterPrev: false, hidden: false,
});

/** A fresh form: the day after tomorrow, 7:00 to 8:30 by the browser's clock, one free ticket type for 60. */
export function blankForm(now = new Date()): EventForm {
  const zone = browserZone();
  const today = wallOf(now, zone).date;
  const [y, m, d] = today.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d + 2));
  const date = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
  return {
    visibility: "public", kind: "run", title: "", description: "", zone,
    startsAt: { date, time: "07:00" }, endsAt: { date, time: "08:30" }, closesAt: null, maxPerOrder: "",
    place: null, placeText: "", tags: [], cohosts: [], paid: false, tiers: [newTier("General entry", "60")],
    age: "all", ageMin: "21", gender: "all", cover: null, questions: [], details: emptyDetails(),
  };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** What the form needs before an event exists: may this host price tickets yet, and the fee and limits to show. */
export async function eventRules(): Promise<{ paidAllowed: boolean; fees: FeeRules }> {
  const r = await rpc<Json | null>("event_pricing", {});
  if (!r.ok || !r.value) return { paidAllowed: false, fees: DEFAULT_FEES };
  const d = r.value;
  return {
    paidAllowed: d.paid_allowed === true,
    fees: {
      bps: numOrNull(d.fee_bps) ?? DEFAULT_FEES.bps, gstBps: numOrNull(d.gst_bps) ?? DEFAULT_FEES.gstBps,
      maxPerOrder: numOrNull(d.max_per_order) ?? DEFAULT_FEES.maxPerOrder,
      priceMinMinor: numOrNull(d.price_min_minor) ?? DEFAULT_FEES.priceMinMinor,
      priceMaxMinor: numOrNull(d.price_max_minor) ?? DEFAULT_FEES.priceMaxMinor,
    },
  };
}

/** Places this host has used before, newest first. Empty on any failure: they are only a shortcut. */
export async function myVenues(): Promise<EventPlace[]> {
  const r = await rpc<Json[] | null>("my_event_venues", {});
  if (!r.ok) return [];
  // One chip a place: the list can carry the same place once for every event held there.
  const seen = new Set<string>();
  return list(r.value).filter(v => str(v.name)).map(v => ({
    name: str(v.name), address: str(v.address) || null, lat: numOrNull(v.lat), lng: numOrNull(v.lng), googlePlaceId: str(v.google_place_id) || null,
  })).filter(v => {
    const k = `${v.googlePlaceId ?? ""}|${v.name}|${v.lat ?? ""}|${v.lng ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Squadmates first, then people I follow who follow me back: who can be a co-host. The first 60, or the first 60 matching. */
export async function cohostCandidates(query?: string): Promise<Person[]> {
  const rows = list(unwrap(await rpc<Json[] | null>("event_cohost_candidates", { p_query: query?.trim() || null })));
  const faces = await signedUrls("avatars", rows.map(r => str(r.avatar_path) || null));
  return rows.map(r => ({ userId: str(r.user_id), name: str(r.name) || "Runner", avatarUrl: faces.get(str(r.avatar_path)), meta: str(r.meta) }));
}

/** A draft or a live event as the form holds it. Throws EditorError (event_closed for one that has ended or was cancelled). */
export async function loadEvent(id: string): Promise<Loaded> {
  const e = unwrap(await rpc<Json | null>("get_event_for_edit", { p_event_id: id }));
  if (!e) throw new EditorError("not_found");
  if (e.status !== "draft" && e.status !== "published") throw new EditorError("event_closed");
  const cohosts = list(e.cohosts);
  const coverPath = str(e.cover_path) || null;
  const mapPath = str(e.course_map_path) || null;
  const [imgs, faces] = await Promise.all([
    signedUrls("event-covers", [coverPath, mapPath]),
    signedUrls("avatars", cohosts.map(c => str(c.avatar_path) || null)),
  ]);
  const zone = zoneKnown(str(e.timezone)) ? str(e.timezone) : DEFAULT_ZONE;
  const wall = (v: unknown): Wall | null => (typeof v === "string" && v ? wallOf(v, zone) : null);
  const tiers = list(e.tiers);
  const minAge = numOrNull(e.min_age);
  const kind: EventKind = EVENT_KINDS.some(k => k.key === e.kind) ? (e.kind as EventKind) : "run";
  // One time for the whole event, kept on every ticket type.
  const closesAt = str(tiers.find(t => t.sales_close_at)?.sales_close_at) || null;
  // As the server has it: reading "squad" as anything else would widen a members-only event on the next save.
  const visibility: Visibility = e.visibility === "public" || e.visibility === "squad" ? e.visibility : "link";
  const host = e.host as Json | null;
  const place = e.place as Json | null;
  const questions = Array.isArray(e.questions) ? list(e.questions) : null;
  const tags = Array.isArray(e.tags) ? (e.tags as string[]) : [];
  const form: EventForm = {
    visibility, kind, title: str(e.title), description: str(e.description), zone,
    startsAt: wallOf(str(e.starts_at), zone), endsAt: wallOf(str(e.ends_at), zone), closesAt: wall(closesAt),
    maxPerOrder: numOrNull(e.max_per_order) == null ? "" : String(numOrNull(e.max_per_order)),
    place: place && str(place.name) ? {
      name: str(place.name), address: str(place.address) || null, lat: numOrNull(place.lat), lng: numOrNull(place.lng),
      googlePlaceId: str(place.google_place_id) || null,
    } : null,
    placeText: "",
    tags: knownTags(tags),
    cohosts: cohosts.map(c => ({ userId: str(c.user_id), name: str(c.name) || "Runner", meta: "", avatarUrl: faces.get(str(c.avatar_path)) })),
    paid: tiers.some(t => Number(t.price_minor) > 0),
    tiers: tiers.length ? tiers.map((t, i) => ({
      key: newKey(), id: str(t.id) || null, name: str(t.name), capacity: t.capacity == null ? "" : String(t.capacity),
      unlimited: t.capacity == null, taken: Number(t.taken) || 0,
      price: Number(t.price_minor) > 0 ? rupees(Number(t.price_minor)) : "",
      opensAt: wall(t.sales_open_at), closesEarlyAt: wall(t.closes_early_at),
      afterPrev: i > 0 && !!t.opens_after, hidden: !!t.hidden,
    })) : [newTier("General entry", "60")],
    age: minAge == null ? "all" : minAge === 16 ? "16" : minAge === 18 ? "18" : "custom",
    ageMin: String(minAge ?? 21),
    gender: (["all", "women", "men", "women_nb"] as const).find(g => g === e.gender) ?? "all",
    cover: coverPath ? { path: coverPath, url: imgs.get(coverPath) ?? null, blob: null } : null,
    questions: (questions ?? []).filter(q => q.kind === "choice" || q.kind === "text" || q.kind === "emergency").map(q => ({
      key: newKey(), id: str(q.id) || null, kind: q.kind as QuestionDraft["kind"], label: str(q.label),
      options: Array.isArray(q.options) ? (q.options as string[]).join(", ") : "", required: q.required !== false,
    })),
    details: {
      meetNote: str(e.meet_note), refundNote: str(e.refund_note),
      surface: (["road", "trail", "track", "mixed"] as const).find(x => x === e.surface) ?? "",
      terrain: str(e.terrain), timed: e.timed === true,
      distances: (Array.isArray(e.distances_km) ? (e.distances_km as unknown[]) : []).map(Number).filter(Number.isFinite).map(fmtKm).join(", "),
      schedule: list(e.schedule).map(x => ({ key: newKey(), time: str(x.time), label: str(x.label), note: str(x.note) })),
      course: list(e.course_facts).map(x => ({ key: newKey(), label: str(x.label), value: str(x.value) })),
      faq: list(e.faq).map(x => ({ key: newKey(), q: str(x.q), a: str(x.a) })),
      included: (Array.isArray(e.included) ? (e.included as unknown[]) : []).map(String).join("\n"),
      courseMap: mapPath ? { path: mapPath, url: imgs.get(mapPath) ?? null, blob: null } : null,
      // What the event's tags stand for and it holds: taken away if the host turns those tags off.
      tagKm: derivedFromTags(tags).distances_km.map(kmKey)
        .filter(k => (Array.isArray(e.distances_km) ? (e.distances_km as unknown[]) : []).some(x => kmKey(Number(x)) === k)),
      tagSurface: !!e.surface && e.surface === derivedFromTags(tags).surface,
    },
  };
  return {
    form,
    saved: {
      id: str(e.id), status: e.status, isHost: !!e.is_host,
      host: host && str(host.id) ? { kind: host.kind === "organizer" ? "organizer" : "squad", id: str(host.id), name: str(host.name) } : null,
      startsAt: str(e.starts_at), endsAt: str(e.ends_at), zone, closesAt, coverPath, tags, kind, visibility,
      hadQuestions: (questions ?? []).length > 0, place: placeKey(form),
      details: detailsWire(form.details), mapPath,
      saleTimes: Object.fromEntries(tiers.filter(t => str(t.id)).map(t => [str(t.id), {
        opensAt: str(t.sales_open_at) || null, closesEarlyAt: str(t.closes_early_at) || null,
      }])),
    },
    fees: {
      bps: numOrNull(e.fee_bps) ?? DEFAULT_FEES.bps, gstBps: numOrNull(e.gst_bps) ?? DEFAULT_FEES.gstBps,
      maxPerOrder: numOrNull(e.max_per_order_limit) ?? DEFAULT_FEES.maxPerOrder,
      priceMinMinor: numOrNull(e.price_min_minor) ?? DEFAULT_FEES.priceMinMinor,
      priceMaxMinor: numOrNull(e.price_max_minor) ?? DEFAULT_FEES.priceMaxMinor,
    },
    // The read carries each when the database has it: a tier's sale state (20270124) and the questions (20270125).
    features: { saleOptions: tiers.some(t => "sale_state" in t || "sales_open_at" in t), questions: questions !== null },
    sold: Number(e.sold) || 0,
    galleryCount: Array.isArray(e.gallery_paths) ? e.gallery_paths.length : 0,
  };
}

// ─── What the form still needs ──────────────────────────────────────────────

/** A question the form won't save: no words, or a choice with fewer than two options. */
export const questionBad = (q: QuestionDraft): boolean => !q.label.trim() || (q.kind === "choice" && optionsOf(q.options).length < 2);

export type Check = {
  /** What stands between this form and publishing (or saving a live event), in words. */
  missing: string[];
  /** What a draft needs before it can be saved at all. */
  draftMissing: string[];
  start: Date | null;
  end: Date | null;
  badTime: boolean;
  badClose: boolean;
  badMax: boolean;
  noPin: boolean;
  /** By tier key. */
  tier: Record<string, { capacity?: string; price?: string; opens?: string; early?: string }>;
  /** Paid, and this host has no payout details yet. */
  needPayout: boolean;
  /** The event page's sections, by section. */
  details: { distances?: string; schedule?: string; course?: string; faq?: string; included?: string };
};

/**
 * The app's rules for what a form must hold (app/event-create.tsx), read at
 * `now`. `payoutReady` is null while unknown. `womenOnly` is the event's rule
 * as it will be saved (a women-only squad's events always are).
 */
export function checkForm(
  f: EventForm, saved: Saved | null, fees: FeeRules, opts: { payoutReady: boolean | null; womenOnly: boolean; now: number },
): Check {
  const live = saved?.status === "published";
  const start = instantOf(f.startsAt, f.zone), end = instantOf(f.endsAt, f.zone);
  const s = start?.getTime() ?? NaN, en = end?.getTime() ?? NaN;
  const title = f.title.trim();
  const hasPin = f.place?.lat != null && f.place?.lng != null;
  const typedPlace = f.placeText.trim();
  // A live event's time can't be moved from this form at all.
  const timeMoved = !saved || (!live && (saved.zone !== f.zone
    || !sameWall(f.startsAt, saved.startsAt, saved.zone) || !sameWall(f.endsAt, saved.endsAt, saved.zone)));
  const future = s > opts.now;
  const badRange = !(en > s) || en - s > 14 * 86400000;
  const tier: Check["tier"] = {};
  const at = (w: Wall | null) => instantOf(w, f.zone)?.getTime() ?? null;
  for (const t of f.tiers) {
    const e: Check["tier"][string] = {};
    const cap = parseInt(t.capacity, 10);
    if (!t.unlimited && !(cap >= 1 && cap <= 100000)) e.capacity = "Set a limit from 1 to 1,00,000, or no limit.";
    else if (!t.unlimited && cap < t.taken) e.capacity = `${t.taken.toLocaleString("en-IN")} already taken, so it can’t go lower.`;
    if (f.paid && !priceLocked(t)) {
      const pm = priceMinorOf(t.price);
      if (pm == null || pm < fees.priceMinMinor) e.price = `₹${rupees(fees.priceMinMinor)} or more.`;
      else if (pm > fees.priceMaxMinor) e.price = `₹${(fees.priceMaxMinor / 100).toLocaleString("en-IN")} at most.`;
    }
    const open = at(t.opensAt), early = at(t.closesEarlyAt);
    if (t.opensAt && (open == null || open >= Math.min(s, early ?? Infinity))) e.opens = "Has to be before the event starts, and before this type stops selling.";
    if (t.closesEarlyAt && (early == null || early > s)) e.early = "Has to be before the event starts, or when it does.";
    if (Object.keys(e).length) tier[t.key] = e;
  }
  // Registration closes: never after the start, and a time just picked has to be ahead.
  const close = at(f.closesAt);
  const closeMoved = !saved ? !!f.closesAt : saved.zone !== f.zone || !sameWall(f.closesAt, saved.closesAt, saved.zone);
  const closeLate = !!f.closesAt && (close == null || close > s);
  const closePast = close != null && !closeLate && close <= opts.now && (closeMoved || !live);
  // Tickets per booking: empty is pacr's cap; a women-only event is one each whatever was typed.
  const maxTyped = opts.womenOnly || f.maxPerOrder.trim() === "" ? null : parseInt(f.maxPerOrder, 10);
  const badMax = maxTyped != null && !(maxTyped >= 1 && maxTyped <= fees.maxPerOrder);
  const age = f.age === "custom" ? parseInt(f.ageMin, 10) : null;
  const badAge = f.age === "custom" && !(age != null && age >= 5 && age <= 80);
  const needPayout = f.paid && opts.payoutReady === false;
  // The event page's sections: what update_event would refuse, said before it is sent.
  const d = f.details, dErr: Check["details"] = {};
  const km = distancesOf(d.distances);
  if (km === null) dErr.distances = "Distances are numbers in km, separated by commas.";
  else if (new Set(km.map(kmKey)).size > DETAIL_MAX.distances) dErr.distances = `Up to ${DETAIL_MAX.distances} distances.`;
  else if (km.some(n => n < 0.1 || n > 250)) dErr.distances = "Each distance is from 0.1 to 250 km.";
  if (d.schedule.some(r => !r.label.trim() && (r.time.trim() || r.note.trim()))) dErr.schedule = "Each step needs what happens.";
  if (d.course.some(r => !r.label.trim() && r.value.trim())) dErr.course = "Each fact needs a name.";
  if (d.faq.some(r => !r.q.trim() && r.a.trim())) dErr.faq = "Each answer needs its question.";
  const lines = includedOf(d.included);
  if (lines.length > DETAIL_MAX.included) dErr.included = `Up to ${DETAIL_MAX.included} lines.`;
  // Characters as the database counts them, not UTF-16 units: an emoji is one.
  else if (lines.some(l => [...l].length > 30)) dErr.included = "Each line is up to 30 characters.";
  const detailWords = [
    dErr.distances ? "race distances that fit" : null, dErr.schedule ? "what happens at each event-day step" : null,
    dErr.course ? "a name for each course fact" : null, dErr.faq ? "a question for each answer" : null,
    dErr.included ? "what’s included in up to 12 lines of 30 characters" : null,
  ].filter((x): x is string => !!x);

  const missing: string[] = [];
  if (!title) missing.push("a name");
  if (!start || !end) missing.push("a start and an end");
  else if (badRange && timeMoved) missing.push("an end after the start, within 14 days of it");
  else if (!future && (timeMoved || !live)) missing.push("a start time in the future");
  if (!hasPin) missing.push(typedPlace ? "a location picked from the list" : "a location");
  if (Object.values(tier).some(t => t.capacity)) missing.push("a limit for each ticket type");
  if (Object.values(tier).some(t => t.price)) missing.push("a price for each ticket type");
  if (needPayout) missing.push("payout details");
  if (f.questions.some(questionBad)) missing.push("words (and at least two options for a choice) for each registration question");
  if (Object.values(tier).some(t => t.opens || t.early)) missing.push("ticket sale times that come before the start, and open before they close");
  if (f.tiers.length > 0 && f.tiers.every(t => t.hidden)) missing.push("at least one ticket type that isn’t hidden");
  if (closeLate) missing.push("a time registration closes that isn’t after the start");
  else if (closePast && future) missing.push("a time registration closes that’s still ahead");
  if (badMax) missing.push(`a tickets-per-booking limit between 1 and ${fees.maxPerOrder}`);
  if (badAge) missing.push("a minimum age between 5 and 80");
  missing.push(...detailWords);

  const draftMissing: string[] = [];
  if (!title) draftMissing.push("a name");
  if (!f.place && !typedPlace) draftMissing.push("a location");
  if (!start || !end) draftMissing.push("a start and an end");
  else if (badRange) draftMissing.push("an end after the start, within 14 days of it");
  else if (!future) draftMissing.push("a start time in the future");
  if (closeLate) draftMissing.push("a time registration closes that isn’t after the start");
  if (badMax) draftMissing.push(`a tickets-per-booking limit between 1 and ${fees.maxPerOrder}`);
  if (badAge) draftMissing.push("a minimum age between 5 and 80");
  // What a draft would otherwise save as something else: an empty limit as no limit, an empty price as free, a
  // half-typed sale time as none.
  if (Object.values(tier).some(t => t.capacity)) draftMissing.push("a limit for each ticket type (or no limit)");
  if (Object.values(tier).some(t => t.price)) draftMissing.push("a price for each ticket type (or make the event free)");
  if (Object.values(tier).some(t => t.opens || t.early)) draftMissing.push("ticket sale times that come before the start");
  draftMissing.push(...detailWords);

  return {
    missing, draftMissing, start, end,
    badTime: !start || !end || (badRange && timeMoved) || (!future && (timeMoved || !live)),
    badClose: closeLate || (closePast && future), badMax, noPin: !hasPin, tier, needPayout, details: dErr,
  };
}

/** "a name, a location and a price for each ticket type". */
export const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// ─── The poster ─────────────────────────────────────────────────────────────

const BUCKET = "event-covers";
/** The poster as the app saves it: 2:3. */
export const POSTER = { aspect: 2 / 3, out: { width: 1000, height: 1500 } };
/** The course map as the older web editor saved it: 16:9. */
export const COURSE_MAP = { aspect: 16 / 9, out: { width: 1600, height: 900 } };

/** A picture into the event's own folder ("<event id>/poster-…" or "course-…", what event_image_path_ok allows). */
async function uploadImage(eventId: string, kind: "poster" | "course", jpeg: Blob): Promise<string | null> {
  try {
    const rand = `${Date.now().toString(36)}${crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 10)}`;
    const path = `${eventId}/${kind}-${rand}.jpg`;
    const { error } = await getSupabase().storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
    if (error) {
      console.warn(`[host] ${kind} upload failed`, error.message);
      return null;
    }
    return path;
  } catch {
    return null;
  }
}
async function removeImages(paths: (string | null | undefined)[]): Promise<void> {
  const real = paths.filter((p): p is string => !!p);
  if (!real.length) return;
  try { await getSupabase().storage.from(BUCKET).remove(real); } catch { /* best effort, as in the app */ }
}

// ─── Save ───────────────────────────────────────────────────────────────────

export type SaveOutcome = {
  saved: Saved;
  /** The form with what the save stored: ticket type and question ids, the poster's path. */
  form: EventForm;
  /** Registration questions were in the form and this database has no place for them yet: they are out of `form`. */
  questionsOff: boolean;
  /** Sale options were in the form and this database dropped them: they are out of `form`. */
  saleOff: boolean;
};
/** How far a save got before it stopped: nothing, a new draft with its name, time and place, or everything but what failed. */
export type SaveStage = "none" | "created" | "saved";
/**
 * A failure after the event row exists carries what was saved so far, so the page keeps editing that draft instead
 * of making a second one, and `stage` says how much of the save landed.
 */
export type SaveResult =
  | { ok: true; value: SaveOutcome }
  | { ok: false; reason: EditorFail; partial: SaveOutcome | null; stage: SaveStage };

/** A refusal's words after part of a save landed: never "nothing was changed" when something was. */
export function partialCopy(reason: EditorFail, stage: SaveStage, publishing: boolean): { title: string; body: string } {
  const c = editorFailCopy(reason);
  if (stage === "none") return c;
  const body = c.body.replace(/\s*Nothing was changed\.$/, "").replace(/\s*Everything else is as you left it\.$/, "");
  return {
    title: c.title,
    body: stage === "created"
      ? `${body} A draft was saved with the name, time and place; save again for the rest.`
      : publishing ? `${body} Your changes were saved; the event is still a draft.` : `${body} Everything else was saved.`,
  };
}

const placeJson = (f: Pick<EventForm, "place" | "placeText">) => (f.place
  ? { name: f.place.name, address: f.place.address, lat: f.place.lat, lng: f.place.lng, google_place_id: f.place.googlePlaceId }
  : { name: f.placeText.trim() });
const placeKey = (f: Pick<EventForm, "place" | "placeText">) => JSON.stringify(placeJson(f));

/**
 * Save the form: `prev` is what the server has (null for a new event, which is
 * created as a draft first), `host` who a new event is for. `features` says
 * what this database is known to do for the event.
 */
export async function saveEvent(
  input: EventForm, prev: Saved | null, opts: { host: HostRef; publish: boolean; features: Features },
): Promise<SaveResult> {
  let form = input;
  let saved = prev;
  let questionsOff = false;
  let saleOff = false;
  let stage: SaveStage = "none";
  const fail = (reason: EditorFail): SaveResult => ({ ok: false, reason, partial: saved ? { saved, form, questionsOff, saleOff } : null, stage });
  const start = instantOf(form.startsAt, form.zone), end = instantOf(form.endsAt, form.zone);
  if (!start || !end) return fail("invalid_time");
  const startsAt = start.toISOString(), endsAt = end.toISOString();
  const iso = (w: Wall | null) => instantOf(w, form.zone)?.toISOString() ?? null;
  const firstCap = form.tiers[0]?.unlimited ? null : parseInt(form.tiers[0]?.capacity ?? "", 10) || null;

  // 1: the event row.
  if (!saved) {
    const res = await rpc<string>("create_event", {
      p_host_kind: opts.host.kind, p_host_id: opts.host.id, p_kind: form.kind,
      p_title: form.title.trim(), p_description: form.description.trim() || null,
      p_starts_at: startsAt, p_ends_at: endsAt, p_timezone: form.zone, p_place: placeJson(form),
      p_meet_note: form.details.meetNote.trim() || null, p_visibility: form.visibility, p_women_only: form.gender === "women",
      p_capacity: firstCap, p_refund_note: form.details.refundNote.trim() || null,
    });
    if (!res.ok) return fail(res.reason);
    saved = {
      id: res.value, status: "draft", isHost: true, host: null, startsAt, endsAt, zone: form.zone, closesAt: null, coverPath: null,
      tags: [], kind: form.kind, visibility: form.visibility, hadQuestions: false, place: placeKey(form),
      // What create_event stored: the two notes; the rest of the page's sections go with the save below.
      details: { ...detailsWire(emptyDetails()), meet_note: form.details.meetNote.trim(), refund_note: form.details.refundNote.trim() },
      mapPath: null, saleTimes: {},
    };
    stage = "created";
  }
  const id = saved.id;
  const live = saved.status === "published";
  const hadQuestions = saved.hadQuestions;
  // Against the tags the form knows: one it doesn't offer (an older "Social") is not a change the host made.
  const tagsChanged = !sameTags(knownTags(saved.tags), form.tags);

  // 1b: an edit's changes to the event's own row. They go with everything below in one call, so a save lands whole or not at all.
  const patch: Json = {};
  if (prev) {
    Object.assign(patch, { title: form.title.trim(), description: form.description.trim() });
    // The place goes only when the host picked another: sending the same one again would mark it freshly checked with Google.
    if (prev.place !== placeKey(form)) patch.place = placeJson(form);
    if (prev.kind !== form.kind) patch.kind = form.kind;
    // Only when the host picked another: who can see an event never changes as a side effect of editing its words.
    if (prev.visibility !== form.visibility) patch.visibility = form.visibility;
    // A live event's start, end and zone are fixed. A draft's go only when they moved.
    if (!live) {
      const zoneMoved = prev.zone !== form.zone;
      const startMoved = zoneMoved || !sameWall(form.startsAt, prev.startsAt, prev.zone);
      const endMoved = zoneMoved || !sameWall(form.endsAt, prev.endsAt, prev.zone);
      if (startMoved) patch.starts_at = startsAt;
      if (endMoved || startMoved) patch.ends_at = endsAt;
      if (prev.zone !== form.zone || startMoved || endMoved) patch.timezone = form.zone;
    }
  }

  // 1c: the event page's sections, each only when the host changed it (the tags' distances and surface are in here,
  // put there by the form when the tags changed).
  const wire = detailsWire(form.details);
  for (const k of Object.keys(wire) as (keyof DetailsWire)[]) {
    if (JSON.stringify(wire[k]) !== JSON.stringify(saved.details[k])) patch[k] = wire[k];
  }

  // 2: the pictures, uploaded into the event's folder before the save that points at them.
  let newCover: string | null = null, newMap: string | null = null;
  if (form.cover?.blob) {
    newCover = await uploadImage(id, "poster", form.cover.blob);
    if (!newCover) return fail("upload_failed");
    patch.cover_path = newCover;
  } else if (!form.cover && saved.coverPath) {
    patch.cover_path = null;
  }
  const map = form.details.courseMap;
  if (map?.blob) {
    newMap = await uploadImage(id, "course", map.blob);
    if (!newMap) { await removeImages([newCover]); return fail("upload_failed"); }
    patch.course_map_path = newMap;
  } else if (!map && saved.mapPath) {
    patch.course_map_path = null;
  }

  // 3: tags, who can join, ticket types, co-hosts. (No gallery_paths: the past photos stay as they are.)
  const sale = opts.features.saleOptions !== false;
  /** A type's sale time: as the server has it when the host didn't change it, else as the form reads it. */
  const keepOr = (id: string | null, k: "opensAt" | "closesEarlyAt", w: Wall | null) => {
    const was = id && prev && prev.zone === form.zone ? prev.saleTimes[id]?.[k] ?? null : undefined;
    return was !== undefined && sameWall(w, was, form.zone) ? was : iso(w);
  };
  const closes = instantOf(form.closesAt, form.zone);
  const setup: Json = {
    // Tags go only when the host changed them, so one this form doesn't offer stays on the event.
    ...(tagsChanged ? { tags: [...form.tags, ...otherTags(saved.tags)] } : {}),
    min_age: minAgeOf(form),
    gender: form.gender,
    // The start itself is the default, which the server keeps as "no time set".
    // A time the host didn't touch goes back exactly as the server has it.
    sales_close_at: prev && prev.zone === form.zone && sameWall(form.closesAt, prev.closesAt, prev.zone) && !patch.starts_at ? prev.closesAt
      : closes && closes.getTime() < start.getTime() ? closes.toISOString() : null,
    // Empty = pacr's cap (the server clears the host's).
    max_per_order: parseInt(form.maxPerOrder, 10) || null,
    tiers: form.tiers.map((t, i) => ({
      ...(t.id ? { id: t.id } : {}),
      name: t.name.trim() || "General entry",
      capacity: t.unlimited ? null : parseInt(t.capacity, 10) || null,
      // A sold ticket type keeps its price: leaving it out says "as it is".
      ...(priceLocked(t) ? {} : { price_minor: form.paid ? priceMinorOf(t.price) ?? 0 : 0 }),
      // Sale options: left out for a database known not to have them, so nothing looks saved that wasn't.
      ...(sale ? {
        sales_open_at: keepOr(t.id, "opensAt", t.opensAt), closes_early_at: keepOr(t.id, "closesEarlyAt", t.closesEarlyAt), hidden: t.hidden,
        opens_after: t.afterPrev && i > 0 ? i - 1 : null,
      } : {}),
    })),
  };
  if (saved.isHost) setup.cohosts = form.cohosts.map(c => c.userId);

  // The row and the setup in one transaction: a refusal leaves the event as it was.
  const res = await rpc<Json | null>("save_event", { p_event_id: id, p_patch: patch, p_setup: setup });
  if (!res.ok) {
    // A refusal means nothing points at the new files. A lost answer ("error") may hide a save that landed, and the
    // event would then point at files that are gone: those are left, at the cost of an unused file if it didn't.
    if (res.reason !== "error") await removeImages([newCover, newMap]);
    return fail(res.reason);
  }
  const row = (res.value?.event ?? null) as Json | null;
  const out = (res.value?.setup ?? null) as Json | null;
  await removeImages([str(row?.old_cover_path) || null, str(row?.old_course_map_path) || null]);
  stage = "saved";
  const sentTiers = list(setup.tiers);
  saved = {
    ...saved, kind: form.kind, visibility: form.visibility, place: placeKey(form),
    ...(tagsChanged ? { tags: [...form.tags, ...otherTags(saved.tags)] } : {}),
    details: wire,
    // What the server now has: a time that didn't move keeps its saved value, seconds and all.
    ...(patch.starts_at ? { startsAt } : {}), ...(patch.ends_at ? { endsAt } : {}), ...(patch.timezone ? { zone: form.zone } : {}),
  };
  if ("cover_path" in patch) {
    saved = { ...saved, coverPath: newCover };
    form = { ...form, cover: form.cover && newCover ? { ...form.cover, path: newCover, blob: null } : null };
  }
  if ("course_map_path" in patch) {
    saved = { ...saved, mapPath: newMap };
    form = { ...form, details: { ...form.details, courseMap: map && newMap ? { ...map, path: newMap, blob: null } : null } };
  }
  const tierIds = list(out?.tiers);
  const closeSaved = out && "sales_close_at" in out ? str(out.sales_close_at) || null : undefined;
  form = { ...form, tiers: form.tiers.map((t, i) => ({ ...t, id: str(tierIds[i]?.id) || t.id })) };
  if (sale) {
    saved = { ...saved, saleTimes: Object.fromEntries(form.tiers.flatMap((t, i) => (t.id ? [[t.id, {
      opensAt: (sentTiers[i]?.sales_open_at as string | null) ?? null, closesEarlyAt: (sentTiers[i]?.closes_early_at as string | null) ?? null,
    }]] : []))) };
  }
  if (closeSaved !== undefined) saved = { ...saved, closesAt: closeSaved };

  // 3b: a database from before sale options takes the save and drops them without a word. For an event whose
  // database isn't known yet (a new one), ask what was kept, so nothing looks saved, or goes live, that wasn't.
  if (opts.features.saleOptions === null && form.tiers.some(t => t.opensAt || t.closesEarlyAt || t.afterPrev || t.hidden)) {
    const back = await rpc<Json | null>("get_event_for_edit", { p_event_id: id });
    // Not knowing is not "kept": nothing goes live on a guess.
    if (!back.ok && opts.publish) return fail(back.reason);
    if (back.ok && back.value && !list(back.value.tiers).some(t => "sale_state" in t || "sales_open_at" in t)) {
      saleOff = true;
      form = { ...form, tiers: form.tiers.map(t => ({ ...t, opensAt: null, closesEarlyAt: null, afterPrev: false, hidden: false })) };
    }
  }

  // 4: the registration questions. Their own call; asked only when the host has some, or had some and took them off.
  if (opts.features.questions !== false && (form.questions.length > 0 || hadQuestions)) {
    const qs = await rpc<Json[] | null>("set_event_questions", {
      p_event_id: id,
      p_questions: form.questions.map(q => ({
        ...(q.id ? { id: q.id } : {}), kind: q.kind, label: q.label.trim(), required: q.required,
        ...(q.kind === "choice" ? { options: optionsOf(q.options) } : {}),
      })),
    });
    if (!qs.ok && qs.reason === "unavailable") {
      // A database from before questions: the rest is saved, and the page says these weren't.
      questionsOff = true;
      form = { ...form, questions: [] };
    } else if (!qs.ok) {
      return fail(qs.reason);
    } else {
      const ids = list(qs.value);
      const withIds = form.questions.map((q, i) => ({ ...q, id: str(ids[i]?.id) || q.id }));
      form = { ...form, questions: withIds };
      saved = { ...saved, hadQuestions: withIds.length > 0 };
    }
  }

  // 5: publish. Not when part of the form was dropped on the way: the host sees what was kept first.
  if (opts.publish && saved.status === "draft" && (saleOff || questionsOff)) return fail(saleOff ? "sale_options_off" : "questions_off");
  if (opts.publish && saved.status === "draft") {
    const pub = await rpc<null>("publish_event", { p_event_id: id });
    if (!pub.ok && pub.reason !== "already_published") return fail(pub.reason);
    saved = { ...saved, status: "published" };
  }
  return { ok: true, value: { saved, form, questionsOff, saleOff } };
}

/** Throw a draft away, its pictures too. */
export async function deleteDraft(id: string): Promise<Result<null>> {
  const res = await rpc<Json | null>("delete_draft_event", { p_event_id: id });
  if (!res.ok) return res;
  const g = Array.isArray(res.value?.gallery_paths) ? (res.value.gallery_paths as string[]) : [];
  await removeImages([str(res.value?.cover_path) || null, str(res.value?.course_map_path) || null, ...g]);
  return { ok: true, value: null };
}
