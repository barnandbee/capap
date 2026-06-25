# Capitalist Apocalypse — Claude Code Handoff

> **For:** Claude Code  
> **Prepared by:** Claude (claude.ai chat session)  
> **Files to expect from user:** `capitalist-apocalypse-game.html` (the full game), `Capitalist Apocalypse.docx` (original card design doc), `capitalist-apocalypse-game-reference.md` (structured card data reference), `capitalist-apocalypse.html` (original card-browser/viewer, separate from the game)

-----

## 1. What this project is

A two-player hotseat card game simulation — fully self-contained in a single HTML file, no dependencies, no build step. Players pass a device between turns.

The physical card game (“Capitalist Apocalypse”) has players building portfolios of organisations across six sectors, reacting to shifting governments and “Higher Power” world events, and using action cards to grow, merge, steal, or sabotage. The game ends when the *Capitalist Apocalypse* Higher Power card is played, when *Dolphins* finishes a flooded world, or when a player is eliminated. Winner is highest live portfolio value.

The simulation was written from scratch in the chat session. The HTML file is the entire thing: data, engine, UI, and art in one `<script>` block.

-----

## 2. File structure

Everything lives inside one `<script>` tag at the bottom of the HTML body. Sections are clearly commented with banner comments (`/* === NAME === */`). Reading order:

```
CARD DATA       — raw arrays: GOVS, GOV_TEXT, HP, ACTIONS, ORGS
BUILD DECK      — buildDeck(), inst(), shuffle()
STATE           — newState(), S (the live global state object), opp(), cur()
VALUE ENGINE    — orgValue(), score(), fmt(), hpActiveFor(), etc.
CARD ART        — fractal Julia-set generator, fractalCache, cardArt()
LOG + RENDER    — render(), seatEl(), orgMini(), handMini()
MODAL HELPER    — modal(), pickOrg(), note() — async UI dialogs
COUNTER SYSTEM  — counterCardsFor(), offerCounter(), counterFlow(), resolveCounter()
CORE TURN       — spend(), drawOne(), enforceHandLimit(), doDraw(), doOverthrow(), playCard()
HIGHER POWER    — playHP()
ACTION CARDS    — playAction() — large switch/case, one case per action name
HELPERS         — removeFromHand(), allOrgs(), canAffect(), canTakeover(), doTakeover(),
                  swapOrgs(), mergeCompatible(), doMerge()
GOVERNMENT      — setGovernment(), blockedGovChange(), applyCommunism(), removeHP()
ELIMINATION     — eliminate(), checkEliminationEnd(), checkEnd()
TURN FLOW       — maybeEndTurn(), endTurn(), startOfTurnEffects(), showPassScreen()
END GAME        — endGame()
SETUP           — buildGovGrid(), rollGov(), startGame(), RULES_HTML
WIRE UP         — event listener bindings (last 4 lines)
```

-----

## 3. Card data formats

### 3a. Governments

```js
const GOVS = ["Theocracy","Dictatorship","Democracy","Communism","Monarchy","Anarchy"];
// Index 0–5. Dice roll at setup maps 1–6 → index 0–5.
// Coup: roll a double → the number on both dice (1–6) installs GOVS[n-1].
```

### 3b. Higher Power cards

```js
const HP = [
  ["name", "description text"],  // 11 entries
];
```

### 3c. Action cards

```js
const ACTIONS = [
  ["name", "description text", quantity],  // quantity = copies in deck
];
// 30 unique actions, 66 total copies (sum of quantities).
```

### 3d. Organisation cards

```js
const ORGS = [
  ["name", "type", startingSizeIdx, ["£Sbn","£Ebn","£Gbn"], "×mergeStr", "usp text"],
  //                 0=Start-up                                 merge multiplier as string
  //                 1=Enterprise                               e.g. "×3", "×10 value", "×-1"
  //                 2=Giant
];
// 36 organisations across 6 sectors: Tech, Natural Resources, Perishables, Services, Wellbeing, Public
```

-----

## 4. Card instance structure

`buildDeck()` creates card instances using `inst(def)`. Each instance carries:

```js
// All cards:
{ uid: Number,       // unique per instance, used as identity key
  def: Object,       // the raw definition object (has .name, .text or .usp, etc.)
  cat: String,       // "Organisation" | "Action" | "Higher Power"
  type: String,      // sector name (org) or "Action" / "Higher Power"
  name: String       // shortcut to def.name
}

// Organisation cards additionally:
{ size: 0|1|2,           // current size (Start-up/Enterprise/Giant), mutated by play
  mergeBonus: Number,     // multiplier stored on the surviving card after a merge (default 1)
  takeoverResisted: Bool, // Drugtopia: true after its one free resistance is used
  tabletsUsed: Bool       // Tablets 'n' That: true after its one-time merger block is used
}
```

