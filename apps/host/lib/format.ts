/** "Dawn Riders" → "DR". Matches the app's Avatar fallback and js/supabase.js. */
export function initials(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** 1240 → "1,240" */
export function num(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString("en-IN");
}

// The four roles in public.role_rank: owner 3, organiser 2, run_leader 1,
// member 0. Hosting starts at run leader.
const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  organiser: "Organiser",
  run_leader: "Run leader",
  member: "Member",
};

/** A membership role as people read it: "run_leader" → "Run leader". */
export function roleLabel(role: string | null | undefined): string {
  const r = String(role ?? "");
  return ROLE_LABELS[r] ?? "";
}
