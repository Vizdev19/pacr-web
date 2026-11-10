"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Button, EmptyState, GlassCard, Icon, Input, Select, StatusTag, Switch } from "@/components/ds";
import { LoadError, RowsSkeleton, kMuted, kStrong, kTextarea } from "@/components/shell/kit";
import * as api from "@/lib/api";
import { dayTime, monthYear, num } from "@/lib/format";
import { useLoad, useViewport } from "@/lib/hooks";
import { useHost } from "@/lib/host";
import { organizerApplyHref } from "@/lib/refs";
import { SquadImages, type Images } from "./SquadImages";

export function Settings() {
  const { host } = useHost();
  return host.kind === "organizer" ? <OrganizerSettings key={host.key} /> : <SquadSettings key={host.key} circleId={host.id} squadKey={host.key} />;
}

const divider = <div style={{ height: 1, background: "var(--border-subtle)", margin: "16px 0" }} />;
const SITE = "https://pacr.life";

// ── Organizer ──────────────────────────────────────────────────────────────

const ORG_STATUS: Record<api.Organizer["status"], string> = { approved: "Approved", pending: "Pending review", rejected: "Rejected", suspended: "Suspended" };

function OrganizerSettings() {
  const x = useLoad(async () => {
    const h = await api.myHosting();
    const urls = await api.signedUrls("avatars", [h.organizer?.avatar_path]);
    return { o: h.organizer, src: h.organizer?.avatar_path ? urls.get(h.organizer.avatar_path) : undefined };
  }, "organizer-settings");
  if (x.status === "loading") return <RowsSkeleton rows={4} />;
  if (x.status === "error") return <LoadError what="your organizer profile" error={x.error} onRetry={x.reload} />;
  const { o, src } = x.data;
  if (!o) return <EmptyState variant="locked" title="No organizer profile" message="Ask to host events to set one up." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
      <GlassCard title="Organizer profile" actions={<StatusTag status={ORG_STATUS[o.status]} />}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Avatar name={o.name} src={src} size={56} style={{ borderRadius: 12 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "var(--type-section)" }}>{o.name}</div>
            <div style={kMuted}>{num(o.events_count)} {o.events_count === 1 ? "event" : "events"} hosted</div>
          </div>
        </div>
        {o.bio ? <p style={{ font: "400 14px/1.5 var(--font-sans)", color: "var(--text-body)", marginTop: 14, overflowWrap: "anywhere" }}>{o.bio}</p> : null}
        {o.instagram ? <div style={{ ...kMuted, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}><Icon name="at-sign" size={13} />{o.instagram.replace(/^@/, "")}</div> : null}
        {(o.status === "rejected" || o.status === "suspended") && o.decision_note ? (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--surface-panel)", font: "400 13px/1.45 var(--font-sans)", color: "var(--text-body)" }}>
            <div style={kStrong}>Note from pacr</div>{o.decision_note}
          </div>
        ) : null}
        <div style={{ marginTop: 16 }}><a href={organizerApplyHref}><Button variant="secondary" icon="settings" tabIndex={-1}>Edit organizer profile</Button></a></div>
      </GlassCard>
      <GlassCard title="Payout account" subtitle="Where your ticket money is paid out">
        <Link href="/money"><Button variant="secondary" icon="wallet" tabIndex={-1}>Open Money</Button></Link>
      </GlassCard>
    </div>
  );
}

// ── Squad ──────────────────────────────────────────────────────────────────

function SquadSettings({ circleId, squadKey }: { circleId: string; squadKey: string }) {
  const x = useLoad(async () => {
    const detail = await api.squadDetail(circleId);
    const urls = await api.signedUrls("club-avatars", [detail?.avatar_path, detail?.cover_path]);
    const images: Images = {
      photoPath: detail?.avatar_path ?? null, coverPath: detail?.cover_path ?? null,
      photo: detail?.avatar_path ? urls.get(detail.avatar_path) : undefined,
      cover: detail?.cover_path ? urls.get(detail.cover_path) : undefined,
    };
    return { detail, images };
  }, `settings:${squadKey}`);
  if (x.status === "loading") return <RowsSkeleton rows={5} />;
  if (x.status === "error") return <LoadError what="settings" error={x.error} onRetry={x.reload} />;
  if (!x.data.detail) return <EmptyState variant="locked" title="Settings aren’t available" message="You’re not a member of this squad any more." />;
  return <SquadForm detail={x.data.detail} images={x.data.images} onImages={images => x.set(d => ({ ...d, images }))} />;
}

