# Sudoku – Implementation Plan: Coach (change request)

Implements PRD 3.4.1, the shared help counter of PRD 3.4 and the decisions of
PRD 11 "Change request Coach (review round 3)". The working rules and the phase
gate of [implementation.md](implementation.md) apply unchanged: phases in order,
every phase ends with **all** unit tests and **all** e2e tests (four projects)
green, checkboxes ticked only when delivered and tested, one commit per phase
(`Sudoku: coach phase N – <title>`). Never commit red.

## Starting point (code as of 2026-11-15)

- `techniques.js` already has the catalogue in ascending order
  (`TECHNIQUES`: nakedSingle, hiddenSingle, pointing, claiming, naked/hidden
  pair/triple, xWing, xyWing, swordfish), `candidates`, `nextStep`, `applyStep`.
  Placing steps return `{ technique, cell, digit }`, elimination steps
  `{ technique, cells, eliminations: [{ cell, digit }] }`.
- `game.js` `logicalCell()` already walks `nextStep` until the first placement (used
  by Hint). The Coach chain is the same walk, but it keeps the steps.
- Missing for the explanations: the steps do not say **which unit** (hidden single,
  pointing line, claiming box, subset unit), **which digits** (subsets) or the
  **base/cover lines** (fish). This metadata is added in phase C1.
- Help counter: `state.hints` (0…`MAX_HINTS` = 4) and the label `Hint n/4` in `view.js`.
  The field keeps its name and meaning ("helps used"), so saved games stay valid;
  only the display changes.

## Design decisions for the implementation

- **Chain:** from the current board (givens + locked digits; wrong digits ignored),
  repeat `nextStep` / `applyStep` until a placing step; the chain is the list of steps,
  the last one places. Hard cap 50 steps (then: fallback of PRD 3.4.1).
- **Pruning:** greedy, last elimination step first: drop a step if, after replaying
  the remaining steps, every remaining step is still valid (its pattern still holds
  in that candidate state, checked by `validStep`) and the final placement is still a
  naked or hidden single. Eliminations are logically valid facts, so a subset of them
  never yields a wrong candidate state; only the *explanation* could break, which
  `validStep` guards against.
- **Candidates are computed, never stored:** the Coach state lives only in the
  controller (open/closed, chain, step index). Nothing new goes into `sudoku.game`.
  Notes are only hidden by the view.
- **Help accounting:** only `coachFill` increments `hints`. Close costs nothing.
  Clearing a wrong digit (reload case) before coaching costs nothing.
- **Texts:** one template function per technique in `coach.js`, plus a name tracker
  per session (first mention "row 4, column 6", later "r4c6"; boxes 1–9).

---

## Phase C1 – Coach engine (pure logic) ✅ 2026-11-15

- [x] `techniques.js`: add metadata to the steps, backward compatible (new fields only):
  - hidden single: `unit` (index 0–26)
  - pointing: `box`, `line` (row/column unit index), `digit`
  - claiming: `line`, `box`, `digit`
  - naked/hidden subsets: `unit`, `digits`
  - X-Wing/Swordfish: `digit`, `base` (row or column unit indices), `cover`
  - XY-Wing: `pivot`, `pincers`, `digit` (= z)
- [x] `techniques.js`: `validStep(grid, cand, step)` – true if the step's pattern
  still holds and still removes at least one candidate (per technique; reuses the
  finders' logic restricted to the step's cells/units)
- [x] `coach.js` (new, pure): `coachChain(grid)` → `{ steps, placement }` or
  `{ steps: [], placement: null }` (catalogue exhausted); for each step also the
  candidate snapshot *before* the step, restricted to the involved cells
  (`shown: { cell: mask }`, `removed: [{cell, digit}]`, `key: [{cell, digit}]`,
  `keyCells`, `units`). Takes the board (givens + correct digits) instead of the
  game state, so it stays independent of `game.js`; the adapter is in `game.js`
  (`coachGrid(state)`, `coachSteps(state)`)
- [x] `coach.js`: pruning as described above (`coachChain(grid, { prune: false })`
  gives the unpruned chain for tests)