Action and HP cards are single-use: played → discarded to `S.discard`. Organisation cards played → `player.portfolio`. HP cards played → `S.activeHP` (array of `{name, card}`).

-----

## 5. Global state object `S`

```js
S = {
  players: [
    { id: 0,
      name: "Player 1",
      hand: [],            // card instances in hand (max 7)
      portfolio: [],       // org card instances in play
      eliminated: Bool,
      negatedHP: Set,      // Set of HP names negated for this player
      blindSpotAgainst: null | Number  // player id whose actions can't affect them (Happy Pill)
    },
    { /* same shape, id:1 */ }
  ],
  drawPile: [],     // shared deck, draw from front (shift), return to back (push)
  discard: [],      // spent action/hp cards — out of game
  activeHP: [],     // [{name, card}] — Higher Power cards currently in effect
  government: String | null,
  ruler: Number | null,    // player id of current ruler (null for Theocracy/Anarchy)
  current: 0|1,            // whose turn it is
  actions: Number,         // actions remaining this turn (starts at 2, decremented by spend())
  turn: Number,            // turn counter (increments each time current flips)
  log: [],                 // array of HTML strings, newest first, max 40
  cryptoPlayed: Bool,      // true once Cryptodisaster has ever been played (Globo Bank stays worthless)
  anyHPPlayed: Bool,       // true once any HP card played (triggers GHS doubling)
  allied: Bool,            // true if an alliance is active (shared portfolio value)
  dolphinsCountdown: null | Number,  // turns until Dolphins ends game (set to 2 when Dolphins plays)
  over: Bool               // true once endGame() fires
}
```

-----

## 6. Value engine

`orgValue(org, player)` — returns live £bn value of one organisation for a given player.

Order of operations inside `orgValue`:

1. Parse the card’s base value at current size (`def.values[org.size]`), multiply by `org.mergeBonus`.
1. Apply card-specific USP modifiers in a `switch(org.def.name)` block.
1. Apply global sector modifiers (Cryptodisaster zeroes tech, Big Burn doubles public, Dinosaurs doubles NatRes/Perishables).
1. Clamp The Great Health Service to £200bn.
1. Return `v`.

`hpActiveFor(name, player)` — returns `true` if the named HP card is in `S.activeHP` AND has not been negated for that player via `player.negatedHP`.

`score(player)` — sums `orgValue(o, player)` across `player.portfolio` (or combined portfolios if `S.allied`).

**House rules committed in the engine:**

- Merge result: `mergeBonus = (multiplier × combinedCurrentValue) / survivingCardGiantBase`. Surviving card is set to Giant. The other card is removed from portfolio.
- Mass Robot Uprising: tech organisations count as every sector for bonus/merge purposes (implemented in sector checks via `isSec()` helper inside `orgValue`).
- GHS hard cap: £200bn regardless of stacking.

-----

## 7. Turn flow

```
startGame()
  → showPassScreen()     ← "pass device, then reveal"
      → revealBtn click  ← unhides board for current player
          → player takes up to 2 actions:
              doDraw()         ← spend 1 action, draw 1 card
              playCard(card)   ← spend 1 action, route to playHP / playAction / deploy org
              doOverthrow()    ← spend 2 actions, roll dice, attempt coup
          → endTurn() when actions=0 or player clicks "End turn / Pass"
              → dolphinsCountdown check
              → flip S.current (0↔1)
              → increment S.turn, reset S.actions=2
              → startOfTurnEffects() (e.g. Dictatorship card theft)
              → showPassScreen()
```

`maybeEndTurn()` is called after each action to auto-end if actions hit 0.

-----

## 8. Counter system

When the active player plays a counterable card, `offerCounter(actorId, event)` is called **before** `apply()` executes. It:

1. Checks `counterCardsFor(responder, event)` — builds a list of valid response cards/abilities.
1. If non-empty, shows `#counterScreen` (hidden, device-pass prompt — doesn’t reveal what the card is).
1. If the responder clicks “View my cards”, shows a modal with their response options.
1. Returns `true` (cancelled) if the action was blocked, `false` otherwise.

