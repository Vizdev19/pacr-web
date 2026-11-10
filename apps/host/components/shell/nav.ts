import type { IconName } from "@/components/ds";
import type { RoleKey } from "@/lib/host";

export type PageId =
  | "overview" | "calendar" | "runs" | "events" | "members" | "requests" | "messages" | "moderation"
  | "money" | "insights" | "team" | "settings";

export const PAGES: Record<PageId, { label: string; icon: IconName; href: string; group?: string }> = {
  overview: { label: "Overview", icon: "layout-grid", href: "/" },
  calendar: { label: "Calendar", icon: "calendar", href: "/calendar", group: "Plan" },
  runs: { label: "Runs", icon: "footprints", href: "/runs", group: "Plan" },
  events: { label: "Events", icon: "ticket", href: "/events", group: "Plan" },
  members: { label: "Members", icon: "users", href: "/members", group: "People" },
  requests: { label: "Join requests", icon: "user-plus", href: "/requests", group: "People" },
  messages: { label: "Messages", icon: "megaphone", href: "/messages", group: "Talk" },
  moderation: { label: "Moderation", icon: "shield-alert", href: "/moderation", group: "Talk" },
  money: { label: "Money", icon: "wallet", href: "/money", group: "Business" },
  insights: { label: "Insights", icon: "chart-column", href: "/insights", group: "Business" },
  team: { label: "Team", icon: "user-cog", href: "/team", group: "Setup" },
  settings: { label: "Settings", icon: "settings", href: "/settings", group: "Setup" },
};
export const ORDER: (PageId | string)[] = [
  "overview", "Plan", "calendar", "runs", "events", "People", "members", "requests", "Talk", "messages", "moderation",
  "Business", "money", "insights", "Setup", "team", "settings",
];

// Pages each role cannot open, following what the database allows:
// run leaders schedule and check in runs and can host events, but members,
// announcements, reports and settings need an owner or organiser (rank 2+);
// an organizer account has events and money only.
export const LOCKED: Record<RoleKey, PageId[]> = {
  owner: [],
  organiser: [],
  leader: ["members", "requests", "messages", "moderation", "money", "insights", "team", "settings"],
  organizer: ["runs", "members", "requests", "messages", "moderation", "insights", "team"],
};
export const WHO: Partial<Record<RoleKey, string>> = {
  leader: "Run leaders schedule runs, run check-in and see who’s coming. Members, messages and settings are for the owner and organisers.",
  organizer: "Organizer accounts handle events, tickets and money. Squad runs and members live in squad dashboards.",
};

export function pageOf(pathname: string): PageId {
  const seg = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
  return (seg && seg in PAGES ? seg : "overview") as PageId;
}
