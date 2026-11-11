(() => {
const { Tabs, SegmentedControl, Card, TicketCard, TrustTag, Media, Button, Icon, Input, CodeInput, FieldMessage, Logo, EmptyState, DirectionsLink } = window.PacrWebDesignSystem_1066e0;
const D = window.PACR;

function TicketsPage({ ctx }) {
  const [when, setWhen] = React.useState('upcoming');
  const [open, setOpen] = React.useState(null);
  const [seat, setSeat] = React.useState('1');
  if (!ctx.signedIn) return <div className="pw-container sec"><EmptyState icon="ticket" title="Sign in to see your tickets" action="Sign in" onAction={() => ctx.go('signin')} /></div>;
  const orders = when === 'upcoming' ? [{ ev: D.events[0], seats: ['10K', '10K'], status: 'valid', paid: '₹1,056.88' }, { ev: D.events[2], seats: ['Free'], status: 'valid', paid: 'Free' }] : [{ ev: { ...D.events[1], date: 'Thu, 23 Oct · 7:00 pm' }, seats: ['General'], status: 'checked-in', paid: '₹316.48' }, { ev: { ...D.events[3], title: 'Hennur 5K', date: 'Sun, 12 Oct · 6:00 am', venue: 'Hennur' }, seats: ['5K'], status: 'refunded', paid: '₹421.54' }];
  const o = open != null ? orders[open] : null;
  return <div className="pw-container" style={{ paddingTop: 24, paddingBottom: 64, maxWidth: 960 }}>
    <div className="sec-h"><h1 className="t-h1">Your tickets</h1><SegmentedControl value={when} onChange={v => { setWhen(v); setOpen(null); }} options={[{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }]} /></div>
    {o ? <div className="split split--ticket">
      <div className="stack" style={{ alignItems: 'center' }}>{o.seats.length > 1 ? <Tabs variant="pill" value={seat} onChange={setSeat} tabs={o.seats.map((s, i) => ({ id: String(i + 1), label: 'Seat ' + (i + 1) }))} /> : null}
        <TicketCard event={o.ev.title} date={o.ev.date} venue={o.ev.venue + ', Bengaluru'} holder={D.me.name} ticketType={o.seats[+seat - 1] || o.seats[0]} seat={+seat > o.seats.length ? 1 : +seat} seats={o.seats.length} status={o.status} qrValue={o.ev.rid} /></div>
      <div className="stack"><Button variant="ghost" icon="arrow-left" onClick={() => setOpen(null)} style={{ alignSelf: 'flex-start' }}>All tickets</Button>
        <Card><div className="stack"><b>{o.ev.title}</b><span className="t-secondary">{o.ev.date}</span><span className="t-secondary">{o.ev.venue}, Bengaluru</span><DirectionsLink address={o.ev.venue + ', Bengaluru'} /></div></Card>
        <Card><div className="row" style={{ justifyContent: 'space-between' }}><span className="t-secondary">Paid</span><b className="num">{o.paid}</b></div><p className="t-caption" style={{ margin: '10px 0 0' }}>{o.status === 'refunded' ? 'Refunded to your original payment method on 14 Oct.' : 'Cancel up to 48 hours before for a refund of the ticket price.'}</p>{o.status === 'valid' && o.paid !== 'Free' ? <Button variant="ghost" size="sm" style={{ marginTop: 8 }}>Cancel order</Button> : null}</Card></div>
    </div> : <div className="stack">{orders.map((x, i) => <Card key={i} interactive onClick={() => { setOpen(i); setSeat('1'); }}><div className="row" style={{ flexWrap: 'nowrap', gap: 16 }}><div style={{ width: 56, flex: 'none' }}><Media ratio="2:3" radius={6} /></div><div style={{ flex: 1, minWidth: 0 }}><b>{x.ev.title}</b><div className="t-caption">{x.ev.date} · {x.ev.venue}</div><div className="t-body-s" style={{ marginTop: 4 }}>{x.seats.length} {x.seats.length === 1 ? 'seat' : 'seats'} · {x.seats[0]}</div></div>
      {x.status === 'valid' ? <TrustTag kind="going">Valid</TrustTag> : x.status === 'checked-in' ? <TrustTag kind="checked-in" /> : <TrustTag kind="request-sent">Refunded</TrustTag>}<Icon name="chevron-right" /></div></Card>)}</div>}
  </div>;
}

function SignInPage({ ctx }) {
  const [step, setStep] = React.useState('start');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [err, setErr] = React.useState(false);
  const done = () => { ctx.setSignedIn(true); ctx.go('feed'); };
  return <div className="pw-container" style={{ padding: '56px var(--page-gutter) 80px', display: 'grid', placeItems: 'center' }}><Card style={{ width: 'min(420px, 100%)', padding: 28 }}>
    <div className="stack" style={{ gap: 16 }}><Logo height={30} />
      {step === 'start' ? <><h1 className="t-h2">Sign in to pacr</h1>
        <Button block size="lg" variant="inverse" icon="apple" onClick={done}>Continue with Apple</Button><Button block size="lg" variant="secondary" icon="chrome" onClick={done}>Continue with Google</Button>
        <div className="row" style={{ gap: 12, color: 'var(--text-muted)', fontSize: 13 }}><span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />or<span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} /></div>
        <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        <Button block size="lg" disabled={!/.+@.+\..+/.test(email)} onClick={() => setStep('code')}>Email me a code</Button></>
      : <><h1 className="t-h2">Check your email</h1><p className="t-secondary" style={{ margin: 0 }}>We sent a 6-digit code to <b style={{ color: 'var(--text-primary)' }}>{email}</b>.</p>
        <CodeInput value={code} error={err} autoFocus onChange={v => { setCode(v); setErr(false); if (v.length === 6) { if (v === '000000') setErr(true); else setTimeout(done, 300); } }} />
        {err ? <FieldMessage tone="error">That code didn't work. Check the latest email from pacr.</FieldMessage> : <FieldMessage>Any 6 digits work in this demo (000000 shows the error).</FieldMessage>}
        <Button variant="ghost" onClick={() => setStep('start')}>Use a different email</Button></>}
      <p className="t-caption" style={{ margin: 0, textAlign: 'center' }}>No passwords. Accounts are made in the app.</p></div>
  </Card></div>;
}
Object.assign(window, { TicketsPage, SignInPage });
})();