**Counterable action events:** `Stock Crash`, `Build Stock`, `CEO Scandal`, `It's 1929`, `The New Deal`, `Rainbow Unicorn`, `Hostile Takeover`, `Regular Takeover`, `Angel Investor`, `Merger`, `Force An Alliance`, `Dragon's Den`.

**Counter cards mapped:**

|Trigger                                           |Counter card                                        |
|--------------------------------------------------|----------------------------------------------------|
|Any action or HP                                  |Absolutely Not, Mate (roll a double to reverse)     |
|Takeover / merger                                 |Lawsuit (cancel)                                    |
|Merger                                            |Tablets ‘n’ That USP (one-time block from portfolio)|
|Big Freeze                                        |Big Coat                                            |
|Big Burn                                          |Big Sun Hat                                         |
|Sea Rise                                          |Big Surfboard                                       |
|False Idol                                        |Alejandra, God Of Apocalypta                        |
|Dolphins / Dinosaurs / Third Kind                 |Dr. Dolittle                                        |
|Robot Uprising / Electrobrainwash / Cryptodisaster|Luddite Uprising                                    |

**Not yet wired as counters:** `Independence Day` (requires both players to roll; currently played proactively from hand, not as a response). `Absolutely Not, Mate` and `Lawsuit` show a note if played proactively telling the player they’re response cards.

-----

## 9. Government effects — what’s implemented

|Government  |Implemented behaviour                                                                                                                                                                         |
|------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Theocracy   |On install: each player draws one HP card from the deck. No per-turn ruler effect.                                                                                                            |
|Dictatorship|`ruler` = the player who triggered the change. At start of their turn: steal one random card from opponent’s hand.                                                                            |
|Democracy   |`ruler` = random player (coin flip at setup, re-rolled on government change). Per-turn effect (draw 3, resize one org) is **not yet** enforced by the engine — the ruler just has `ruler` set.|
|Communism   |On install: `applyCommunism()` pools all orgs in play and in hand, reallocates evenly (Bill’s Local News stays). Value modifiers (RAIL ×-1, WOODOO’S ×0.5, GHS ×2) active in `orgValue`.      |
|Monarchy    |`ruler` = random player. M. Smooth’s ×5 and Mrs. Stone free-merge active in engine. Per-turn “freely choose card types” is not enforced.                                                      |
|Anarchy     |`ruler = null`. NEF ×5 in engine. Mergers blocked by check in `playAction`. Takeover Anarchy double-grab implemented in `doTakeover`.                                                         |

**Democracy and Monarchy per-turn privileges** (draw 3 / resize once; free card type choice) are noted as open gaps — not enforced per turn, relying on player honour.

-----

## 10. Organisation USPs — implementation status

All 36 USPs are represented in the value engine or as gameplay guards. A quick audit:

|Card                      |USP mechanism                                                                                                                                                        |
|--------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Tablets ‘n’ That          |`tabletsUsed` flag on instance; checked in `counterCardsFor`                                                                                                         |
|Big Ol’ Oil ‘n’ Gas       |Zeroed in `orgValue` under Big Freeze / Sea Rise / Big Burn / Dolphins                                                                                               |
|BESCO                     |Merge-compatible with tech — handled in `mergeCompatible()`                                                                                                          |
|Big Bloody Search         |`canTakeover()` returns false; elimination if held during Cryptodisaster                                                                                             |
|Speedy Courier Plus       |`mergeCompatible()` — can merge with all                                                                                                                             |
|Fit But You Know It Gyms  |×2 in `orgValue` under Dolphins / Third Kind                                                                                                                         |
|RAIL CHOO CHOO            |×-1 in `orgValue` under Communism                                                                                                                                    |
|Peachy ‘n’ Clean          |`mergeCompatible()` — can merge with all                                                                                                                             |
|Good Mind, Inc.           |Merger multiplier → ×20 if partner is Tech, in `doMerge()`                                                                                                           |
|National Enforcement Force|×5 in `orgValue` under Anarchy                                                                                                                                       |
|H2OMG                     |×100 base in `orgValue` under Big Burn                                                                                                                               |
|NeoMode Fashion           |×3 in `orgValue` under Big Burn or Big Freeze                                                                                                                        |
|Imaginary Friends         |×3 in `orgValue` under Mass Robot Uprising                                                                                                                           |
|Hydropoly                 |×2 Sea Rise / ×0.5 Big Burn in `orgValue`                                                                                                                            |
|Some Sort Of Social Media |USP (choose government when merged with Services) is **not yet implemented**                                                                                         |
|Drugtopia                 |`takeoverResisted` flag; absorbs one takeover in `doTakeover()`                                                                                                      |
|M. Smooth’s Grooming      |×5 in `orgValue` under Monarchy                                                                                                                                      |
|Pizza D. Action           |×5 in `orgValue` under Dolphins                                                                                                                                      |
|Water Supply              |Worthless under Dolphins; can merge-all under Big Burn — partially implemented (worthless done; mass-merge USP not automated)                                        |
|Fibre 2 Fibre             |Merge only with Tech — not yet enforced in `mergeCompatible()`                                                                                                       |
|Golden Carrot Health Foods|×5 merge with Perishables in `doMerge()`                                                                                                                             |
|A-Video                   |Elimination on Cryptodisaster (checked in `playHP`)                                                                                                                  |
|WOODOO’S                  |×2 Democracy / ×0.5 Communism in `orgValue`                                                                                                                          |
|Globo Bank TM             |Worthless once `S.cryptoPlayed` in `orgValue`                                                                                                                        |
|The Great Health Service  |×2 under Communism or after any HP; capped at £200bn                                                                                                                 |
|Mrs. Stone                |“Merge free” under Monarchy — **not yet implemented** (merge still costs an action card)                                                                             |
|Data Share, Inc.          |Elimination on Cryptodisaster                                                                                                                                        |
|Space Programme           |×2 under Third Kind in `orgValue`                                                                                                                                    |
|Broadband, Baby!          |Merge with Services — handled in `mergeCompatible()`                                                                                                                 |
|SOLAR 1000                |×3 under Big Burn in `orgValue`                                                                                                                                      |
|Bill’s Local News         |Exempt from Communism pool in `applyCommunism()`                                                                                                                     |
|Happy Pill                |`blindSpotAgainst` set on owner; `canAffect()` checks it — **partially wired but the Blind Spot modal to pick the target player is not in the current playCard flow**|
|Blue Steel                |×10 under Mass Robot Uprising in `orgValue`                                                                                                                          |
|Fran’s Food               |`canTakeover()` checks acquirer has 2+ Perishables                                                                                                                   |
|Globocorp TM              |×2 (small/enterprise) / ×-1 (giant) in `doMerge()`                                                                                                                   |
|Mortar & Brick Builders   |×5 if owner holds all other 5 sectors — `hasAllOtherSectors()` in `orgValue`                                                                                         |

-----

## 11. Known gaps and open items

These are the things the current version leaves for follow-up:

### Gameplay gaps

- **Happy Pill flow**: the Blind Spot prompt (pick which player is negated) never fires when Happy Pill is played. `blindSpotAgainst` exists on state but is never set. Fix: in `playAction`, case `"Happy Pill"` should prompt the active player to name an opponent (with only 2 players this is trivial) and set `opp(S.current).blindSpotAgainst = S.current` (or the reverse, depending on interpretation of the card).
- **Some Sort Of Social Media**: USP “when merged with a services org, you may choose the government” is not triggered by the merge flow.
- **Water Supply mass-merge**: “can merge with all organisations in one go in Big Burn” — the current merger flow only merges two at a time.
- **Fibre 2 Fibre**: “Can merge only with tech sector” is not enforced — currently allows any same-type merge.
- **Mrs. Stone free merge under Monarchy**: costs an action card like any other merge.
- **Democracy ruler privileges**: draw 3 / resize one org are not enforced per turn (relying on honour).
- **Monarchy ruler privilege**: freely choose card type not enforced.
- **Independence Day as response**: currently treated as a proactive card. Should interrupt when an HP card is played.
- **Big Bloody Search takeover immunity**: confirmed in `canTakeover()`. However the current wording on the physical card says you also lose if it’s in play during Cryptodisaster — this IS implemented (eliminates the holder).
- **Anarchy — “every takeover yields 2 organisations”**: implemented as seizing a second random org from the same portfolio, but only if one is available and not Drugtopia/Big Bloody Search — this is an approximation.

### UX gaps

- **Player names**: hardcoded as “Player 1” / “Player 2”. Should be settable at setup.
- **Rulebook / reference**: in-game rules panel is brief; could expand.
- **Scrolling hand on mobile**: works but tight on small screens. Cards could stack vertically or use a carousel.
- **Fractal art generation**: all 77 unique fractals are generated synchronously on first render. On slow devices this could cause a pause. Could be deferred/async or pre-generated progressively.

### Structural improvements

