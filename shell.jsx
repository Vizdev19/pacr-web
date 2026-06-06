// Pacr — shared shell components (nav, footer, placeholders, wordmark)
// Exposed on window for use across pages.

const PageContext = React.createContext({page:'home', goto:()=>{}});

function Wordmark({size='md', white=false}){
  return (
    <span className={`wm ${size}`} style={white?{color:'var(--bone)'}:{}}>pacr</span>
  );
}

function Nav({page, goto}){
  const links = [
    {id:'shop', label:'Shop'},
    {id:'collection', label:'Collection'},
    {id:'about', label:'Manifesto'},
    {id:'app', label:'App'},
  ];
  return (
    <header className="nav">
      <div className="nav-inner">
        <div className="nav-left">
          {links.slice(0,2).map(l => (
            <a key={l.id} href={`#${l.id}`} className={page===l.id?'active':''} onClick={(e)=>{e.preventDefault();goto(l.id)}}>{l.label}</a>
          ))}
          {links.slice(2).map(l => (
            <a key={l.id} href={`#${l.id}`} className={page===l.id?'active':''} onClick={(e)=>{e.preventDefault();goto(l.id)}}>{l.label}</a>
          ))}
        </div>
        <div className="nav-center">
          <a href="#home" onClick={(e)=>{e.preventDefault();goto('home')}}><Wordmark size="md"/></a>
        </div>
        <div className="nav-right">
          <a href="#search">Search</a>
          <a href="#account">Account</a>
          <a href="#cart" className={page==='cart'?'active':''} onClick={(e)=>{e.preventDefault();goto('cart')}}>
            <span className="cart-pill"><span className="dot"></span>Cart · 2</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function Footer({goto}){
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Wordmark size="lg" white/>
            <div style={{marginTop:24, maxWidth:360, fontSize:14, lineHeight:1.6, color:'rgba(244,241,236,0.78)'}}>
              An apparel brand and an invite-only running app for athletes who train with intent.
            </div>
            <div style={{marginTop:32, display:'flex', gap:8, alignItems:'stretch', maxWidth:360}}>
              <input placeholder="Email address" style={{flex:1, background:'transparent', border:'1px solid rgba(244,241,236,0.24)', color:'var(--bone)', padding:'12px 14px', fontFamily:'var(--display)', fontSize:14, outline:'none'}}/>
              <button className="btn on-dark" style={{padding:'12px 18px'}}>Join →</button>
            </div>
          </div>
          <div>
            <h4>Shop</h4>
            <ul>
              <li><a href="#" onClick={(e)=>{e.preventDefault();goto('shop')}}>All apparel</a></li>
              <li><a href="#" onClick={(e)=>{e.preventDefault();goto('shop')}}>Tops</a></li>
              <li><a href="#" onClick={(e)=>{e.preventDefault();goto('shop')}}>Shorts</a></li>
              <li><a href="#" onClick={(e)=>{e.preventDefault();goto('shop')}}>Tights</a></li>
              <li><a href="#" onClick={(e)=>{e.preventDefault();goto('shop')}}>Singlets</a></li>
            </ul>
          </div>
          <div>
            <h4>Pacr</h4>
            <ul>
              <li><a href="#" onClick={(e)=>{e.preventDefault();goto('about')}}>Manifesto</a></li>
              <li><a href="#" onClick={(e)=>{e.preventDefault();goto('app')}}>The app</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Coaches</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Journal</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Stockists</a></li>
            </ul>
          </div>
          <div>
            <h4>Care</h4>
            <ul>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Sizing</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Returns</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Shipping</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Contact</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Press</a></li>
            </ul>
          </div>
          <div>
            <h4>Privacy</h4>
            <ul>
              <li><a href="/privacy">Privacy policy</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Terms of service</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Cookie preferences</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Data requests</a></li>
              <li><a href="#" onClick={(e)=>e.preventDefault()}>Accessibility</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div>© 2026 Pacr · Train like a craft</div>
          <div style={{display:'flex',gap:24,alignItems:'center'}}>
            <a href="#" onClick={(e)=>{e.preventDefault();goto('app')}} className="invite-link">Request an invite</a>
            <span>EN · USD</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Placeholder({label, corner, ratio='1/1', dark=false, children, style={}}){
  return (
    <div className={`ph ${dark?'dark':''}`} style={{aspectRatio:ratio, ...style}}>
      {label && <div className="ph-label">{label}</div>}
      {corner && <div className="ph-corner">{corner}</div>}
      {children}
    </div>
  );
}

function Eyebrow({children, dark=false, style={}}){
  return <div className={`eyebrow ${dark?'on-dark':''}`} style={style}>{children}</div>;
}

function SectionHead({eyebrow, title, right, dark=false}){
  return (
    <div className="section-head">
      <div className="meta-l"><Eyebrow dark={dark}>{eyebrow}</Eyebrow></div>
      <h2>{title}</h2>
      <div className="meta-r"><Eyebrow dark={dark}>{right}</Eyebrow></div>
    </div>
  );
}

Object.assign(window, { Wordmark, Nav, Footer, Placeholder, Eyebrow, SectionHead, PageContext });
