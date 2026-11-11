// Copy and facts for the static pages (/plans/<distance>, /app, /hosts,
// /safety, /about). Everything here must be true of the app today: no plan
// rewritten every morning, no heat- or humidity-adjusted pace, no talking
// back to the coach, no user numbers.
//
// The plan numbers are the app's own limits (pacr repo, src/services/plan.ts:
// MIN_WEEKS, LONG_RUN_CAP_KM, TAPER_WEEKS, PLAN_MIN_WEEKS / PLAN_MAX_WEEKS).
// Change them here when they change there.

export type PlanSlug = "5k" | "10k" | "half-marathon" | "marathon";
export type ByLevel = { new: number; regular: number; experienced: number };

export type PlanInfo = {
  slug: PlanSlug;
  /** "5K", "Half marathon": titles and buttons. */
  name: string;
  /** The same in a sentence: "5K", "half marathon". */
  noun: string;
  km: number;
  /** <title> and meta description. */
  title: string;
  description: string;
  lead: string;
  /** Fewer weeks than this and the builder calls the plan a stretch (planFeasibility). */
  minWeeks: ByLevel;
  /** The longest single run the plan will ever schedule, in km. */
  longRunKm: ByLevel;
  /** The taper at the end, at most this many weeks (shorter plans taper less). */
  taperWeeks: number;
  /** One line per phase, about this distance. */
  phases: { base: string; build: string; peak: string; taper: string };
  /** Questions only this distance gets, before the shared ones. */
  faq: { q: string; a: string }[];
};

export const PLAN_WEEKS = { min: 3, max: 24 };

