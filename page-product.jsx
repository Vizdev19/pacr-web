// Pacr — Product detail (PDP)
function ProductPage(){
  const { goto } = React.useContext(PageContext);
  const [size, setSize] = React.useState('M');
  const [color, setColor] = React.useState('Bone');
  const sizes = ['XS','S','M','L','XL'];
  const colors = [{n:'Bone',h:'#F4F1EC'},{n:'Ink',h:'#0E0E0C'},{n:'Track',h:'oklch(0.55 0.15 25)'}];

  return (
    <div>
      <div className="container" style={{padding:'24px 32px 0'}}>
        <div className="mono" style={{fontSize:11, letterSpacing:'.16em', textTransform:'uppercase', color:'var(--mute)'}}>
          <span style={{cursor:'pointer'}} onClick={()=>goto('shop')}>Shop</span>
          <span style={{margin:'0 10px'}}>/</span>
          <span style={{cursor:'pointer'}} onClick={()=>goto('shop')}>Tops</span>
          <span style={{margin:'0 10px'}}>/</span>
          <span style={{color:'var(--ink)'}}>Field Singlet</span>
        </div>
      </div>

      <section style={{padding:'32px 0 0'}}>
        <div className="container">
          <div style={{display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:64, alignItems:'flex-start'}}>
            {/* Gallery */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, position:'sticky', top:80}}>
              <Placeholder label="Field Singlet · Bone" corner="01 / 04" ratio="4/5" style={{gridColumn:'1 / 3'}}/>
              <Placeholder label="Detail · weave" corner="02"/>
              <Placeholder label="On body" corner="03"/>
              <Placeholder label="Back" corner="04" style={{gridColumn:'1 / 3', aspectRatio:'4/3'}}/>
            </div>

            {/* Info */}
            <div style={{paddingTop:8}}>
              <Eyebrow>Drop 01 · 001 / 12</Eyebrow>
              <h1 style={{fontFamily:'var(--display)',fontSize:48,fontWeight:600,letterSpacing:'-0.03em',lineHeight:1.0,margin:'12px 0 12px'}}>Field Singlet</h1>
              <div className="product-meta" style={{fontSize:14, marginBottom:24}}>Featherweight mesh · 78 g · Made in Portugal</div>
              <div className="mono" style={{fontSize:18, fontWeight:500, marginBottom:32}}>$84.00 USD</div>

              <p style={{fontSize:15, lineHeight:1.65, color:'rgba(14,14,12,0.78)', margin:'0 0 32px', maxWidth:520}}>
                A near-weightless racing singlet cut from a perforated micro-mesh that disappears in motion. Tested across thirty 21.1km efforts in heat and humidity — no chafe, no cling, no compromise.
              </p>

              {/* color */}
              <div style={{marginBottom:28}}>
                <div className="mono" style={{fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)',marginBottom:12}}>Color · {color}</div>
                <div style={{display:'flex', gap:8}}>
                  {colors.map(c => (
                    <button key={c.n} onClick={()=>setColor(c.n)} style={{
                      width:36, height:36, padding:0, cursor:'pointer',
                      background:c.h, border:'1px solid '+(color===c.n?'var(--ink)':'var(--line)'),
                      outline: color===c.n?'1px solid var(--ink)':'none', outlineOffset:2
                    }} title={c.n}/>
                  ))}
                </div>
              </div>

              {/* size */}
              <div style={{marginBottom:28}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                  <div className="mono" style={{fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>Size · {size}</div>
                  <a href="#" className="mono" style={{fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)',borderBottom:'1px solid var(--mute)',paddingBottom:1}}>Size guide</a>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6}}>
                  {sizes.map(s => (
                    <button key={s} onClick={()=>setSize(s)} style={{
                      padding:'14px 0', cursor:'pointer',
                      background: size===s?'var(--ink)':'transparent',
                      color: size===s?'var(--bone)':'var(--ink)',
                      border:'1px solid '+(size===s?'var(--ink)':'var(--line)'),
                      fontFamily:'var(--mono)', fontSize:12, letterSpacing:'.06em'
                    }}>{s}</button>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button className="btn lg full" onClick={()=>goto('cart')}>Add to bag — ${`84.00`}</button>
              <div className="mono" style={{fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)',marginTop:14,textAlign:'center'}}>Free shipping over $150 · Members ship free</div>

              {/* spec block */}
              <div style={{marginTop:48, borderTop:'1px solid var(--line)'}}>
                {[
                  {k:'Fabric', v:'88% recycled polyester · 12% elastane'},
                  {k:'Weight', v:'78 g (size M)'},
                  {k:'Weather', v:'18–32°C · low to moderate humidity'},
                  {k:'Tested at', v:'Threshold pace · 21.1 km · 30+ runs'},
                  {k:'Origin', v:'Made in Porto, Portugal'},
                ].map(r => (
                  <div key={r.k} style={{display:'grid',gridTemplateColumns:'140px 1fr',padding:'18px 0',borderBottom:'1px solid var(--line-2)'}}>
                    <div className="mono" style={{fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>{r.k}</div>
                    <div style={{fontSize:14, lineHeight:1.5}}>{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Field notes */}
      <section className="section">
        <div className="container">
          <SectionHead eyebrow="Field notes" title="What we tested it at." right="04 entries"/>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24}}>
            {[
              {pace:"3'42\"/km", env:'29°C · 78% humid', km:'10.0', who:'Coach M.'},
              {pace:"4'10\"/km", env:'24°C · clear', km:'21.1', who:'Athlete K.'},
              {pace:"5'05\"/km", env:'31°C · sun', km:'15.4', who:'Coach R.'},
              {pace:"3'58\"/km", env:'19°C · light rain', km:'12.0', who:'Athlete S.'},
            ].map((n,i) => (
              <div key={i} style={{border:'1px solid var(--line)', padding:24}}>
                <div className="mono" style={{fontSize:10,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginBottom:24}}>Run · 0{i+1}</div>
                <div style={{fontFamily:'var(--display)',fontSize:36,fontWeight:600,letterSpacing:'-0.02em',lineHeight:1}}>{n.pace}</div>
                <div className="mono" style={{fontSize:12,marginTop:8,color:'var(--mute)'}}>{n.km} km · {n.env}</div>
                <div style={{marginTop:32,fontSize:13,color:'var(--mute)',fontStyle:'italic'}}>"No cling, no chafe."</div>
                <div className="mono" style={{fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)',marginTop:14}}>— {n.who}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pair with */}
      <section className="section tight" style={{borderTop:'1px solid var(--line)'}}>
        <div className="container">
          <SectionHead eyebrow="Pair with" title="Made to run together." right=""/>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24}}>
            {['Mileage Short','Pacework Half Tight','Race Cap','Threshold LS'].map((n,i) => (
              <div key={n} className="product-card" onClick={()=>goto('product')}>
                <Placeholder label={n} corner={`№ 0${i+2}`} ratio="4/5"/>
                <div className="product-row">
                  <div><div className="product-name">{n}</div><div className="product-meta">Bone</div></div>
                  <div className="product-price">$96</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

window.ProductPage = ProductPage;
