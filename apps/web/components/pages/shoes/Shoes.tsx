"use client";
// /shoes: the runner's pairs and how far each has gone, read-only. Pairs and
// their targets come from the app (user_data pacr_shoes); km is summed from
// the runs that name each pair, the way the app's shoeUsage does.
import { useCallback } from "react";
import { Badge, Card, Media } from "@/components/ds/core";
import { Banner } from "@/components/ds/overlays";
import { EmptyState, ErrorState, Skeleton } from "@/components/ds/feedback";
import { RequireSignIn } from "@/components/site/RequireSignIn";
import { getShoes, ymdLong, type ShoeView } from "@/lib/shoes";
import { useLoad } from "@/lib/profile";
import { StoreIcons } from "@/components/ds/brands";

export function ShoesPage() {
  return <RequireSignIn title="Sign in to see your shoes" body="Your pairs, and how far you've run in each.">
    {auth => <Shoes key={auth.uid} uid={auth.uid} />}
  </RequireSignIn>;
}

const kmText = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: n >= 100 ? 0 : 1 });

function Shoes({ uid }: { uid: string }) {
  const fetchShoes = useCallback(() => getShoes(uid), [uid]);
  const { data, failed, retry } = useLoad(fetchShoes);
  const shoes = data?.shoes;

  const active = (shoes ?? []).filter(s => !s.retired), retired = (shoes ?? []).filter(s => s.retired);
  return <div className="pw-container pw-page" style={{ maxWidth: 860 }}>
    <div className="sec-h" style={{ marginBottom: "var(--space-6)" }}>
      <div><h1 className="t-h1">Shoes</h1><p>Every run you record goes on the pair you last ran in. Add and edit shoes in the app.</p></div>
    </div>
    {failed ? <ErrorState title="Couldn't load your shoes" body="Check your connection and try again." onRetry={retry} />
      : !shoes ? <div className="stack"><Skeleton variant="runner" /><Skeleton variant="runner" /></div>
      : !shoes.length ? <EmptyState boxed icon="footprints" title="No shoes yet." body="Add a pair in the app and its kilometres add up here as you run."><StoreIcons size="md" /></EmptyState>
      : <>
        {!data?.counted ? <div style={{ marginBottom: "var(--space-6)" }}><Banner tone="warning" title="Kilometres from your runs aren't added in">We couldn&apos;t read your runs just now, so each pair shows only the kilometres it started with. Refresh to try again.</Banner></div> : null}
        {active.length ? <section className="block" aria-label="In use"><h2>In use</h2><div className="stack">{active.map(s => <Pair key={s.key} s={s} counted={!!data?.counted} />)}</div></section> : null}
        {retired.length ? <section className="block" aria-label="Retired"><h2>Retired</h2><div className="stack">{retired.map(s => <Pair key={s.key} s={s} counted={!!data?.counted} />)}</div></section> : null}
      </>}
  </div>;
}

function Pair({ s, counted }: { s: ShoeView; counted: boolean }) {
  const pct = Math.min(100, Math.round((s.km / s.targetKm) * 100));
  const tone = s.wear === "done" ? "var(--danger)" : s.wear === "near" ? "var(--warning)" : "var(--accent)";
  const facts = [
    !counted ? null : s.runs ? `${s.runs.toLocaleString("en-IN")} ${s.runs === 1 ? "run" : "runs"}` : "No runs yet",
    s.since ? `since ${ymdLong(s.since)}` : null,
    s.lastRun ? `last run ${ymdLong(s.lastRun)}` : null,
  ].filter(Boolean).join(" · ");
  return <Card>
    <div className="row" style={{ flexWrap: "nowrap", gap: "var(--space-4)", alignItems: "flex-start" }}>
      <div style={{ width: 72, flex: "none" }}><Media ratio="1:1" tile src={s.photo} alt={s.photo ? `Photo of ${s.name}` : ""} /></div>
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: "var(--space-2)" }}>
        <div className="row" style={{ justifyContent: "space-between", gap: "var(--space-2)" }}>
          <div style={{ minWidth: 0 }}><b style={{ overflowWrap: "anywhere" }}>{s.name}</b>{s.model ? <div className="t-caption">{s.model}</div> : null}</div>
          {s.retired ? <Badge size="sm">Retired</Badge> : s.wear === "done" ? <Badge size="sm" tone="danger">Past its target</Badge> : s.wear === "near" ? <Badge size="sm" tone="warning">Near its target</Badge> : null}
        </div>
        <div className="t-body-s num"><b>{kmText(s.km)} km</b> <span className="t-secondary">of {kmText(s.targetKm)} km</span></div>
        <div className="pw-table__bar" style={{ width: "100%", background: "var(--surface-2)" }} role="meter" aria-valuemin={0} aria-valuemax={s.targetKm} aria-valuenow={Math.round(s.km)} aria-label={`${kmText(s.km)} of ${kmText(s.targetKm)} km`}>
          <div className="pw-table__bar" style={{ width: pct + "%", background: tone }} />
        </div>
        <span className="t-caption">{facts}</span>
      </div>
    </div>
  </Card>;
}
