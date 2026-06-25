"use strict";
/* Capitalist Apocalypse — counter system, turn flow & rules
   Part of the multi-file split (see README). Loaded as a classic <script>;
   all modules share one global scope until the planned ES-module step. */

/* ============================================================
   COUNTER SYSTEM (key counters only)
   "respond" cards held by the opponent of the player acting.
   ============================================================ */
function counterCardsFor(responder, event){
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
function spend(n=1){S.actions-=n;}
function drawOne(player,announce=true){
  if(!S.drawPile.length){if(announce)logEv("The draw pile is empty.");return null;}
  const c=S.drawPile.shift();
  player.hand.push(c);
  enforceHandLimit(player);
  return c;
}
function enforceHandLimit(player){
  while(player.hand.length>7){
    const c=player.hand.pop(); // discard to bottom of draw pile
    S.drawPile.push(c);
    logEv(`<span class="tag">${player.name}</span> exceeded 7 cards — ${c.def.name} returned to the bottom of the draw pile.`);
  }
}
function discardFromHand(player,card){
  const i=player.hand.findIndex(c=>c.uid===card.uid);
  if(i>=0){player.hand.splice(i,1);S.discard.push(card);}
}
async function doDraw(){
  if(S.actions<1)return;
  const c=drawOne(cur());
  if(c){logEv(`<span class="tag">${cur().name}</span> drew a card.`);spend();}
  render();
  checkEnd();
}
async function doOverthrow(){
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
  render(); checkEnd(); maybeEndTurn();
}

async function playCard(card){
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
    spend(); render(); checkEnd(); maybeEndTurn(); return;
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
    render(); checkEnd(); maybeEndTurn(); return;
  }
  S.activeHP.push({name,card});
  S.anyHPPlayed=true;
  logEv(`<span class="tag">${me.name}</span> unleashed Higher Power: <b>${name}</b>.`);

  // immediate effects
  if(name==="Capitalist Apocalypse"){ render(); endGame("Capitalist Apocalypse has been played."); return; }
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
  if(checkEliminationEnd()){return;}
  render(); checkEnd(); maybeEndTurn();
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
      render();checkEnd();maybeEndTurn();return;
    }
    apply();
  } else {
    S.discard.push(removeFromHand(me,card));
    spend();
    apply();
  }
  if(checkEliminationEnd())return;
  render();checkEnd();maybeEndTurn();
}

function removeFromHand(player,card){
  const i=player.hand.findIndex(c=>c.uid===card.uid);
  return i>=0?player.hand.splice(i,1)[0]:card;
}

