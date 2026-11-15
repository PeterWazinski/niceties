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

## Phase C1 – Coach engine (pure logic)

- [ ] `techniques.js`: add metadata to the steps, backward compatible (new fields only):
  - hidden single: `unit` (index 0–26)
  - pointing: `box`, `line` (row/column unit index), `digit`
  - claiming: `line`, `box`, `digit`
  - naked/hidden subsets: `unit`, `digits`
  - X-Wing/Swordfish: `digit`, `base` (row or column unit indices), `cover`
  - XY-Wing: `pivot`, `pincers`, `digit` (= z)
- [ ] `techniques.js`: `validStep(grid, cand, step)` – true if the step's pattern
  still holds and still removes at least one candidate (per technique; reuses the
  finders' logic restricted to the step's cells/units)
- [ ] `coach.js` (new, pure): `coachChain(state)` → `{ steps, placement }` or
  `{ steps: [], placement: null }` (catalogue exhausted); for each step also the
  candidate snapshot *before* the step, restricted to the involved cells
  (`shown: { cell: mask }`, `removed: [{cell, digit}]`, `key: [{cell, digit}]`)
- [ ] `coach.js`: pruning as described above
- [ ] `coach.js`: `explain(step, names)` → `{ title: "Naked Pair", level: "Expert", text }`
  with the templates of PRD 3.4.1; `cellNamer()` (long first, short after), unit names
- [ ] `config.js`: `COACH_MAX_STEPS = 50`

Tests (unit, `tests/unit/coach.test.js`, `techniques.test.js`):
- [ ] Every technique has a fixture position where the Coach chain uses it, with the
  expected title, level, key cells, removed candidates and text
- [ ] The easiest technique wins: a position with a naked single and a pair gives a
  one-step chain (the single)
- [ ] Every chain ends with a placement whose digit equals the solution; no removed
  candidate is ever the solution digit of its cell (seeded batch: 50 games per level,
  played forward with Coach until solved)
- [ ] Pruning: a constructed chain with an unrelated elimination step drops it; every
  remaining step passes `validStep`
- [ ] Cell names: first mention long, later short, per session; box numbers 1–9
- [ ] Catalogue exhausted → `placement: null`
- [ ] Existing grading results unchanged (the added fields do not change `gradePuzzle`)
- [ ] e2e: earlier tests pass

Gate → commit `Sudoku: coach phase C1 – coach engine`.

## Phase C2 – Game model

- [ ] `game.js`: `coachFill(state, placement)` – locks the digit like `hint`, selects
  the cell, removes the digit from peer notes, `hints++`; ignored when lost, solved or
  `hints >= MAX_HINTS`
- [ ] `game.js`: `coachAvailable(state)` – not lost, not solved, `hints < MAX_HINTS`
- [ ] `game.js`: `clearWrongForCoach(state)` – clears the wrong digit (reload case)
  without changing `hints` or `mistakes`; returns the cleared cell
- [ ] `config.js`: keep `MAX_HINTS = 4` as the shared limit (comment: Hint + Coach)

Tests (unit, `game.test.js`):
- [ ] Mixed use: 3 hints + 1 coach fill → both inactive; 4 coach fills → Hint ignored
- [ ] Coach fill locks, removes peer notes, solves the game on the last cell
- [ ] Wrong digit after a restore: cleared without cost, mistakes unchanged
- [ ] Save → restore round trip unchanged; saves from before still load
- [ ] Property test extended: random play with Hint and Coach never exceeds 4 helps
- [ ] e2e: earlier tests pass

Gate → commit `Sudoku: coach phase C2 – coach in the game model`.

## Phase C3 – UI: buttons, help dots, Coach panel, board marks

- [ ] `view.js`: tool row with **Hint** and **Coach** (icon + label), help dots
  (`●○`, filled = used) under the buttons, `aria-label` "Help: n of 4 used";
  both `aria-disabled` when no help is left; remove the `Hint n/4` label
