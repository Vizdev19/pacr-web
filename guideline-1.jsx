// Pacr Brand Guidelines — Part 1 (sections 01–04: Cover, TOC, Logo, Clearspace/Misuse)

// ===== SHARED ATOMS =====
function GLEyebrow({n, label, dark}){
  return (
    <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:dark?'rgba(244,241,236,0.5)':'var(--mute)',display:'flex',gap:14,alignItems:'center'}}>
      <span style={{color:dark?'rgba(244,241,236,0.85)':'var(--ink)'}}>{n}</span>
      <span style={{width:24,height:1,background:dark?'rgba(244,241,236,0.3)':'var(--line)'}}></span>
      <span>{label}</span>
    </div>
  );
}

function GLSection({id, n, label, title, kicker, dark, children}){
  return (
    <section id={id} data-screen-label={`${n} ${label}`} className={dark?'gl-sec dark':'gl-sec'} style={{padding:'120px 0', borderTop: dark?'1px solid rgba(244,241,236,0.14)':'1px solid var(--line)', background: dark?'var(--ink)':'transparent', color: dark?'var(--bone)':'var(--ink)'}}>
      <div className="container">
        <div style={{display:'grid', gridTemplateColumns:'200px 1fr', gap:48, alignItems:'flex-start', marginBottom:80}}>
          <GLEyebrow n={n} label={label} dark={dark}/>
          <div>
            <h2 style={{fontFamily:'var(--display)',fontSize:72,fontWeight:600,letterSpacing:'-0.035em',lineHeight:.98,margin:'0 0 24px',textWrap:'balance',maxWidth:900}}>{title}</h2>
            {kicker && <p style={{fontSize:18, lineHeight:1.55, maxWidth:680, color:dark?'rgba(244,241,236,0.78)':'rgba(14,14,12,0.7)', margin:0}}>{kicker}</p>}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

// Page-corner registration marks for that lab-spec feel
function CornerMarks({dark}){
  const c = dark ? 'rgba(244,241,236,0.25)' : 'rgba(14,14,12,0.18)';
  const Reg = ({pos}) => {
    const styleMap = {
      tl:{top:24,left:24,borderRight:0,borderBottom:0},
      tr:{top:24,right:24,borderLeft:0,borderBottom:0},
      bl:{bottom:24,left:24,borderRight:0,borderTop:0},
      br:{bottom:24,right:24,borderLeft:0,borderTop:0},
    };
    return <div style={{position:'absolute',width:14,height:14,border:`1px solid ${c}`,...styleMap[pos]}}></div>;
  };
  return <>
    <Reg pos="tl"/><Reg pos="tr"/><Reg pos="bl"/><Reg pos="br"/>
  </>;
}

// Wordmark (stride cut) — re-usable
function Wordmark({size=56, white=false, noStrike=false}){
  return (
    <span style={{
      display:'inline-block', position:'relative',
      fontFamily:"'Archivo',sans-serif", fontWeight:900, fontStretch:'125%',
      fontSize:size, letterSpacing:'-0.055em', lineHeight:.85,
      color: white?'var(--bone)':'var(--ink)'
    }}>
      pacr
      {!noStrike && <span style={{
        position:'absolute', left:'34%', top:'-8%', bottom:'-2%',
        width: Math.max(1.5, size*0.04),
        background:'oklch(0.55 0.15 25)',
        transform:'rotate(14deg)', transformOrigin:'top'
      }}></span>}
    </span>
  );
}

// ===== COVER =====
function GLCover(){
  return (
    <section data-screen-label="00 Cover" style={{minHeight:'100vh', background:'var(--bone)', position:'relative', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'48px 0'}}>
      <CornerMarks/>
      <div className="container" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mute)'}}>
          Pacr · Brand Guidelines<br/>v1.0 · 04.2026
        </div>
        <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mute)',textAlign:'right'}}>
          Confidential<br/>Internal & approved partners
        </div>
      </div>

      <div className="container" style={{display:'flex', flexDirection:'column', gap:48}}>
        <Wordmark size={300}/>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'flex-end'}}>
          <h1 style={{fontFamily:'var(--display)',fontSize:64,fontWeight:600,letterSpacing:'-0.03em',lineHeight:1,margin:0,maxWidth:760,textWrap:'balance'}}>
            How to use the Pacr brand. Every mark, every word, every margin.
          </h1>
          <div style={{fontFamily:'var(--mono)',fontSize:13,letterSpacing:'.06em',color:'var(--mute)',lineHeight:1.7,textAlign:'right'}}>
            <div>10 sections</div>
            <div>74 pages</div>
            <div>Maintained by Brand</div>
            <div>brand@pacr.life</div>
          </div>
        </div>
      </div>

      <div className="container" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
        <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mute)'}}>
          Train like a craft.
        </div>
        <div className="mono" style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase',color:'var(--mute)'}}>
          00 / Cover
        </div>
      </div>
    </section>
  );
}