/* ---------- takeover / merge helpers ---------- */
function allOrgs(){const r=[];S.players.forEach(p=>p.portfolio.forEach(o=>r.push({o,owner:p})));return r;}
function canAffect(targetPlayer,actor){
  // blind spot: if targetPlayer named actor in blindSpotAgainst, actor's actions can't affect targetPlayer
  return targetPlayer.blindSpotAgainst!==actor.id;
}
function canTakeover(o,acquirer,owner){
  if(!canAffect(owner,acquirer))return false;
  if(o.def.name==="Big Bloody Search, Inc.")return false;
  if(o.def.name==="Fran's Food"){
    const per=acquirer.portfolio.filter(x=>x.type==="Perishables").length;
    if(per<2)return false;
  }
  return true;
}
function doTakeover(o,from,to){
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
function swapOrgs(a,pa,b,pb){
  pa.portfolio.splice(pa.portfolio.findIndex(o=>o.uid===a.uid),1);
  pb.portfolio.splice(pb.portfolio.findIndex(o=>o.uid===b.uid),1);
  pa.portfolio.push(b);pb.portfolio.push(a);
}
function mergeCompatible(a,b){
  // same type always ok; plus special "merge with anything" USPs
  const anyMerge=["Speedy Courier Plus","Peachy 'n' Clean"];
  if(anyMerge.includes(a.def.name)||anyMerge.includes(b.def.name))return true;
  return a.type===b.type;
}
function doMerge(a,b,player){
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
function setGovernment(g,rulerId){
  S.government=g; S.ruler = rulerId;
  if(g==="Theocracy"){S.players.forEach(p=>{const idx=S.drawPile.findIndex(c=>c.cat==="Higher Power");if(idx>=0){p.hand.push(S.drawPile.splice(idx,1)[0]);enforceHandLimit(p);}});logEv("Theocracy: every player draws a Higher Power card.");}
  if(g==="Communism"){applyCommunism();}
}
function blockedGovChange(){
  if(S.activeHP.some(h=>h.name==="Electrobrainwash") && !cur().negatedHP.has("Electrobrainwash"))return true;
  if(S.activeHP.some(h=>h.name==="False Idol"))return true;
  return false;
}
function applyCommunism(){
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
function removeHP(name){
  S.activeHP=S.activeHP.filter(h=>h.name!==name);
  if(name==="Dolphins")S.dolphinsCountdown=null;
}

/* ---------- elimination / end ---------- */
function eliminate(player,reason){
  player.eliminated=true;
  logEv(`<b>${player.name} is OUT</b> — ${reason}.`);
}
function checkEliminationEnd(){
  const alive=S.players.filter(p=>!p.eliminated);
  if(alive.length<=1){endGame(alive.length?`${alive[0].name} is the last corporation standing.`:"Mutual destruction.");return true;}
  return false;
}
function checkEnd(){
  if(S.over)return;
  checkEliminationEnd();
}

/* ---------- turn flow ---------- */
function maybeEndTurn(){
  if(S.over)return;
  if(S.actions<=0) endTurn();
}
function endTurn(){
  if(S.over)return;
  // dolphins countdown
  if(S.dolphinsCountdown!=null){
    S.dolphinsCountdown--;
    if(S.dolphinsCountdown<=0){endGame("The dolphins have taken the world.");return;}
  }
  // advance
  S.current=1-S.current;
  // skip eliminated
  if(S.players[S.current].eliminated){endGame(`${S.players[1-S.current].name} wins by elimination.`);return;}
  S.turn++;
  S.actions=2;
  // start-of-turn government effects for ruler
  startOfTurnEffects();
  showPassScreen();
}
function startOfTurnEffects(){
  const me=cur();
  if(S.government==="Dictatorship" && S.ruler===me.id){
    const victim=opp(me.id);
    if(victim.hand.length){const idx=Math.floor(Math.random()*victim.hand.length);const c=victim.hand.splice(idx,1)[0];me.hand.push(c);enforceHandLimit(me);logEv(`Dictatorship: ${me.name} seized a random card from ${victim.name}.`);}
  }
}
function showPassScreen(){
  render();
  const sc=document.getElementById("passScreen");
  document.getElementById("passTitle").textContent=`${cur().name}, it's your turn`;
  document.getElementById("passSub").textContent=`Pass the device to ${cur().name}. The previous player's hand is now hidden.`;
  sc.classList.remove("hidden");
}

/* ---------- end game ---------- */
function endGame(reason){
  if(S.over)return;
  S.over=true;
  render();
  const sc=document.getElementById("overScreen");
  const s0=score(S.players[0]), s1=score(S.players[1]);
  let title="The world has ended", sub=reason;
  let winner;
  if(S.players[0].eliminated && !S.players[1].eliminated) winner=1;
  else if(S.players[1].eliminated && !S.players[0].eliminated) winner=0;
  else if(S.allied) winner=-1;
  else winner = s0===s1 ? -1 : (s0>s1?0:1);
  document.getElementById("overTitle").textContent=title;
  document.getElementById("overSub").textContent=sub;
  document.getElementById("overScores").innerHTML=
    `<div style="font-size:15px;line-height:1.8">
      ${S.players[0].name}: <b style="color:var(--gold)">${fmt(s0)}</b>${S.players[0].eliminated?" (out)":""}<br>
      ${S.players[1].name}: <b style="color:var(--gold)">${fmt(s1)}</b>${S.players[1].eliminated?" (out)":""}
     </div>
     <h2 style="margin-top:14px">${winner===-1?"It's a shared fate — a draw":S.players[winner].name+" wins"}</h2>`;
  sc.classList.remove("hidden");
}
