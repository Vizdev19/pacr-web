"use client";

import { useEffect, useState } from "react";
import { getSupabase, signinHref } from "@/lib/supabase";
import { initials, num, roleLabel } from "@/lib/format";

// One squad as public.my_hosting() returns it (20261130130000_event_create).
type HostedSquad = {
  id: string;
  name: string;
  slug: string | null;
  role: string;
  verified: boolean;
  is_public: boolean;
  women_only?: boolean;
  members?: number;
};

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; squads: HostedSquad[] };

export default function SquadsList() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    (async () => {
      const sb = getSupabase();
      const { data: auth } = await sb.auth.getSession();
      if (!auth.session) {
        // Same as the original /host page: signed out goes to /signin and back.
        window.location.replace(signinHref());
        return;
      }
      const { data, error } = await sb.rpc("my_hosting");
      if (!live) return;
      if (error) {
        // A stored session the server no longer accepts (expired refresh,
        // signed out elsewhere): sign in again rather than blame the network.
        if (/jwt|not_allowed/i.test(error.message ?? "") || error.code === "PGRST301") {
          window.location.replace(signinHref());
          return;
        }
        console.warn("[host] my_hosting failed", error);
        setState({ kind: "error" });
        return;
      }
      const squads = ((data as { squads?: HostedSquad[] } | null)?.squads ?? []) as HostedSquad[];
      setState({ kind: "ready", squads });
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state.kind === "loading") return <p className="msg">Loading your squads…</p>;
  if (state.kind === "error") {
    return <p className="msg err">Couldn’t load your squads. Check your connection and refresh the page.</p>;
  }
  if (state.squads.length === 0) {
    return (
      <div className="empty">
        You don’t run any squads yet. Squad owners, organisers and run leaders see their squads here. Start
        a squad or ask your squad’s owner to make you a run leader in the PACR app.
      </div>
    );
  }

  return (
    <div className="rows">
      {state.squads.map((s) => {
        const sub = [
          roleLabel(s.role),
          s.members != null ? `${num(s.members)} ${s.members === 1 ? "member" : "members"}` : null,
          s.is_public ? "Public" : "Private",
          s.women_only ? "Women only" : null,
        ].filter(Boolean);
        return (
          <div className="row" key={s.id}>
            <span className="face" aria-hidden>
              {initials(s.name)}
            </span>
            <div className="row-text">
              <div className="row-title">
                {s.slug ? <a href={`/s/${encodeURIComponent(s.slug)}`}>{s.name}</a> : s.name}
                {s.verified ? (
                  <span className="seal" title="Verified squad" aria-label="Verified">
                    ✓
                  </span>
                ) : null}
              </div>
              <div className="row-sub">{sub.join(" · ")}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
