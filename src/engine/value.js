/* Capitalist Apocalypse — value engine (DOM-free engine module).
   orgValue() / score() compute live £bn values from the current state. */
import { SECTORS } from "./data.js";
import { S } from "./state.js";

export function parseV(s){return parseFloat(String(s).replace("£","").replace("bn",""));}
export function fmt(n){
  const r=Math.round(n*1000)/1000;
  return "£"+ (Object.is(r,-0)?0:r) +"bn";
}
export function hpActiveFor(name,player){
  return S.activeHP.some(h=>h.name===name) && !player.negatedHP.has(name);
}
export function hasAllOtherSectors(player){
  const set=new Set(player.portfolio.map(o=>o.type));
  return SECTORS.filter(s=>s!=="Services").every(s=>set.has(s));
}
export function orgValue(o,player){
  let base = parseV(o.def.values[o.size]) * (o.mergeBonus||1);
  let v = base;
  const g = S.government;
  const F = n => hpActiveFor(n,player);
  switch(o.def.name){
    case "Big Ol' Oil 'n' Gas": if(F("Big Freeze")||F("Sea Rise")||F("Big Burn")||F("Dolphins")) return 0; break;
    case "Fit But You Know It Gyms": if(F("Dolphins")||F("Encounter of the Third Kind")) v*=2; break;
    case "RAIL CHOO CHOO": if(g==="Communism") v*=-1; break;
    case "H2OMG": if(F("Big Burn")) v=base*100; break;
    case "NeoMode Fashion": if(F("Big Burn")||F("Big Freeze")) v*=3; break;
    case "Imaginary Friends": if(F("Mass Robot Uprising")) v*=3; break;
    case "Hydropoly": if(F("Sea Rise")) v*=2; if(F("Big Burn")) v*=0.5; break;
    case "M. Smooth's Grooming": if(g==="Monarchy") v*=5; break;
    case "Pizza D. Action": if(F("Dolphins")) v*=5; break;
    case "Water Supply": if(F("Dolphins")) return 0; break;
    case "WOODOO'S": if(g==="Democracy") v*=2; if(g==="Communism") v*=0.5; break;
    case "Globo Bank TM": if(S.cryptoPlayed) return 0; break;
    case "The Great Health Service": if(g==="Communism"||S.anyHPPlayed){ v=base*2; if(v>200)v=200; } break;
    case "Space Programme": if(F("Encounter of the Third Kind")) v*=2; break;
    case "SOLAR 1000": if(F("Big Burn")) v=base*3; break;
    case "Blue Steel": if(F("Mass Robot Uprising")) v*=10; break;
    case "National Enforcement Force": if(g==="Anarchy") v*=5; break;
    case "Mortar & Brick Builders": if(hasAllOtherSectors(player)) v*=5; break;
  }
  const isSec = sec => o.def.type===sec || (F("Mass Robot Uprising") && o.def.type==="Tech");
  if(F("Cryptodisaster") && isSec("Tech")) return 0;
  if(F("Big Burn") && isSec("Public")) v*=2;
  if(F("Return of the Dinosaurs") && (isSec("Natural Resources")||isSec("Perishables"))) v*=2;
  if(o.def.name==="The Great Health Service" && v>200) v=200; // card states £200bn maximum
  return v;
}
export function score(player){
  if(S.allied){
    const all=[...S.players[0].portfolio,...S.players[1].portfolio];
    return all.reduce((t,o)=>t+orgValue(o,player),0);
  }
  return player.portfolio.reduce((t,o)=>t+orgValue(o,player),0);
}
