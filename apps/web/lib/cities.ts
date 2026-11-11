import type { City } from "./types";

export type SiteCity = { id: string; name: string; meta?: string; squads: number; events_upcoming: number; runs_next_7d: number };

/** list_cities rows → the city picker's options, with "10 squads" beside each. */
export function siteCities(rows: City[]): SiteCity[] {
  return rows.map(c => ({
    id: c.id, name: c.name, squads: c.squads, events_upcoming: c.events_upcoming, runs_next_7d: c.runs_next_7d,
    meta: c.squads ? `${c.squads} squad${c.squads === 1 ? "" : "s"}` : undefined,
  }));
}
