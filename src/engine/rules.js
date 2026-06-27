/* Capitalist Apocalypse — game rules (DOM-free engine module).

   Everything here mutates the shared state `S` and is safe to run under Node:
   no DOM, no prompts. The UI/flow layer orchestrates which of these run and
   gathers the player choices they need. */
import { GOVS } from "./data.js";
import { buildDeck, shuffle } from "./deck.js";
import { S, setActiveState, newState, opp, cur, logEv } from "./state.js";
import { parseV, fmt, orgValue, score } from "./value.js";

/* ---------- set up a fresh game ---------- */
export function newGame(gov, ruler){
  setActiveState(newState());
  S.drawPile = shuffle(buildDeck());
  // deal 5 each
  for(let k=0;k<5;k++){ S.players[0].hand.push(S.drawPile.shift()); S.players[1].hand.push(S.drawPile.shift()); }
  S.government = gov;
  S.ruler = ruler;
  S.current = ruler!=null ? ruler : 0;
  S.actions = 2;
  logEv(`The world begins under <b>${gov}</b>${ruler!=null?` — ${S.players[ruler].name} rules`:""}.`);
  if(gov==="Communism") applyCommunism();
  return S;
}

/* ---------- counter detection (pure) ---------- */
export function counterCardsFor(responder, event){
  // event: {kind:'action'|'hp', name, targetPlayer?, actorId}
  const out=[];
  const has = nm => responder.hand.find(c=>c.def.name===nm);
  // Absolutely Not, Mate — reverse any action OR hp
  if(event.kind==="action"||event.kind==="hp"){const c=has("Absolutely Not, Mate"); if(c) out.push({card:c,type:"reverse"});}
  // Lawsuit — vs takeover / merger aimed at responder (or any merger/takeover)
  if(event.kind==="action" && ["Hostile Takeover","Regular Takeover","Angel Investor","Merger","Force An Alliance","Dragon's Den"].includes(event.name)){
    const c=has("Lawsuit"); if(c) out.push({card:c,type:"lawsuit"});
  }
  // Tablets 'n' That — block a merger (portfolio ability)
  if(event.kind==="action" && event.name==="Merger"){
    const t=responder.portfolio.find(o=>o.def.name==="Tablets 'n' That" && !o.tabletsUsed);
    if(t) out.push({org:t,type:"tablets"});
  }
  // HP negation cards
  if(event.kind==="hp"){
    const map={
      "Big Freeze":"Big Coat","Big Burn":"Big Sun Hat","Sea Rise":"Big Surfboard","False Idol":"Alejandra, God Of Apocalypta"
    };
    if(map[event.name]){const c=has(map[event.name]);if(c)out.push({card:c,type:"negate"});}
    if(["Dolphins","Return of the Dinosaurs","Encounter of the Third Kind"].includes(event.name)){const c=has("Dr. Dolittle");if(c)out.push({card:c,type:"dolittle"});}
    if(["Mass Robot Uprising","Electrobrainwash","Cryptodisaster"].includes(event.name)){const c=has("Luddite Uprising");if(c)out.push({card:c,type:"luddite"});}
  }
  return out;
}

/* ---------- card movement ---------- */
export function drawOne(player,announce=true){
  if(!S.drawPile.length){if(announce)logEv("The draw pile is empty.");return null;}
  const c=S.drawPile.shift();
  player.hand.push(c);
  enforceHandLimit(player);
  return c;
}
export function enforceHandLimit(player){
  while(player.hand.length>7){
    const c=player.hand.pop(); // discard to bottom of draw pile
    S.drawPile.push(c);
    logEv(`<span class="tag">${player.name}</span> exceeded 7 cards — ${c.def.name} returned to the bottom of the draw pile.`);
  }
}
export function discardFromHand(player,card){
  const i=player.hand.findIndex(c=>c.uid===card.uid);
  if(i>=0){player.hand.splice(i,1);S.discard.push(card);}
}
export function removeFromHand(player,card){
  const i=player.hand.findIndex(c=>c.uid===card.uid);
  return i>=0?player.hand.splice(i,1)[0]:card;
}