export const PLANS: Record<PlanSlug, PlanInfo> = {
  "5k": {
    slug: "5k", name: "5K", noun: "5K", km: 5,
    title: "5K training plan, built around you",
    description: "A free 5K training plan from the pacr app: answer a few questions about your running and your race, and pacr's coach writes the weeks, checked against safe-training rules.",
    lead: "From a first 5K to a faster one. Tell pacr where your running is today, your race date and the days you can run, and get a plan written for you, checked week by week against safe-training rules.",
    minWeeks: { new: 5, regular: 4, experienced: 3 },
    longRunKm: { new: 5, regular: 8, experienced: 10 },
    taperWeeks: 1,
    phases: {
      base: "Easy running at a pace you could talk at, to build the habit. Brand new? It can start with run/walk.",
      build: "A little more running each week, and the first quality sessions, such as intervals or tempo runs.",
      peak: "The biggest weeks of the plan. Easy days protect the hard ones.",
      taper: "A lighter final week, so you reach the start line fresh. The race is the last day of the plan.",
    },
    faq: [
      { q: "How long does it take to train for a 5K?", a: "It depends on where you start. The builder calls a date fewer than 5 weeks away a stretch for someone new to running, 4 for a regular runner and 3 for an experienced one, and tells you before it builds. Plans run from 3 to 24 weeks." },
      { q: "Can a complete beginner use it?", a: "Yes. Tell the builder you're brand new and the plan starts from what you can do now. On a tight date it uses run/walk intervals, so you finish without chasing a time." },
      { q: "No race booked. Can I still get faster?", a: "Pick Get faster instead of a race. The plan keeps one quality day a week, everything else easy, and ends with a 5K time trial." },
    ],
  },
  "10k": {
    slug: "10k", name: "10K", noun: "10K", km: 10,
    title: "10K training plan, built around you",
    description: "A free 10K training plan from the pacr app: pacr's coach writes your weeks from your answers, and rules check every week before you see it.",
    lead: "Step up from 5K, or chase a faster 10K. Answer a few questions and pacr's coach writes the weeks, starting from what you run today.",
    minWeeks: { new: 10, regular: 6, experienced: 4 },
    longRunKm: { new: 10, regular: 13, experienced: 16 },
    taperWeeks: 1,
    phases: {
      base: "Easy running to build the aerobic base, with one long run a week.",
      build: "Volume climbs and quality days start: tempo, intervals, hills or fartlek.",
      peak: "The biggest weeks of the plan, with easy days protecting the hard ones.",
      taper: "A lighter last week. The race sits on the final day.",
    },
    faq: [
      { q: "How long does it take to train for a 10K?", a: "The builder calls a date fewer than 10 weeks away a stretch for someone new to running, 6 for a regular runner and 4 for an experienced one. Plans run from 3 to 24 weeks." },
      { q: "I've run a 5K. Is a 10K the next step?", a: "It's a common one. Add your recent 5K under recent results and your paces start from it, between what you run today and your goal." },
    ],
  },
  "half-marathon": {
    slug: "half-marathon", name: "Half marathon", noun: "half marathon", km: 21.1,
    title: "Half marathon training plan, built around you",
    description: "A free half marathon training plan from the pacr app: written by pacr's coach from your answers, with long runs capped and weekly growth kept gentle.",
    lead: "21.1 km, first time or faster. pacr's coach writes the weeks from your answers, and rules keep the long run and the weekly growth sensible.",
    minWeeks: { new: 16, regular: 10, experienced: 8 },
    longRunKm: { new: 18, regular: 20, experienced: 23 },
    taperWeeks: 2,
    phases: {
      base: "Time on your feet at an easy pace. Slow is correct.",
      build: "Weekly distance and the long run grow, with a lighter week after every three that climbed.",
      peak: "The biggest weeks and the longest run. Practise race-day shoes, breakfast and pacing.",
      taper: "Up to two lighter weeks before race day, which is the last day of the plan.",
    },
    faq: [
      { q: "How long does it take to train for a half marathon?", a: "The builder calls a date fewer than 16 weeks away a stretch for someone new to running, 10 for a regular runner and 8 for an experienced one. Plans run from 3 to 24 weeks." },
      { q: "How long is the longest run?", a: "Never more than 18 km for someone new to running, 20 km for a regular runner and 23 km for an experienced one, and shorter if you set a time limit on your long run." },
    ],
  },
  marathon: {
    slug: "marathon", name: "Marathon", noun: "marathon", km: 42.2,
    title: "Marathon training plan, built around you",
    description: "A free marathon training plan from the pacr app: pacr's coach writes your build to 42.2 km, and rules check the long runs, the weekly growth and the taper.",
    lead: "42.2 km takes patience. Tell pacr your race date, your running now and the days you have, and get a plan that builds slowly and tapers properly.",
    minWeeks: { new: 24, regular: 16, experienced: 12 },
    longRunKm: { new: 30, regular: 32, experienced: 35 },
    taperWeeks: 3,
    phases: {
      base: "Easy miles and a weekly long run that starts near your longest run today.",
      build: "Volume climbs gently, with a cutback week after every three that climbed.",
      peak: "The biggest weeks and the longest runs of the plan.",
      taper: "Up to three lighter weeks. Less running, more sleep. Race day is the last day.",
    },
    faq: [
      { q: "How long does it take to train for a marathon?", a: "The builder calls a date fewer than 24 weeks away a stretch for someone new to running, 16 for a regular runner and 12 for an experienced one, and suggests more weeks when the date is too close." },
      { q: "How long is the longest run?", a: "Never more than 30 km for someone new to running, 32 km for a regular runner and 35 km for an experienced one, and shorter if you set a time limit on your long run." },
    ],
  },
};

export const PLAN_ORDER: PlanSlug[] = ["5k", "10k", "half-marathon", "marathon"];

/** Questions every plan page shares. */
export const PLAN_FAQ: { q: string; a: string }[] = [
  { q: "Who writes the plan?", a: "pacr's coach, an AI, writes the weeks from your answers. Then pacr checks every week against its training rules and fixes anything that breaks one, before you see it. If the coach can't finish, or its plan fails the checks, you can use pacr's standard plan, built from the same answers and limits." },
  { q: "Can I do it on my watch?", a: "Plan workouts can go to Apple Watch. pacr also imports runs from Apple Health and Health Connect, and connects to Garmin and WHOOP." },
  { q: "Does the coach talk to me during runs?", a: "Yes. The voice coach speaks your splits and pace while you run." },
  { q: "Is it free?", a: "Yes. pacr is free to use today, apart from event tickets." },
];

export const LEVELS: [keyof ByLevel, string][] = [["new", "New to running"], ["regular", "Running regularly"], ["experienced", "Experienced"]];
