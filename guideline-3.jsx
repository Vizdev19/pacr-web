// Pacr Brand Guidelines — Part 3 (08–11: Stationery, App UI, Apparel/Packaging, Social, Sign-off)

function GLStationery(){
  return (
    <GLSection id="sec-08" n="08" label="Stationery" title="The brand at hand." kicker="Cards, letterhead, and signatures are the smallest surfaces the brand lives on. Tight grids, mono labels, ink on bone.">
      {/* Business cards */}
      <div style={{border:'1px solid var(--line)', marginBottom:32}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)'}}>
          <span>08.1 · Business card</span>
          <span>85 × 55 mm · Mohawk Loop antique · 1 PMS spot</span>
        </div>
        <div style={{padding:64, background:'#e8e5e0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, justifyItems:'center'}}>
          {/* Front */}
          <div style={{width:340, height:220, background:'var(--bone)', boxShadow:'0 14px 40px -20px rgba(0,0,0,.35)', padding:'18px 22px', display:'flex', flexDirection:'column', justifyContent:'space-between', position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <Wordmark size={32}/>
              <div className="mono" style={{fontSize:8,letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mute)',textAlign:'right'}}>Pacr · 2026<br/>Porto · PT</div>
            </div>
            <div>
              <div style={{fontSize:18, fontWeight:600, letterSpacing:'-0.01em'}}>Marina Costa</div>
              <div className="mono" style={{fontSize:9,letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mute)',marginTop:4}}>Head Coach · Performance</div>
              <div style={{height:1, background:'var(--line)', margin:'14px 0'}}></div>
              <div className="mono" style={{fontSize:10, lineHeight:1.6, color:'var(--ink)'}}>
                marina@pacr.life<br/>
                +351 22 000 0000<br/>
                pacr.life
              </div>
            </div>
          </div>
          {/* Back */}
          <div style={{width:340, height:220, background:'var(--ink)', color:'var(--bone)', boxShadow:'0 14px 40px -20px rgba(0,0,0,.35)', padding:'18px 22px', display:'flex', flexDirection:'column', justifyContent:'space-between', position:'relative'}}>
            <div className="mono" style={{fontSize:8,letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)',display:'flex',justifyContent:'space-between'}}>
              <span>STRIDE · 02</span><span>BACK</span>
            </div>
            <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center'}}>
              <Wordmark size={88} white/>
            </div>
            <div className="mono" style={{fontSize:8,letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)',display:'flex',justifyContent:'space-between'}}>
              <span>Train like a craft.</span><span>·002</span>
            </div>
          </div>
        </div>
      </div>

      {/* Letterhead */}
      <div style={{border:'1px solid var(--line)', marginBottom:32}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)'}}>
          <span>08.2 · Letterhead</span>
          <span>A4 · 24 mm margins · 11pt body</span>
        </div>
        <div style={{padding:64, background:'#e8e5e0', display:'flex', justifyContent:'center'}}>
          <div style={{width:520, aspectRatio:'1/1.414', background:'var(--bone)', padding:48, boxShadow:'0 18px 50px -22px rgba(0,0,0,.35)', display:'flex', flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',paddingBottom:24,borderBottom:'1px solid var(--line)'}}>
              <Wordmark size={36}/>
              <div className="mono" style={{fontSize:8,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',textAlign:'right',lineHeight:1.6}}>
                Pacr Lda<br/>Rua das Flores 89<br/>4050-262 Porto · PT
              </div>
            </div>
            <div style={{paddingTop:24, fontSize:10, lineHeight:1.55, color:'var(--ink)', flex:1}}>
              <div className="mono" style={{fontSize:8,letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mute)',marginBottom:12}}>04.26.2026 · Re: Drop 02 review</div>
              <p style={{margin:'0 0 10px'}}>Dear Marina,</p>
              <p style={{margin:'0 0 10px'}}>Thank you for the detailed notes on the Threshold LS prototype. We've folded your weave revisions into the next sample run.</p>
              <p style={{margin:'0 0 10px'}}>Field testing for Drop 02 begins Monday at the Foz course. We'll meet at 06:30, 8 km easy followed by 4 × 1 km at threshold.</p>
              <p style={{margin:0}}>Until then — quietly fast.</p>
            </div>
            <div style={{paddingTop:24, borderTop:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)',fontSize:8,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)'}}>
              <span>pacr.life</span><span>brand@pacr.life</span><span>01 / 01</span>
            </div>
          </div>
        </div>
      </div>

      {/* Email signature */}
      <div style={{border:'1px solid var(--line)'}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)'}}>
          <span>08.3 · Email signature</span>
          <span>Plain HTML · system fallback OK</span>
        </div>
        <div style={{padding:48, background:'#f5f3ee'}}>
          <div style={{maxWidth:480, padding:'20px 24px', background:'var(--bone)', borderLeft:'2px solid oklch(0.55 0.15 25)', fontFamily:"'Inter Tight',sans-serif"}}>
            <div style={{fontSize:14, fontWeight:600, letterSpacing:'-0.01em'}}>Marina Costa</div>
            <div style={{fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)',marginTop:2}}>Head Coach · Performance</div>
            <div style={{height:1, background:'var(--line)', margin:'12px 0'}}></div>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <Wordmark size={22}/>
              <div style={{fontFamily:'var(--mono)',fontSize:11, color:'var(--ink)'}}>
                marina@pacr.life · +351 22 000 0000 · <span style={{borderBottom:'1px solid var(--line)'}}>pacr.life</span>
              </div>
            </div>
            <div style={{fontFamily:'var(--mono)',fontSize:9,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)',marginTop:14}}>Train like a craft.</div>
          </div>
        </div>
      </div>
    </GLSection>
  );
}

function GLAppUI(){
  return (
    <GLSection id="sec-09" n="09" label="App UI" title="The brand on a phone." kicker="In-product, the brand is calm. Big numbers, mono captions, ink on bone. Track red is reserved for live actions and primary CTAs.">
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:32, marginBottom:48}}>
        {/* Today screen */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="mono" style={{fontSize:10,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)'}}>09.1 · Today</div>
          <div style={{aspectRatio:'9/19.5', background:'var(--bone)', borderRadius:36, padding:'56px 24px 32px', border:'1px solid var(--line)', display:'flex', flexDirection:'column', gap:18, fontFamily:"'Inter Tight',sans-serif", overflow:'hidden'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--mono)',fontSize:9,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>
              <Wordmark size={16}/><span>Wed · 04.26</span>
            </div>
            <div className="mono" style={{fontSize:9,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginTop:8}}>Today · Tempo</div>
            <div style={{fontFamily:'var(--display)',fontSize:48,fontWeight:600,letterSpacing:'-0.025em',lineHeight:.95}}>8 km<br/>tempo</div>
            <div className="mono" style={{fontSize:11, color:'var(--mute)'}}>Target 4'25"/km · 35 min</div>
            <div style={{flex:1, marginTop:8, padding:14, background:'var(--paper)', border:'1px solid var(--line)'}}>
              <div className="mono" style={{fontSize:9,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)'}}>Why this run</div>
              <div style={{fontSize:11, lineHeight:1.5, marginTop:6}}>Threshold work. Lifts your lactate ceiling without dipping into VO2.</div>
            </div>
            <button style={{padding:'14px 0', background:'oklch(0.55 0.15 25)', color:'var(--bone)', border:0, fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.2em', textTransform:'uppercase', borderRadius:0}}>Start run →</button>
          </div>
        </div>

        {/* Active run */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="mono" style={{fontSize:10,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)'}}>09.2 · Active run</div>
          <div style={{aspectRatio:'9/19.5', background:'var(--ink)', color:'var(--bone)', borderRadius:36, padding:'56px 24px 32px', display:'flex', flexDirection:'column', gap:18, fontFamily:"'Inter Tight',sans-serif", overflow:'hidden', position:'relative'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--mono)',fontSize:9,letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)'}}>
              <span><span style={{color:'oklch(0.55 0.15 25)'}}>●</span> LIVE</span><span>00:14:32</span>
            </div>
            <div style={{flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap:8}}>
              <div className="mono" style={{fontSize:9,letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)'}}>Pace</div>
              <div className="mono" style={{fontSize:72, fontWeight:500, letterSpacing:'-0.02em', lineHeight:1}}>4'21"</div>
              <div className="mono" style={{fontSize:11, color:'rgba(244,241,236,0.5)'}}>+04 vs target</div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:0, borderTop:'1px solid rgba(244,241,236,0.14)', paddingTop:16}}>
              {[['Dist','3.42 km'],['HR','164'],['Cad','182']].map(([k,v]) => (
                <div key={k}>
                  <div className="mono" style={{fontSize:8,letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)'}}>{k}</div>
                  <div style={{fontFamily:'var(--display)',fontSize:18,fontWeight:600,marginTop:4}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plan */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="mono" style={{fontSize:10,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)'}}>09.3 · Plan</div>
          <div style={{aspectRatio:'9/19.5', background:'var(--bone)', borderRadius:36, padding:'56px 24px 32px', border:'1px solid var(--line)', display:'flex', flexDirection:'column', gap:14, fontFamily:"'Inter Tight',sans-serif", overflow:'hidden'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--mono)',fontSize:9,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>
              <span>Plan · Sub-3</span><span>Wk 4 / 16</span>
            </div>
            <div style={{fontFamily:'var(--display)',fontSize:24,fontWeight:600,letterSpacing:'-0.02em',lineHeight:1.05,marginTop:4}}>Berlin Marathon<br/>09.27.2026</div>
            <div style={{height:6, background:'var(--line-2)', position:'relative', marginTop:12}}>
              <div style={{position:'absolute',inset:0,width:'25%',background:'oklch(0.55 0.15 25)'}}></div>
            </div>
            <div className="mono" style={{fontSize:9, color:'var(--mute)'}}>52 / 60 km this week</div>
            <div style={{flex:1, marginTop:6, display:'flex', flexDirection:'column', gap:1, background:'var(--line)', border:'1px solid var(--line)'}}>
              {[
                ['MON','Easy 6 km','done'],
                ['TUE','Tempo 8 km','done'],
                ['WED','Rest','done'],
                ['THU','Intervals 6×800','today'],
                ['FRI','Easy 5 km','up'],
                ['SAT','Long 21 km','up'],
                ['SUN','Rest','up'],
              ].map(([d,r,s]) => (
                <div key={d} style={{display:'flex', justifyContent:'space-between', padding:'8px 10px', background:'var(--bone)', alignItems:'center'}}>
                  <div className="mono" style={{fontSize:9,letterSpacing:'.16em',color:s==='today'?'oklch(0.55 0.15 25)':'var(--mute)'}}>{d}</div>
                  <div style={{fontSize:11, fontWeight:s==='today'?600:400}}>{r}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--mute)'}}>{s==='done'?'✓':s==='today'?'●':'·'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* UI tokens */}
      <div style={{border:'1px solid var(--line)'}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)'}}>09.4 · UI tokens</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)'}}>
          {[
            {k:'Radius', v:'0 · 4 · 36', d:'Sharp by default. 36 for cards.'},
            {k:'Spacing', v:'4 · 8 · 16 · 24 · 48', d:'Five-step scale.'},
            {k:'Touch target', v:'44 px min', d:'Always.'},
            {k:'Live action', v:'Track red', d:'Only color cue for "happening now".'},
          ].map((t,i) => (
            <div key={t.k} style={{padding:24, borderRight:i<3?'1px solid var(--line)':'none', borderTop:i>3?'1px solid var(--line)':'none'}}>
              <div className="mono" style={{fontSize:10,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginBottom:12}}>{t.k}</div>
              <div style={{fontFamily:'var(--display)', fontSize:22, fontWeight:600, letterSpacing:'-0.015em'}}>{t.v}</div>
              <div style={{fontSize:13, color:'var(--mute)', marginTop:6}}>{t.d}</div>
            </div>
          ))}
        </div>
      </div>
    </GLSection>
  );
}

function GLApparel(){
  return (
    <GLSection id="sec-10" n="10" label="Apparel & packaging" title="Marks at body, marks at unboxing." kicker="The wordmark sits low and quiet on garments — never billboard-sized. Hangtags carry the field report. Shipping looks like documentation, not retail.">
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24, marginBottom:48}}>
        {/* Singlet */}
        <div style={{border:'1px solid var(--line)'}}>
          <div className="mono" style={{padding:'12px 16px', fontSize:10, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)', borderBottom:'1px solid var(--line)'}}>10.1 · Garment placement</div>
          <div style={{aspectRatio:'4/5', background:'var(--paper)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative'}}>
            <svg viewBox="0 0 300 400" width="80%">
              <path d="M 60 60 L 110 40 Q 150 65 190 40 L 240 60 L 220 130 L 230 380 L 70 380 L 80 130 Z" fill="rgba(14,14,12,0.04)" stroke="rgba(14,14,12,0.2)"/>
            </svg>
            <div style={{position:'absolute', bottom:'30%', left:'50%', transform:'translateX(-50%)'}}>
              <Wordmark size={22}/>
            </div>
          </div>
        </div>
        {/* Hangtag */}
        <div style={{border:'1px solid var(--line)'}}>
          <div className="mono" style={{padding:'12px 16px', fontSize:10, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)', borderBottom:'1px solid var(--line)'}}>10.2 · Hangtag · field report</div>
          <div style={{aspectRatio:'4/5', background:'#e8e5e0', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
            <div style={{width:140, aspectRatio:'1/1.6', background:'var(--bone)', padding:'16px 14px', display:'flex', flexDirection:'column', gap:10, boxShadow:'0 14px 30px -16px rgba(0,0,0,.4)', position:'relative'}}>
              <div style={{position:'absolute',top:8,left:'50%',transform:'translateX(-50%)',width:8,height:8,borderRadius:'50%',background:'#e8e5e0',border:'1px solid var(--line)'}}></div>
              <Wordmark size={22}/>
              <div className="mono" style={{fontSize:7,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)'}}>Field Singlet · Bone · M</div>
              <div style={{height:1,background:'var(--line)'}}></div>
              <div className="mono" style={{fontSize:7, lineHeight:1.6, color:'var(--ink)'}}>
                WGT 78g<br/>FAB 88/12<br/>TST 21K<br/>MD PT<br/>№ 0042
              </div>
              <div style={{flex:1}}></div>
              <div className="mono" style={{fontSize:6,letterSpacing:'.2em',textTransform:'uppercase',color:'oklch(0.55 0.15 25)',textAlign:'center'}}>Train like a craft</div>
            </div>
          </div>
        </div>
        {/* Box */}
        <div style={{border:'1px solid var(--line)'}}>
          <div className="mono" style={{padding:'12px 16px', fontSize:10, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)', borderBottom:'1px solid var(--line)'}}>10.3 · Shipping box</div>
          <div style={{aspectRatio:'4/5', background:'#dad6cd', display:'flex', alignItems:'center', justifyContent:'center', padding:24}}>
            <div style={{width:'90%', aspectRatio:'1/0.7', background:'#c9bca6', padding:18, display:'flex', flexDirection:'column', justifyContent:'space-between', boxShadow:'0 18px 36px -18px rgba(0,0,0,.45)', border:'1px solid rgba(0,0,0,0.08)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <Wordmark size={18}/>
                <div className="mono" style={{fontSize:7,letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,12,0.55)',textAlign:'right'}}>Drop 01<br/>·042 / 600</div>
              </div>
              <div className="mono" style={{fontSize:7,letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(14,14,12,0.55)'}}>FRAGILE · ONE WAY UP · MADE IN PT</div>
            </div>
          </div>
        </div>
      </div>

      {/* Woven label */}
      <div style={{border:'1px solid var(--line)'}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)'}}>10.4 · Woven neck label & care print</div>
        <div style={{padding:48, background:'var(--paper)', display:'flex', gap:40, justifyContent:'center', alignItems:'center'}}>
          <div style={{width:120, padding:'14px 10px', background:'var(--bone)', border:'1px solid var(--line)', textAlign:'center', display:'flex', flexDirection:'column', gap:6}}>
            <Wordmark size={20}/>
            <div className="mono" style={{fontSize:7,letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mute)'}}>Made · Porto</div>
          </div>
          <div style={{width:160, padding:14, background:'var(--bone)', border:'1px solid var(--line)', display:'flex', flexDirection:'column', gap:8}}>
            <div className="mono" style={{fontSize:7,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)'}}>Care</div>
            <div className="mono" style={{fontSize:8, lineHeight:1.6}}>WASH 30°<br/>NO BLEACH<br/>NO IRON<br/>HANG DRY</div>
            <div className="mono" style={{fontSize:7,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginTop:8}}>88% PES · 12% EA</div>
          </div>
        </div>
      </div>
    </GLSection>
  );
}

function GLSocial(){
  return (
    <GLSection id="sec-11" n="11" label="Social & web" title="The brand at thumbnail size." kicker="Social posts behave like field notes — small marks, mono captions, lots of negative space. Avatars use the monogram on bone. Banners stay quiet.">
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24, marginBottom:32}}>
        {/* Avatar */}
        <div style={{border:'1px solid var(--line)'}}>
          <div className="mono" style={{padding:'12px 16px', fontSize:10, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)', borderBottom:'1px solid var(--line)'}}>11.1 · Profile avatar</div>
          <div style={{padding:48, background:'var(--paper)', display:'flex', justifyContent:'center'}}>
            <div style={{width:160, height:160, borderRadius:'50%', background:'var(--bone)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative'}}>
              <div style={{position:'relative', display:'inline-block'}}>
                <span style={{fontFamily:"'Archivo'",fontWeight:900,fontStretch:'125%',fontSize:84,letterSpacing:'-0.055em',lineHeight:.85}}>p</span>
                <span style={{position:'absolute',left:'78%',top:'-6%',bottom:'-2%',width:3,background:'oklch(0.55 0.15 25)',transform:'rotate(14deg)',transformOrigin:'top'}}></span>
              </div>
            </div>
          </div>
        </div>
        {/* Square post */}
        <div style={{border:'1px solid var(--line)'}}>
          <div className="mono" style={{padding:'12px 16px', fontSize:10, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)', borderBottom:'1px solid var(--line)'}}>11.2 · Drop announcement · 1080</div>
          <div style={{aspectRatio:'1/1', background:'var(--bone)', padding:32, display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
            <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mute)',display:'flex',justifyContent:'space-between'}}>
              <span>Drop 02</span><span>04.26.26</span>
            </div>
            <div style={{fontFamily:'var(--display)',fontSize:34,fontWeight:600,letterSpacing:'-0.025em',lineHeight:1.0,textWrap:'balance'}}>Eight new pieces. Members first.</div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
              <Wordmark size={28}/>
              <span className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'oklch(0.55 0.15 25)'}}>● LIVE 09:00 GMT</span>
            </div>
          </div>
        </div>
        {/* Story */}
        <div style={{border:'1px solid var(--line)'}}>
          <div className="mono" style={{padding:'12px 16px', fontSize:10, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)', borderBottom:'1px solid var(--line)'}}>11.3 · Story · 9:16</div>
          <div style={{aspectRatio:'9/16', background:'var(--ink)', color:'var(--bone)', padding:24, display:'flex', flexDirection:'column', justifyContent:'space-between', position:'relative', maxWidth:240, margin:'0 auto'}}>
            <div className="mono" style={{fontSize:9,letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(244,241,236,0.55)'}}>Field note · 04</div>
            <div>
              <div className="mono" style={{fontSize:32, fontWeight:500, letterSpacing:'-0.02em', marginBottom:8}}>5'42"</div>
              <div className="mono" style={{fontSize:9, color:'rgba(244,241,236,0.55)', letterSpacing:'.16em', textTransform:'uppercase'}}>21.1 km · 24°c · clear</div>
            </div>
            <Wordmark size={16} white/>
          </div>
        </div>
      </div>

      {/* Banners */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
        <div style={{border:'1px solid var(--line)'}}>
          <div className="mono" style={{padding:'12px 16px', fontSize:10, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)', borderBottom:'1px solid var(--line)'}}>11.4 · X / Twitter banner</div>
          <div style={{aspectRatio:'3/1', background:'var(--bone)', padding:32, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <Wordmark size={64}/>
            <div className="mono" style={{fontSize:13,letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mute)'}}>Train like a craft</div>
          </div>
        </div>
        <div style={{border:'1px solid var(--line)'}}>
          <div className="mono" style={{padding:'12px 16px', fontSize:10, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)', borderBottom:'1px solid var(--line)'}}>11.5 · LinkedIn banner</div>
          <div style={{aspectRatio:'4/1', background:'var(--ink)', color:'var(--bone)', padding:32, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <Wordmark size={48} white/>
            <div className="mono" style={{fontSize:11,letterSpacing:'.22em',textTransform:'uppercase',color:'rgba(244,241,236,0.55)'}}>Apparel · Coaching · Invite-only</div>
          </div>
        </div>
      </div>
    </GLSection>
  );
}

function GLOutro(){
  return (
    <section data-screen-label="12 Sign-off" style={{padding:'120px 0 64px', background:'var(--ink)', color:'var(--bone)', position:'relative'}}>
      <CornerMarks dark/>
      <div className="container">
        <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)'}}>End · Brand Guidelines · v1.0</div>
        <h2 style={{fontFamily:'var(--display)',fontSize:88,fontWeight:600,letterSpacing:'-0.04em',lineHeight:.95,margin:'48px 0 48px',maxWidth:1100,textWrap:'balance'}}>Use this document like a coach uses a watch — quietly, often, and with respect.</h2>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:32, paddingTop:32, borderTop:'1px solid rgba(244,241,236,0.14)'}}>
          <div>
            <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)',marginBottom:10}}>Maintained by</div>
            <div style={{fontSize:18}}>The Pacr Brand team<br/><span style={{color:'rgba(244,241,236,0.6)'}}>brand@pacr.life</span></div>
          </div>
          <div>
            <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)',marginBottom:10}}>Asset library</div>
            <div style={{fontSize:18}}>brand.pacr.life<br/><span style={{color:'rgba(244,241,236,0.6)'}}>Logo files · type · templates</span></div>
          </div>
          <div>
            <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)',marginBottom:10}}>Questions?</div>
            <div style={{fontSize:18}}>If in doubt, ask.<br/><span style={{color:'rgba(244,241,236,0.6)'}}>We'd rather a slow yes than a quick no.</span></div>
          </div>
        </div>
        <div style={{marginTop:96, display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
          <Wordmark size={120} white/>
          <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)',textAlign:'right',lineHeight:1.7}}>
            © 2026 Pacr Lda<br/>All rights reserved<br/>v1.0 · April 2026
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { GLStationery, GLAppUI, GLApparel, GLSocial, GLOutro });
