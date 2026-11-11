(() => {
const { Tabs, PostCard, Card, Avatar, Button, IconButton, Icon, Media, RadioGroup, Checkbox, ChipSelect, RunCard, RunnerRow, StatTile, BarChart, Skeleton, EmptyState, LoadMore, BottomSheet, PhotoPicker } = window.PacrWebDesignSystem_1066e0;
const D = window.PACR;
// NOTE: the web feed launches WITHOUT the Composer below (decided 2026-11-11, see pacr/docs/web/feed-plan.md).

function Composer({ onPost }) { /* omitted on purpose: no composer on the web */ return null; }

function FeedPage({ ctx }) {
  const [tab, setTab] = React.useState('squads');
  const [posts, setPosts] = React.useState(D.posts);
  const [loading, setLoading] = React.useState(true);
  const [more, setMore] = React.useState(false);
  React.useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, [tab]);
  if (!ctx.signedIn) return <div className="pw-container sec"><EmptyState icon="lock" title="Sign in to see your feed" body="Runs, photos and kudos from the people and squads you follow." action="Sign in" onAction={() => ctx.go('signin')} /></div>;
  const shown = tab === 'following' ? posts.filter(p => !p.squads.length || p.mine) : tab === 'discover' ? [] : posts;
  return <div className="pw-container" style={{ paddingTop: 24, paddingBottom: 64 }}><div className="split split--feed">
    <div className="stack" style={{ gap: 16 }}>
      <Tabs variant="pill" value={tab} onChange={setTab} tabs={[{ id: 'squads', label: 'Squads' }, { id: 'following', label: 'Following' }, { id: 'discover', label: 'Discover' }]} />
      {loading ? <><Skeleton variant="post" /><Skeleton variant="post" /></> : shown.length ? <>{shown.map(p => <PostCard key={p.id} {...p} own={p.author.handle === D.me.handle} />)}<LoadMore hasMore={!more} onClick={() => setMore(true)} /></>
        : <Card><EmptyState icon="compass" title="Your feed is quiet." body="Follow runners and join squads to see their runs here." action="Find squads near you" onAction={() => ctx.go('clubs')} /></Card>}
    </div>
    <aside className="stack sticky hide-md">
      <Card><h3 className="t-h4" style={{ marginBottom: 12 }}>Your week</h3><div className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><StatTile flat size="sm" label="Distance" value="21.4" unit="km" delta="+4.2 km" /><StatTile flat size="sm" label="Runs" value="3" /></div><div style={{ marginTop: 12 }}><BarChart height={90} data={[5, 0, 6.2, 0, 0, 10.2, 0]} labels={['M', 'T', 'W', 'T', 'F', 'S', 'S']} highlight={5} /></div></Card>
      <Card><h3 className="t-h4" style={{ marginBottom: 4 }}>Your squads' next runs</h3>{D.runs.filter(r => D.me.squads.includes(r.squad)).map(r => <a key={r.rid} href={'#/run/' + r.rid} className="row" style={{ padding: '10px 0', textDecoration: 'none', color: 'inherit', flexWrap: 'nowrap', borderTop: '1px solid var(--border-subtle)' }}><Icon name="calendar" size={18} /><div style={{ flex: 1 }}><b className="t-body-s">{r.title}</b><div className="t-caption">{r.dow}, {r.time} · {D.squad(r.squad).name}</div></div><Icon name="chevron-right" size={16} /></a>)}</Card>
      <Card><h3 className="t-h4">Runners you might know</h3><RunnerRow name="Rohan Das" handle="rohan" sub="In Lalbagh Loopers" /><RunnerRow name="Sid Prakash" handle="sid" sub="Runs with 6am Club" /></Card>
    </aside>
  </div></div>;
}
window.FeedPage = FeedPage;
})();
