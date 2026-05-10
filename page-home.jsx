// Pacr — Home page
function HomePage(){
  const { goto } = React.useContext(PageContext);
  return (
    <div>
      {/* HERO — gallery, full bleed split */}
      <section style={{borderBottom:'1px solid var(--line)'}}>
        <div className="container" style={{padding:'48px 32px 0'}}>
          <Eyebrow>2026 / Spring · Drop 01 · Issued for members and the public alike</Eyebrow>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1.1fr 1fr', gap:0, marginTop:24, borderTop:'1px solid var(--line)'}}>
          <div style={{padding:'72px 32px 72px 64px', display:'flex', flexDirection:'column', justifyContent:'space-between', minHeight:620, borderRight:'1px solid var(--line)'}}>
            <div>
              <h1 style={{fontFamily:'var(--display)',fontSize:96,fontWeight:600,letterSpacing:'-0.045em',lineHeight:.92,margin:'0 0 32px',textWrap:'balance'}}>
                Train<br/>like a craft.
              </h1>
              <p style={{fontSize:18, lineHeight:1.5, maxWidth:440, color:'rgba(14,14,12,0.7)', margin:0}}>
                Apparel built for runners who measure their work in seasons, not sessions. Made in small drops, tested at race pace.
              </p>
            </div>
            <div style={{display:'flex', gap:12, marginTop:48}}>
              <button className="btn lg" onClick={()=>goto('shop')}>Shop the drop</button>
              <button className="btn lg ghost" onClick={()=>goto('about')}>The manifesto</button>
            </div>
          </div>
          <div>
            <Placeholder label="Hero / Drop 01" corner="01 / Editorial" ratio="auto" style={{aspectRatio:'auto', minHeight:620, height:'100%'}}/>
          </div>
        </div>

        {/* Spec strip */}
        <div className="spec-grid" style={{borderLeft:0, borderTop:0}}>
          <div className="spec-cell"><div className="k">Drop</div><div className="v">No. 01 / Spring 26</div></div>
          <div className="spec-cell"><div className="k">Pieces</div><div className="v">12 silhouettes</div></div>
          <div className="spec-cell"><div className="k">Tested</div><div className="v">21.1 km · marathon</div></div>
          <div className="spec-cell"><div className="k">Made in</div><div className="v">Portugal</div></div>
        </div>
      </section>

      {/* FEATURED — three large cards */}
      <section className="section">
        <div className="container">
          <SectionHead eyebrow="Drop 01 / 02" title="The pieces, in order of how often you'll reach for them." right="Updated 04.26"/>
          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:24}}>
            <div className="product-card" onClick={()=>goto('product')}>
              <Placeholder label="Singlet 01 · Bone" corner="Hero" ratio="4/5"/>
              <div className="product-row">
                <div>
                  <div className="product-name">Field Singlet — Bone</div>
                  <div className="product-meta">Featherweight mesh · 78 g</div>
                </div>
                <div className="product-price">$84</div>
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:24}}>
              <div className="product-card" onClick={()=>goto('product')}>
                <Placeholder label="Half Tight" corner="" ratio="1/1"/>
                <div className="product-row">
                  <div><div className="product-name">Pacework Half Tight</div><div className="product-meta">Compression · pocketed</div></div>
                  <div className="product-price">$112</div>
                </div>
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:24}}>
              <div className="product-card" onClick={()=>goto('product')}>
                <Placeholder label="Long Sleeve" corner="" ratio="1/1"/>
                <div className="product-row">
                  <div><div className="product-name">Threshold LS</div><div className="product-meta">Merino blend · cool-day</div></div>
                  <div className="product-price">$148</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{marginTop:48, display:'flex', justifyContent:'center'}}>
            <button className="btn ghost" onClick={()=>goto('shop')}>View all 12 pieces →</button>
          </div>
        </div>
      </section>

      {/* SCIENCE STRIP — dark */}
      <section className="section dark">
        <div className="container">
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:96, alignItems:'center'}}>
            <div>
              <Eyebrow dark>Field Notes</Eyebrow>
              <h2 style={{fontFamily:'var(--display)',fontSize:56,fontWeight:600,letterSpacing:'-0.025em',lineHeight:1.0,margin:'16px 0 24px'}}>
                The fastest fabric is the one you forget you're wearing.
              </h2>
              <p style={{fontSize:17, lineHeight:1.6, color:'rgba(244,241,236,0.78)', maxWidth:480, margin:0}}>
                Every drop ships with a field report — fabric weight, weave, weather window, and what we tested it at. No marketing science. Real notes from real runs.
              </p>
              <div style={{marginTop:32}}>
                <button className="btn on-dark ghost" onClick={()=>goto('about')}>Read the journal →</button>
              </div>
            </div>
            <div>
              <Placeholder dark label="Field test · 21.1 km" corner="Photo set" ratio="4/5"/>
            </div>
          </div>
        </div>
      </section>

      {/* THE APP — subtle */}
      <section className="section">
        <div className="container">
          <div style={{border:'1px solid var(--line)', padding:'64px', display:'grid', gridTemplateColumns:'1fr auto', gap:48, alignItems:'center'}}>
            <div>
              <Eyebrow>Members · Invite-only</Eyebrow>
              <h3 style={{fontFamily:'var(--display)',fontSize:40,fontWeight:600,letterSpacing:'-0.025em',lineHeight:1.05,margin:'12px 0 16px',maxWidth:640}}>
                A coach in your pocket. Trained on sports science, tuned to your body.
              </h3>
              <p style={{fontSize:15, lineHeight:1.6, color:'var(--mute)', maxWidth:560, margin:0}}>
                Pacr the app is invite-only. Personalized, science-based plans for 5K through marathon. Members get first access to drops.
              </p>
            </div>
            <button className="btn ghost" onClick={()=>goto('app')}>Request an invite →</button>
          </div>
        </div>
      </section>
    </div>
  );
}

window.HomePage = HomePage;