type Values = {
  name: string; description: string; instagram: string; policy: api.JoinPolicy; womenOnly: boolean;
  rsvp: boolean; postAll: boolean; goal: string;
};

const POLICIES = [
  { value: "open", label: "Open · anyone can join" },
  { value: "request", label: "Request · you approve each runner" },
  { value: "invite", label: "Invite only · hidden from search" },
];

function SquadForm({ detail, images, onImages }: { detail: api.SquadDetail; images: Images; onImages: (next: Images) => void }) {
  const { host, notify, notifyError } = useHost();
  const { phone } = useViewport();
  const owner = host.roleKey === "owner";
  const initial: Values = {
    name: detail.name, description: detail.description ?? "", instagram: (detail.instagram ?? "").replace(/^@/, ""), policy: detail.join_policy,
    womenOnly: detail.women_only, rsvp: detail.rsvp_reminders, postAll: detail.posting_mode === "all", goal: detail.weekly_goal_km == null ? "" : String(detail.weekly_goal_km),
  };
  const [base, setBase] = useState<Values>(initial);
  const [v, setV] = useState<Values>(initial);
  const [busy, setBusy] = useState(false);
  const [vKey, setVKey] = useState(0);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV(cur => ({ ...cur, [k]: val }));

  const nameOk = v.name.trim().length >= 1 && v.name.trim().length <= 60;
  const goalN = Number(v.goal);
  const goalOk = v.goal.trim() === "" ? base.goal === "" : /^\d+$/.test(v.goal.trim()) && goalN >= 5 && goalN <= 5000;
  const nameLocked = detail.verified && !owner;
  const changed = (k: keyof Values) => (k === "name" ? v.name.trim() !== base.name : k === "goal" ? v.goal.trim() !== base.goal : v[k] !== base[k]);
  const dirty = (Object.keys(v) as (keyof Values)[]).some(k => changed(k) && !(k === "instagram" && !owner) && !(k === "name" && nameLocked));
  const valid = nameOk && goalOk;

  async function save() {
    setBusy(true);
    const done: Partial<Values> = {};
    try {
      const patch: api.SquadPatch = {};
      if (changed("name") && !nameLocked) { patch.name = v.name.trim(); done.name = v.name.trim(); }
      if (changed("description")) { patch.description = v.description.trim(); done.description = v.description.trim(); }
      if (changed("goal") && v.goal.trim() !== "") { patch.weekly_goal_km = goalN; done.goal = String(goalN); }
      if (changed("rsvp")) { patch.rsvp_reminders = v.rsvp; done.rsvp = v.rsvp; }
      if (changed("womenOnly")) { patch.women_only = v.womenOnly; done.womenOnly = v.womenOnly; }
      if (changed("postAll")) { patch.posting_mode = v.postAll ? "all" : "owners_only"; done.postAll = v.postAll; }
      if (Object.keys(patch).length) { await api.updateSquad(detail.id, patch); setBase(b => ({ ...b, ...done })); }
      if (changed("policy")) { await api.setJoinPolicy(detail.id, v.policy); setBase(b => ({ ...b, policy: v.policy })); }
      if (owner && changed("instagram")) {
        const handle = v.instagram.trim().replace(/^@/, "");
        await api.setSquadInstagram(detail.id, handle);
        setBase(b => ({ ...b, instagram: handle }));
      }
      notify("success", "Settings saved", "Changes are live for members.");
      setVKey(k => k + 1);
    } catch (e) {
      notifyError("Couldn’t save", e);
    } finally {
      setBusy(false);
    }
  }

  const link = detail.slug ? `${SITE}/s/${detail.slug}` : null;
  const invite = link && detail.invite_code ? `${link}?invite=${detail.invite_code}` : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0,1fr)" : "minmax(0,1.6fr) minmax(300px,1fr)", gap: 12, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <GlassCard title="Squad profile">
          <SquadImages circleId={detail.id} name={detail.name} images={images} onChange={onImages} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 14, marginTop: 14 }}>
            <Input label="Name" value={v.name} maxLength={60} disabled={nameLocked} error={!nameOk ? "Use 1 to 60 characters" : undefined}
              hint={nameLocked ? "Only the owner can rename a verified squad" : detail.verified ? "Renaming a verified squad removes its badge until it’s verified again." : undefined}
              onChange={e => set("name", e.target.value)} />
            <Input label="Home base" icon="map-pin" value={detail.location ?? ""} readOnly placeholder="Not set" hint="Change the home base in the pacr app" />
            <label className="pc-field" style={{ gridColumn: "1 / -1" }}>
              <span className="pc-label">Description</span>
              <textarea rows={3} style={kTextarea} maxLength={200} value={v.description} onChange={e => set("description", e.target.value)} />
              <span className="pc-hint" style={{ textAlign: "right" }}>{v.description.length} / 200</span>
            </label>
            <Input label="Instagram" icon="at-sign" value={v.instagram} maxLength={30} readOnly={!owner} hint={owner ? undefined : "Owner only"}
              onChange={e => set("instagram", e.target.value.replace(/[^A-Za-z0-9._@]/g, ""))} />
            <Select label="Who can join" value={v.policy} options={POLICIES} onChange={val => set("policy", val as api.JoinPolicy)} />
          </div>
          {divider}
          <Switch checked={v.womenOnly} onChange={c => set("womenOnly", c)} label="Women-only squad" />
        </GlassCard>

        <GlassCard title="Runs & members">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Switch checked={v.rsvp} onChange={c => set("rsvp", c)} label="RSVP reminders" />
            <Switch checked={v.postAll} onChange={c => set("postAll", c)} label="Members can post in the squad feed" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ font: "400 14px var(--font-sans)", color: "var(--text-body)" }}>Weekly squad goal</span>
              <Input size="sm" inputMode="numeric" value={v.goal} placeholder="Not set" error={!goalOk ? "5 to 5000, whole numbers" : undefined}
                trailing={<span style={kMuted}>km</span>} style={{ width: 150 }} onChange={e => set("goal", e.target.value.replace(/[^\d]/g, ""))} />
            </div>
          </div>
        </GlassCard>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button loading={busy} disabled={!dirty || !valid} onClick={save}>Save changes</Button>
        </div>

        {link ? (
          <GlassCard title="Squad link">
            <LinkRow label="Copy link" url={link} />
            {invite ? (
              <div style={{ marginTop: 12 }}>
                <LinkRow label="Copy invite link" url={invite} />
                <div style={{ ...kMuted, marginTop: 4 }}>Opens the squad and joins on the spot.</div>
              </div>
            ) : null}
          </GlassCard>
        ) : null}

        <GlassCard title="Danger zone">
          {[["Add a co-owner", "Done in the pacr app."], ["Delete squad", "Done in the pacr app. Removes runs, chat and photos for all members."]].map(([t, s], i) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 0", borderTop: i ? "1px solid var(--border-subtle)" : 0 }}>
              <div style={{ flex: "1 1 260px" }}><div style={kStrong}>{t}</div><div style={kMuted}>{s}</div></div>
              {owner ? <span style={kMuted}>In the pacr app → Manage</span> : <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...kMuted }}><Icon name="lock" size={13} />Owner only</span>}
            </div>
          ))}
        </GlassCard>
      </div>
      <VerificationCard key={vKey} circleId={detail.id} owner={owner} />
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const { notify } = useHost();
  async function copy() {
    try { await navigator.clipboard.writeText(url); notify("success", "Link copied", url); } catch { notify("danger", "Couldn’t copy", "Select the link and copy it yourself."); }
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <code style={{ flex: "1 1 220px", minWidth: 0, overflowWrap: "anywhere", font: "400 13px/1.4 var(--font-sans)", color: "var(--text-body)" }}>{url}</code>
      <Button size="sm" variant="secondary" icon="copy" onClick={copy}>{label}</Button>
    </div>
  );
}

