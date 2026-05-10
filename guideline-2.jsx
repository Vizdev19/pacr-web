// Pacr Brand Guidelines — Part 2 (sections 04–07: Color, Type, Voice, Imagery)

function GLColor(){
  const swatches = [
    {n:'Bone',    hex:'#F4F1EC', cmyk:'2 / 3 / 6 / 0',   pms:'Warm Gray 1', use:'Primary surface',   dark:false},
    {n:'Ink',     hex:'#0E0E0C', cmyk:'70 / 65 / 65 / 75', pms:'Black 6',     use:'Type · marks',       dark:true},
    {n:'Graphite',hex:'#1C1C1A', cmyk:'65 / 60 / 60 / 60', pms:'Cool Gray 11',use:'Spec panels',        dark:true},
    {n:'Paper',   hex:'#FAF8F4', cmyk:'1 / 1 / 3 / 0',   pms:'11-0103 TPX',  use:'Secondary surface',  dark:false},
    {n:'Track',   hex:'#BA3824', cmyk:'15 / 88 / 92 / 5', pms:'7599 C',       use:'Single accent · ≤8% of any layout', dark:true},
  ];
  return (
    <GLSection id="sec-04" n="04" label="Color" title="A bone surface, an ink mark, and one accent — used like punctuation." kicker="The palette is intentionally narrow. Track red is the only accent and must never exceed roughly 8% of any composition. Treat it like a heartbeat: rare, deliberate, alive.">
      <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', border:'1px solid var(--line)', borderRight:0}}>
        {swatches.map(s => (
          <div key={s.n} style={{borderRight:'1px solid var(--line)', display:'flex', flexDirection:'column'}}>
            <div style={{height:280, background:s.hex, borderBottom:'1px solid var(--line)'}}></div>
            <div style={{padding:24, color:'var(--ink)', background:'var(--bone)', flex:1, display:'flex', flexDirection:'column', gap:14}}>
              <div style={{fontFamily:'var(--display)',fontSize:26,fontWeight:600,letterSpacing:'-0.02em'}}>{s.n}</div>
              <div className="mono" style={{fontSize:12, lineHeight:1.7}}>
                <div>HEX  {s.hex}</div>
                <div>CMYK {s.cmyk}</div>
                <div>PMS  {s.pms}</div>
              </div>
              <div style={{fontSize:13, color:'var(--mute)', marginTop:'auto', paddingTop:14, borderTop:'1px solid var(--line-2)'}}>{s.use}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{marginTop:48, padding:48, border:'1px solid var(--line)', background:'var(--paper)'}}>
        <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginBottom:18}}>04.6 · Proportional ratio</div>
        <div style={{display:'flex', height:60, marginBottom:14}}>
          <div style={{flex:60, background:'#F4F1EC', border:'1px solid var(--line)'}}></div>
          <div style={{flex:25, background:'#0E0E0C'}}></div>
          <div style={{flex:7, background:'#1C1C1A'}}></div>
          <div style={{flex:8, background:'#BA3824'}}></div>
        </div>
        <div style={{display:'flex', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.16em', textTransform:'uppercase', color:'var(--mute)'}}>
          <div style={{flex:60}}>60 · Bone</div>
          <div style={{flex:25}}>25 · Ink</div>
          <div style={{flex:7}}>7 · Graphite</div>
          <div style={{flex:8, color:'oklch(0.55 0.15 25)'}}>8 · Track</div>
        </div>
      </div>
    </GLSection>
  );
}

function GLType(){
  return (
    <GLSection id="sec-05" n="05" label="Typography" title="Two families. One does the talking, one does the math." kicker="Inter Tight is our display and body voice — sharp, modern, slightly editorial. JetBrains Mono carries every distance, pace, size, and timestamp. The mono is the brand's instrumentation; never replace it with a stylistic stand-in.">
      {/* Inter Tight specimen */}
      <div style={{border:'1px solid var(--line)', marginBottom:32}}>
        <div style={{padding:'14px 24px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)'}}>
          <span>05.1 · Display & body — Inter Tight</span>
          <span>Weights 400 · 500 · 600 · 700 · 800</span>
        </div>
        <div style={{padding:48, background:'var(--paper)'}}>
          <div style={{fontFamily:'var(--display)', fontWeight:700, fontSize:200, letterSpacing:'-0.05em', lineHeight:.85, marginBottom:32}}>Aa</div>
          <div style={{fontFamily:'var(--display)', fontSize:24, lineHeight:1.05, fontWeight:600, letterSpacing:'-0.02em', marginBottom:24}}>The quickest brown fox runs an honest pace.</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:24, paddingTop:24, borderTop:'1px solid var(--line)'}}>
            {[
              {n:'Display', sz:'72 / 64', w:600, lh:0.98, tr:-0.03, ex:'Train like a craft.'},
              {n:'Heading', sz:'40 / 44', w:600, lh:1.05, tr:-0.02, ex:'Field-tested apparel.'},
              {n:'Subhead', sz:'22 / 28', w:500, lh:1.3, tr:-0.01, ex:'Drop 01 · Spring 26.'},
              {n:'Body', sz:'15 / 24', w:400, lh:1.55, tr:0, ex:'Made in small drops, tested at race pace by the runners who design it.'},
            ].map(t => (
              <div key={t.n}>
                <div className="mono" style={{fontSize:10,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)'}}>{t.n} · {t.sz}</div>
                <div style={{fontFamily:'var(--display)', fontWeight:t.w, fontSize:18, lineHeight:t.lh, letterSpacing:t.tr+'em', marginTop:12}}>{t.ex}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* JetBrains Mono specimen */}
      <div style={{border:'1px solid var(--line)'}}>
        <div style={{padding:'14px 24px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)'}}>
          <span>05.2 · Mono — JetBrains Mono</span>
          <span>Weights 400 · 500</span>
        </div>
        <div style={{padding:48, background:'var(--paper)'}}>
          <div className="mono" style={{fontSize:120, lineHeight:1, marginBottom:32, letterSpacing:'-0.02em'}}>5'42"</div>
          <div className="mono" style={{fontSize:14, lineHeight:1.8, color:'var(--mute)'}}>
            21.1 KM · MARATHON · DROP 01 · 92 G · 04.26.2026 · 16:42 · M / L / XL
          </div>
        </div>
      </div>

      {/* hierarchy demo */}
      <div style={{marginTop:48, padding:48, border:'1px solid var(--line)'}}>
        <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginBottom:24}}>05.3 · Hierarchy in practice</div>
        <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginBottom:8}}>Drop 01 · Spring 26</div>
        <div style={{fontFamily:'var(--display)',fontSize:64,fontWeight:600,letterSpacing:'-0.03em',lineHeight:.98,marginBottom:16,maxWidth:760}}>Twelve pieces. One season. Made to be run in.</div>
        <div style={{fontSize:16, lineHeight:1.6, color:'var(--mute)', maxWidth:560}}>Each garment ships with a field report — fabric weight, weave, weather window, and what we tested it at. No marketing science.</div>
      </div>
    </GLSection>
  );
}

