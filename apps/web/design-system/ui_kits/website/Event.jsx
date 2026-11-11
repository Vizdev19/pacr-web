(() => {
const { Media, Badge, TrustTag, VerifiedMark, Button, Icon, Card, MapEmbed, DirectionsLink, QuantityStepper, OrderSummary, BottomSheet, Banner, TicketCard, Tabs, SectionNav, ErrorState, Breadcrumbs } = window.PacrWebDesignSystem_1066e0;
const D = window.PACR;
const inr = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 });

function Checkout({ ev, qty, open, onClose, ctx }) {
  const [step, setStep] = React.useState('summary');
  const [left, setLeft] = React.useState(600);
  const [seat, setSeat] = React.useState('1');
  React.useEffect(() => { if (open) { setStep('summary'); setLeft(600); } }, [open]);
  React.useEffect(() => { if (!open || !['summary', 'pay', 'failed'].includes(step)) return; const t = setInterval(() => setLeft(l => { if (l <= 1) { setStep('expired'); return 0; } return l - 1; }), 1000); return () => clearInterval(t); }, [open, step]);
  const lines = ev.tickets.map(t => ({ label: t.label, qty: qty[t.id] || 0, price: t.price }));
  const seats = lines.flatMap(l => Array.from({ length: l.qty }, () => l.label));
  const free = lines.every(l => !l.price || !l.qty);
  const sub = lines.reduce((s, l) => s + l.qty * l.price, 0); const fee = Math.round(sub * 5) / 100; const tot = Math.round((sub + fee + Math.round(fee * 18) / 100) * 100) / 100;
  const mm = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
  if (!open) return null;
  if (step === 'pay') return <div className="razor" onClick={e => e.target === e.currentTarget && setStep('summary')}><div className="razor__box">
    <div className="razor__top"><div><b>pacr</b><div style={{ fontSize: 12, opacity: .8 }}>{ev.title}</div></div><b>{inr(tot)}</b></div>
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}><span style={{ color: '#555', fontSize: 12 }}>Razorpay payment window (stand-in)</span>
      {['UPI', 'Cards', 'Netbanking'].map(m => <div key={m} style={{ padding: 12, border: '1px solid #e5e5e5', borderRadius: 8, fontWeight: 600 }}>{m}</div>)}
      <div style={{ display: 'flex', gap: 8 }}><button className="pw-btn pw-btn--primary" style={{ flex: 1 }} onClick={() => setStep('done')}>Pay {inr(tot)}</button><button className="pw-btn pw-btn--secondary" onClick={() => setStep('failed')}>Fail</button></div></div></div></div>;
  const titles = { summary: 'Order summary', failed: 'Order summary', expired: 'Seats released', done: "You're in" };
  return <BottomSheet open onClose={onClose} title={titles[step]} footer={step === 'summary' || step === 'failed' ? <><Button block size="lg" onClick={() => free ? setStep('done') : setStep('pay')}>{free ? 'Get free tickets' : 'Pay ' + inr(tot)}</Button><span className="t-caption" style={{ textAlign: 'center' }}>Tickets are in your name, {D.me.name}.</span></> : step === 'expired' ? <Button block size="lg" onClick={() => { setLeft(600); setStep('summary'); }}>Hold seats again</Button> : <Button block size="lg" variant="secondary" onClick={() => { onClose(); ctx.go('tickets'); }}>See all my tickets</Button>}>
    {step === 'summary' || step === 'failed' ? <div className="stack" style={{ gap: 16 }}>
      {step === 'failed' ? <Banner tone="error" title="Payment didn't go through">You weren't charged. Your seats are still held.</Banner> : null}
      {!free ? <Banner tone="warning" icon="timer" title={'Seats held for ' + mm}>Pay before the timer runs out or the seats go back on sale.</Banner> : null}
      <div className="row" style={{ flexWrap: 'nowrap', gap: 12 }}><div style={{ width: 52 }}><Media ratio="2:3" radius={6} /></div><div><b>{ev.title}</b><div className="t-caption">{ev.date} · {ev.venue}</div></div></div>
      <OrderSummary lines={lines} note={null} /></div>
    : step === 'expired' ? <p className="t-secondary">The 10-minute hold ran out and your seats went back on sale. Nothing was charged.</p>
    : <div className="stack" style={{ alignItems: 'center', gap: 16 }}>
      <p className="t-secondary" style={{ margin: 0, textAlign: 'center' }}>{seats.length} {seats.length === 1 ? 'ticket' : 'tickets'} for {ev.title}. One QR per seat; each is scanned once at the gate.</p>
      {seats.length > 1 ? <Tabs variant="pill" value={seat} onChange={setSeat} tabs={seats.map((l, i) => ({ id: String(i + 1), label: 'Seat ' + (i + 1) }))} /> : null}
      <TicketCard event={ev.title} date={ev.date} venue={ev.venue} holder={D.me.name} ticketType={seats[+seat - 1] || seats[0]} seat={+seat} seats={seats.length} qrValue={ev.rid} /></div>}
  </BottomSheet>;
}

