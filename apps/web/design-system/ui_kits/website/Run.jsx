(() => {
const { Breadcrumbs, DateTile, VerifiedMark, TrustTag, Button, IconButton, Icon, MapEmbed, DirectionsLink, Card, AvatarGroup, Avatar, RunCard, Banner, QRBlock, BottomSheet, ShareMenu, ErrorState, EmptyState } = window.PacrWebDesignSystem_1066e0;
const D = window.PACR;

function RunPage({ ctx, id }) {
  const r = D.run(id);
  const [going, setGoing] = React.useState(false);
  const [qr, setQr] = React.useState(false);
  const [share, setShare] = React.useState(false);
  if (!r) {
    const s = D.squads[0]; const next = D.runs.filter(x => x.squad === s.slug);
    return <div className="pw-container" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 720 }}>
      <EmptyState icon="calendar-x" title="This run is no longer on the calendar" body={'The organisers removed it. Here are ' + s.name + "'s next runs."} />
      <div className="stack">{next.map(x => <RunCard key={x.rid} {...x} squad={s.name} href={'#/run/' + x.rid} showCta={false} />)}</div></div>;
  }
  const s = D.squad(r.squad);
  const isMember = ctx.signedIn && D.me.squads.includes(r.squad);
  const checkin = isMember && going;
  const toggle = () => ctx.requireSignIn('Sign in to RSVP', () => { setGoing(g => { if (!g) ctx.toast({ title: "You're going", message: r.title + ' · ' + r.dow + ', ' + r.time, action: 'Add to calendar' }); return !g; }); });
  const n = r.goingCount + (going ? 1 : 0);
  const others = D.runs.filter(x => x.squad === r.squad && x.rid !== r.rid);
  const rsvpBtn = r.womenOnly && ctx.signedIn && false ? null : <Button size="lg" block variant={going ? 'secondary' : 'primary'} className="pw-rsvp" aria-pressed={going} icon={going ? 'check' : 'calendar-plus'} onClick={toggle}>{going ? 'Going' : 'RSVP'}</Button>;
  return <div className="pw-container" style={{ paddingTop: 16, paddingBottom: 64 }}>
    <Breadcrumbs items={[{ label: s.name, href: '#/s/' + s.slug }, { label: r.title }]} />
    <div className="split" style={{ marginTop: 20 }}>
      <div>
        <div className="row" style={{ alignItems: 'flex-start', gap: 18, flexWrap: 'nowrap' }}><DateTile dow={r.dow} day={r.day} month={r.month} time={r.time} today={r.today} />
          <div style={{ flex: 1, minWidth: 0 }}><a href={'#/s/' + s.slug} className="row" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, gap: 6 }}>{s.name}{s.verified ? <VerifiedMark size={15} /> : null}</a>
            <h1 className="t-h1" style={{ margin: '4px 0 10px' }}>{r.title}</h1>
            <div className="pw-tags">{r.womenOnly ? <TrustTag kind="women-only" /> : null}<TrustTag kind="repeats">{r.repeats || 'One-off run'}</TrustTag>{going ? <TrustTag kind="going" /> : null}</div></div>
          <IconButton icon="share-2" label="Share run" variant="secondary" onClick={() => setShare(true)} /></div>
        {r.womenOnly ? <div style={{ marginTop: 20 }}><Banner tone="info" title="Women-only run">Everyone can see this run. Only women can RSVP, by the squad's rules in the app.</Banner></div> : null}
        <div className="block" style={{ marginTop: 28 }}><MapEmbed ratio="16:9" pins={[{ x: .44, y: .46, label: r.place.split(',')[1] || 'Start', active: true, icon: 'flag' }]} address={r.place} directions />
          <dl className="dl"><dt><Icon name="map-pin" size={17} />Meet</dt><dd>{r.place}</dd><dt><Icon name="clock" size={17} />When</dt><dd>{r.dow}, {r.day} {r.month} · {r.time}</dd><dt><Icon name="route" size={17} />Distance</dt><dd className="num">{r.distance} km</dd><dt><Icon name="gauge" size={17} />Pace</dt><dd className="num">{r.pace} /km, with slower groups</dd><dt><Icon name="flag" size={17} />Run leader</dt><dd>{r.leader}</dd></dl></div>
        {others.length ? <div className="block"><h2>{s.name}'s other runs</h2><div className="stack">{others.map(x => <RunCard key={x.rid} {...x} squad={null} href={'#/run/' + x.rid} showCta={false} />)}</div></div> : null}
      </div>
      <aside className="stack sticky">
        <Card className="hide-md"><div className="stack">
          <div className="row"><AvatarGroup names={r.going} total={n} max={4} size={30} /><span className="t-body-s"><b className="num">{n}</b> going</span></div>
          {rsvpBtn}
          {going ? <div className="row" style={{ justifyContent: 'space-between' }}><Button size="sm" variant="ghost" icon="calendar">Add to calendar</Button><DirectionsLink address={r.place} /></div> : <span className="t-caption">RSVP is free. No limit on places.</span>}
        </div></Card>
        {checkin ? <Card><div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}><TrustTag kind="checkin-open" /><b>Check-in opens 30 min before the start</b><Button block icon="qr-code" onClick={() => setQr(true)}>Show my check-in QR</Button></div></Card> : null}
        {ctx.signedIn && going ? <Card><span className="t-caption">Going</span><div className="stack" style={{ marginTop: 8, gap: 8 }}>{['Priya Raman', ...r.going].slice(0, 4).map(nm => <div key={nm} className="row"><Avatar name={nm} size={28} /><span className="t-body-s">{nm}{nm === D.me.name ? ' (you)' : ''}</span></div>)}<span className="t-caption">and {n - 4} more</span></div></Card> : null}
      </aside>
    </div>
    <div className="only-md mbar" style={{ bottom: ctx.signedIn ? 'var(--tabbar-h)' : 0, zIndex: 31 }}><div><b className="num">{n} going</b><div className="t-caption">{r.dow}, {r.time} · {r.distance} km</div></div><div style={{ flex: 'none', width: 140 }}>{checkin ? <Button block icon="qr-code" onClick={() => setQr(true)}>My QR</Button> : rsvpBtn}</div></div>
    <BottomSheet open={qr} onClose={() => setQr(false)} title="Check-in QR">
      <div data-theme="light" style={{ background: '#fff', color: '#000', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}><QRBlock large size={240} value={'checkin-' + r.rid} refCode={D.me.name.toUpperCase()} brightnessHint /><b style={{ fontSize: 17 }}>{r.title} · {r.time}</b><span className="t-caption">Show this to {r.leader} at the start.</span></div>
    </BottomSheet>
    <ShareMenu open={share} onClose={() => setShare(false)} url={'pacr.life/s/' + s.slug + '?run=' + r.rid.replace('r-', 'k7')} title="Share this run" onAction={a => a === 'copy' && ctx.toast({ title: 'Link copied' })} />
  </div>;
}
window.RunPage = RunPage;
})();
