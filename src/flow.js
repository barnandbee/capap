/* Capitalist Apocalypse — turn flow & counter orchestration (browser).

   This layer wires player choices (modals, the counter screen) to the DOM-free
   engine. It's the natural seam for AI players later: a bot would call the same
   engine mutations these handlers do, without the await-modal prompts. */
import {
  GOVS, GOV_TEXT, SIZES,
  S, opp, cur, logEv, spend,
  counterCardsFor, drawOne, enforceHandLimit, discardFromHand, removeFromHand,
  allOrgs, canTakeover, doTakeover, swapOrgs, mergeCompatible, doMerge,
  setGovernment, blockedGovChange, removeHP, eliminate,
  checkEliminationEnd, checkEnd, startOfTurnEffects, endGame
} from "./engine/index.js";
import { modal, pickOrg, note } from "./ui/modal.js";
import { render, showPassScreen } from "./ui/render.js";

/* ============================================================
   COUNTER SYSTEM (UI side of the key counters)
   ============================================================ */
// returns true if the original effect should be CANCELLED
async function offerCounter(actorId, event){
  const responder=S.players[1-actorId];
  if(responder.eliminated) return false;
  const opts=counterCardsFor(responder,event);
  if(!opts.length) return false;
  // hidden prompt — pass device
  const cancelled = await counterFlow(responder,event,opts);
  return cancelled;
}
function counterFlow(responder,event,opts){
  return new Promise(resolve=>{
    const screen=document.getElementById("counterScreen");
    document.getElementById("counterTitle").textContent=`${responder.name}, you may respond`;
    document.getElementById("counterSub").textContent=`${S.players[event.actorId].name} just played “${event.name}”. You hold a card that could respond — but it stays secret unless you use it.`;
    screen.classList.remove("hidden");
    const viewBtn=document.getElementById("counterViewBtn");
    const declineBtn=document.getElementById("counterDeclineBtn");
    const onView=async()=>{cleanup();
      const choice=await modal({
        title:`${responder.name} — choose a response`,
        desc:"Play a card to respond, or let it stand.",
        options:opts.map((o,i)=>({label: o.card?o.card.def.name:(o.org?`Tablets 'n' That (block merger)`:"Respond"),
          sub: o.type==="reverse"?"Roll a double to reverse it":o.type==="lawsuit"?"Cancel the takeover/merger":o.type==="tablets"?"Block this merger (one-time)":"Negate the effect",
          value:i})),
        cancel:"Let it stand"
      });
      if(choice==null){resolve(false);return;}
      const chosen=opts[choice];
      const cancelled=await resolveCounter(responder,event,chosen);
      resolve(cancelled);
    };
    const onDecline=()=>{cleanup();resolve(false);};
    function cleanup(){screen.classList.add("hidden");viewBtn.onclick=null;declineBtn.onclick=null;}
    viewBtn.onclick=onView; declineBtn.onclick=onDecline;
  });
}
async function resolveCounter(responder,event,chosen){
  if(chosen.type==="tablets"){
    chosen.org.tabletsUsed=true;
    logEv(`<span class="tag">${responder.name}</span> used Tablets 'n' That to <b>block the merger</b>.`);
    return true;
  }
  // discard the response card from hand
  discardFromHand(responder,chosen.card);
  if(chosen.type==="reverse"){
    const d1=1+Math.floor(Math.random()*6), d2=1+Math.floor(Math.random()*6);
    const dbl=d1===d2;
    logEv(`<span class="tag">${responder.name}</span> played Absolutely Not, Mate — rolled ${d1} &amp; ${d2}. ${dbl?"<b>Double! Reversed.</b>":"No double — it stands."}`);
    return dbl;
  }
  if(chosen.type==="lawsuit"){
    logEv(`<span class="tag">${responder.name}</span> filed a Lawsuit — the ${event.name.toLowerCase()} is delayed (cancelled).`);
    return true;
  }
  if(chosen.type==="negate"){
    responder.negatedHP.add(event.name);
    logEv(`<span class="tag">${responder.name}</span> negated <b>${event.name}</b> for themselves.`);
    return false; // HP still plays, just negated for responder
  }
  if(chosen.type==="dolittle"){
    responder.negatedHP.add(event.name);
    logEv(`<span class="tag">${responder.name}</span> played Dr. Dolittle — ${event.name} negated for them.`);
    return false;
  }
  if(chosen.type==="luddite"){
    S.players.forEach(p=>p.negatedHP.add(event.name));
    logEv(`<span class="tag">${responder.name}</span> played Luddite Uprising — <b>${event.name} negated for everyone</b>.`);
    return false;
  }
  return false;
}