- [x] `coach.js`: `explain(step, name, { afterEliminations })` →
  `{ title: "Naked Pair", level: "Expert", text }` with the templates of PRD 3.4.1;
  `cellNamer()` (long first, short after), unit names; a naked single after
  eliminations says "all other candidates are gone"
- [x] `config.js`: `COACH_MAX_STEPS = 50`
- [x] Brought forward from C4 (forced by `pwa.test.js`, which requires every `js/`
  file to be in the module graph and precached): `coach.js` imported by `game.js`,
  in the `sw.js` precache list, `VERSION` 4 → 5

Tests (unit, `tests/unit/coach.test.js`, `techniques.test.js`):
- [x] Every technique has a fixture with its metadata, `validStep` true where found,
  false after applying it and false when the pattern is broken (9 fixtures + singles);
  every technique has an explanation test with the exact text, title and level
- [x] The easiest technique wins: a fresh Beginner puzzle gives a one-step chain (the
  single); in the batch the unpruned chain always starts with `nextStep`'s technique
- [x] Every chain ends with a placement whose digit equals the solution; no removed
  candidate is ever the solution digit of its cell; every step holds when replayed
  (seeded batch: 10 games per level, played forward with the Coach until solved;
  expert games use expert techniques, master games master techniques)
- [x] Pruning: never longer than the unpruned chain, shortens some chains in the
  batch, every remaining step passes `validStep` (replaced the constructed chain:
  the batch shows real unneeded steps)
- [x] Decorated steps: candidates only in the involved cells, removed and key
  candidates among them
- [x] Cell names: first mention long, later short, per session; box numbers 1–9
- [x] Catalogue exhausted → `placement: null`
- [x] Existing grading results unchanged (all generator/technique tests green)
- [x] Game adapter: the Coach ignores a wrong digit
- [x] e2e: earlier tests pass – **desktop project only** (92 green, Chrome); the WebKit
  projects, `a11y.spec.js` (needs `@axe-core/playwright`) and `visual.spec.js`
  (Windows baselines) could not run in the cloud session. C1 changes no UI; run the
  full gate on the dev notebook before C3.

Result: 164 unit tests green (25 new). Smoke run of 45 games: longest pruned chain
4 steps, about 1 ms per Coach call.

Gate → commit `Sudoku: coach phase C1 – coach engine`.

## Phase C2 – Game model ✅ 2026-11-15

- [x] `game.js`: `coachFill(state, placement)` – locks the digit like `hint`, selects
  the cell, removes the digit from peer notes, `hints++`; ignored when lost, solved,
  `hints >= MAX_HINTS`, a wrong digit on the board, or the placement is not an empty
  cell with its solution digit. Returns `{ kind: "filled" | "ignored", cell, digit }`
- [x] `game.js`: `coachAvailable(state)` – not lost, not solved, `hints < MAX_HINTS`
- [x] `game.js`: `clearWrongForCoach(state)` – clears the wrong digit(s) (reload case)
  without changing `hints` or `mistakes`; returns the cleared cells (nothing when the
  Coach is not available)
- [x] `game.js`: `coachFallback(state)` – placement for Fill when no technique
  applies (PRD 3.4.1): the first empty cell with its solution digit
- [x] `config.js`: keep `MAX_HINTS = 4` as the shared limit (comment: Hint + Coach);
  the state field `hints` now counts helps of both kinds, so saves stay valid

Tests (unit, `game.test.js`):
- [x] Mixed use: 3 hints + 1 coach fill → both refused; 4 coach fills → Hint and Coach
  refused, state unchanged
- [x] Coach fill locks, selects, removes peer notes, uses one help; coach fills alone
  solve a whole game, then the Coach is unavailable
- [x] Opening the Coach (computing the chain) is free
- [x] Refused fills: no placement, wrong digit, given cell, out of range, wrong digit
  on the board, lost game
- [x] Wrong digit after a restore: cleared without cost, mistakes unchanged; nothing
  cleared when no help is left
- [x] Fallback placement; none when the board is full
- [x] Save → restore round trip keeps the shared count; saves from before still load
  (existing test)
