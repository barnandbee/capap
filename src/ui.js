"use strict";
/* Capitalist Apocalypse — render + modal dialogs
   Part of the multi-file split (see README). Loaded as a classic <script>;
   all modules share one global scope until the planned ES-module step. */

/* ============================================================
   LOG + RENDER
   ============================================================ */
function logEv(html){S.log.unshift(html);if(S.log.length>40)S.log.pop();}
function render(){
  if(!S)return;
  // status bar
  const sb=document.getElementById("statusbar");
  let html="";
  html+=`<span class="pill">Turn <b>${S.turn}</b></span>`;
  const rulerName = S.ruler!=null ? ` · ${S.players[S.ruler].name}` : "";
  html+=`<span class="pill">Gov: <b>${S.government||"—"}</b>${rulerName}</span>`;
  html+=`<span class="pill">Draw pile: <b>${S.drawPile.length}</b></span>`;
  if(S.allied) html+=`<span class="pill danger">ALLIANCE active</span>`;
  S.activeHP.forEach(h=>html+=`<span class="pill hp">${h.name}</span>`);
  if(S.dolphinsCountdown!=null) html+=`<span class="pill danger">Dolphins: ${S.dolphinsCountdown} turn(s) left</span>`;
  sb.innerHTML=html;

  // board: opponent seat on top, current player on bottom
  const board=document.getElementById("board");
  board.innerHTML="";
  board.appendChild(seatEl(opp(S.current).id,false));
  board.appendChild(seatEl(S.current,true));

  // log
  document.getElementById("log").innerHTML = S.log.map(l=>`<div class="ev">${l}</div>`).join("") || `<div class="ev" style="opacity:.4">The world holds its breath…</div>`;

  // dock
  const dock=document.getElementById("dock");
  const me=cur();
  dock.innerHTML=`
    <span class="acts">Actions left <b>${S.actions}</b></span>
    <button class="btn" id="drawBtn" ${S.actions<1?"disabled":""}>Draw a card</button>
    <button class="btn" id="overthrowBtn" ${S.actions<2?"disabled":""}>Overthrow gov</button>
    <button class="btn primary" id="endBtn">End turn / Pass</button>`;
  document.getElementById("drawBtn").onclick=()=>doDraw();
  document.getElementById("overthrowBtn").onclick=()=>doOverthrow();
  document.getElementById("endBtn").onclick=()=>endTurn();
}
function seatEl(pid,isActive){
  const p=S.players[pid];
  const el=document.createElement("div");
  el.className="seat"+(isActive?" active":"");
  const sc=score(p);
  el.innerHTML=`
    <div class="seat-head">
      <div class="who">${p.name}${p.eliminated?" (out)":""}${S.ruler===pid?" 👑":""}</div>
      <div class="score">value<b>${fmt(sc)}</b></div>
    </div>
    <div class="seat-label">Portfolio (in play)</div>
    <div class="cardrow" id="port-${pid}"></div>
    <div class="seat-label">Hand ${isActive?"":`· ${p.hand.length} card(s), hidden`}</div>
    <div class="cardrow" id="hand-${pid}"></div>`;
  // portfolio
  setTimeout(()=>{ // mount after innerHTML
    const port=el.querySelector(`#port-${pid}`);
    p.portfolio.forEach(o=>port.appendChild(orgMini(o,p)));
    const hand=el.querySelector(`#hand-${pid}`);
    if(isActive){
      p.hand.forEach(c=>hand.appendChild(handMini(c)));
    } else {
      p.hand.forEach(()=>{const d=document.createElement("div");d.className="mini face-down";d.innerHTML="<span>Apocalypse</span>";hand.appendChild(d);});
    }
  },0);
  return el;
}
function orgMini(o,owner){
  const d=document.createElement("div");
  d.className="mini";
  const col=TYPE_COLORS[o.def.type]||"#444";
  d.innerHTML=`
    <span class="badge" style="background:${col}">${o.def.type}</span>
    <div class="nm">${o.def.name}</div>
    <div class="art" style="background-image:url('${cardArt(o)}')"></div>
    <div class="sizebar">${["S","E","G"].map((s,i)=>`<div class="s ${i===o.size?"on":""}">${s}</div>`).join("")}</div>
    <div class="val">${fmt(orgValue(o,owner))}</div>
    <div class="sub">live value${o.mergeBonus>1?` · merged ×${o.mergeBonus}`:""}</div>
    <div class="usp">${o.def.usp}</div>`;
  return d;
}
function handMini(c){
  const d=document.createElement("div");
  const col=TYPE_COLORS[c.def.type]||"#a8761c";
  if(c.cat==="Organisation"){
    d.className="mini playable";d.tabIndex=0;
    d.innerHTML=`<span class="badge" style="background:${col}">${c.def.type}</span>
      <div class="nm">${c.def.name}</div>
      <div class="art" style="background-image:url('${cardArt(c)}')"></div>
      <div class="sizebar">${["S","E","G"].map((s,i)=>`<div class="s ${i===c.size?"on":""}">${s}</div>`).join("")}</div>
      <div class="val">${c.def.values[c.size]}</div>
      <div class="sub">play to portfolio</div>
      <div class="usp">${c.def.usp}</div>`;
  } else {
    d.className="mini playable";d.tabIndex=0;
    d.innerHTML=`<span class="badge" style="background:${col}">${c.cat}</span>
      <div class="nm" style="font-size:13px">${c.def.name}</div>
      <div class="art" style="background-image:url('${cardArt(c)}')"></div>
      <div class="usp" style="max-height:88px;border-top:none;margin-top:6px">${c.def.text}</div>`;
  }
  const go=()=>playCard(c);
  d.onclick=go; d.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}};
  return d;
}

/* ============================================================
   MODAL HELPER (async)
   ============================================================ */
function modal({title,desc,options,cancel="Cancel",allowCancel=true}){
  return new Promise(res=>{
    const m=document.getElementById("modalMount");
    const wrap=document.createElement("div");wrap.className="modal";
    wrap.innerHTML=`<div class="box"><h3>${title}</h3>${desc?`<div class="desc">${desc}</div>`:""}
      <div class="opts"></div>
      <div class="modal-foot">${allowCancel?`<button class="btn ghost" style="color:var(--ink);border-color:var(--ink)">${cancel}</button>`:""}</div></div>`;
    const opts=wrap.querySelector(".opts");
    options.forEach(o=>{
      const b=document.createElement("button");b.className="opt";
      b.innerHTML=`<b>${o.label}</b>${o.sub?`<small>${o.sub}</small>`:""}`;
      b.onclick=()=>{cleanup();res(o.value);};
      opts.appendChild(b);
    });
    if(allowCancel) wrap.querySelector(".modal-foot .btn").onclick=()=>{cleanup();res(null);};
    function cleanup(){wrap.remove();}
    m.appendChild(wrap);
  });
}
async function pickOrg(title,list,desc){
  if(!list.length){await modal({title,desc:"No valid organisations.",options:[],allowCancel:true,cancel:"OK"});return null;}
  const sel=await modal({title,desc,options:list.map(x=>({label:`${x.o.def.name} · ${SIZES[x.o.size]}`,sub:`${x.owner.name} · ${fmt(orgValue(x.o,x.owner))}`,value:x.o.uid})),});
  if(sel==null)return null;
  for(const x of list) if(x.o.uid===sel) return x;
  return null;
}
function note(title,desc){return modal({title,desc,options:[],allowCancel:true,cancel:"OK"});}