function EventPage({ ctx, id }) {
  const ev = D.event(id);
  const [qty, setQty] = React.useState({});
  const [open, setOpen] = React.useState(false);
  const [sec, setSec] = React.useState('about');
  if (!ev) return <div className="pw-container sec"><ErrorState kind="notfound" title="We can't find that event" body="It may have ended or been removed." action="See events" onAction={() => ctx.go('events')} /></div>;
  const count = Object.values(qty).reduce((a, b) => a + b, 0);
  const sub = ev.tickets.reduce((s, t) => s + (qty[t.id] || 0) * t.price, 0);
  const sold = ev.status === 'sold-out';
  const buy = () => ctx.requireSignIn('Sign in to get tickets', () => setOpen(true));
  const panel = <div className="stack" style={{ gap: 0 }}>
    {ev.tickets.map(t => <div key={t.id} className="ticket-type"><div><b>{t.label}</b><div className="t-body-s"><b className="num">{t.price ? inr(t.price) : 'Free'}</b>{t.price ? <span className="t-caption"> + fee and GST</span> : null}</div>{t.note ? <div className="t-caption">{t.note}</div> : null}</div>
      {t.left === 0 ? <TrustTag kind="sold-out" /> : <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}><QuantityStepper value={qty[t.id] || 0} max={Math.min(4, t.left)} onChange={v => setQty({ ...qty, [t.id]: v })} label={t.label + ' tickets'} />{t.left <= 10 ? <span className="t-caption" style={{ color: 'var(--warning)' }}>{t.left} left</span> : null}</div>}</div>)}
    <div style={{ paddingTop: 16 }}><Button block size="lg" disabled={!count || sold} onClick={buy}>{sold ? 'Sold out' : count ? 'Get ' + count + (count === 1 ? ' ticket' : ' tickets') + (sub ? ' · ' + inr(sub) : '') : 'Choose tickets'}</Button>{sub ? <p className="t-caption" style={{ margin: '8px 0 0', textAlign: 'center' }}>+ pacr fee (5%) and GST, shown before you pay</p> : null}</div></div>;
  return <>
    <div className="pw-container" style={{ paddingTop: 16 }}><Breadcrumbs items={[{ label: 'Events', href: '#/events' }, { label: ev.title }]} /></div>
    <div className="pw-container"><div className="split split--wide" style={{ marginTop: 20 }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 28, flexWrap: 'wrap' }}>
        <div style={{ width: 'min(260px, 100%)' }}><Media ratio="2:3" radius="var(--radius-lg)" label="Event poster" /></div>
        <div style={{ flex: 1, minWidth: 260 }} className="stack"><div className="row"><Badge tone="accent">{ev.type}</Badge>{ev.status ? <TrustTag kind={ev.status} /> : null}</div>
          <h1 className="t-h1">{ev.title}</h1>
          <div className="row t-secondary" style={{ gap: 6 }}>By <b style={{ color: 'var(--text-primary)' }}>{ev.host}</b>{ev.hostVerified ? <VerifiedMark /> : null}</div>
          <dl className="dl" style={{ marginTop: 8 }}><dt><Icon name="calendar" size={17} />When</dt><dd>{ev.date}</dd><dt><Icon name="map-pin" size={17} />Where</dt><dd>{ev.venue}, Bengaluru</dd><dt><Icon name="ticket" size={17} />Price</dt><dd className="num">{ev.price ? (ev.fromPrice ? 'From ' : '') + inr(ev.price) + ' + fee and GST' : 'Free'}</dd></dl></div>
      </div>
      <aside className="sticky hide-md"><Card><h2 className="t-h4" style={{ marginBottom: 4 }}>Tickets</h2>{panel}</Card></aside>
    </div></div>
    <div style={{ marginTop: 32 }}><SectionNav active={sec} onSelect={setSec} sections={[{ id: 'about', label: 'About' }, { id: 'course', label: 'Course' }, { id: 'schedule', label: 'Schedule' }, { id: 'tickets', label: 'Tickets' }, { id: 'faq', label: 'FAQ' }]} /></div>
    <div className="pw-container" style={{ paddingBottom: 64 }}><div className="split split--wide" style={{ marginTop: 28 }}><div>
      <div className="block prose"><h2>About</h2><p>A flat, fast loop course inside Cubbon Park with two distances. Roads are closed to traffic until 8:00 am.</p>{ev.included ? <><b>What's included</b><ul className="rules" style={{ marginTop: 8 }}>{ev.included.map(i => <li key={i}>{i}</li>)}</ul></> : null}</div>
      <div className="block"><h2>Course</h2><MapEmbed ratio="16:9" route interactive={false} /><p className="t-caption" style={{ margin: 0 }}>Two loops for the 10K, one for the 5K. Start and finish at the bandstand.</p></div>
      <div className="block"><h2>Venue</h2><MapEmbed ratio="5:2" pins={[{ x: .5, y: .55, active: true, label: 'Bandstand' }]} address="Cubbon Park bandstand, Bengaluru" directions /></div>
      {ev.schedule ? <div className="block"><h2>Schedule</h2><Card pad={false}>{ev.schedule.map(([t, w], i) => <div key={i} className="row" style={{ padding: '12px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0 }}><b className="num" style={{ width: 80 }}>{t}</b>{w}</div>)}</Card></div> : null}
      <div className="block only-md" id="tickets"><h2>Tickets</h2><Card>{panel}</Card></div>
      <div className="block faq"><h2>FAQ</h2>{[['Can I transfer my ticket?', 'Not yet. Tickets are in the buyer’s name.'], ['What if the event is cancelled?', 'You get a full refund, including the pacr fee and GST, to your original payment method.']].map(([q, a]) => <details key={q}><summary>{q}<Icon name="plus" /></summary><p>{a}</p></details>)}</div>
    </div><div /></div></div>
    {count ? <div className="only-md mbar" style={{ bottom: ctx.signedIn ? 'var(--tabbar-h)' : 0, zIndex: 31 }}><div><b className="num">{count} {count === 1 ? 'ticket' : 'tickets'} · {sub ? inr(sub) : 'Free'}</b><div className="t-caption">+ fee and GST</div></div><Button onClick={buy}>Continue</Button></div> : null}
    <Checkout ev={ev} qty={qty} open={open} onClose={() => setOpen(false)} ctx={ctx} />
  </>;
}
window.EventPage = EventPage;
})();