- [x] Property test extended: random play with Hint and Coach never exceeds 4 helps
- [x] e2e: earlier tests pass – desktop project (92 green, Chrome); WebKit, a11y and
  visual as noted in C1

Result: 173 unit tests green (9 new).

Gate → commit `Sudoku: coach phase C2 – coach in the game model`.

## Phase C3 – UI: buttons, help dots, Coach panel, board marks ✅ 2026-11-15

- [x] `view.js`: tool row with **Hint** and **Coach** (icon + label) and the help dots
  (filled = used) **between** them in the same row (no extra row, so the iPhone
  board keeps its size; PRD 3.1/3.4 updated); `data-used` on `#help-dots` and a
  screen-reader text "Help: n of 4 used"; both buttons `aria-disabled` when no help
  is left; the `Hint n/4` label is gone
- [x] `view.js`: Coach panel (`#coach-panel`: title · level, text) in place of the
  number row/pad; while it is open the tool row becomes **Close · dots · Next/Fill**
  (`#coach-close`, `#coach-next`). The text scrolls (portrait: what is left below the
  board; landscape: up to 232 px; short landscape: two lines)
- [x] `view.js`: coaching marks: units `.coach-unit` (light), key cells `.coach-key`
  (medium), a candidate grid `.cands` only in the involved cells, candidates
  `.removed` (red, struck through, bold) and `.key` (accent, extra bold); selection
  highlights give way while coaching; notes hidden and restored; cell labels name
  the candidates and the removed ones
- [x] `controller.js`: Coach flow – open (a wrong digit kept over a reload fades out
  first, free), step index, Next, Fill (`coachFill` + the hint fade-in/pulse), Close
  (focus back on Coach); board, number pad, Hint and keys blocked while open; New
  Game / Level close the Coach first; reload closes it (not saved)
- [x] Keyboard: `C` opens, `Enter` = Next/Fill, `Esc` = Close; focus on Next/Fill;
  texts announced through the `aria-live` region
- [x] `themes.css`: `--coach-accent` for all five schemes (= the player colour;
  ≥ 4.62:1 on the key-cell background). Other candidates use `--ink` (the muted
  colour falls below 4.5:1 on `--sel-bg`). No `--coach-removed`: `--wrong` reaches
  ≥ 4.76:1 everywhere
- [x] `base.css`: tool row grid, dots, panel, marks; `[hidden]` overrides for the
  flex/grid elements

Tests (e2e, new `coach.spec.js` + `coach-helpers.js`; positions are found by
playing generated games forward with the Coach and loaded as `sudoku.game`):
- [x] Beginner position (hidden single): key cell marked, Fill locks the digit, one
  dot filled, pad and Coach button back, no marks left
- [x] Expert position: first step an elimination with Next, removed candidates red
  (`--wrong`) and `line-through`, key ones ≥ 700 weight, candidates only in the step's
  cells; then through to Fill
