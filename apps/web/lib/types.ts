// Rows returned by the public RPCs. Ids never appear: squads come back as
// slugs, runs as refs (see the migration's header).

export type City = {
  id: string; name: string; lat: number; lng: number; radius_km: number;
  squads: number; runs_next_7d: number; events_upcoming: number; home: boolean;
};

export type NextRun = { ref: string; starts_at: string; title: string; distance_km: number | null; women_only: boolean };

export type DirectoryRow = {
  slug: string; name: string; location: string | null; city_id: string | null; has_photo: boolean; has_cover: boolean;
  verified: boolean; women_only: boolean; join_policy: "open" | "request" | "invite"; member_count: number;
  distance_km: number | null; is_member: boolean; requested: boolean; next_runs: NextRun[]; total: number;
};

export type RunRow = {
  run_ref: string; starts_at: string; projected: boolean; title: string; meeting_point: string | null;
  meeting_lat: number | null; meeting_lng: number | null; google_place_id: string | null;
  distance_km: number | null; pace_label: string | null; leader_name: string | null; women_only: boolean;
  repeat_weekly: boolean; going_count: number; going_by_me: boolean; squad_slug: string; squad_name: string;
  squad_has_photo: boolean; squad_verified: boolean; squad_join_policy: "open" | "request" | "invite";
  city_id: string | null; is_member: boolean;
};

export type EventRow = {
  id: string; title: string; kind: string; starts_at: string; ends_at: string; timezone: string | null;
  place_name: string | null; cover_path: string | null; host: { name?: string; kind?: string } | null;
  is_paid: boolean; min_price_minor: number | null; sold_out: boolean; going_count: number; women_only: boolean;
  spots_left: number | null; city_id: string | null;
};

export type SiteStats = {
  public_squads: number; cities_with_squads: number; runs_next_7d: number; events_upcoming: number; runners_this_week: number;
};