/* ============================================================
   CORE TURN ACTIONS
   ============================================================ */
export async function doDraw(){
  if(S.actions<1)return;
  const c=drawOne(cur());
  if(c){logEv(`<span class="tag">${cur().name}</span> drew a card.`);spend();}
  checkEnd();
  render();
}
export async function doOverthrow(){
  if(S.actions<2){await note("Not enough actions","Overthrowing the government uses your whole turn (2 actions).");return;}
  if(S.activeHP.some(h=>h.name==="Electrobrainwash") && !cur().negatedHP.has("Electrobrainwash")){
    await note("Blocked","Electrobrainwash forbids changing the government.");return;
  }
  if(S.activeHP.some(h=>h.name==="False Idol")){
    await note("Blocked","A False Idol forces Theocracy — the government cannot change.");return;
  }
  spend(2);
  const d1=1+Math.floor(Math.random()*6), d2=1+Math.floor(Math.random()*6);
  logEv(`<span class="tag">${cur().name}</span> attempts a coup — rolled ${d1} &amp; ${d2}.`);
  if(d1===d2){
    setGovernment(GOVS[d1-1],S.current);
    logEv(`<b>Double ${d1}!</b> Installs <b>${GOVS[d1-1]}</b>.`);
    await note("Coup successful!",`Double ${d1}! The world is now under ${GOVS[d1-1]}.`);
  } else {
    await note("Coup failed","No double — the government stands. Your turn is spent.");
  }
  checkEnd(); render(); maybeEndTurn();
}

export async function playCard(card){
  if(S.actions<1){await note("No actions left","End your turn to pass the device.");return;}
  const me=cur();
  if(card.cat==="Organisation"){
    if(S.activeHP.some(h=>h.name==="Big Freeze") && !me.negatedHP.has("Big Freeze")){
      await note("Frozen","Big Freeze is in play — no organisation cards can be played. (Big Coat negates it.)");return;
    }
    // move to portfolio
    const i=me.hand.findIndex(c=>c.uid===card.uid);
    me.hand.splice(i,1);
    me.portfolio.push(card);
    logEv(`<span class="tag">${me.name}</span> brought <b>${card.def.name}</b> into play.`);
    spend(); checkEnd(); render(); maybeEndTurn(); return;
  }
  if(card.cat==="Higher Power"){
    await playHP(card); return;
  }
  // ACTION
  await playAction(card);
}