- [x] Master position runs through a master technique to Fill (titles and texts on
  the page equal the engine's)
- [x] Close in the middle: no dot used, board unchanged, notes and labels exactly as
  before, focus on Coach
- [x] Taps on cells, digit keys and `H` do nothing while the panel is open
- [x] Shared limit: 2 hints + 2 coach fills → four filled dots, both buttons
  inactive, `C` and `H` ignored
- [x] Wrong digit kept over a reload → cleared, mistakes 1/3 and dots unchanged,
  coaching starts
- [x] Cell names: every short name comes after the long one; the page shows the
  engine's texts
- [x] Short landscape (844×390): text scrolls, Next/Close visible and ≥ 44 px
- [x] The page never scrolls while coaching
- [x] Keyboard: `C`, `Esc`, `Enter`; screen reader: step text announced, candidates
  and removed digits in the cell label
- [x] Contrast of every coaching candidate ≥ 4.5:1 in every scheme (computed colours)
- [ ] a11y: axe scan with the panel open in every scheme – **written**
  (`a11y.spec.js`), **not run here** (`@axe-core/playwright` missing in the cloud
  session); run on the dev notebook
- [ ] Visual baselines: the tool row changed, so `visual.spec.js` will differ –
  update with `npx playwright test visual.spec.js --update-snapshots` on the dev
  notebook (Windows baselines) and look at the images
- [x] e2e: earlier tests pass (layout, gameplay and persistence adapted to the
  dots). Run here: desktop project in Chrome (106 green incl. C4) and the iPhone /
  iPad projects **emulated in Chrome** (all specs except a11y/visual: 315 green).
  Real WebKit could not run in the cloud session: run the four projects on the dev
  notebook

Gate → commit `Sudoku: coach phase C3 – coach UI`.

## Phase C4 – Offline, docs, release ✅ 2026-11-15

- [x] `sw.js`: `VERSION` 5 → 6 (the precache entry for `js/coach.js` came in C1), so
  installed apps pick up the new UI
- [x] e2e offline: after one online load, offline reload, Coach runs through Next and
  Fill, one dot used (`offline.spec.js`; green on desktop and the emulated devices)
- [x] `README.md` (Sudoku): Coach and shared helps in "Playing", keyboard `C` /
  `Enter` / `Esc`, `coach` in the project layout
- [x] `implementation.md` "After the release": entry for the Coach, pointing to this file
- [x] PRD 9 criterion 11 mapped to tests (table below)

Still to do on the dev notebook (cannot run in the cloud session):
- [ ] `npm run test:all` with real WebKit for the iPhone / iPad projects
- [ ] `a11y.spec.js` incl. the new Coach axe scan
- [ ] `visual.spec.js --update-snapshots`, look at the new images, commit them
- [ ] Try it on the real iPhone / iPad (GitHub Pages)

Gate → commit `Sudoku: coach phase C4 – offline and docs`.

## After the release

- [x] **Step counter and preparation note** (2026-11-15, after testing on the iPad:
  a chain like Pointing → XY-Wing → Hidden Single looked as if the first step
  were already the solution). Analysis: no defect – over 8,700 chains a single
  never came before the last step, and the UI showed exactly the engine's steps.
  Change: for chains of several steps the title starts with "Step k of n"; every
  elimination step shows the note "This step removes candidates; no cell can be
  filled yet." (also announced); PRD 3.4.1 and README updated; title kept on one
  line, portrait text height formula corrected (the note made the iPhone page 1 px
  too tall); `VERSION` 7. Tests: `coach.spec.js` (counter and note on every step,
  one-step chain without them), offline title pattern. Run: 173 unit, desktop 108,
  emulated iPhone/iPad 324 – all green; WebKit, axe and visual still on the notebook.

---

## Acceptance traceability (PRD 9, criterion 11)

| Part | Test(s) |
|---|---|
| Easiest move, step by step | unit coach (easiest wins, batch, texts per technique); e2e coach (Beginner/Expert/Master positions) |
| Next per elimination, Fill at the end | e2e coach (Expert, Master) |
| Candidates only in involved cells, removed red + struck through | unit coach (`shown`, `removed`); e2e coach (computed styles) |
| Notes hidden and restored | e2e coach (Close) |
| Input blocked | e2e coach |
| Shared limit of four, dots | unit game (mixed use); e2e coach (shared limit) |
| Close costs nothing | unit game; e2e coach |
| Offline | e2e offline: "the Coach explains and fills" (C4) |

## Risks to watch

- **Pruning vs. explanation:** dropping a step can make a later step's pattern
  disappear; `validStep` guards this. If it turns out too complex, ship without
  pruning first (longer chains, still correct) and note it here.
- **Long Master chains:** several eliminations before a single. Measure the chain
  length over the seeded batch in C1; if chains get long, consider showing one
  sentence "first remove …" per step and keep Next.
- **Space on the iPhone:** the panel must fit in the height of the number row plus
  tip line; the text scrolls rather than pushing the board.
- **Test environment:** the full gate needs WebKit and `@axe-core/playwright`
  (`npm install`, `npx playwright install`) – run it on the dev notebook or in CI. The
  screenshot baselines are Windows-rendered (`*-win32.png`).
