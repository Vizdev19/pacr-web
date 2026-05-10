// Pacr — About / Manifesto page
function AboutPage(){
  const { goto } = React.useContext(PageContext);
  return (
    <div>
      {/* Manifesto hero */}
      <section style={{borderBottom:'1px solid var(--line)', padding:'120px 0 96px'}}>
        <div className="container">
          <Eyebrow>Manifesto · Issued 2026</Eyebrow>
          <h1 style={{fontFamily:'var(--display)',fontSize:108,fontWeight:600,letterSpacing:'-0.045em',lineHeight:.92,margin:'32px 0 0',maxWidth:1200,textWrap:'balance'}}>
            Running is the only sport where the opponent is the version of you from last week.
          </h1>
        </div>
      </section>

      {/* Body essay */}
      <section className="section">
        <div className="container">
          <div style={{display:'grid', gridTemplateColumns:'200px 1fr 200px', gap:32}}>
            <div className="mono" style={{fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>01 / Why Pacr</div>
            <div style={{fontSize:20, lineHeight:1.55, maxWidth:680}}>
              <p style={{marginTop:0}}>Pacr started for one reason: most running gear is designed for billboards. We make ours for the run.</p>
              <p>Every piece is tested by the people who design it, in the conditions our members run in — not in a lab, and not on a model. We weigh fabric in grams. We track it across thirty efforts. We publish what we find.</p>
              <p>The app exists for the same reason. There is more sports science available today than at any time in history, and almost none of it makes it to the average runner. So we built a coach that will. It's invite-only, not because we're precious about it, but because the model improves with focus.</p>
              <p>The rest is craft. Drop by drop. Mile by mile.</p>
            </div>
            <div></div>
          </div>
        </div>
      </section>

      {/* Image break */}
      <section style={{padding:'0 0 96px'}}>
        <div className="container">
          <Placeholder label="Studio · Porto" corner="Field set 02" ratio="21/9"/>
        </div>
      </section>

      {/* Three pillars */}
      <section className="section dark">
        <div className="container">
          <SectionHead dark eyebrow="What we hold to" title="Three pillars. Nothing else." right="2026 / 03"/>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:0, borderTop:'1px solid rgba(244,241,236,0.14)', borderLeft:'1px solid rgba(244,241,236,0.14)'}}>
            {[
              {n:'01', t:'Made to run in.', d:'If a piece fails on a long run, it fails. We don\'t ship gear we wouldn\'t race in. Drops are small on purpose.'},
              {n:'02', t:'Science in the open.', d:'Every plan in the app is rooted in published sport-science. Every fabric ships with its field notes — weight, weather, mileage tested.'},
              {n:'03', t:'A community, not a market.', d:'The app is invite-only. The drops are quiet. The people who wear Pacr earn it on the road, not at checkout.'},
            ].map(p => (
              <div key={p.n} style={{padding:'40px 32px', borderRight:'1px solid rgba(244,241,236,0.14)', borderBottom:'1px solid rgba(244,241,236,0.14)'}}>
                <div className="mono" style={{fontSize:11,letterSpacing:'.18em',color:'rgba(244,241,236,0.55)'}}>{p.n}</div>
                <h3 style={{fontFamily:'var(--display)',fontSize:32,fontWeight:600,letterSpacing:'-0.02em',lineHeight:1.05,margin:'24px 0 14px'}}>{p.t}</h3>
                <p style={{fontSize:15, lineHeight:1.6, color:'rgba(244,241,236,0.78)', margin:0}}>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="section">
        <div className="container">
          <SectionHead eyebrow="By the numbers" title="A small operation, on purpose." right=""/>
          <div className="spec-grid">
            {[
              {k:'Founded',v:'2025 / Porto'},
              {k:'Pieces / drop',v:'12'},
              {k:'Runs / piece',v:'30+'},
              {k:'Avg. fabric weight',v:'92 g'},
              {k:'Members',v:'1,840'},
              {k:'Coaches in app',v:'7'},
              {k:'Plans tuned',v:'5K → marathon'},
              {k:'Returns rate',v:'< 2%'},
            ].map(s => (
              <div key={s.k} className="spec-cell">
                <div className="k">{s.k}</div>
                <div className="v">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{padding:'80px 0 120px'}}>
        <div className="container" style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:32, flexWrap:'wrap'}}>
          <h2 style={{fontFamily:'var(--display)',fontSize:48,fontWeight:600,letterSpacing:'-0.025em',lineHeight:1.05,margin:0,maxWidth:680,textWrap:'balance'}}>
            If this sounds like you, we'd like to meet.
          </h2>
          <div style={{display:'flex', gap:12}}>
            <button className="btn lg" onClick={()=>goto('app')}>Request an invite</button>
            <button className="btn lg ghost" onClick={()=>goto('shop')}>Shop the drop</button>
          </div>
        </div>
      </section>
    </div>
  );
}

window.AboutPage = AboutPage;
