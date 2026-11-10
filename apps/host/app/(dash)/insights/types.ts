import type { HostedEvent, Roster, SquadDetail, SquadRun } from "@/lib/api";

export type Loaded = {
  now: number;
  roster: Roster;
  detail: SquadDetail | null;
  /** This week's km from the squads overview. */
  weekKm: number;
  upcoming: SquadRun[];
  faces: Map<string, string>;
  /** Monday of each of the 12 weeks, oldest first (ms). */
  starts: number[];
  events: HostedEvent[];
};

export type Computed = {
  km: number[];
  runCount: number[];
  active: number[];
  who: Set<string>[];
  now: number;
};

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