function GLVoice(){
  return (
    <GLSection id="sec-06" n="06" label="Voice & tone" title="Quiet, exact, and earned." kicker="Pacr writes like a coach who runs further than you do — precise, lightly poetic, never hyped. Short sentences. Specific numbers. No exclamation points. No emojis.">
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, border:'1px solid var(--line)', borderRight:0, marginBottom:48}}>
        <div style={{borderRight:'1px solid var(--line)', padding:32}}>
          <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'oklch(0.55 0.15 25)',marginBottom:18}}>We do</div>
          <ul style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:14, fontSize:16, lineHeight:1.5}}>
            <li>· Use specific numbers (78 g, 5'42"/km, 21.1 km).</li>
            <li>· Lead with the run, not the marketing.</li>
            <li>· Treat the reader as a peer, not a beginner.</li>
            <li>· Keep sentences short. Trim adverbs.</li>
            <li>· Cite, when we make a claim.</li>
          </ul>
        </div>
        <div style={{padding:32}}>
          <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginBottom:18}}>We don't</div>
          <ul style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:14, fontSize:16, lineHeight:1.5, color:'var(--mute)'}}>
            <li>· Use exclamations. Or emojis. Ever.</li>
            <li>· Say "game-changing", "level up", "elevate".</li>
            <li>· Make claims we haven't tested.</li>
            <li>· Hype the gear above the runner.</li>
            <li>· Write longer than necessary.</li>
          </ul>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
        {[
          {context:'Product copy', good:'Featherweight mesh. 78 g. Tested at threshold pace across thirty 21K efforts.', bad:'Revolutionary fabric tech that takes your running to the next level!'},
          {context:'Email subject', good:'Drop 02 — eight new pieces, members first.', bad:'🔥 You won\'t believe our biggest drop ever 🔥'},
        ].map(e => (
          <div key={e.context} style={{border:'1px solid var(--line)'}}>
            <div className="mono" style={{padding:'12px 20px', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)', borderBottom:'1px solid var(--line)'}}>{e.context}</div>
            <div style={{padding:24, borderBottom:'1px solid var(--line-2)'}}>
              <div className="mono" style={{fontSize:10,letterSpacing:'.2em',textTransform:'uppercase',color:'oklch(0.55 0.15 25)',marginBottom:8}}>Yes</div>
              <div style={{fontSize:16, lineHeight:1.5}}>{e.good}</div>
            </div>
            <div style={{padding:24}}>
              <div className="mono" style={{fontSize:10,letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mute)',marginBottom:8}}>No</div>
              <div style={{fontSize:16, lineHeight:1.5, color:'var(--mute)', textDecoration:'line-through', textDecorationColor:'var(--mute-2)'}}>{e.bad}</div>
            </div>
          </div>
        ))}
      </div>
    </GLSection>
  );
}

