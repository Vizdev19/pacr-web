(() => {
const { Media, VerifiedMark, TrustTag, Button, IconButton, Icon, Tabs, RunCard, EventCard, MapEmbed, DirectionsLink, Card, Avatar, AvatarGroup, BottomSheet, Input, Banner, LeaderboardTable, RunnerRow, PostCard, ShareMenu, Breadcrumbs, ErrorState } = window.PacrWebDesignSystem_1066e0;
const D = window.PACR;

function JoinAction({ s, state, onJoin, block }) {
  if (state === 'member') return <Button variant="secondary" icon="check" block={block}>Member</Button>;
  if (state === 'sent') return <Button variant="secondary" icon="clock" disabled block={block}>Request sent</Button>;
  if (s.policy === 'invite') return <div className="stack" style={{ gap: 6 }}><Button variant="secondary" icon="lock" disabled block={block}>Invite only</Button><span className="t-caption">Members join by invite from the organisers.</span></div>;
  return <Button icon={s.policy === 'open' ? 'user-plus' : 'message-circle-question'} onClick={onJoin} block={block} size={block ? 'lg' : 'md'}>{s.policy === 'open' ? 'Join squad' : 'Ask to join'}</Button>;
}

function SquadPage({ ctx, id }) {
  const s = D.squad(id);
  const member = ctx.signedIn && D.me.squads.includes(id);
  const [state, setState] = React.useState(member ? 'member' : 'none');
  const [ask, setAsk] = React.useState(false);
  const [ans, setAns] = React.useState({});
  const [tab, setTab] = React.useState('runs');
  const [share, setShare] = React.useState(false);
  const [rsvp, setRsvp] = React.useState({});
  React.useEffect(() => { setState(ctx.signedIn && D.me.squads.includes(id) ? 'member' : 'none'); }, [ctx.signedIn]);
  if (!s) return <div className="pw-container sec"><ErrorState kind="notfound" title="We can't find that squad" body="It may have changed its name or closed." action="Browse squads" onAction={() => ctx.go('clubs')} /></div>;
  const runs = D.runs.filter(r => r.squad === s.slug);
  const events = D.events.filter(e => e.host === s.name);
  const join = () => ctx.requireSignIn(s.policy === 'open' ? 'Sign in to join' : 'Sign in to ask to join', () => { if (s.policy === 'open') { setState('member'); ctx.toast({ title: "You're in", message: 'Welcome to ' + s.name }); } else setAsk(true); });
  const isMember = state === 'member';
  const qs = s.questions || ['Why do you want to join?'];
  const runList = <div className="stack">{runs.length ? runs.map(r => <RunCard key={r.rid} {...window.runProps(r, ctx, rsvp, setRsvp)} squad={null} />) : <p className="t-secondary">No runs on the calendar yet.</p>}</div>;
  return <div className="pw-container" style={{ paddingBottom: 64 }}>
    <div style={{ paddingTop: 16 }}><Breadcrumbs items={[{ label: 'Squads', href: '#/clubs' }, { label: s.city, href: '#/clubs' }, { label: s.name }]} /></div>
    <div className="ent-cover"><Media ratio="5:2" label="Squad cover" /><div style={{ position: 'absolute', right: 12, top: 12 }}><IconButton icon="share-2" label="Share squad" variant="overlay" onClick={() => setShare(true)} /></div></div>
    <div className="ent-head">
      <div className="ent-head__tile"><Media ratio="1:1" tile /></div>
      <div className="ent-head__txt"><h1 className="t-h1">{s.name}{s.verified ? <VerifiedMark size={24} /> : null}</h1>
        <div className="pw-meta" style={{ marginTop: 6 }}><span><Icon name="map-pin" size={15} />{s.area}, {s.city}</span><span><Icon name="users-round" size={15} />{s.members} members</span>{s.instagram ? <span><Icon name="instagram" size={15} />{s.instagram}</span> : null}</div>
        <div className="pw-tags" style={{ marginTop: 10 }}><TrustTag kind={s.policy} />{s.womenOnly ? <TrustTag kind="women-only" /> : null}{s.verified ? <TrustTag kind="verified" /> : null}</div></div>
      <div className="hide-md" style={{ paddingBottom: 4 }}><JoinAction s={s} state={state} onJoin={join} /></div>
    </div>
    {isMember ? <div style={{ marginTop: 24 }}><Tabs value={tab} onChange={setTab} tabs={[{ id: 'feed', label: 'Feed' }, { id: 'runs', label: 'Runs' }, { id: 'ann', label: 'Announcements', count: 1, unread: true }, { id: 'chat', label: 'Chat' }, { id: 'lb', label: 'Leaderboard' }, { id: 'mem', label: 'Members', count: s.members }, { id: 'about', label: 'About' }]} /></div> : null}
    <div className="split" style={{ marginTop: 28 }}>
      <div>
        {isMember && tab === 'feed' ? <div className="stack">{D.posts.slice(0, 2).map(p => <PostCard key={p.id} {...p} />)}</div> : null}
        {isMember && tab === 'ann' ? <Card><div className="row" style={{ marginBottom: 8 }}><Avatar name={s.organiser} size={32} /><b>{s.organiser}</b><TrustTag kind="organiser" size="sm" /><span className="t-caption">Mon</span></div><p style={{ margin: 0 }}>No run on 22 Nov. We'll join the Sunday coffee run instead. Tickets are free.</p></Card> : null}
        {isMember && tab === 'lb' ? <Card><div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}><b>This week</b><span className="t-caption">Mon 9 – Sun 15 Nov</span></div><LeaderboardTable rows={[{ rank: 1, name: 'Arjun Mehta', km: 48.2, runs: 5 }, { rank: 2, name: 'Meera Nair', km: 41, runs: 4 }, { rank: 3, name: 'Rohan Das', km: 36.5, runs: 4 }, { rank: 7, name: 'Priya Raman', km: 21.4, runs: 3, you: true }]} /></Card> : null}
        {isMember && tab === 'mem' ? <Card><RunnerRow name={s.organiser} handle="arjun" role="owner" /><RunnerRow name="Meera Nair" handle="meera" role="organiser" following /><RunnerRow name="Rohan Das" handle="rohan" role="run-leader" /><RunnerRow name="Priya Raman" handle="priya" isYou /></Card> : null}
        {isMember && tab === 'chat' ? <Card><div className="stack"><Banner tone="neutral" icon="pin" title="Pinned">Meet at the gate at 5:50. Parking on Kasturba Rd.</Banner><p className="t-caption" style={{ margin: 0 }}>Chat is in the app. <a href="#">Open in pacr</a></p></div></Card> : null}
        {(!isMember || tab === 'runs') ? <div className="block"><h2>Upcoming runs</h2>{runList}</div> : null}
        {(!isMember || tab === 'about') ? <>
          <div className="block prose"><h2>About</h2><p>{s.about}</p></div>
          <div className="block"><h2>Weekly schedule</h2><Card pad={false}>{s.schedule.map(([d, t, n, km], i) => <div key={i} className="row" style={{ padding: '14px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 0, justifyContent: 'space-between' }}><span><b style={{ display: 'inline-block', width: 48 }}>{d}</b>{n}</span><span className="t-secondary num">{t} · {km}</span></div>)}</Card></div>
          {s.rules.length ? <div className="block"><h2>Squad rules</h2><ul className="rules">{s.rules.map(r => <li key={r}>{r}</li>)}</ul></div> : null}
          {events.length ? <div className="block"><h2>Events by {s.name}</h2><div className="grid-posters">{events.map(e => <EventCard key={e.rid} {...e} href={'#/e/' + e.rid} />)}</div></div> : null}
        </> : null}
      </div>
      <aside className="stack sticky">
        <Card className="hide-md"><div className="stack"><JoinAction s={s} state={state} onJoin={join} block />{!isMember ? <span className="t-caption">{s.policy === 'ask' ? 'The organisers will see your answers to ' + qs.length + ' short questions.' : s.policy === 'open' ? 'Free. Leave any time.' : ''}</span> : null}</div></Card>
        <Card pad={false}><MapEmbed ratio="16:9" radius={0} interactive={false} pins={[{ x: .45, y: .5, active: true, icon: 'house' }]} /><div style={{ padding: 16 }} className="stack"><div><span className="t-caption">Home base</span><div style={{ fontWeight: 600 }}>{s.base}</div></div><DirectionsLink address={s.base} /></div></Card>
        <Card><span className="t-caption">Organiser</span><div className="row" style={{ marginTop: 8 }}><Avatar name={s.organiser} size={36} /><b>{s.organiser}</b></div>
          {ctx.signedIn ? <div className="row" style={{ marginTop: 14 }}><AvatarGroup names={['Meera Nair', 'Rohan Das']} size={24} /><span className="t-caption">Meera and Rohan, who you follow, are members</span></div> : <p className="t-caption" style={{ margin: '14px 0 0' }}>{s.members} members. Sign in to see people you follow.</p>}</Card>
        {isMember && ctx.signedIn ? <Button variant="ghost" icon="layout-dashboard">Manage in dashboard</Button> : null}
      </aside>
    </div>
    {!isMember ? <div className="only-md mbar" style={{ bottom: ctx.signedIn ? 'var(--tabbar-h)' : 0, zIndex: 31 }}><div><b>{s.name}</b><div className="t-caption">{s.members} members · Next {s.nextRun}</div></div><JoinAction s={s} state={state} onJoin={join} /></div> : null}
    <BottomSheet open={ask} onClose={() => setAsk(false)} title={'Ask to join ' + s.name} footer={<Button block size="lg" disabled={qs.some((q, i) => !(ans[i] || '').trim())} onClick={() => { setAsk(false); setState('sent'); ctx.toast({ title: 'Request sent', message: 'The organisers will review your answers.', tone: 'info' }); }}>Send request</Button>}>
      <div className="stack" style={{ gap: 16 }}><p className="t-body-s t-secondary" style={{ margin: 0 }}>{s.organiser} and the organisers will see your answers and your profile.</p>
        {qs.map((q, i) => <Input key={i} label={(i + 1) + '. ' + q} multiline rows={2} value={ans[i] || ''} onChange={e => setAns({ ...ans, [i]: e.target.value })} />)}</div>
    </BottomSheet>
    <ShareMenu open={share} onClose={() => setShare(false)} url={'pacr.life/s/' + s.slug} title="Share this squad" onAction={id => id === 'copy' && ctx.toast({ title: 'Link copied' })} />
  </div>;
}
window.SquadPage = SquadPage;
})();