// ── Verification (mirrors the app's VerificationCard) ─────────────────────

function VerificationCard({ circleId, owner }: { circleId: string; owner: boolean }) {
  const { notify, notifyError } = useHost();
  const { phone } = useViewport();
  const x = useLoad(async () => ({ v: await api.verificationStatus(circleId), now: Date.now() }), `verification:${circleId}`);
  const [busy, setBusy] = useState(false);
  const stick = { position: phone ? "static" : "sticky", top: 76 } as const;

  if (x.status === "loading") return <GlassCard title="Verification" style={stick}><RowsSkeleton rows={2} /></GlassCard>;
  if (x.status === "error") return <GlassCard title="Verification" style={stick}><LoadError what="verification" error={x.error} onRetry={x.reload} /></GlassCard>;
  const s = x.data.v;
  const req = s.request;
  const pending = req?.status === "pending";
  const rejected = req?.status === "rejected";
  const cooling = !!s.retry_at && new Date(s.retry_at).getTime() > x.data.now;
  const ready = s.is_public && !!s.instagram;

  async function run(fn: () => Promise<unknown>, ok: [string, string], bad: string) {
    setBusy(true);
    try { await fn(); notify("success", ok[0], ok[1]); x.reload(); } catch (e) { notifyError(bad, e); } finally { setBusy(false); }
  }
  async function copy(code: string) {
    try { await navigator.clipboard.writeText(code); notify("success", "Code copied"); } catch { notify("danger", "Couldn’t copy", "Select the code and copy it yourself."); }
  }

  const tag = s.verified ? "Verified" : pending ? "Pending review" : rejected ? "Rejected" : null;
  return (
    <GlassCard title="Verification" actions={tag ? <StatusTag status={tag} /> : undefined} style={stick}
      subtitle={s.verified ? (s.verified_at ? `Verified since ${monthYear(s.verified_at)}` : "Verified") : pending ? "Waiting for review" : rejected ? "Not verified this time" : "Get the badge"}>
      {s.verified ? (
        <>
          <div style={{ font: "400 13px/1.45 var(--font-sans)", color: "var(--text-body)" }}>Runners see the badge next to the squad’s name. Verified squads can host ticketed events.</div>
          <div style={{ ...kMuted, marginTop: 10 }}>Changing the squad’s name or Instagram removes the badge. You can ask again after.</div>
        </>
      ) : pending && req ? (
        <>
          <div style={{ font: "400 13px/1.45 var(--font-sans)", color: "var(--text-body)" }}>
            {owner
              ? `Put this code in @${(req.instagram ?? s.instagram ?? "").replace(/^@/, "")}’s Instagram bio. Staff check it within a few days; take it out once you’re verified.`
              : `The owner asked on ${dayTime(req.created_at)}. Staff check the squad’s Instagram within a few days.`}
          </div>
          {owner && req.code ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "8px 8px 8px 16px", borderRadius: 12, background: "var(--surface-panel)" }}>
              <code style={{ flex: 1, font: "800 22px/1 var(--font-sans)", letterSpacing: 2, color: "var(--text-strong)" }}>{req.code}</code>
              <Button size="sm" variant="secondary" icon="copy" onClick={() => copy(req.code ?? "")}>Copy</Button>
            </div>
          ) : null}
          {owner ? <div style={{ marginTop: 12 }}><Button size="sm" variant="ghost" loading={busy} onClick={() => run(() => api.cancelVerification(circleId), ["Request cancelled", "Staff stop checking. You can ask again any time."], "Couldn’t cancel")}>Cancel request</Button></div> : null}
        </>
      ) : (
        <>
          {rejected ? <div style={{ font: "400 13px/1.45 var(--font-sans)", color: "var(--text-body)", marginBottom: 10 }}>{req?.owner_note || "Staff couldn’t confirm the squad from its Instagram."}</div>
            : <div style={{ font: "400 13px/1.45 var(--font-sans)", color: "var(--text-body)", marginBottom: 10 }}>A badge next to the name tells runners this is the real club, not a lookalike. Verified squads can host ticketed events.</div>}
          <Check ok={s.is_public} label="Public squad" />
          <Check ok={!!s.instagram} label="Instagram handle added" />
          {owner ? (
            <>
              {cooling && s.retry_at ? <div style={{ ...kMuted, marginTop: 10 }}>You can ask again from {dayTime(s.retry_at)}.</div>
                : !ready ? <div style={{ ...kMuted, marginTop: 10 }}>{!s.is_public ? "Only public squads can be verified. Change Who can join first." : "Add the squad’s Instagram first: that’s how staff check it’s really yours."}</div> : null}
              <div style={{ marginTop: 12 }}>
                <Button icon="badge-check" loading={busy} disabled={!ready || cooling} onClick={() => run(() => api.requestVerification(circleId), ["Verification requested", "Put the code in the squad’s Instagram bio while staff check."], "Couldn’t ask")}>
                  {rejected ? "Ask again" : "Ask for verification"}
                </Button>
              </div>
            </>
          ) : <div style={{ ...kMuted, marginTop: 10 }}>Only the owner can ask for verification.</div>}
        </>
      )}
    </GlassCard>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--border-subtle)", font: "400 13px var(--font-sans)", color: "var(--text-strong)" }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", background: ok ? "var(--fill-lime)" : "#fff", border: ok ? 0 : "1.5px solid var(--border-strong)" }}>
        {ok ? <Icon name="check" size={13} strokeWidth={2.5} /> : null}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </div>
  );
}
