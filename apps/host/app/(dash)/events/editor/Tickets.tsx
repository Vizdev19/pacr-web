"use client";

// Tickets: free or paid, the ticket types (name, limit, price while nobody has
// bought it), and each type's sale options: when it goes on sale, an early
// last day, opening after the type above, hidden. A free event can ask the
// host to approve each runner. The app's form, on the web
// (pacr app/event-create.tsx); the rules are the database's and are said here
// before a save would be refused for them.

import { useState } from "react";
import { Button, Icon, IconButton, Input, SegmentedControl, Switch } from "@/components/ds";
import { kMuted, kStrong } from "@/components/shell/kit";
import {
  MAX_TIERS, cleanPrice, feeMinorOf, newTier, priceLocked, priceMinorOf, totalCapacity,
  type Check, type EventForm, type FeeRules, type TierDraft,
} from "@/lib/eventEditor";
import { zoneShort, type Wall } from "@/lib/eventZone";
import { num, paise, plural } from "@/lib/format";
import { eBox, eErr, eRow, Section, shiftDay, SwitchRow, WhenInput } from "./parts";

export function Tickets({ form, patch, fees, check, show, paidAllowed, saleOptions, approval, live, refundCharged, onRefuse, children }: {
  form: EventForm;
  patch: (p: Partial<EventForm>) => void;
  fees: FeeRules;
  check: Check;
  /** Show what's wrong (after a save was tried). */
  show: boolean;
  paidAllowed: boolean;
  /** false when this database has no sale options yet; null while unknown. */
  saleOptions: boolean | null;
  /** false when this database can't hold "Approve each runner" yet; null while unknown. */
  approval: boolean | null;
  live: boolean;
  /** Say that refunds the host causes carry the payment charge. */
  refundCharged: boolean;
  /** A choice the form can't take: a toast says why. */
  onRefuse: (title: string, body: string) => void;
  /** The payout card, under the fee line. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const tiers = form.tiers;

  const setTier = (key: string, p: Partial<TierDraft>) => {
    const next = tiers.map(t => (t.key === key ? { ...t, ...p } : t));
    // A type can't open after one that is hidden (it sells to nobody), so hiding a type turns that off on the one below it.
    patch({ tiers: next.map((t, i) => (i > 0 && next[i - 1].hidden && t.afterPrev ? { ...t, afterPrev: false } : t)) });
  };
  const remove = (key: string) => {
    const next = tiers.filter(t => t.key !== key);
    // The first type has nothing above it to wait for.
    patch({ tiers: next.map((t, i) => (i === 0 && t.afterPrev ? { ...t, afterPrev: false } : t)) });
  };

  const setPaid = (v: string) => {
    const paid = v === "paid";
    if (paid === form.paid) return;
    if (paid && !paidAllowed) {
      onRefuse("Paid tickets aren’t open yet", "pacr is still switching paid tickets on. This event can be free for now.");
      return;
    }
    if (!paid && tiers.some(t => priceLocked(t) && priceMinorOf(t.price) != null)) {
      onRefuse("These prices are fixed", "Runners have already bought tickets at these prices, so the event can’t become free.");
      return;
    }
    // A paid ticket isn't "General entry", and it is bought, not asked for: approval is a free event's.
    const one = tiers.length === 1 ? tiers[0] : null;
    patch({ paid, ...(paid ? { requiresApproval: false } : {}), tiers: paid && one && one.name === "General entry" && !one.id ? [{ ...one, name: "Standard" }] : tiers });
  };

  const cap = totalCapacity(tiers);
  const zone = zoneShort(form.zone);

  return (
    <Section title="Tickets" note={live ? "A type runners have booked keeps its price, and its limit can’t go under the seats taken." : undefined}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <SegmentedControl value={form.paid ? "paid" : "free"} onChange={setPaid}
          options={[{ value: "free", label: "Free" }, { value: "paid", label: "Paid" }]} />
        {!paidAllowed && !form.paid ? <span style={kMuted}>Paid tickets aren’t open yet.</span> : null}
      </div>
      {!form.paid && approval !== false ? (
        <SwitchRow label="Approve each runner" checked={form.requiresApproval}
          sub="Runners ask for a spot. You approve or decline each one, and they get their ticket once you approve."
          onChange={on => patch({ requiresApproval: on })} />
      ) : null}

      {tiers.map((t, i) => {
        const err = show ? check.tier[t.key] : undefined;
        const locked = priceLocked(t);
        const pm = priceMinorOf(t.price);
        const inUse = !!t.opensAt || !!t.closesEarlyAt || t.afterPrev || t.hidden;
        const unfolded = inUse || open === t.key;
        const above = tiers[i - 1];
        const priceHint = !form.paid ? undefined
          : locked ? `${plural(t.taken, "seat")} taken · the price is fixed`
          : pm != null && pm >= fees.priceMinMinor && pm <= fees.priceMaxMinor ? `Runner pays ${paise(pm + feeMinorOf(pm, fees))} · you get ${paise(pm)}`
          : `${paise(fees.priceMinMinor)} to ${paise(fees.priceMaxMinor)}`;
        return (
          <div key={t.key} style={eBox}>
            <div style={eRow}>
              <Input label="Ticket name" value={t.name} maxLength={40} placeholder="General entry" style={{ flex: "2 1 220px" }}
                onChange={e => setTier(t.key, { name: e.target.value })} />
              {form.paid ? (
                locked && pm == null ? (
                  <Input label="Price" value="Free" disabled hint={`${plural(t.taken, "seat")} taken · stays free`} style={{ flex: "1 1 150px" }} />
                ) : (
                  <Input label="Price" icon="indian-rupee" inputMode="decimal" value={t.price} placeholder="0" disabled={locked}
                    error={err?.price} hint={priceHint} style={{ flex: "1 1 150px" }}
                    onChange={e => setTier(t.key, { price: cleanPrice(e.target.value) })} />
                )
              ) : null}
              <div style={{ flex: "1 1 170px", display: "flex", flexDirection: "column", gap: 8 }}>
                <Input label="Limit" inputMode="numeric" value={t.unlimited ? "" : t.capacity} disabled={t.unlimited}
                  placeholder={t.unlimited ? "No limit" : "50"} error={t.unlimited ? undefined : err?.capacity}
                  hint={t.unlimited ? undefined : t.taken > 0 ? `${num(t.taken)} taken` : "seats"}
                  onChange={e => setTier(t.key, { capacity: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
                <Switch checked={t.unlimited} onChange={on => setTier(t.key, { unlimited: on })} label="No limit" />
              </div>
              {tiers.length > 1 && t.taken === 0 ? (
                <IconButton icon="trash-2" label={`Remove ${t.name.trim() || "this ticket type"}`} variant="ghost" size="sm" style={{ marginTop: 22 }}
                  onClick={() => remove(t.key)} />
              ) : null}
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              {saleOptions === false ? (
                <span style={kMuted}>Sale options (an on-sale time, an early bird, hidden types) aren’t switched on yet.</span>
              ) : !unfolded ? (
                <Button variant="ghost" size="sm" icon="sliders-horizontal" onClick={() => setOpen(t.key)}>Sale options</Button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="sliders-horizontal" size={14} color="var(--text-muted)" /><span style={kStrong}>Sale options</span>
                    <span style={kMuted}>· times are {zone}</span>
                  </div>
                  <OptionalWhen label="On sale from" off="As soon as the event is published" on="A set time"
                    value={t.opensAt} error={err?.opens} fallback={shiftDay(form.startsAt, -14, "10:00")}
                    onChange={w => setTier(t.key, { opensAt: w })} />
                  <OptionalWhen label="Stops selling" off="When registration closes" on="Earlier (an early bird)"
                    value={t.closesEarlyAt} error={err?.early} fallback={shiftDay(form.startsAt, -7, "21:00")}
                    onChange={w => setTier(t.key, { closesEarlyAt: w })} />
                  {i > 0 ? (
                    <SwitchRow label="Opens after the type above" checked={t.afterPrev} disabled={!!above?.hidden && !t.afterPrev}
                      sub={above?.hidden ? "The type above is hidden, so nothing can wait for it."
                        : `Goes on sale when ${above?.name.trim() || "the type above"} sells out or stops selling. That type needs a limit or an early last day.`}
                      onChange={on => setTier(t.key, { afterPrev: on })} />
                  ) : null}
                  <SwitchRow label="Hidden" checked={t.hidden} disabled={!t.hidden && tiers.filter(x => !x.hidden).length <= 1}
                    sub="Not shown or sold to anyone. Seats you give out from the pacr app: crew, pacers, sponsors."
                    onChange={on => setTier(t.key, { hidden: on, ...(on ? { afterPrev: false } : {}) })} />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {tiers.length < MAX_TIERS ? (
        <div><Button variant="secondary" icon="plus" onClick={() => patch({ tiers: [...tiers, newTier()] })}>Add ticket type</Button></div>
      ) : null}
      {show && tiers.length > 0 && tiers.every(t => t.hidden) ? <span style={eErr}>At least one ticket type has to be on show.</span> : null}

      <div style={kMuted}>
        {cap == null ? "No limit on seats" : `${plural(cap, "seat")} in all`}
        {form.paid
          ? ` · Runners pay a ${fees.bps / 100}% pacr fee on top of the price, plus ${fees.gstBps / 100}% GST on that fee. You get the full price, paid out after the event. Only the host can refund a booking.`
          : form.requiresApproval && approval !== false ? " · Runners ask for a free spot, and you approve each one." : " · Runners book for free."}
      </div>
      {refundCharged ? (
        <div style={kMuted}>
          Refunds you make, and an event you cancel, carry Razorpay’s payment charge: about 2.4% of each refunded booking. It comes off your payout.
        </div>
      ) : null}
      {children}
    </Section>
  );
}

/** A time that is usually left to the default: a switch, and the date and time once it is on. */
function OptionalWhen({ label, off, on, value, fallback, error, onChange }: {
  label: string; off: string; on: string; value: Wall | null; fallback: Wall; error?: string; onChange: (w: Wall | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SwitchRow label={`${label}: ${value ? on.toLowerCase() : off.toLowerCase()}`} checked={!!value} onChange={v => onChange(v ? fallback : null)} />
      {value ? <div style={{ paddingLeft: 46 }}><WhenInput label={label} value={value} error={error} onChange={onChange} /></div> : null}
    </div>
  );
}