- [ ] `view.js`: Coach panel in place of the number row/pad: title + level, text,
  **Next** / **Fill**, **Close**; text area scrolls on short landscape screens
  (≤ 520 px high), buttons stay visible
- [ ] `view.js`: coaching marks on the board: unit (light), key cells (medium),
  candidate mini grid only in involved cells; classes `.coach-unit`, `.coach-key`,
  `.cand-removed` (red, struck through), `.cand-key` (accent, bold); user notes hidden
  while open, restored afterwards
- [ ] `controller.js`: Coach flow – open (clear a wrong digit first if present), step
  index, Next, Fill (`coachFill` + the existing hint fade-in/pulse animation), Close;
  board and number input blocked while open; reload closes it
- [ ] Keyboard: `C` opens, `Enter` = Next/Fill, `Esc` = Close; focus on the primary
  button; texts announced through the `aria-live` region
- [ ] `themes.css`: `--coach-accent` (and, if needed, `--coach-removed`) for all five
  schemes
- [ ] `base.css`: tool row with two buttons in portrait and landscape; panel sizes

Tests (e2e, new `coach.spec.js`, all four projects; positions are loaded by writing
a prepared `sudoku.game` into localStorage before the page opens):
- [ ] Beginner position: Coach shows "Hidden Single · Beginner" (or Naked Single),
  key cell marked, **Fill** fades the digit in and locks it, one dot filled
- [ ] Expert position: first step an elimination with **Next**, removed candidates
  red and struck through (computed style: `text-decoration-line` includes
  `line-through`), deciding ones bold; after Next they are gone; last step **Fill**
- [ ] Master position (X-Wing or XY-Wing) runs through to Fill
- [ ] Close at any step: no dot filled, board unchanged, notes visible again exactly
  as before
- [ ] Taps on board cells and number buttons do nothing while the panel is open
- [ ] Shared limit: 2 hints + 2 coach fills → both buttons inactive, `H` and `C` ignored
- [ ] Wrong digit kept over a reload (`keepWrong`) → Coach clears it, mistakes and
  dots unchanged, then coaching starts
- [ ] Cell names: first long, then short in the same session
- [ ] Short landscape (≤ 520 px high): panel text scrolls, Next/Fill/Close visible
  and ≥ 44 px
- [ ] Keyboard (desktop): `C`, `Enter`, `Esc`
- [ ] a11y: axe scan with the panel open in every scheme; contrast of `.cand-key` and
  `.cand-removed` ≥ 4.5:1; colour not the only signal
- [ ] Visual baselines updated for the new tool row (intended change; look at the images)
- [ ] e2e: earlier tests pass (layout, gameplay, a11y specs adapted to the dots)

Gate → commit `Sudoku: coach phase C3 – coach UI`.

## Phase C4 – Offline, docs, release

- [ ] `sw.js`: `js/coach.js` in the precache list (the unit test in `pwa.test.js`
  fails otherwise), `VERSION` raised
- [ ] e2e offline: after one online load, offline reload, Coach runs through Next and
  Fill
- [ ] `README.md` (Sudoku): Coach in "Playing", shared help limit, keyboard `C`
- [ ] `implementation.md` "After the release": entry for the Coach, pointing to this file
- [ ] PRD 9 criterion 11 mapped to tests (table below)

Gate → commit `Sudoku: coach phase C4 – offline and docs`.

---

## Acceptance traceability (PRD 9, criterion 11)

| Part | Test(s) |
|---|---|
| Easiest move, step by step | unit coach (easiest wins, fixtures per technique); e2e coach (Beginner/Expert/Master positions) |
| Next per elimination, Fill at the end | e2e coach (Expert, Master) |
| Candidates only in involved cells, removed red + struck through | unit coach (`shown`, `removed`); e2e coach (computed styles) |
| Notes hidden and restored | e2e coach (Close) |
| Input blocked | e2e coach |
| Shared limit of four, dots | unit game (mixed use); e2e coach (shared limit) |
| Close costs nothing | unit game; e2e coach |
| Offline | e2e offline (C4) |

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
