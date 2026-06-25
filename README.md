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

No server or install needed — it's a static file:

```bash
# clone, then just open the file
open index.html          # macOS
xdg-open index.html      # Linux
# or double-click index.html in a file browser
```

Everything (game data, engine, UI, and the generative card art) lives inline in
`index.html`.

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

```
index.html                    The entire game (data, engine, UI, art)
docs/HANDOFF.md               Deep architecture reference — state shape, turn flow,
                              value engine, card formats, known gaps
.github/workflows/pages.yml   GitHub Pages deployment
.nojekyll                     Serve files as-is (no Jekyll processing)
```

For anyone working on the engine, **`docs/HANDOFF.md` is the map**: it documents the
global state object, the value engine, the counter system, every card format, and the
current list of known gaps and house rules.

---

## Roadmap

This version is intentionally a single HTML file. The longer-term direction needs more
structure than one file can carry comfortably:

### Near term (quality-of-life, low risk)
- [ ] Player name input at setup (currently hardcoded "Player 1" / "Player 2")
- [ ] Wire the Happy Pill "Blind Spot" prompt (state already supports it)
- [ ] Persist a game in progress to `localStorage` so a reload doesn't lose it

### Medium term (the structural shift)
- [ ] **Extract the engine from the HTML.** Split the data arrays and game logic out of
  `index.html` into modules (e.g. `data.js`, `engine.js`, `ui.js`) so the rules can
  evolve without scrolling a 1,300-line file. This is the prerequisite for everything
  below.
- [ ] Move to a small build/dev setup (a static bundler) while keeping the output a
  deployable static site for Pages.

### Long term (the headline features)
- [ ] **3+ player support.** State and rendering are already parameterised by player id;
  the work is generalising opponent targeting (`opp()` → a player picker) across the
  counter/takeover/merge flows.
- [ ] **Computer (AI) players**, so a single human can play solo against bots. This is
  the main reason the engine needs to come out of the UI layer: a headless engine with a
  clean "given this state, choose a legal move" interface lets an AI drive the same API a
  human does. Start with a heuristic bot (maximise portfolio value, counter when
  threatened) before anything fancier.

See `docs/HANDOFF.md` §11 and §15 for the detailed gap list and suggested priorities.

---

## Credits

Game design and original single-file implementation predate this repository; see
`docs/HANDOFF.md` for the full handoff notes.