/* ---------- takeover / merge helpers ---------- */
export function allOrgs(){const r=[];S.players.forEach(p=>p.portfolio.forEach(o=>r.push({o,owner:p})));return r;}
export function canAffect(targetPlayer,actor){
  // blind spot: if targetPlayer named actor in blindSpotAgainst, actor's actions can't affect targetPlayer
  return targetPlayer.blindSpotAgainst!==actor.id;
}
export function canTakeover(o,acquirer,owner){
  if(!canAffect(owner,acquirer))return false;
  if(o.def.name==="Big Bloody Search, Inc.")return false;
  if(o.def.name==="Fran's Food"){
    const per=acquirer.portfolio.filter(x=>x.type==="Perishables").length;
    if(per<2)return false;
  }
  return true;
}
export function doTakeover(o,from,to){
  if(o.def.name==="Drugtopia" && !o.takeoverResisted){
    o.takeoverResisted=true;
    logEv(`<b>Drugtopia</b> resisted the takeover (one-time).`);
    return;
  }
  const anarchy=S.government==="Anarchy";
  // move org
  from.portfolio.splice(from.portfolio.findIndex(x=>x.uid===o.uid),1);
  to.portfolio.push(o);
  logEv(`<span class="tag">${to.name}</span> took over <b>${o.def.name}</b> from ${from.name}.`);
  if(anarchy){
    // takeover yields 2 organisations — grab a second random org if available
    const extra=from.portfolio.find(x=>canTakeover(x,to,from));
    if(extra){from.portfolio.splice(from.portfolio.findIndex(x=>x.uid===extra.uid),1);to.portfolio.push(extra);logEv(`Anarchy bonus: also seized <b>${extra.def.name}</b>.`);}
  }
}
export function swapOrgs(a,pa,b,pb){
  pa.portfolio.splice(pa.portfolio.findIndex(o=>o.uid===a.uid),1);
  pb.portfolio.splice(pb.portfolio.findIndex(o=>o.uid===b.uid),1);
  pa.portfolio.push(b);pb.portfolio.push(a);
}
export function mergeCompatible(a,b){
  // same type always ok; plus special "merge with anything" USPs
  const anyMerge=["Speedy Courier Plus","Peachy 'n' Clean"];
  if(anyMerge.includes(a.def.name)||anyMerge.includes(b.def.name))return true;
  return a.type===b.type;
}
export function doMerge(a,b,player){
  // multiplier: parse a.def.merge & b.def.merge → use the primary (a) multiplier, with USP boosts
  let mult=parseFloat(String(a.def.merge).replace("×",""))||1;
  // Good Mind ×20 if merged with tech
  if(a.def.name==="Good Mind, Inc." && b.type==="Tech") mult=20;
  if(b.def.name==="Good Mind, Inc." && a.type==="Tech") mult=20;
  // Golden Carrot ×5 with perishables
  if(a.def.name==="Golden Carrot Health Foods" && b.type==="Perishables") mult=5;
  // Globocorp rules
  if(a.def.name==="Globocorp TM"||b.def.name==="Globocorp TM"){
    const otherCard=a.def.name==="Globocorp TM"?b:a;
    mult = otherCard.size===2 ? -1 : 2;
  }
  const combinedBase=parseV(a.def.values[a.size])+parseV(b.def.values[b.size]);
  // result: keep card a, set Giant, store mergeBonus so live value = mult * combinedBase at giant baseline
  // We express bonus relative to a's giant base so orgValue stays consistent.
  const aGiantBase=parseV(a.def.values[2])||1;
  a.size=2;
  a.mergeBonus = (mult*combinedBase)/ (aGiantBase||1);
  if(!isFinite(a.mergeBonus)||a.mergeBonus===0) a.mergeBonus=mult;
  // remove b
  player.portfolio.splice(player.portfolio.findIndex(o=>o.uid===b.uid),1);
  logEv(`<span class="tag">${player.name}</span> merged <b>${a.def.name}</b> + <b>${b.def.name}</b> → Giant at merge ×${mult} (≈ ${fmt(orgValue(a,player))}).`);
}

