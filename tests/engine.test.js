/* Engine tests — run with `npm test` (node --test).
   These exercise the DOM-free engine directly, with no browser. */
import test from "node:test";
import assert from "node:assert/strict";

import {
  GOVS, HP, ACTIONS, ORGS,
  buildDeck, inst, mkOrg, shuffle,
  S, setActiveState, newState, newGame,
  parseV, orgValue, score, hpActiveFor,
  doMerge, doTakeover, canTakeover, mergeCompatible,
  setGovernment, applyCommunism, eliminate, checkEliminationEnd, endGame,
  counterCardsFor
} from "../src/engine/index.js";

/** Build an organisation instance by card name straight from ORGS. */
function org(name){
  const def = ORGS.find(o => o[0] === name);
  assert.ok(def, `unknown org ${name}`);
  return inst(mkOrg(def));
}
/** Fresh empty 2-player state, ready to poke at. */
function blank(){ setActiveState(newState()); return S; }

test("deck composition matches the card data", () => {
  const deck = buildDeck();
  const actionCopies = ACTIONS.reduce((t, a) => t + a[2], 0);
  assert.equal(deck.filter(c => c.cat === "Action").length, actionCopies);
  assert.equal(deck.filter(c => c.cat === "Higher Power").length, HP.length);
  assert.equal(deck.filter(c => c.cat === "Organisation").length, ORGS.length);
  assert.equal(deck.length, actionCopies + HP.length + ORGS.length);
});

test("live `S` binding updates for all engine modules after newGame", () => {
  const before = S;
  newGame("Democracy", 0);
  assert.notEqual(S, before, "S should be reassigned");
  // value.js reads the SAME live S — if the binding were stale this would throw
  assert.equal(typeof score(S.players[0]), "number");
  assert.equal(S.government, "Democracy");
});

test("newGame deals five cards each and sets the government", () => {
  newGame("Theocracy", null);
  assert.equal(S.players[0].hand.length, 5);
  assert.equal(S.players[1].hand.length, 5);
  assert.equal(S.government, "Theocracy");
  assert.equal(S.current, 0);          // no ruler -> player 0 starts
});

test("orgValue: base value scales with size and mergeBonus", () => {
  blank();
  const a = org("A-Video"); // [£0.1, £1, £30]
  a.size = 2;
  assert.equal(orgValue(a, S.players[0]), 30);
  a.mergeBonus = 3;
  assert.equal(orgValue(a, S.players[0]), 90);
});

test("orgValue: RAIL CHOO CHOO flips negative under Communism", () => {
  blank();
  const rail = org("RAIL CHOO CHOO"); rail.size = 2; // -100
  S.government = "Anarchy";
  assert.equal(orgValue(rail, S.players[0]), -100);
  S.government = "Communism";
  assert.equal(orgValue(rail, S.players[0]), 100);
});

test("orgValue: Great Health Service doubles but caps at 200", () => {
  blank();
  const ghs = org("The Great Health Service"); ghs.size = 2; // base 100
  S.anyHPPlayed = true;
  assert.equal(orgValue(ghs, S.players[0]), 200); // 100*2 capped
});

test("orgValue: Cryptodisaster zeroes tech; Globo Bank stays dead", () => {
  blank();
  const tech = org("A-Video"); tech.size = 2;
  S.activeHP.push({ name: "Cryptodisaster", card: null });
  S.cryptoPlayed = true;
  assert.equal(orgValue(tech, S.players[0]), 0);
  const globo = org("Globo Bank TM"); globo.size = 2;
  assert.equal(orgValue(globo, S.players[0]), 0);
});

test("orgValue: negatedHP exempts a player from a Higher Power", () => {
  blank();
  const tech = org("A-Video"); tech.size = 2;
  S.activeHP.push({ name: "Cryptodisaster", card: null });
  assert.equal(orgValue(tech, S.players[0]), 0);
  S.players[0].negatedHP.add("Cryptodisaster");
  assert.equal(orgValue(tech, S.players[0]), 30);
  assert.equal(hpActiveFor("Cryptodisaster", S.players[0]), false);
});

test("score sums a portfolio; alliance combines both", () => {
  blank();
  const a = org("A-Video"); a.size = 2;        // 30
  const b = org("Pizza D. Action"); b.size = 2; // 10
  S.players[0].portfolio.push(a);
  S.players[1].portfolio.push(b);
  assert.equal(score(S.players[0]), 30);
  S.allied = true;
  assert.equal(score(S.players[0]), 40);
});

