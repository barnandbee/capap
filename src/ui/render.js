/* Capitalist Apocalypse — rendering & screens (browser only).
   Reads the engine state and paints the board; shows the pass / game-over
   overlays. The over-screen is driven purely by S.over / S.result, so any
   engine path that ends the game surfaces correctly on the next render(). */
import { TYPE_COLORS } from "../engine/data.js";
import { S, opp, cur } from "../engine/state.js";
import { score, orgValue, fmt } from "../engine/value.js";
import { cardArt } from "./art.js";
// flow imports render too — ESM handles the cycle because these are only
// invoked at event time, never during module evaluation.
import { doDraw, doOverthrow, endTurn, playCard } from "../flow.js";

export function render(){
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

  if(S.over) showGameOver();
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

/* ---------- overlay screens ---------- */
export function showPassScreen(){
  render();
  const sc=document.getElementById("passScreen");
  document.getElementById("passTitle").textContent=`${cur().name}, it's your turn`;
  document.getElementById("passSub").textContent=`Pass the device to ${cur().name}. The previous player's hand is now hidden.`;
  sc.classList.remove("hidden");
}
export function showGameOver(){
  const sc=document.getElementById("overScreen");
  const r=S.result||{reason:"",scores:[score(S.players[0]),score(S.players[1])],winner:-1};
  const [s0,s1]=r.scores, winner=r.winner;
  document.getElementById("overTitle").textContent="The world has ended";
  document.getElementById("overSub").textContent=r.reason;
  document.getElementById("overScores").innerHTML=
    `<div style="font-size:15px;line-height:1.8">
      ${S.players[0].name}: <b style="color:var(--gold)">${fmt(s0)}</b>${S.players[0].eliminated?" (out)":""}<br>
      ${S.players[1].name}: <b style="color:var(--gold)">${fmt(s1)}</b>${S.players[1].eliminated?" (out)":""}
     </div>
     <h2 style="margin-top:14px">${winner===-1?"It's a shared fate — a draw":S.players[winner].name+" wins"}</h2>`;
  sc.classList.remove("hidden");
}