function GLImagery(){
  return (
    <GLSection id="sec-07" n="07" label="Imagery & motion" title="Documentary, not commercial." kicker="Photography is built around real runs in real conditions. Low-saturation color, grain over polish, motion blur where it earns its place. Treat models as athletes, not models.">
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:8, marginBottom:24, height:480}}>
        <div className="ph" style={{aspectRatio:'auto', height:'100%'}}>
          <div className="ph-label">07.1 · Hero · documentary</div>
          <div className="ph-corner">F2.0 · 1/640 · ISO 400</div>
        </div>
        <div className="ph" style={{aspectRatio:'auto', height:'100%'}}><div className="ph-label">Detail · weave</div></div>
        <div className="ph" style={{aspectRatio:'auto', height:'100%'}}><div className="ph-label">On body · static</div></div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:48, height:240}}>
        {['Cool morning','Heat · midday','Track · dusk','Trail · grain'].map(l => (
          <div key={l} className="ph" style={{aspectRatio:'auto', height:'100%'}}><div className="ph-label">{l}</div></div>
        ))}
      </div>

      {/* Iconography */}
      <div style={{border:'1px solid var(--line)', marginBottom:32}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)'}}>
          <span>07.2 · Iconography</span>
          <span>1.5px stroke · 24px grid · square caps</span>
        </div>
        <div style={{padding:'48px 32px', display:'grid', gridTemplateColumns:'repeat(8, 1fr)', gap:24, background:'var(--paper)'}}>
          {[
            ['M3 18l6-12 4 8 3-4 5 8','Pace'],
            ['M12 3v9l5 3','Time'],
            ['M3 18c4-6 8-6 12 0M3 12c4-6 8-6 12 0','Run'],
            ['M5 12h14M12 5v14','Goal'],
            ['M4 6h16M4 12h16M4 18h16','Plan'],
            ['M12 3l9 6-9 12-9-12z','Peak'],
            ['M3 12a9 9 0 1018 0 9 9 0 10-18 0M12 3v9l4 2','Track'],
            ['M3 20l4-4 5 5 9-9','Climb'],
          ].map(([d, label]) => (
            <div key={label} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter"><path d={d}/></svg>
              <div className="mono" style={{fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Motion */}
      <div style={{border:'1px solid var(--line)'}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.18em', textTransform:'uppercase', color:'var(--mute)'}}>07.3 · Motion principles</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:0}}>
          {[
            {n:'Ease', v:'cubic-bezier(.2,.7,.3,1)', d:'A near-flat curve. Movements feel measured, not bouncy.'},
            {n:'Duration', v:'180–320 ms', d:'Short for UI, longer for narrative. Never under 120 ms.'},
            {n:'Style', v:'Linear, not playful', d:'Slide, fade, count. No springs. No bounces.'},
          ].map((m,i) => (
            <div key={m.n} style={{padding:32, borderRight: i<2?'1px solid var(--line)':'none'}}>
              <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginBottom:14}}>{m.n}</div>
              <div className="mono" style={{fontSize:18, fontWeight:500, marginBottom:10}}>{m.v}</div>
              <div style={{fontSize:14, lineHeight:1.5, color:'var(--mute)'}}>{m.d}</div>
            </div>
          ))}
        </div>
      </div>
    </GLSection>
  );
}

Object.assign(window, { GLColor, GLType, GLVoice, GLImagery });
