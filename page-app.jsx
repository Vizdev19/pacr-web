// Pacr — App / Membership page
function AppPage(){
  const { goto } = React.useContext(PageContext);
  const [submitted, setSubmitted] = React.useState(false);
  return (
    <div>
      {/* Hero — invite */}
      <section style={{borderBottom:'1px solid var(--line)'}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, alignItems:'stretch'}}>
          <div style={{padding:'120px 64px', display:'flex', flexDirection:'column', justifyContent:'space-between', minHeight:680, borderRight:'1px solid var(--line)'}}>
            <div>
              <Eyebrow>Pacr · The app · Invite-only</Eyebrow>
              <h1 style={{fontFamily:'var(--display)',fontSize:80,fontWeight:600,letterSpacing:'-0.04em',lineHeight:.95,margin:'24px 0 24px',textWrap:'balance'}}>
                A coach that runs with you.
              </h1>
              <p style={{fontSize:18, lineHeight:1.55, maxWidth:480, color:'rgba(14,14,12,0.7)', margin:0}}>
                Pacr is a personal running coach trained on decades of sport science and tuned to you. Plans for 5K through marathon. Built for committed runners.
              </p>
            </div>
            <div style={{display:'flex', gap:20, marginTop:48, fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.16em', textTransform:'uppercase', color:'var(--mute)'}}>
              <div><span style={{color:'var(--accent)'}}>●</span> 1,840 members</div>
              <div>1,200+ on the waitlist</div>
            </div>
          </div>
          <div style={{padding:'80px 64px', background:'var(--ink)', color:'var(--bone)', display:'flex', flexDirection:'column', justifyContent:'center', minHeight:680}}>
            {submitted ? (
              <div>
                <Eyebrow dark>Received · 0042</Eyebrow>
                <h2 style={{fontFamily:'var(--display)',fontSize:44,fontWeight:600,letterSpacing:'-0.025em',lineHeight:1.05,margin:'16px 0 16px'}}>You're on the list.</h2>
                <p style={{fontSize:16, lineHeight:1.6, color:'rgba(244,241,236,0.78)', maxWidth:420, margin:0}}>We review applications in waves. Expect to hear back within 14 days. In the meantime — keep running.</p>
              </div>
            ) : (
              <div style={{maxWidth:440}}>
                <Eyebrow dark>Request an invite</Eyebrow>
                <h2 style={{fontFamily:'var(--display)',fontSize:36,fontWeight:600,letterSpacing:'-0.02em',lineHeight:1.1,margin:'14px 0 32px'}}>Tell us about your running.</h2>
                <form onSubmit={(e)=>{e.preventDefault();setSubmitted(true)}} style={{display:'flex',flexDirection:'column',gap:18}}>
                  {[
                    {k:'Name',type:'text',ph:'Your name'},
                    {k:'Email',type:'email',ph:'you@email.com'},
                    {k:'Current weekly mileage',type:'text',ph:'e.g. 35 km / week'},
                    {k:'Next race / goal',type:'text',ph:'e.g. Sub-3 marathon, autumn 26'},
                  ].map(f => (
                    <div key={f.k}>
                      <label className="mono" style={{display:'block',fontSize:10,letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)',marginBottom:6}}>{f.k}</label>
                      <input type={f.type} placeholder={f.ph} style={{width:'100%',padding:'12px 0',background:'transparent',border:0,borderBottom:'1px solid rgba(244,241,236,0.24)',color:'var(--bone)',fontFamily:'var(--display)',fontSize:15,outline:'none'}}/>
                    </div>
                  ))}
                  <button type="submit" className="btn on-dark lg" style={{marginTop:16}}>Submit request →</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="section">
        <div className="container">
          <SectionHead eyebrow="What members get" title="Less guesswork. More signal." right="04 features"/>
          <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:24}}>
            {[
              {n:'01', t:'A coach, not a tracker.', d:'Adaptive plans built around your fitness, schedule, and goal race. Updated each week from your actual training, not a generic template.'},
              {n:'02', t:'Sport-science transparency.', d:'Every workout shows the why — VO2, threshold, base. No black boxes. Read the citations, see the model.'},
              {n:'03', t:'A small community of runners.', d:'Vetted, focused, and quiet. Group challenges, members-only meetups, and a feed without the noise.'},
              {n:'04', t:'First access to drops.', d:'Members see new apparel two weeks early, ship free always, and get exclusive numbered pieces.'},
            ].map(f => (
              <div key={f.n} style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:16,padding:'32px 0',borderTop:'1px solid var(--line)'}}>
                <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',paddingTop:6}}>{f.n}</div>
                <div>
                  <h3 style={{fontFamily:'var(--display)',fontSize:26,fontWeight:600,letterSpacing:'-0.02em',lineHeight:1.1,margin:'0 0 12px'}}>{f.t}</h3>
                  <p style={{fontSize:15, lineHeight:1.55, color:'rgba(14,14,12,0.7)', margin:0, maxWidth:480}}>{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App preview */}
      <section className="section" style={{background:'var(--paper)'}}>
        <div className="container">
          <SectionHead eyebrow="In the app" title="Built around the run, not the screen." right=""/>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24}}>
            {[
              {l:'Today',v:"Tempo · 8 km",s:"4'25\"/km"},
              {l:'Week',v:'52 / 60 km',s:'Build phase · wk 4'},
              {l:'Goal',v:'Sub-3 marathon',s:'Berlin · 09.27.26'},
            ].map((c,i) => (
              <div key={i} style={{aspectRatio:'9/16', background:'var(--ink)', color:'var(--bone)', padding:32, display:'flex', flexDirection:'column', justifyContent:'space-between', position:'relative', borderRadius:24}}>
                <div>
                  <Eyebrow dark>{c.l}</Eyebrow>
                </div>
                <div>
                  <div style={{fontFamily:'var(--display)',fontSize:48,fontWeight:600,letterSpacing:'-0.025em',lineHeight:1}}>{c.v}</div>
                  <div className="mono" style={{fontSize:13, marginTop:10, color:'rgba(244,241,236,0.65)'}}>{c.s}</div>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
                  <Wordmark size="sm" white/>
                  <div className="mono" style={{fontSize:10,letterSpacing:'.18em',color:'rgba(244,241,236,0.5)'}}>0{i+1}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="container">
          <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:64}}>
            <div>
              <Eyebrow>FAQ</Eyebrow>
              <h2 style={{fontFamily:'var(--display)',fontSize:44,fontWeight:600,letterSpacing:'-0.025em',lineHeight:1.05,margin:'16px 0 0'}}>Common questions.</h2>
            </div>
            <div>
              {[
                {q:'How does the invite work?', a:'Submit an application. We review in waves and respond within 14 days. Existing members can also extend invites to one runner per quarter.'},
                {q:'How much does the app cost?', a:'$18 / month or $168 / year for members. Cancel anytime. Apparel is sold separately.'},
                {q:'Do I need a watch?', a:'Most members run with a GPS watch (Garmin, Coros, Apple Watch). The app works without one, but signal quality is better with continuous data.'},
                {q:'What if I don\'t race?', a:'Most of our members don\'t. Plans support general fitness, weight loss, and consistency goals — not just race-day targets.'},
              ].map((f,i) => (
                <details key={i} style={{borderTop:'1px solid var(--line)', padding:'24px 0', cursor:'pointer'}}>
                  <summary style={{listStyle:'none',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:18,fontWeight:500,letterSpacing:'-0.01em'}}>
                    <span>{f.q}</span><span className="mono" style={{fontSize:18,color:'var(--mute)'}}>+</span>
                  </summary>
                  <p style={{margin:'16px 0 0', maxWidth:560, fontSize:15, lineHeight:1.6, color:'var(--mute)'}}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

window.AppPage = AppPage;
