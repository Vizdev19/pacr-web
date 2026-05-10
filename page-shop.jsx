// Pacr — Shop / Collection page (PLP)
const PRODUCTS = [
  {id:1, name:'Field Singlet', variant:'Bone', meta:'Featherweight mesh', price:84, ratio:'4/5', tag:'New'},
  {id:2, name:'Field Singlet', variant:'Ink', meta:'Featherweight mesh', price:84, ratio:'4/5'},
  {id:3, name:'Pacework Half Tight', variant:'Ink', meta:'Compression · pocketed', price:112, ratio:'4/5', tag:'New'},
  {id:4, name:'Threshold LS', variant:'Bone', meta:'Merino blend', price:148, ratio:'4/5'},
  {id:5, name:'Threshold LS', variant:'Graphite', meta:'Merino blend', price:148, ratio:'4/5'},
  {id:6, name:'Mileage Short', variant:'Bone', meta:'5" · linerless', price:96, ratio:'4/5'},
  {id:7, name:'Mileage Short', variant:'Ink', meta:'5" · linerless', price:96, ratio:'4/5'},
  {id:8, name:'Cooldown Crew', variant:'Bone', meta:'Heavyweight cotton', price:128, ratio:'4/5'},
  {id:9, name:'Section Tights', variant:'Ink', meta:'Full length · winter', price:164, ratio:'4/5'},
  {id:10, name:'Race Cap', variant:'Track', meta:'Soft brim', price:48, ratio:'4/5', tag:'Members'},
  {id:11, name:'Wind Shell', variant:'Bone', meta:'Packable · 92 g', price:218, ratio:'4/5'},
  {id:12, name:'Trial Tee', variant:'Ink', meta:'Pre-release · numbered', price:88, ratio:'4/5', tag:'Members'},
];

function ShopPage(){
  const { goto } = React.useContext(PageContext);
  const [filter, setFilter] = React.useState('All');
  const filters = ['All','Tops','Shorts','Tights','Outer'];
  const [sort, setSort] = React.useState('Newest');

  return (
    <div>
      {/* head */}
      <section style={{borderBottom:'1px solid var(--line)'}}>
        <div className="container" style={{padding:'56px 32px 40px'}}>
          <Eyebrow>Collection · Drop 01 · Spring 26</Eyebrow>
          <h1 style={{fontFamily:'var(--display)',fontSize:80,fontWeight:600,letterSpacing:'-0.04em',lineHeight:.95,margin:'24px 0 0',textWrap:'balance', maxWidth:1100}}>
            Twelve pieces. One season. Made to be run in.
          </h1>
        </div>
        {/* filter bar */}
        <div className="container" style={{padding:'24px 32px', borderTop:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{display:'flex', gap:0, fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.16em', textTransform:'uppercase'}}>
            {filters.map((f,i) => (
              <button key={f} onClick={()=>setFilter(f)} style={{
                background:'transparent', border:0, borderRight: i<filters.length-1?'1px solid var(--line)':0,
                padding:'8px 18px', cursor:'pointer', color:filter===f?'var(--ink)':'var(--mute)',
                fontFamily:'inherit', fontSize:'inherit', letterSpacing:'inherit', textTransform:'inherit'
              }}>{f}</button>
            ))}
          </div>
          <div style={{display:'flex', gap:24, alignItems:'center', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.16em', textTransform:'uppercase', color:'var(--mute)'}}>
            <span>{PRODUCTS.length} pieces</span>
            <span>·</span>
            <button style={{background:'transparent',border:0,fontFamily:'inherit',fontSize:'inherit',letterSpacing:'inherit',textTransform:'inherit',color:'var(--ink)',cursor:'pointer'}}>
              Sort: {sort} ↓
            </button>
          </div>
        </div>
      </section>

      {/* grid */}
      <section className="section tight">
        <div className="container">
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'40px 24px'}}>
            {PRODUCTS.map(p => (
              <div key={p.id} className="product-card" onClick={()=>goto('product')}>
                <Placeholder label={`${p.name} · ${p.variant}`} corner={`№ ${String(p.id).padStart(2,'0')}`} ratio={p.ratio}>
                  {p.tag && <div style={{position:'absolute',top:14,right:14}}><span className={`tag ${p.tag==='Members'?'accent':''}`}>{p.tag}</span></div>}
                </Placeholder>
                <div className="product-row">
                  <div>
                    <div className="product-name">{p.name}</div>
                    <div className="product-meta">{p.variant} · {p.meta}</div>
                  </div>
                  <div className="product-price">${p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* footer cta band */}
      <section style={{padding:'80px 0', borderTop:'1px solid var(--line)'}}>
        <div className="container" style={{textAlign:'center'}}>
          <Eyebrow>End of drop</Eyebrow>
          <h2 style={{fontFamily:'var(--display)',fontSize:48,fontWeight:600,letterSpacing:'-0.025em',lineHeight:1.05,margin:'16px auto 24px',maxWidth:640,textWrap:'balance'}}>
            Members see the next drop two weeks before anyone else.
          </h2>
          <button className="btn ghost" onClick={()=>goto('app')}>Request an invite →</button>
        </div>
      </section>
    </div>
  );
}

window.ShopPage = ShopPage;