- The entire game is a single HTML file. That’s fine for now, but extracting the data arrays (`GOVS`, `HP`, `ACTIONS`, `ORGS`) to a separate `data.js` would make the engine easier to maintain as the game evolves.
- No persistence (localStorage or otherwise). A game in progress can’t be resumed after a page reload.

-----

## 12. Visual design system

The look is deliberately retro-parchment. Do not introduce a white/clean modern aesthetic — it would clash.

```css
/* Core palette */
--ink: #1a1410           /* dark brown-black — text on light */
--paper: #efe7d6         /* warm parchment — card backgrounds */
--paper-deep: #e2d6bd    /* slightly darker parchment — button default */
--paper-hi: #f7f1e3      /* lighter parchment — modal option hover */
--gold: #c9a227          /* accent — highlights, active states */
--vermilion: #c8462f     /* red-orange — primary action, stamps */
--teal: #2f6f6a          /* tech sector colour */
--shadow: rgba(26,20,16,0.28)
--line: rgba(26,20,16,0.25)
```

**Sector colours** (used on badge chips and fractal tinting):

```js
const TYPE_COLORS = {
  Tech: "#2f6f6a",
  "Natural Resources": "#7a5a2e",
  Perishables: "#c8462f",
  Services: "#3a5a8c",
  Wellbeing: "#7a3a7a",
  Public: "#4a4a4a",
  "Higher Power": "#8a1c4a",
  Action: "#a8761c"
};
```

**Typography:** `"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif` for body. `"EB Garamond", Garamond, "Times New Roman", serif` for headings and card names.

**Card art:** Each card has a 144×58px Julia-set fractal illustration (`<div class="art">`) generated by `makeFractal(seed, colorHex)`. The seed is the card’s name, so it’s deterministic — same card always gets the same image. The art is cached in `fractalCache` (a `Map` keyed by name). Art is tinted in the sector colour, fading from parchment (fast-escape) through tint (near-boundary) to ink-dark (interior).

-----

## 13. Screen / overlay system

Five full-screen overlays with `position:fixed; z-index:50+`:

|ID              |Purpose                             |Hidden by default?                        |
|----------------|------------------------------------|------------------------------------------|
|`#setupScreen`  |Opening dice roll for government    |No (shown first)                          |
|`#passScreen`   |“Pass the device” between turns     |Yes                                       |
|`#counterScreen`|“You may respond” hidden-hand prompt|Yes                                       |
|`#overScreen`   |Game over / winner announcement     |Yes                                       |
|`#modalMount`   |Dynamically appended modal dialogs  |Empty div (modals added/removed on demand)|

The modal system (`modal()`, `pickOrg()`, `note()`) is async/await — it returns a Promise that resolves when the player makes a choice or clicks Cancel. This means `playAction()` and `playHP()` can `await` user choices mid-function, which keeps action logic readable and linear.

-----

## 14. How to run

Open the HTML file in any modern browser. No server needed — it’s a static file. Everything is inline.

To test a specific scenario without playing through, you can open the browser console and mutate `S` directly:

```js
// Example: trigger Cryptodisaster immediately
S.activeHP.push({name:"Cryptodisaster", card:null});
S.cryptoPlayed = true;
render();

// Example: give Player 1 a specific card from the draw pile
const idx = S.drawPile.findIndex(c => c.def.name === "Drugtopia");
S.players[0].hand.push(S.drawPile.splice(idx, 1)[0]);
render();

// Example: check live scores
console.log(score(S.players[0]), score(S.players[1]));
```

-----

## 15. Suggested next priorities

In rough order of impact:

1. **Player name input** at setup — trivial change, big quality-of-life improvement.
1. **Happy Pill Blind Spot flow** — state is ready, just needs the modal prompt wired into `playAction`.
1. **Democracy / Monarchy per-turn privilege enforcement** — add a `rulerActions` counter alongside `S.actions` and expose a “Use ruler privilege” button in the dock when it’s the ruler’s turn.
1. **Fibre 2 Fibre merge restriction** — one-line guard in `mergeCompatible()`.
1. **Some Sort Of Social Media USP** — trigger a `Rebellion`-style government picker after a qualifying merge.
1. **3+ player support** — state and render are already parameterised by player id; `opp()` would need to return an array; counter/takeover targeting would need a player-picker modal.
1. **Persistent game state** — `localStorage.setItem('ca-state', JSON.stringify(S))` on every state change; restore on load.
1. **Sound/animation** — the `.card.flip` CSS transition exists from the original card-browser; a similar flip could be added when cards are played.