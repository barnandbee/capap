"use strict";
/* Capitalist Apocalypse — deck building
   Part of the multi-file split (see README). Loaded as a classic <script>;
   all modules share one global scope until the planned ES-module step. */

/* ============================================================
   BUILD DECK
   ============================================================ */
let UID=1;
function mkAction(a){return {cat:"Action",type:"Action",name:a[0],text:a[1],qty:a[2]};}
function mkHP(h){return {cat:"Higher Power",type:"Higher Power",name:h[0],text:h[1]};}
function mkOrg(o){return {cat:"Organisation",type:o[1],name:o[0],sizeIdx:o[2],values:o[3],merge:o[4],usp:o[5]};}
function buildDeck(){
  const deck=[];
  ACTIONS.forEach(a=>{const d=mkAction(a);for(let i=0;i<a[2];i++)deck.push(inst(d));});
  HP.forEach(h=>deck.push(inst(mkHP(h))));
  ORGS.forEach(o=>deck.push(inst(mkOrg(o))));
  return deck;
}
function inst(def){
  const c={uid:UID++,def,cat:def.cat,type:def.type,name:def.name};
  if(def.cat==="Organisation"){c.size=def.sizeIdx;c.mergeBonus=1;c.takeoverResisted=false;c.tabletsUsed=false;}
  return c;
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