test("doMerge: same-sector merge → Giant; Good Mind ×20 with tech", () => {
  blank();
  const gm = org("Good Mind, Inc.");  gm.size = 1;  // Wellbeing
  const tech = org("A-Video"); tech.size = 1;       // Tech partner
  const p = S.players[0];
  p.portfolio.push(gm, tech);
  doMerge(gm, tech, p);
  assert.equal(p.portfolio.length, 1, "partner removed");
  assert.equal(gm.size, 2, "survivor becomes Giant");
  // combined current base = £0.2 + £1 = 1.2, ×20 = 24
  assert.ok(Math.abs(orgValue(gm, p) - 24) < 1e-9, `got ${orgValue(gm, p)}`);
});

test("doTakeover: Drugtopia resists once, then can be taken", () => {
  blank();
  const drug = org("Drugtopia");
  const from = S.players[1], to = S.players[0];
  from.portfolio.push(drug);
  doTakeover(drug, from, to);
  assert.equal(from.portfolio.length, 1, "first attempt resisted");
  assert.equal(drug.takeoverResisted, true);
  doTakeover(drug, from, to);
  assert.equal(to.portfolio.length, 1, "second attempt succeeds");
  assert.equal(from.portfolio.length, 0);
});

test("canTakeover: Big Bloody Search immune; Fran's Food needs 2 perishables", () => {
  blank();
  const me = S.players[0], owner = S.players[1];
  assert.equal(canTakeover(org("Big Bloody Search, Inc."), me, owner), false);
  const fran = org("Fran's Food");
  assert.equal(canTakeover(fran, me, owner), false);
  me.portfolio.push(org("Pizza D. Action"), org("BESCO")); // 2 perishables
  assert.equal(canTakeover(fran, me, owner), true);
});

test("mergeCompatible: same type or a 'merge with anything' USP", () => {
  blank();
  assert.equal(mergeCompatible(org("A-Video"), org("Data Share, Inc.")), true); // both Tech
  assert.equal(mergeCompatible(org("A-Video"), org("Pizza D. Action")), false);  // Tech vs Perishables
  assert.equal(mergeCompatible(org("Speedy Courier Plus"), org("Pizza D. Action")), true); // any-merge USP
});

test("Communism pools orgs but Bill's Local News stays put", () => {
  blank();
  const bill = org("Bill's Local News");
  const other = org("A-Video");
  S.players[0].portfolio.push(bill, other);
  applyCommunism();
  // Bill stays with player 0; every org is still somewhere in play
  assert.ok(S.players[0].portfolio.includes(bill));
  const all = [...S.players[0].portfolio, ...S.players[1].portfolio];
  assert.ok(all.includes(other));
  assert.equal(all.length, 2);
});

test("setGovernment(Theocracy) makes every player draw a Higher Power", () => {
  newGame("Anarchy", null);
  const before = S.players.map(p => p.hand.filter(c => c.cat === "Higher Power").length);
  setGovernment("Theocracy", null);
  const after = S.players.map(p => p.hand.filter(c => c.cat === "Higher Power").length);
  assert.ok(after[0] >= before[0] && after[1] >= before[1]);
});

test("endGame records a pure result; elimination ends the game", () => {
  blank();
  S.players[0].portfolio.push(Object.assign(org("A-Video"), { size: 2 })); // worth 30
  endGame("test over");
  assert.equal(S.over, true);
  assert.deepEqual(S.result.scores, [30, 0]);
  assert.equal(S.result.winner, 0);

  blank();
  eliminate(S.players[1], "test");
  assert.equal(checkEliminationEnd(), true);
  assert.equal(S.over, true);
  assert.equal(S.result.winner, 0);
});

test("counterCardsFor surfaces the right responses", () => {
  blank();
  const responder = S.players[1];
  responder.hand.push(inst({ cat:"Action", type:"Action", name:"Lawsuit", text:"" }));
  const vsTakeover = counterCardsFor(responder, { kind:"action", name:"Hostile Takeover", actorId:0 });
  assert.ok(vsTakeover.some(o => o.type === "lawsuit"));
  const vsStockCrash = counterCardsFor(responder, { kind:"action", name:"Stock Crash", actorId:0 });
  assert.equal(vsStockCrash.length, 0, "Lawsuit does not answer Stock Crash");
});