/* ---------- HIGHER POWER ---------- */
async function playHP(card){
  const me=cur();
  const name=card.def.name;
  // offer counter (negation cards) before resolving
  const cancelled=await offerCounter(S.current,{kind:"hp",name,actorId:S.current});
  // remove from hand, place in play
  const i=me.hand.findIndex(c=>c.uid===card.uid);
  me.hand.splice(i,1);
  spend();
  if(cancelled){ // Absolutely Not Mate reversed it — discard, no effect
    S.discard.push(card);
    logEv(`<span class="tag">${me.name}</span> tried to unleash <b>${name}</b> — reversed before it landed.`);
    checkEnd(); render(); maybeEndTurn(); return;
  }
  S.activeHP.push({name,card});
  S.anyHPPlayed=true;
  logEv(`<span class="tag">${me.name}</span> unleashed Higher Power: <b>${name}</b>.`);

  // immediate effects
  if(name==="Capitalist Apocalypse"){ endGame("Capitalist Apocalypse has been played."); render(); return; }
  if(name==="Cryptodisaster"){
    S.cryptoPlayed=true;
    // elimination checks
    S.players.forEach(p=>{
      const danger=p.portfolio.find(o=>["A-Video","Data Share, Inc.","Big Bloody Search, Inc."].includes(o.def.name));
      if(danger && !p.negatedHP.has("Cryptodisaster")){
        eliminate(p,`held ${danger.def.name} during Cryptodisaster`);
      }
    });
  }
  if(name==="Theocracy"){ /* not an HP */ }
  if(name==="Encounter of the Third Kind"){
    S.players.forEach(p=>p.portfolio.forEach(o=>{if(o.def.type==="Wellbeing" && !p.negatedHP.has(name)) o.size=2;}));
    logEv("Wellbeing companies surge to Giant size.");
  }
  if(name==="Dolphins"){
    if(S.activeHP.some(h=>h.name==="Sea Rise")){
      S.dolphinsCountdown=2; // ends after each player gets one more turn
      logEv("<b>The world is underwater — dolphins are rising. The end is one turn away.</b>");
    } else {
      logEv("Dolphins appear, but the world isn't underwater — no effect yet.");
    }
  }
  if(name==="False Idol"){
    setGovernment("Theocracy",S.ruler);
    logEv("A False Idol forces the world into Theocracy.");
  }
  if(checkEliminationEnd()){render();return;}
  checkEnd(); render(); maybeEndTurn();
}

