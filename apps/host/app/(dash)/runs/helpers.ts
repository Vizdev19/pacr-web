import type { SquadRun } from "@/lib/api";
import { km } from "@/lib/format";

const TZ = "Asia/Kolkata";

/** "Saturday": the weekday a weekly run repeats on. */
export const weekdayLong = (iso: string | Date) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "long" }).format(new Date(iso));

/** "10 km", or null when the run has no distance. */
export const distanceText = (r: Pick<SquadRun, "distance_km">) => (r.distance_km != null && r.distance_km > 0 ? `${km(r.distance_km)} km` : null);

/** The run link people can share: the squad's public page with this run open. */
export const runLink = (slug: string, ref: string) => `https://pacr.life/s/${slug}?run=${ref}`;

/** A runner name that is safe to show: never empty. */
export const who = (name: string | null | undefined) => (name && name.trim() ? name : "A runner");
