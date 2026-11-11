"use client";
// /u/<handle>: a runner's public card. Following happens in the app; a
// signed-in runner also gets their full profile on the web (/profile?r=<ref>),
// found with resolve_handle under their own session.
import { useEffect, useState } from "react";
import { Avatar, Badge, Button, Card, Icon } from "@/components/ds/core";
import { EmptyState } from "@/components/ds/feedback";
import { useAuth } from "@/lib/auth";
import type { ProfileView } from "@/lib/profilecard";
import { shortCount } from "@/lib/profilecard";
import { encodeRef } from "@/lib/refs";
import { getSupabase } from "@/lib/supabase";
import { OpenInAppButton } from "./OpenInApp";

export function ProfileCard({ runner }: { runner: ProfileView }) {
  const auth = useAuth();
  const [full, setFull] = useState<string | null>(null);
  const signedIn = auth.status === "signed-in";

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    getSupabase().rpc("resolve_handle", { p_handle: runner.handle }).then(({ data }) => {
      const ref = typeof data === "string" ? encodeRef(data) : null;
      if (alive && ref) setFull(`/profile?r=${ref}`);
    });
    return () => { alive = false; };
  }, [signedIn, runner.handle]);

  const f = runner.followers;
  return <div className="pw-reading pw-page"><Card>
    <div className="stack" style={{ gap: "var(--space-5)" }}>
      <div className="row" style={{ gap: "var(--space-5)", flexWrap: "nowrap" }}>
        <Avatar name={runner.name} src={runner.avatar} size={96} alt={runner.name} />
        <div style={{ minWidth: 0 }}>
          <h1 className="t-h1">{runner.name}</h1>
          <div className="pw-meta" style={{ marginTop: "var(--space-1)" }}><span><Icon name="at-sign" size={15} />{runner.handle}</span>
            {runner.location ? <span><Icon name="map-pin" size={15} />{runner.location}</span> : null}</div>
        </div>
      </div>
      {runner.bio ? <p className="t-body-l" style={{ margin: 0 }}>{runner.bio}</p> : null}
      {runner.tags.length ? <div className="pw-tags">{runner.tags.map(t => <Badge key={t}>{t}</Badge>)}</div> : null}
      <div className="t-secondary t-body-s"><b className="num" style={{ color: "var(--text-primary)" }}>{shortCount(f)}</b> {f === 1 ? "follower" : "followers"}
        {runner.joined ? <> · Running with pacr since {runner.joined}</> : null}</div>
      <div className="row" style={{ gap: "var(--space-3)" }}>
        <OpenInAppButton path={`u/${runner.handle}`} label="Follow in the app" />
        {full ? <Button variant="secondary" href={full} icon="user-round">See full profile</Button> : null}
      </div>
      <p className="t-caption" style={{ margin: 0 }}>Follow {runner.first} in the app to see the runs they share.</p>
    </div>
  </Card></div>;
}

export function NoRunner() {
  return <div className="pw-reading sec"><div className="stack" style={{ alignItems: "center", gap: "var(--space-4)" }}>
    <EmptyState icon="user-x" title="Runner not found" body="This profile link may be old. The runner might have changed their handle." />
    <Button variant="secondary" href="/download">Get pacr</Button>
  </div></div>;
}
