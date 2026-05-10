// Pacr — Cart page
function CartPage(){
  const { goto } = React.useContext(PageContext);
  const [items, setItems] = React.useState([
    {id:1, name:'Field Singlet', variant:'Bone · M', price:84, qty:1},
    {id:2, name:'Mileage Short', variant:'Ink · M · 5"', price:96, qty:1},
  ]);
  const subtotal = items.reduce((s,i)=>s + i.price*i.qty, 0);
  const shipping = subtotal >= 150 ? 0 : 12;
  const total = subtotal + shipping;
  const setQty = (id, q) => setItems(items.map(i => i.id===id ? {...i, qty:Math.max(1,q)} : i));
  const remove = (id) => setItems(items.filter(i => i.id !== id));

  return (
    <div>
      <section style={{borderBottom:'1px solid var(--line)'}}>
        <div className="container" style={{padding:'56px 32px 40px'}}>
          <Eyebrow>Bag · {items.length} pieces</Eyebrow>
          <h1 style={{fontFamily:'var(--display)',fontSize:64,fontWeight:600,letterSpacing:'-0.035em',lineHeight:.95,margin:'20px 0 0'}}>Your bag.</h1>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:96, alignItems:'flex-start'}}>
            {/* Items */}
            <div>
              {items.length === 0 ? (
                <div style={{padding:'80px 0', textAlign:'center'}}>
                  <p style={{fontSize:18, color:'var(--mute)'}}>Your bag is empty.</p>
                  <button className="btn ghost" style={{marginTop:24}} onClick={()=>goto('shop')}>Shop the drop →</button>
                </div>
              ) : items.map((it,idx) => (
                <div key={it.id} style={{display:'grid', gridTemplateColumns:'120px 1fr auto', gap:24, padding:'24px 0', borderTop: idx===0?'1px solid var(--line)':'1px solid var(--line-2)', borderBottom: idx===items.length-1?'1px solid var(--line)':'none', alignItems:'center'}}>
                  <Placeholder label="" corner="" ratio="1/1" style={{width:120,height:120,aspectRatio:'1/1'}}/>
                  <div>
                    <div style={{fontSize:18,fontWeight:500,letterSpacing:'-0.01em'}}>{it.name}</div>
                    <div className="mono" style={{fontSize:12,color:'var(--mute)',marginTop:4}}>{it.variant}</div>
                    <div style={{display:'flex', alignItems:'center', gap:24, marginTop:18}}>
                      <div style={{display:'inline-flex', border:'1px solid var(--line)'}}>
                        <button onClick={()=>setQty(it.id, it.qty-1)} style={{width:32,height:32,background:'transparent',border:0,cursor:'pointer',fontFamily:'var(--mono)'}}>−</button>
                        <div style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--mono)',fontSize:13,borderLeft:'1px solid var(--line)',borderRight:'1px solid var(--line)'}}>{it.qty}</div>
                        <button onClick={()=>setQty(it.id, it.qty+1)} style={{width:32,height:32,background:'transparent',border:0,cursor:'pointer',fontFamily:'var(--mono)'}}>+</button>
                      </div>
                      <button onClick={()=>remove(it.id)} className="mono" style={{background:'transparent',border:0,fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)',cursor:'pointer',borderBottom:'1px solid var(--line)',paddingBottom:1}}>Remove</button>
                    </div>
                  </div>
                  <div className="mono" style={{fontSize:15,fontWeight:500}}>${(it.price*it.qty).toFixed(2)}</div>
                </div>
              ))}

              <div style={{marginTop:48, padding:24, background:'var(--paper)', border:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div className="mono" style={{fontSize:11,letterSpacing:'.18em',textTransform:'uppercase',color:'var(--accent)'}}>Members · Free shipping always</div>
                  <div style={{fontSize:14,marginTop:6,color:'var(--mute)'}}>Pacr app members ship free on every order.</div>
                </div>
                <button className="btn ghost" onClick={()=>goto('app')}>Request invite →</button>
              </div>
            </div>

            {/* Summary */}
            <div style={{position:'sticky', top:96, border:'1px solid var(--line)', padding:32, background:'var(--paper)'}}>
              <Eyebrow>Order summary</Eyebrow>
              <div style={{marginTop:24, display:'flex', flexDirection:'column', gap:14}}>
                <div style={{display:'flex',justifyContent:'space-between'}}><span>Subtotal</span><span className="mono">${subtotal.toFixed(2)}</span></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><span>Shipping</span><span className="mono">{shipping===0?'Free':`$${shipping.toFixed(2)}`}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',color:'var(--mute)'}}><span>Estimated tax</span><span className="mono">at checkout</span></div>
              </div>
              <div className="rule" style={{margin:'24px 0'}}></div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <span style={{fontSize:14, letterSpacing:'-0.01em'}}>Total</span>
                <span className="mono" style={{fontSize:24, fontWeight:500}}>${total.toFixed(2)}</span>
              </div>
              <button className="btn lg full" style={{marginTop:32}}>Checkout →</button>
              <div className="mono" style={{fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)',marginTop:16,textAlign:'center'}}>30-day returns · Carbon-neutral shipping</div>

              <div style={{marginTop:32, paddingTop:24, borderTop:'1px solid var(--line-2)'}}>
                <div className="mono" style={{fontSize:11,letterSpacing:'.16em',textTransform:'uppercase',color:'var(--mute)',marginBottom:10}}>Promo code</div>
                <div style={{display:'flex', gap:6}}>
                  <input placeholder="Enter code" style={{flex:1,padding:'10px 12px',background:'transparent',border:'1px solid var(--line)',fontFamily:'var(--display)',fontSize:14,outline:'none'}}/>
                  <button className="btn ghost" style={{padding:'10px 14px'}}>Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

window.CartPage = CartPage;