// ===== TOC =====
function GLToc(){
  const items = [
    {n:'01', label:'Brand foundation', desc:'Why Pacr exists, who it\'s for, what it stands for.'},
    {n:'02', label:'Logo system', desc:'Wordmark, lockups, monogram, app icon.'},
    {n:'03', label:'Clearspace & misuse', desc:'How to give the mark room. How not to ruin it.'},
    {n:'04', label:'Color', desc:'Bone, ink, graphite, track. The full palette.'},
    {n:'05', label:'Typography', desc:'Display, body, mono. Hierarchy and pairing.'},
    {n:'06', label:'Voice & tone', desc:'How Pacr writes. What we say, what we don\'t.'},
    {n:'07', label:'Imagery', desc:'Photography direction, iconography, motion.'},
    {n:'08', label:'Stationery', desc:'Business cards, letterhead, email signatures.'},
    {n:'09', label:'App UI', desc:'In-product brand application.'},
    {n:'10', label:'Apparel & packaging', desc:'Garment marks, hangtags, shipping.'},
    {n:'11', label:'Social & web', desc:'Avatars, post templates, banners.'},
  ];
  return (
    <section data-screen-label="00 Contents" style={{padding:'120px 0', borderTop:'1px solid var(--line)'}}>
      <div className="container">
        <div style={{display:'grid', gridTemplateColumns:'200px 1fr', gap:48, marginBottom:64}}>
          <GLEyebrow n="00" label="Contents"/>
          <h2 style={{fontFamily:'var(--display)',fontSize:64,fontWeight:600,letterSpacing:'-0.03em',lineHeight:1,margin:0,textWrap:'balance'}}>Eleven sections.<br/>Read in any order.</h2>
        </div>
        <div style={{borderTop:'1px solid var(--line)'}}>
          {items.map(it => (
            <a key={it.n} href={`#sec-${it.n}`} style={{display:'grid', gridTemplateColumns:'80px 280px 1fr 80px', gap:24, padding:'24px 0', borderBottom:'1px solid var(--line-2)', color:'var(--ink)', alignItems:'baseline', cursor:'pointer'}}>
              <div className="mono" style={{fontSize:14,letterSpacing:'.1em',color:'var(--mute)'}}>{it.n}</div>
              <div style={{fontFamily:'var(--display)',fontSize:28,fontWeight:500,letterSpacing:'-0.02em'}}>{it.label}</div>
              <div style={{fontSize:15, color:'var(--mute)', lineHeight:1.5}}>{it.desc}</div>
              <div className="mono" style={{fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)',textAlign:'right'}}>Read →</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===== 01 FOUNDATION =====
function GLFoundation(){
  return (
    <GLSection id="sec-01" n="01" label="Brand foundation" title="A brand for runners who train like a craft." kicker="Pacr is two things: an apparel line for committed runners, and an invite-only coaching app rooted in sport science. Both serve the same person — someone who treats running as a long-term practice, not a trend.">
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:0, border:'1px solid var(--line)', borderRight:0}}>
        {[
          {k:'Mission', v:'Make running a craft accessible — through apparel that performs and coaching that actually coaches.'},
          {k:'Audience', v:'The committed runner. 5K to marathon. Not chasing a trend; chasing a personal best.'},
          {k:'Promise', v:'Every piece, every plan, has been tested by people who run further than you do.'},
        ].map(b => (
          <div key={b.k} style={{padding:32, borderRight:'1px solid var(--line)'}}>
            <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginBottom:24}}>{b.k}</div>
            <div style={{fontSize:20, lineHeight:1.45, fontWeight:500, letterSpacing:'-0.01em'}}>{b.v}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:64, padding:48, background:'var(--ink)', color:'var(--bone)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:64}}>
        <div>
          <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)',marginBottom:18}}>Tagline</div>
          <div style={{fontFamily:'var(--display)',fontSize:64,fontWeight:600,letterSpacing:'-0.03em',lineHeight:1}}>Train like a craft.</div>
        </div>
        <div>
          <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'rgba(244,241,236,0.5)',marginBottom:18}}>Adjacent lines</div>
          <ul style={{margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:12, fontSize:18}}>
            <li>· One run wiser.</li>
            <li>· Coaching, in your pocket.</li>
            <li>· Built for the long run.</li>
            <li>· Quietly fast.</li>
          </ul>
        </div>
      </div>
    </GLSection>
  );
}

// ===== 02 LOGO SYSTEM =====
function GLLogo(){
  return (
    <GLSection id="sec-02" n="02" label="Logo system" title="One wordmark. Three derivatives. No more." kicker="The Pacr identity rests on a custom Archivo Black wordmark with a single accent stride line. Every other mark — monogram, app icon, tagline lockup — descends from it.">
      {/* Primary mark */}
      <div style={{border:'1px solid var(--line)', padding:0, marginBottom:48}}>
        <div style={{padding:'14px 24px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)'}}>Primary wordmark · "Stride"</div>
          <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)'}}>02.1</div>
        </div>
        <div style={{padding:'120px 64px', display:'flex', justifyContent:'center', alignItems:'center', background:'var(--paper)'}}>
          <Wordmark size={200}/>
        </div>
      </div>

      {/* Variants grid */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24, marginBottom:48}}>
        <div style={{border:'1px solid var(--line)'}}>
          <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>
            <span>02.2 · Reversed</span><span>For dark surfaces</span>
          </div>
          <div style={{padding:'80px 24px', background:'var(--ink)', display:'flex', justifyContent:'center'}}><Wordmark size={86} white/></div>
        </div>
        <div style={{border:'1px solid var(--line)'}}>
          <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>
            <span>02.3 · Monogram</span><span>Small / single-letter use</span>
          </div>
          <div style={{padding:'56px 24px', background:'var(--paper)', display:'flex', justifyContent:'center', alignItems:'center', height:148}}>
            <div style={{position:'relative', display:'inline-block'}}>
              <span style={{fontFamily:"'Archivo',sans-serif",fontWeight:900,fontStretch:'125%',fontSize:120,letterSpacing:'-0.055em',lineHeight:.85,color:'var(--ink)'}}>p</span>
              <span style={{position:'absolute',left:'78%',top:'-6%',bottom:'-2%',width:5,background:'oklch(0.55 0.15 25)',transform:'rotate(14deg)',transformOrigin:'top'}}></span>
            </div>
          </div>
        </div>
        <div style={{border:'1px solid var(--line)'}}>
          <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>
            <span>02.4 · App icon</span><span>iOS / Android</span>
          </div>
          <div style={{padding:'40px 24px', background:'var(--paper)', display:'flex', justifyContent:'center', alignItems:'center', height:148}}>
            <div style={{width:120, height:120, background:'var(--bone)', borderRadius:28, border:'2px solid oklch(0.55 0.15 25)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <Wordmark size={48} noStrike/>
            </div>
          </div>
        </div>
      </div>

      {/* Tagline lockup */}
      <div style={{border:'1px solid var(--line)'}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>
          <span>02.5 · Tagline lockup</span><span>Vertical & horizontal</span>
        </div>
        <div style={{padding:'48px 64px', background:'var(--paper)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center'}}>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            <Wordmark size={92}/>
            <div className="mono" style={{fontSize:11,letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mute)',marginLeft:2}}>Train like a craft</div>
          </div>
          <div style={{display:'flex', alignItems:'baseline', gap:18}}>
            <Wordmark size={56}/>
            <div style={{width:1, height:24, background:'var(--line)', alignSelf:'center'}}></div>
            <div className="mono" style={{fontSize:11,letterSpacing:'.22em',textTransform:'uppercase',color:'var(--mute)'}}>Coached running · Apparel</div>
          </div>
        </div>
      </div>
    </GLSection>
  );
}

// ===== 03 CLEARSPACE & MISUSE =====
function GLClearspace(){
  return (
    <GLSection id="sec-03" n="03" label="Clearspace & misuse" title="Give the mark room. Don't decorate it." kicker="Clearspace is measured in 'p-heights' (the cap-height of the lowercase p in the wordmark). The mark must always sit on a calm surface and never be modified, recolored, or paired with another visual element it wasn't designed for.">
      {/* Clearspace */}
      <div style={{border:'1px solid var(--line)', marginBottom:48}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>
          <span>03.1 · Minimum clearspace</span><span>1× p-height on all sides</span>
        </div>
        <div style={{padding:'64px', background:'var(--paper)', display:'flex', justifyContent:'center'}}>
          <div style={{position:'relative', padding:'80px 100px', border:'1px dashed oklch(0.55 0.15 25)'}}>
            <div style={{position:'absolute',top:8,left:8,fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'oklch(0.55 0.15 25)'}}>1p</div>
            <div style={{position:'absolute',top:8,right:8,fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'oklch(0.55 0.15 25)'}}>1p</div>
            <div style={{position:'absolute',bottom:8,left:8,fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'oklch(0.55 0.15 25)'}}>1p</div>
            <div style={{position:'absolute',bottom:8,right:8,fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'oklch(0.55 0.15 25)'}}>1p</div>
            <Wordmark size={140}/>
          </div>
        </div>
      </div>

      {/* Min sizes */}
      <div style={{border:'1px solid var(--line)', marginBottom:48}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>
          <span>03.2 · Minimum sizes</span><span>Below these, switch to monogram</span>
        </div>
        <div style={{padding:'48px 64px', background:'var(--paper)', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:32, alignItems:'end'}}>
          {[
            {label:'Print', size:14, note:'14px / 4mm cap-height'},
            {label:'Screen', size:24, note:'24px minimum'},
            {label:'Apparel', size:48, note:'12mm woven label'},
          ].map(s => (
            <div key={s.label} style={{textAlign:'center'}}>
              <div style={{display:'flex', justifyContent:'center', alignItems:'flex-end', height:80}}><Wordmark size={s.size}/></div>
              <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--mute)',marginTop:24}}>{s.label}</div>
              <div style={{fontSize:13, marginTop:6, color:'var(--mute)'}}>{s.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Misuse */}
      <div style={{border:'1px solid var(--line)'}}>
        <div style={{padding:'12px 20px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)',fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)'}}>
          <span>03.3 · Misuse</span><span>Six things never to do</span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gridAutoRows:'180px'}}>
          {[
            {label:"Don't stretch",  el: <span style={{transform:'scaleX(1.6)', transformOrigin:'center', display:'inline-block'}}><Wordmark size={56}/></span>},
            {label:"Don't outline",  el: <span style={{WebkitTextStroke:'2px var(--ink)', color:'transparent', fontFamily:"'Archivo'",fontWeight:900,fontStretch:'125%',fontSize:56,letterSpacing:'-0.055em'}}>pacr</span>},
            {label:"Don't recolor",  el: <span style={{color:'#3aa2c0', fontFamily:"'Archivo'",fontWeight:900,fontStretch:'125%',fontSize:56,letterSpacing:'-0.055em'}}>pacr</span>},
            {label:"Don't gradient", el: <span style={{background:'linear-gradient(90deg,#ff8a00,#ff2bb1)', WebkitBackgroundClip:'text', color:'transparent', fontFamily:"'Archivo'",fontWeight:900,fontStretch:'125%',fontSize:56,letterSpacing:'-0.055em'}}>pacr</span>},
            {label:"Don't crowd",    el: <div style={{display:'inline-flex',gap:6,alignItems:'center'}}><span style={{fontSize:14}}>★</span><Wordmark size={48}/><span style={{fontSize:14}}>★</span></div>},
            {label:"Don't rotate",   el: <span style={{display:'inline-block',transform:'rotate(-12deg)'}}><Wordmark size={56}/></span>},
          ].map((m,i) => (
            <div key={i} style={{borderTop:'1px solid var(--line)', borderRight: i%3<2?'1px solid var(--line)':'none', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', background:'var(--paper)'}}>
              <div style={{opacity:.65}}>{m.el}</div>
              <div style={{position:'absolute', top:14, right:14, color:'oklch(0.55 0.15 25)', fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.16em', textTransform:'uppercase'}}>✕ {m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </GLSection>
  );
}

Object.assign(window, { GLEyebrow, GLSection, CornerMarks, Wordmark, GLCover, GLToc, GLFoundation, GLLogo, GLClearspace });