/* ---------- ACTION CARDS ---------- */
async function playAction(card){
  const me=cur(), other=opp(S.current);
  const name=card.def.name;
  // Determine if this should offer a counter (key counters)
  const counterable=["Hostile Takeover","Regular Takeover","Angel Investor","Merger","Force An Alliance","Dragon's Den","Stock Crash","Build Stock","CEO Scandal","It's 1929","The New Deal","Rainbow Unicorn"].includes(name);
  // blind-spot: if this action targets the opponent and opponent has blind spot vs me
  // (checked inside individual handlers via canAffect)

  // We resolve in two stages: (1) gather the intent / targets, (2) offer counter, (3) apply.
  // For simplicity, build an "apply" closure; targets chosen before counter where it reads better.
  let apply=null, summary=name, needsCounter=counterable;

  switch(name){
    case "Stock Crash": {
      const t=await pickOrg("Stock Crash — pick a company to shrink",allOrgs(),"Drops one size level.");
      if(!t)return;
      apply=()=>{t.o.size=Math.max(0,t.o.size-1);logEv(`<span class="tag">${me.name}</span> crashed <b>${t.o.def.name}</b> to ${SIZES[t.o.size]}.`);};
      break;
    }
    case "Build Stock": {
      const t=await pickOrg("Build Stock — pick a company to grow",allOrgs(),"Raises one size level.");
      if(!t)return;
      apply=()=>{t.o.size=Math.min(2,t.o.size+1);logEv(`<span class="tag">${me.name}</span> grew <b>${t.o.def.name}</b> to ${SIZES[t.o.size]}.`);};
      break;
    }
    case "CEO Scandal": {
      const t=await pickOrg("CEO Scandal — pick a Giant",allOrgs().filter(x=>x.o.size===2),"Reduces a Giant to Enterprise.");
      if(!t)return;
      apply=()=>{t.o.size=1;logEv(`<span class="tag">${me.name}</span>: scandal! <b>${t.o.def.name}</b> falls to Enterprise.`);};
      break;
    }
    case "Rainbow Unicorn": {
      const t=await pickOrg("Rainbow Unicorn — pick a Start-up",allOrgs().filter(x=>x.o.size===0),"Grows a Start-up straight to Giant.");
      if(!t)return;
      apply=()=>{t.o.size=2;logEv(`<span class="tag">${me.name}</span>: 🦄 <b>${t.o.def.name}</b> rockets to Giant.`);};
      break;
    }
    case "It's 1929":
      apply=()=>{allOrgs().forEach(x=>x.o.size=0);logEv(`<span class="tag">${me.name}</span> played It's 1929 — every company collapses to Start-up.`);};
      break;
    case "The New Deal":
      apply=()=>{allOrgs().forEach(x=>x.o.size=2);logEv(`<span class="tag">${me.name}</span> played The New Deal — every company swells to Giant.`);};
      break;
    case "Hostile Takeover": {
      const targets=other.portfolio.filter(o=>canTakeover(o,me,other)).map(o=>({o,owner:other}));
      const t=await pickOrg("Hostile Takeover — choose from opponent",targets,"Seize one organisation from your opponent.");
      if(!t)return;
      apply=()=>doTakeover(t.o,other,me);
      break;
    }
    case "Angel Investor": {
      const targets=other.portfolio.filter(o=>o.size===0 && canTakeover(o,me,other)).map(o=>({o,owner:other}));
      const t=await pickOrg("Angel Investor — pick a Start-up",targets,"Take over a Start-up from your opponent.");
      if(!t)return;
      apply=()=>doTakeover(t.o,other,me);
      break;
    }
    case "Regular Takeover": {
      const mine=me.portfolio.map(o=>({o,owner:me}));
      if(!mine.length){await note("Nothing to swap","You have no organisations in play.");return;}
      const give=await pickOrg("Regular Takeover — give which of yours?",mine);
      if(!give)return;
      const targets=other.portfolio.filter(o=>canTakeover(o,me,other)).map(o=>({o,owner:other}));
      const take=await pickOrg("…in exchange for which of theirs?",targets);
      if(!take)return;
      apply=()=>{swapOrgs(give.o,me,take.o,other);logEv(`<span class="tag">${me.name}</span> swapped <b>${give.o.def.name}</b> for <b>${take.o.def.name}</b>.`);};
      break;
    }
    case "Dragon's Den": {
      const t=await pickOrg("Dragon's Den — pick any company in play",allOrgs(),"Its owner must hand it to the other player for a random card.");
      if(!t)return;
      apply=()=>{
        const from=t.owner, to=opp(from.id);
        // move org
        from.portfolio.splice(from.portfolio.findIndex(o=>o.uid===t.o.uid),1);
        to.portfolio.push(t.o);
        // random card back
        if(to.hand.length){const idx=Math.floor(Math.random()*to.hand.length);const give=to.hand.splice(idx,1)[0];from.hand.push(give);enforceHandLimit(from);}
        logEv(`<span class="tag">Dragon's Den:</span> <b>${t.o.def.name}</b> forced from ${from.name} to ${to.name}.`);
      };
      break;
    }
    case "Merger": {
      // group same-type in my portfolio
      const byType={};
      me.portfolio.forEach(o=>{(byType[o.type]=byType[o.type]||[]).push(o);});
      const mergeable=Object.values(byType).filter(g=>g.length>=2);
      if(S.government==="Anarchy"){await note("No mergers","Mergers are forbidden under Anarchy.");return;}
      if(!mergeable.length){await note("Cannot merge","You need two organisations of the same sector in play.");return;}
      const list=[];
      me.portfolio.forEach(o=>list.push({o,owner:me}));
      const a=await pickOrg("Merger — first organisation",list.filter(x=>byType[x.o.type].length>=2));
      if(!a)return;
      const partners=me.portfolio.filter(o=>o.type===a.o.type && o.uid!==a.o.uid && mergeCompatible(a.o,o)).map(o=>({o,owner:me}));
      if(!partners.length){await note("No partner","No compatible same-sector partner for that card.");return;}
      const b=await pickOrg("Merger — merge with",partners);
      if(!b)return;
      apply=()=>doMerge(a.o,b.o,me);
      break;
    }
    case "Sneaky Corporate Deal":
      apply=()=>{
        if(!me.hand.length||!other.hand.length){logEv("Sneaky Corporate Deal fizzled — a hand was empty.");return;}
        const i=Math.floor(Math.random()*me.hand.length), j=Math.floor(Math.random()*other.hand.length);
        const tmp=me.hand[i];me.hand[i]=other.hand[j];other.hand[j]=tmp;
        logEv(`<span class="tag">${me.name}</span> made a sneaky corporate deal — a card swapped at random.`);
      };
      needsCounter=false;
      break;
    case "Massive Market Forces":
      apply=()=>{const t=me.hand;me.hand=other.hand;other.hand=t;logEv("Adam Smith's Ghost — both players swap entire hands.");};
      needsCounter=false;
      break;
    case "Generous Tax Break":
      apply=()=>{
        S.players.forEach(p=>{
          const orgs=p.hand.filter(c=>c.cat==="Organisation");
          orgs.forEach(o=>{p.hand.splice(p.hand.findIndex(c=>c.uid===o.uid),1);p.portfolio.push(o);});
        });
        logEv("Generous Tax Break — all organisations in hand are forced into play.");
      };
      needsCounter=false;
      break;
    case "Investment Portfolio":
      apply=()=>{
        let got=0;
        for(let k=0;k<3;k++){const idx=S.drawPile.findIndex(c=>c.cat==="Organisation");if(idx<0)break;me.hand.push(S.drawPile.splice(idx,1)[0]);got++;}
        enforceHandLimit(me);
        logEv(`<span class="tag">${me.name}</span> pulled ${got} organisation card(s) from the deck.`);
      };
      needsCounter=false;
      break;
    case "Cosmic Interference":
      apply=()=>{
        const idx=S.drawPile.findIndex(c=>c.cat==="Higher Power");
        if(idx<0){logEv("No Higher Power cards left in the deck.");return;}
        me.hand.push(S.drawPile.splice(idx,1)[0]);enforceHandLimit(me);
        logEv(`<span class="tag">${me.name}</span> drew a Higher Power card from the deck.`);
      };
      needsCounter=false;
      break;
    case "Rebellion": {
      if(blockedGovChange()){await note("Blocked","Government can't change right now (Electrobrainwash / False Idol).");return;}
      const g=await modal({title:"Rebellion — choose a new government",options:GOVS.map(x=>({label:x,sub:GOV_TEXT[x],value:x}))});
      if(!g)return;
      apply=()=>{setGovernment(g,S.current);logEv(`<span class="tag">${me.name}</span> led a Rebellion — government is now <b>${g}</b>.`);};
      needsCounter=false;
      break;
    }
    case "Form An Alliance":
    case "Force An Alliance": {
      if(S.allied){await note("Already allied","An alliance is already in place.");return;}
      if(name==="Form An Alliance"){
        // opponent may decline
        apply=()=>{};
        const ok=await modal({title:`${other.name}: accept alliance?`,desc:`${me.name} offers to combine portfolios. With two players this means a shared victory.`,options:[{label:"Accept",value:"y"},{label:"Refuse",value:"n"}],allowCancel:false});
        if(ok!=="y"){logEv(`${other.name} refused the alliance.`);spend();render();maybeEndTurn();S.discard.push(removeFromHand(me,card));return;}
      }
      apply=()=>{S.allied=true;logEv(`<b>Alliance formed</b> between ${me.name} and ${other.name}. Portfolios are now shared.`);};
      break;
    }
    case "Break All Partnerships":
    case "Break A Heart":
      apply=()=>{
        if(!S.allied){logEv("There was no alliance to break.");return;}
        S.allied=false;logEv(`<span class="tag">${me.name}</span> shattered the alliance. Each keeps their own portfolio.`);
      };
      needsCounter=false;
      break;
    case "Independence Day": {
      if(!S.activeHP.length){await note("Nothing to rescind","No Higher Power card is in play.");return;}
      const which=await modal({title:"Independence Day — target which Higher Power?",options:S.activeHP.map(h=>({label:h.name,value:h.name}))});
      if(!which)return;
      apply=()=>{
        const r1=[1+Math.floor(Math.random()*6),1+Math.floor(Math.random()*6)];
        const r2=[1+Math.floor(Math.random()*6),1+Math.floor(Math.random()*6)];
        const dbl=r1[0]===r1[1]||r2[0]===r2[1];
        logEv(`Independence Day rolls — ${me.name}: ${r1.join("&")}, ${other.name}: ${r2.join("&")}.`);
        if(dbl){removeHP(which);logEv(`<b>A double! ${which} is rescinded.</b>`);}
        else logEv("No doubles — the Higher Power endures.");
      };
      needsCounter=false;
      break;
    }
    case "Luddite Uprising":
      apply=()=>{["Mass Robot Uprising","Electrobrainwash","Cryptodisaster"].forEach(n=>{if(S.activeHP.some(h=>h.name===n))S.players.forEach(p=>p.negatedHP.add(n));});logEv(`<span class="tag">${me.name}</span> sparked a Luddite Uprising — robot/crypto/brainwash effects negated for all.`);};
      needsCounter=false;break;
    case "Dr. Dolittle":
      apply=()=>{["Dolphins","Return of the Dinosaurs","Encounter of the Third Kind"].forEach(n=>{if(S.activeHP.some(h=>h.name===n))me.negatedHP.add(n);});logEv(`<span class="tag">${me.name}</span> played Dr. Dolittle — dolphin/dinosaur/alien effects negated for them.`);};
      needsCounter=false;break;
    case "Big Coat": case "Big Sun Hat": case "Big Surfboard": case "Alejandra, God Of Apocalypta": {
      const map={"Big Coat":"Big Freeze","Big Sun Hat":"Big Burn","Big Surfboard":"Sea Rise","Alejandra, God Of Apocalypta":"False Idol"};
      const target=map[name];
      apply=()=>{
        if(name==="Alejandra, God Of Apocalypta"){if(S.activeHP.some(h=>h.name==="False Idol")){S.players.forEach(p=>p.negatedHP.add("False Idol"));}logEv(`<span class="tag">${me.name}</span> invoked Alejandra — False Idol negated for all.`);}
        else{me.negatedHP.add(target);logEv(`<span class="tag">${me.name}</span> negated ${target} for themselves.`);}
      };
      needsCounter=false;break;
    }
    case "Absolutely Not, Mate":
      await note("Hold that","Absolutely Not, Mate is a response card — it only triggers when your opponent plays something and you're offered the chance to react.");
      return;
    case "Lawsuit":
      await note("Hold that","Lawsuit is a response card — play it when prompted to block an incoming takeover or merger.");
      return;
    default:
      apply=()=>{logEv(`${me.name} played ${name}.`);};
  }

  if(!apply)return;

  // offer counter for counterable actions
  if(needsCounter){
    const cancelled=await offerCounter(S.current,{kind:"action",name,actorId:S.current});
    // remove the action card from hand & discard regardless (it was played)
    S.discard.push(removeFromHand(me,card));
    spend();
    if(cancelled){
      logEv(`<span class="tag">${me.name}</span>'s <b>${name}</b> was countered.`);
      checkEnd();render();maybeEndTurn();return;
    }
    apply();
  } else {
    S.discard.push(removeFromHand(me,card));
    spend();
    apply();
  }
  if(checkEliminationEnd()){render();return;}
  checkEnd();render();maybeEndTurn();
}

/* ---------- turn flow ---------- */
export function maybeEndTurn(){
  if(S.over)return;
  if(S.actions<=0) endTurn();
}
export function endTurn(){
  if(S.over)return;
  // dolphins countdown
  if(S.dolphinsCountdown!=null){
    S.dolphinsCountdown--;
    if(S.dolphinsCountdown<=0){endGame("The dolphins have taken the world.");render();return;}
  }
  // advance
  S.current=1-S.current;
  // skip eliminated
  if(S.players[S.current].eliminated){endGame(`${S.players[1-S.current].name} wins by elimination.`);render();return;}
  S.turn++;
  S.actions=2;
  // start-of-turn government effects for ruler
  startOfTurnEffects();
  showPassScreen();
}
