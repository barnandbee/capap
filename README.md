# Capitalist Apocalypse

A satirical card game where players build portfolios of organisations across six
sectors, weather shifting governments and world-ending "Higher Power" events, and
use action cards to grow, merge, steal, and sabotage their way to the highest live
portfolio value. Last empire standing — or richest one when the world ends — wins.

**▶ Play it: https://barnandbee.github.io/capap/** *(live once the Pages deploy runs — see below)*

The current build is a **two-player hotseat** game: fully self-contained in a single
HTML file, no dependencies, no build step. Players pass one device between turns.

---

## Playing locally

The game is built from ES modules, which browsers only load over http(s) — so serve
the folder with any static server rather than double-clicking the file:

```bash
# from the repo root
python3 -m http.server 8000      # then open http://localhost:8000
# or: npx serve .
```

No build step and no dependencies — the server just hands the static files to the
browser, which loads the module graph from `src/`.

## Testing

The engine core is DOM-free and runs under Node, so it has real automated tests
(no browser, no dependencies):

```bash
npm test          # runs node --test against tests/
```

## How to play

- Roll dice at setup to install the starting **government**.
- On your turn you get **2 actions**. Spend them to **draw**, **play a card**, or
  attempt an **overthrow** (coup).
- **Organisation** cards deploy into your portfolio and carry a live £bn value that
  shifts with governments, Higher Power events, and their own special abilities (USPs).
- **Action** cards let you grow, merge, take over, or sabotage.
- **Higher Power** cards are world events (floods, AI uprisings, crypto crashes) that
  reshape entire sectors.
- Some cards can be **countered** — when an opponent plays a counterable card, you're
  prompted (without revealing it) to respond from your hand.
- The game ends when the *Capitalist Apocalypse* card is played, *Dolphins* finish a
  flooded world, or a player is eliminated. **Highest live portfolio value wins.**

A full in-game rules panel is available from the setup screen.

---

## Deployment (GitHub Pages)

The site deploys automatically via GitHub Actions
(`.github/workflows/pages.yml`) on every push to `main`:

1. Merge this branch into `main`.
2. The workflow auto-enables Pages (if needed) and publishes the repo root.
3. The game goes live at `https://barnandbee.github.io/capap/`.

> One-time step: in **Settings → Pages**, ensure the build source is set to
> **GitHub Actions**. The workflow attempts to enable this automatically, but
> repository settings may require an admin to confirm it once.

Because the game is a single self-contained `index.html` at the repo root, it also
works with classic "deploy from branch" Pages if you prefer that route.

---

## Project layout

The game used to be one 1,300-line `index.html`. It's now ES modules under `src/`,
split into a **DOM-free engine** and a **browser UI/flow** layer (no build step):

```
index.html                    Markup + screens; loads src/main.js as a module
src/styles.css                All styles (retro-parchment design system)
src/engine/                   DOM-FREE CORE — runs in the browser AND under Node
  data.js                       Card data & constants (GOVS, HP, ACTIONS, ORGS …)
  deck.js                       Deck building (buildDeck, inst, shuffle)
  state.js                      Live game state `S`, newState, opp/cur, logEv
  value.js                      Value engine (orgValue, score)
  rules.js                      newGame, takeovers, merges, government, endgame, …
  index.js                      Barrel: import the whole engine from one place
src/ui/                       BROWSER ONLY
  art.js                        Seeded Julia-set card art (<canvas>)
  modal.js                      Async modal / pickOrg / note dialogs
  render.js                     render(), board, pass & game-over screens
src/flow.js                   Turn flow + counter orchestration (wires UI ↔ engine)
src/setup.js                  Dice-roll setup, startGame(), in-game rules text
src/main.js                   Browser entry point (the module index.html loads)
tests/engine.test.js          Node tests for the engine core (npm test)
docs/HANDOFF.md               Deep architecture reference — state, value engine, cards
.github/workflows/            pages.yml (deploy) · test.yml (run engine tests)
```

**The boundary that matters:** nothing in `src/engine/` touches the DOM, so the entire
game core runs under Node and is unit-tested directly. `src/flow.js` is where player
choices (modals, the counter screen) meet the engine — the natural seam where an AI
player will later call the same engine mutations a human does, minus the prompts.

`S` (the live game state) is exported as a live binding from `src/engine/state.js`;
only that module reassigns it (via `newGame`/`setActiveState`), so every other module
reads the current state through the import.

For deeper internals — every card format, USP, and house rule — see
**`docs/HANDOFF.md`**.

---

## Roadmap

This version is intentionally a single HTML file. The longer-term direction needs more
structure than one file can carry comfortably:

### Near term (quality-of-life, low risk)
- [ ] Player name input at setup (currently hardcoded "Player 1" / "Player 2")
- [ ] Wire the Happy Pill "Blind Spot" prompt (state already supports it)
- [ ] Persist a game in progress to `localStorage` so a reload doesn't lose it

### Medium term (the structural shift)
- [x] **Extract the engine from the HTML.** The monolith was split into `src/` files
  by concern (zero logic change).
- [x] **Convert `src/` to true ES modules** with explicit `import`/`export`, and pull
  the DOM-free core (`src/engine/`) behind a clean, headless API that runs under Node.
  This enforces the engine/UI boundary the AI work below needs.
- [x] **Automated engine tests** (`tests/engine.test.js`, run via `npm test` and in
  CI) covering the value engine, merges, takeovers, Communism, eliminations and the
  live-state binding.

### Long term (the headline features)
- [ ] **3+ player support.** State and rendering are already parameterised by player id;
  the work is generalising opponent targeting (`opp()` → a player picker) across the
  counter/takeover/merge flows.
- [ ] **Computer (AI) players**, so a single human can play solo against bots. The
  groundwork is now in place: the engine is headless and tested, and `src/flow.js` is
  the seam where decisions are made. The next concrete step is a move-generation layer
  (`legalMoves(state)` + `applyMove(state, move)`) over the engine, after which a
  heuristic bot (maximise portfolio value, counter when threatened) can drive the same
  API a human does before anything fancier.

See `docs/HANDOFF.md` §11 and §15 for the detailed gap list and suggested priorities.

---

## Credits

Game design and original single-file implementation predate this repository; see
`docs/HANDOFF.md` for the full handoff notes.
