"use client";

// The rest of the event: its name and words, type and tags, when it is (and in
// which time zone), who can see it, when registration closes, how many tickets
// a booking may hold, and who can join.

import { useEffect, useRef, type ReactNode } from "react";
import { Icon, Input, RadioGroup, SegmentChip, SegmentedControl, Select } from "@/components/ds";
import { kMuted, kStrong } from "@/components/shell/kit";
import {
  DESC_MAX, EVENT_KINDS, EVENT_TAGS, GENDER_LABEL, MAX_TAGS, TITLE_MAX, minAgeOf,
  type AgeRule, type Check, type EventForm, type EventKind, type FeeRules, type GenderRule, type Visibility,
} from "@/lib/eventEditor";
import { instantOf, plausibleWall, wallText, zoneChoices, zoneLabel, zoneShort, browserZone, type Wall } from "@/lib/eventZone";
import { Area, eErr, eRow, Section, shiftDay, shiftWall, SwitchRow, WhenInput } from "./parts";

type Props = { form: EventForm; patch: (p: Partial<EventForm>) => void; check: Check; show: boolean };

export function Basics({ form, patch, show, poster, otherTags = [] }: Props & {
  poster: ReactNode;
  /** Tags on the event this form doesn't offer: kept, and they count in the five. */
  otherTags?: string[];
}) {
  const max = Math.max(0, MAX_TAGS - otherTags.length);
  const kind = EVENT_KINDS.find(k => k.key === form.kind);
  return (
    <Section title="Details">
      <div style={{ ...eRow, gap: 18 }}>
        {poster}
        <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Event name" value={form.title} maxLength={TITLE_MAX} placeholder="Saturday sunrise 10K"
            error={show && !form.title.trim() ? "The event needs a name." : undefined}
            onChange={e => patch({ title: e.target.value })} />
          <Area label="Description" value={form.description} max={DESC_MAX} rows={5}
            placeholder="The route, pace groups, what to bring, where to meet after" onChange={v => patch({ description: v })} />
        </div>
      </div>
      <div className="pc-field">
        <span className="pc-label">Type</span>
        <div><SegmentedControl value={form.kind} onChange={v => patch({ kind: v as EventKind })}
          options={EVENT_KINDS.map(k => ({ value: k.key, label: k.label }))} /></div>
        {kind ? <span className="pc-hint">{kind.note}</span> : null}
      </div>
      <div className="pc-field">
        <span className="pc-label">Tags <span style={kMuted}>{form.tags.length + otherTags.length} of {MAX_TAGS}</span></span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {EVENT_TAGS.map(tag => {
            const on = form.tags.includes(tag);
            const full = form.tags.length >= max && !on;
            return (
              <SegmentChip key={tag} label={tag} active={on} style={full ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                onClick={() => { if (!full) patch({ tags: on ? form.tags.filter(t => t !== tag) : EVENT_TAGS.filter(t => t === tag || form.tags.includes(t)) }); }} />
            );
          })}
        </div>
        {otherTags.length ? <span className="pc-hint">Also tagged {otherTags.join(", ")}, from before: kept as it is.</span> : null}
      </div>
    </Section>
  );
}

export function When({ form, patch, check, show, live }: Props & { live: boolean }) {
  // The last start a host could mean. A year typed into the date field passes through 0002, 0020 and 0202 on the way
  // to 2027: the end and the close time move once, from the last real start to the next, not with every key.
  const anchor = useRef<Wall>(form.startsAt);
  useEffect(() => { if (plausibleWall(form.startsAt)) anchor.current = form.startsAt; }, [form.startsAt]);
  if (live) {
    // A live event's date and time are fixed, and its time zone with them.
    return (
      <Section title="Date and time" note="Fixed once the event is live. To move it, cancel this event and create a new one.">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Icon name="lock" size={14} color="var(--text-muted)" />
          <span style={kStrong}>{check.start ? wallText(check.start, form.zone) : ""} to {check.end ? wallText(check.end, form.zone) : ""}</span>
          <span style={kMuted}>{zoneLabel(form.zone, check.start ?? undefined)}</span>
        </div>
      </Section>
    );
  }
  const zones = zoneChoices(form.zone, browserZone());
  const setStart = (w: EventForm["startsAt"]) => {
    // The end keeps its distance from the start, and so does a time registration closes.
    const was = instantOf(anchor.current, form.zone), now = plausibleWall(w) ? instantOf(w, form.zone) : null;
    const by = was && now ? now.getTime() - was.getTime() : 0;
    if (now) anchor.current = w;
    patch({
      startsAt: w,
      ...(by ? { endsAt: shiftWall(form.endsAt, by, form.zone) ?? form.endsAt, closesAt: shiftWall(form.closesAt, by, form.zone) } : {}),
    });
  };
  const s = check.start?.getTime() ?? NaN, e = check.end?.getTime() ?? NaN;
  const startErr = show && check.badTime && !(e <= s) && !(e - s > 14 * 86400000) ? "Pick a start time in the future." : undefined;
  const endErr = show && (e <= s || e - s > 14 * 86400000) ? "The end has to be after the start, and within 14 days of it." : undefined;
  return (
    <Section title="Date and time" note="The time at the event. It can’t be moved once the event is live.">
      <div style={eRow}>
        <WhenInput label="Starts" value={form.startsAt} error={startErr} onChange={setStart} />
        <WhenInput label="Ends" value={form.endsAt} error={endErr} onChange={w => patch({ endsAt: w })} />
      </div>
      <Select label="Time zone" value={form.zone} onChange={z => patch({ zone: z })} style={{ maxWidth: 360 }}
        options={zones.map(z => ({ value: z, label: zoneLabel(z, check.start ?? undefined) }))}
        hint="The times above are read on a clock in this zone, wherever you are." />
    </Section>
  );
}

export function Visible({ form, patch, squadHost, hostName }: Pick<Props, "form" | "patch"> & { squadHost: boolean; hostName: string }) {
  const options = [
    { value: "public", label: "Everyone", description: "Listed in the pacr app’s Events tab and on the host’s page. Anyone nearby can find it and register." },
    { value: "link", label: "Anyone with the link", description: "Not listed or searchable. Only people you send the link to can open it and register." },
    // Members-only is for events a squad hosts; an event that already has it keeps the choice.
    ...(squadHost || form.visibility === "squad"
      ? [{ value: "squad", label: "Squad members only", description: `Not listed. Only ${hostName}’s members can open it and register.` }] : []),
  ];
  return (
    <Section title="Who can see it">
      <RadioGroup value={form.visibility} onChange={v => patch({ visibility: v as Visibility })} options={options} />
    </Section>
  );
}

export function Registration({ form, patch, check, show, fees, womenOnly }: Props & { fees: FeeRules; womenOnly: boolean }) {
  const typed = form.maxPerOrder.trim() === "" ? null : parseInt(form.maxPerOrder, 10);
  return (
    <Section title="Registration">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SwitchRow label={form.closesAt ? "Registration closes at a set time" : "Registration closes when the event starts"} checked={!!form.closesAt}
          sub={form.closesAt ? undefined : "Switch on to close it earlier: the evening before, say."}
          onChange={on => patch({ closesAt: on ? shiftDay(form.startsAt, -1, "21:00") : null })} />
        {form.closesAt ? (
          <div style={{ paddingLeft: 46 }}>
            <WhenInput label={`Closes (${zoneShort(form.zone)})`} value={form.closesAt}
              error={show && check.badClose ? "Has to be before the event starts, and still ahead." : undefined}
              onChange={w => patch({ closesAt: w })} />
          </div>
        ) : null}
      </div>
      <Input label="Tickets per booking" inputMode="numeric" style={{ maxWidth: 260 }}
        value={womenOnly ? "1" : form.maxPerOrder} disabled={womenOnly} placeholder={String(fees.maxPerOrder)}
        error={show && check.badMax ? `Between 1 and ${fees.maxPerOrder}, or empty.` : undefined}
        hint={womenOnly
          ? "A women-only event is one ticket per booking: every runner registers herself, so pacr can check each one against her profile."
          : typed == null ? `One runner can book up to ${fees.maxPerOrder} tickets at once, with a QR for each. Set a lower limit if you want.`
          : typed === 1 ? "One ticket each." : "The most one runner can book at once."}
        onChange={e => patch({ maxPerOrder: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
    </Section>
  );
}

const AGES: { value: AgeRule; label: string }[] = [
  { value: "all", label: "All ages" }, { value: "16", label: "16+" }, { value: "18", label: "18+" }, { value: "custom", label: "Custom" },
];
const GENDERS: GenderRule[] = ["all", "women", "men", "women_nb"];

export function WhoCanJoin({ form, patch, show, squadWomen, hostName }: Pick<Props, "form" | "patch" | "show"> & { squadWomen: boolean; hostName: string }) {
  const gender: GenderRule = squadWomen ? "women" : form.gender;
  const minAge = minAgeOf(form);
  const age = parseInt(form.ageMin, 10);
  const badAge = form.age === "custom" && !(age >= 5 && age <= 80);
  const restricted = gender !== "all" || minAge != null;
  return (
    <Section title="Who can join">
      <div className="pc-field">
        <span className="pc-label">Age</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <SegmentedControl value={form.age} onChange={v => patch({ age: v as AgeRule })} options={AGES} />
          {form.age === "custom" ? (
            <Input aria-label="Minimum age" inputMode="numeric" value={form.ageMin} style={{ width: 110 }} placeholder="21"
              onChange={e => patch({ ageMin: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
          ) : null}
        </div>
        {form.age === "custom" && show && badAge ? <span style={eErr}>A minimum age is between 5 and 80.</span> : null}
      </div>
      <div className="pc-field">
        <span className="pc-label">Gender</span>
        <RadioGroup direction="row" gap={18} value={gender} disabled={squadWomen} onChange={v => patch({ gender: v as GenderRule })}
          options={GENDERS.map(g => ({ value: g, label: GENDER_LABEL[g] }))} />
      </div>
      {restricted ? (
        <span style={kMuted}>
          {squadWomen ? `${hostName} is a women-only squad, so its events are too. ` : ""}
          Only {gender === "all" ? "runners" : GENDER_LABEL[gender].replace(" only", "").toLowerCase()}
          {minAge != null ? ` aged ${minAge}+` : ""} can register.
          {gender === "women"
            ? ` pacr checks this against each runner’s profile, so it’s one ticket per booking${minAge != null ? "; they confirm their age when they register" : ""}.`
            : " They confirm it when they register, for everyone they book for."}
        </span>
      ) : null}
    </Section>
  );
}