/* ---------- government ---------- */
export function setGovernment(g,rulerId){
  S.government=g; S.ruler = rulerId;
  if(g==="Theocracy"){S.players.forEach(p=>{const idx=S.drawPile.findIndex(c=>c.cat==="Higher Power");if(idx>=0){p.hand.push(S.drawPile.splice(idx,1)[0]);enforceHandLimit(p);}});logEv("Theocracy: every player draws a Higher Power card.");}
  if(g==="Communism"){applyCommunism();}
}
export function blockedGovChange(){
  if(S.activeHP.some(h=>h.name==="Electrobrainwash") && !cur().negatedHP.has("Electrobrainwash"))return true;
  if(S.activeHP.some(h=>h.name==="False Idol"))return true;
  return false;
}
export function applyCommunism(){
  // pool all orgs in play + in hand, except Bill's Local News (stays), reallocate evenly
  const keep={};
  const pool=[];
  S.players.forEach(p=>{
    keep[p.id]=[];
    p.portfolio.forEach(o=>{ if(o.def.name==="Bill's Local News") keep[p.id].push(o); else pool.push(o); });
    // orgs in hand also pooled into play
    const handOrgs=p.hand.filter(c=>c.cat==="Organisation");
    handOrgs.forEach(o=>{p.hand.splice(p.hand.findIndex(c=>c.uid===o.uid),1); if(o.def.name==="Bill's Local News")keep[p.id].push(o); else pool.push(o);});
  });
  shuffle(pool);
  S.players.forEach(p=>p.portfolio=keep[p.id].slice());
  pool.forEach((o,i)=>S.players[i%2].portfolio.push(o));
  logEv("Communism: all organisations pooled and shared evenly (Bill's Local News stayed put).");
}
export function removeHP(name){
  S.activeHP=S.activeHP.filter(h=>h.name!==name);
  if(name==="Dolphins")S.dolphinsCountdown=null;
}

/* ---------- start-of-turn ruler effects ---------- */
export function startOfTurnEffects(){
  const me=cur();
  if(S.government==="Dictatorship" && S.ruler===me.id){
    const victim=opp(me.id);
    if(victim.hand.length){const idx=Math.floor(Math.random()*victim.hand.length);const c=victim.hand.splice(idx,1)[0];me.hand.push(c);enforceHandLimit(me);logEv(`Dictatorship: ${me.name} seized a random card from ${victim.name}.`);}
  }
}

/* ---------- elimination / end ---------- */
export function eliminate(player,reason){
  player.eliminated=true;
  logEv(`<b>${player.name} is OUT</b> — ${reason}.`);
}
export function checkEliminationEnd(){
  const alive=S.players.filter(p=>!p.eliminated);
  if(alive.length<=1){endGame(alive.length?`${alive[0].name} is the last corporation standing.`:"Mutual destruction.");return true;}
  return false;
}
export function checkEnd(){
  if(S.over)return;
  checkEliminationEnd();
}

/* End the game: pure state transition. Records the result on S.result so the UI
   (or a headless caller) can present it. Display lives in the UI layer. */
export function endGame(reason){
  if(S.over)return;
  S.over=true;
  const s0=score(S.players[0]), s1=score(S.players[1]);
  let winner;
  if(S.players[0].eliminated && !S.players[1].eliminated) winner=1;
  else if(S.players[1].eliminated && !S.players[0].eliminated) winner=0;
  else if(S.allied) winner=-1;
  else winner = s0===s1 ? -1 : (s0>s1?0:1);
  S.result = { reason, scores:[s0,s1], winner };
  return S.result;
}
