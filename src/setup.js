"use strict";
/* Capitalist Apocalypse — setup, dice roll & rules text
   Part of the multi-file split (see README). Loaded as a classic <script>;
   all modules share one global scope until the planned ES-module step. */

/* ============================================================
   SETUP
   ============================================================ */
function buildGovGrid(){
  const g=document.getElementById("govGrid");
  g.innerHTML=GOVS.map((n,i)=>`<div class="pick" id="gp${i}"><div class="num">${i+1}</div><div class="nm">${n}</div></div>`).join("");
}
let chosenGov=null, chosenRuler=null;
function rollGov(){
  const die=document.getElementById("setupDie");
  let ticks=0;
  const faces=["⚀","⚁","⚂","⚃","⚄","⚅"];
  const iv=setInterval(()=>{
    const r=Math.floor(Math.random()*6);
    die.textContent=faces[r];
    document.querySelectorAll(".pick").forEach((e,i)=>e.style.outline=i===r?"3px solid var(--gold)":"none");
    if(++ticks>12){
      clearInterval(iv);
      const final=Math.floor(Math.random()*6);
      die.textContent=faces[final];
      document.querySelectorAll(".pick").forEach((e,i)=>e.style.outline=i===final?"3px solid var(--gold)":"none");
      chosenGov=GOVS[final];
      // ruler-relevant govs: Dictatorship/Democracy/Monarchy have a ruler. Decide by a quick high-roll.
      chosenRuler = ["Dictatorship","Democracy","Monarchy"].includes(chosenGov) ? Math.floor(Math.random()*2) : null;
      document.getElementById("rollGovBtn").classList.add("hidden");
      const start=document.getElementById("startGameBtn");
      start.classList.remove("hidden");
      start.textContent=`Begin under ${chosenGov}`;
    }
  },70);
}
function startGame(){
  S=newState();
  S.drawPile=shuffle(buildDeck());
  // deal 5 each
  for(let k=0;k<5;k++){S.players[0].hand.push(S.drawPile.shift());S.players[1].hand.push(S.drawPile.shift());}
  S.government=chosenGov;
  S.ruler=chosenRuler;
  S.current = chosenRuler!=null ? chosenRuler : 0;
  S.actions=2;
  logEv(`The world begins under <b>${chosenGov}</b>${chosenRuler!=null?` — ${S.players[chosenRuler].name} rules`:""}.`);
  if(chosenGov==="Communism")applyCommunism();
  document.getElementById("setupScreen").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("rulesText").innerHTML=RULES_HTML;
  startOfTurnEffects();
  showPassScreen();
}

const RULES_HTML=`
<b>Turn:</b> two actions per turn. Each action is either <i>Draw a card</i> or <i>Play a card</i>; you may repeat. Overthrowing the government uses both actions.<br><br>
<b>Hand:</b> start with 5, hold up to 7. Excess cards return to the bottom of the draw pile.<br><br>
<b>Deck:</b> Action, Organisation and Higher Power cards are shuffled into one pile. Government is set by the opening dice roll and only changes via <i>Rebellion</i> or a successful coup (roll any double — its number, 1–6, installs that government).<br><br>
<b>Counters (key set):</b> when you play certain cards your opponent is offered a hidden chance to respond with <i>Absolutely Not, Mate</i> (roll a double to reverse), <i>Lawsuit</i> (block a takeover/merger), the Higher-Power negators (Big Coat / Sun Hat / Surfboard / Dr. Dolittle / Luddite Uprising / Alejandra), or the Tablets 'n' That merger block.<br><br>
<b>Merge maths (house rule):</b> merging two same-sector cards makes one Giant whose live value ≈ <i>merge multiplier × combined current value</i>. USP boosts (Good Mind ×20 w/ tech, Golden Carrot ×5 w/ perishables, Globocorp rules) override the base multiplier.<br><br>
<b>Mass Robot Uprising (house rule):</b> tech organisations count as <i>every</i> sector, so they pick up Big Burn / Dinosaurs bonuses and can merge with anything.<br><br>
<b>Win:</b> highest live portfolio value when the game ends — either the <i>Capitalist Apocalypse</i> card is played, the <i>Dolphins</i> finish a flooded world, or a player is eliminated (e.g. holding A-Video / Data Share / Big Bloody Search during Cryptodisaster).<br><br>
<b>Alliances</b> combine both portfolios into a shared value; with two players that means a shared (draw) victory until broken.`;
