# Sudoku – Implementation Plan

Implements [PRD.md](PRD.md). Section numbers (e.g. "PRD 3.4") refer to it.

## Working rules

1. **Phases are done in order.** Each phase ends with a green test run and a commit.
2. **Phase gate (every phase):**
   - [ ] `npm test` (unit, `node --test`) passes: **all** tests.
   - [ ] `npm run test:e2e` (headless Playwright, all projects: iPhone, iPad portrait, iPad landscape, desktop) passes: **all** tests.
   - [ ] No skipped, `.only`, or quarantined tests; no retries to hide flakiness (`retries: 0`). A flaky test is fixed, not rerun.
   - [ ] Tests written in the phase cover every work item of the phase; earlier tests still pass (no regression).
   - [ ] **Update `implementation.md`:** tick every checkbox of this phase that has been delivered (work items and tests, only those really done and passing); an item that was not delivered stays unticked and gets a note why, or is moved to a later phase. The updated file is part of the phase commit.
   - [ ] **Commit all files** of the phase (`git add -A` in `Sudoku/`, check `git status` is clean afterwards) with the message `Sudoku: phase N – <title>`, ending with the attribution line configured for this repo.
   - Only when the gate is green may the next phase start. If a test fails, fix the cause in the same phase; do not commit red.
3. **Stack** (PRD 7): plain HTML/CSS/ES modules, no framework, no build step. Dev dependency only: `@playwright/test`. Same conventions as `untangleMe` (`tests/unit/*.test.js`, `tests/e2e/`, `playwright.config.js`).
4. **Pure logic first, DOM later:** everything in `js/` except `view.js`, `numpad.js`, `main.js`, `settings.js`, `store.js`, `pool.js` and the worker runs under node without a DOM.
5. **Determinism:** all randomness goes through the seeded `rng.js`, so unit tests are reproducible.
6. **Checkboxes** are ticked in this file at the end of each phase (see the gate); the file is part of each phase's commit, so the plan always shows the true project state.

## Test infrastructure (set up in phase 0, used by all)

- `package.json` scripts: `test` → `node --test "tests/unit/*.test.js"`, `test:e2e` → `playwright test`, `test:all` → both.
- `playwright.config.js`: `webServer` = a tiny static server on `localhost` (needed for ES modules and service workers; `file://` doesn't work), `retries: 0`, headless, projects:
  - `iphone` (≈ 390×844, touch, WebKit device descriptor)
  - `ipad-portrait` (≈ 810×1080, touch)
  - `ipad-landscape` (≈ 1080×810, touch)
  - `desktop` (Chromium 1280×800)
  - Browsers: the iOS device descriptors run **WebKit** (closest stand-in for Safari), `desktop` runs Chromium. Android is covered only by Chromium emulation (PRD: expected to work, not officially supported).
- e2e helpers in `tests/e2e/helpers.js`: open the game with a **fixed seed** (`?seed=` URL parameter, test hook – see phase 7), read a cell's digit/classes, tap/hold a number (pointer down → wait → up).

---

## Phase 0 – Scaffold and test harness

Goal: an empty but runnable project with the test pipeline working.

- [x] Folder structure from PRD 7.1 (empty modules only where needed), `.gitignore` (`node_modules`, `test-results`, `playwright-report`)
- [x] `package.json` (name `sudoku`, scripts above, devDependency `@playwright/test` – same version as untangleMe), `npm install`, `npx playwright install` for the needed browsers
- [x] `playwright.config.js` with the four projects and the static `webServer`
- [x] `index.html` shell: viewport meta (`viewport-fit=cover`), title, empty `<main id="app">`, `css/base.css` + `css/themes.css` stubs, `js/main.js` stub
- [x] `README.md` stub (how to run, how to test)

Tests:
- [x] Unit: sanity test that imports `js/config.js` (levels, `MAX_MISTAKES = 3`, long-press threshold constant)
- [x] e2e: page loads in all projects, no console errors, title and `#app` present

Gate → commit `Sudoku: phase 0 – scaffold and test harness`.

## Phase 1 – Solver, RNG, symmetry (pure logic)

Goal: the algorithmic foundation of PRD 5.

- [x] `rng.js`: seeded generator (mulberry32), `int(n)`, `shuffle(array)`
- [x] `solver.js`: bitmask backtracking, "fewest candidates first"; `solve(grid)`, `countSolutions(grid, limit)` (stops at 2), `isValidGrid`
- [x] `symmetry.js`: the symmetry types of PRD 5.3 (180°, 90°, h/v mirror, diagonal, anti-diagonal, both diagonals, both axes) → `orbits(type)` as lists of cell indices; each orbit set partitions the 81 cells
- [x] `config.js`: symmetry list, board constants (peers, rows/cols/boxes lookup tables, shared helper module e.g. `grid.js`)

Tests (unit):
- [x] Solver solves known easy/hard/“hardest” sample puzzles correctly
- [x] `countSolutions` returns 0 for contradictory, 1 for unique, 2 (capped) for an empty/ambiguous grid
- [x] Solver speed guard: 100 known puzzles solved under a generous total time (catches accidental exponential behaviour)
- [x] Symmetry: orbits partition all cells, and applying a symmetry twice returns to the start, for every type
- [x] RNG: same seed → same sequence; shuffle is a permutation
- [x] e2e: smoke tests of phase 0 still pass

Gate → commit `Sudoku: phase 1 – solver, rng, symmetry`.

## Phase 2 – Generator (Beginner) and grading core

Goal: unique, symmetric puzzles, graded by a human-technique solver (PRD 5.2).

- [x] `generator.js`: random full grid (randomised backtracking), symmetric dig (remove orbits, keep uniqueness), returns `{ givens, solution, level, symmetry, clues }`
- [x] `techniques.js`, first part: naked single, hidden single; `gradePuzzle(givens)` → `{ solved, hardest, steps }` using techniques in ascending order
- [x] Level config in `config.js`: Beginner 38–42 clues, hardest = singles (PRD 4)
- [x] `generate(level, rng, options)` for Beginner with retry loop; symmetry 180° by default

Tests (unit):
- [x] 100 seeded Beginner puzzles: exactly one solution, clue count 38–42, 180° symmetric, `solution` is valid and consistent with the givens, graded as singles-only
- [x] Grader: known puzzles requiring pairs/X-wing are *not* graded as singles-only
- [x] Same seed → identical puzzle
- [x] Beginner generation time guard (average per puzzle far below the PRD target)
- [x] e2e: earlier smoke tests pass

Gate → commit `Sudoku: phase 2 – generator and grading core (Beginner)`.

## Phase 3 – Expert and Master, all symmetries, worker, pool

Goal: all three levels, generation off the main thread, instant New Game (PRD 4, 5.3, 5.4).

- [x] `techniques.js`, second part: naked/hidden pairs and triples, pointing/claiming pairs (Expert); X-Wing, Swordfish, XY-Wing (Master); each technique reports its name and the cells it touched (reused for hints)
- [x] Level config: Expert 30–34 clues (needs ≥ one Expert technique, nothing harder than Expert), Master 24–28 (needs ≥ one Master technique)
- [x] Generator: per-level retry strategy (new dig order → new grid), symmetry selection (random among all types for Beginner/Expert; Master falls back to a weaker symmetry after N failed tries), a hard attempt limit with graceful fallback so generation always terminates
- [x] `generator.worker.js` (module worker) + main-thread fallback if the worker cannot be created
- [x] `pool.js`: one pre-generated puzzle per level, stored under `sudoku.pool` in localStorage, refilled in the background; `take(level)` returns instantly if the pool has one, else generates

Tests (unit):
- [x] For each level, 50 seeded puzzles: unique, clue range, symmetry holds for the reported symmetry, graded level matches
- [x] Each technique has a dedicated fixture puzzle/position proving that it fires and the expected cells are found
- [x] All symmetry types produce valid unique puzzles at least for Beginner
- [x] Master generation terminates within the attempt limit for 20 seeds
- [x] Pool logic (with an in-memory storage stub): `take` empties the slot, refill restores it, corrupt storage is ignored
- [x] e2e: a test page/hook loads the worker, generates one puzzle per level, verifies uniqueness in the page and measures that the main thread stays responsive (no long task above a threshold); fallback path works when `Worker` is disabled
- [x] e2e: earlier tests pass

Gate → commit `Sudoku: phase 3 – all levels, worker and pool`.

## Phase 4 – Game model and highlighting (pure logic)

Goal: all game rules of PRD 3.2–3.4 without a UI.

- [x] `game.js`: `newGame(puzzle)`, state shape of PRD 7.2 (`givens`, `solution`, `entries`, `notes`, `mistakes`, `level`, `selected`, `dialogOpen`, `solved`)
- [x] `enterDigit(state, cell, digit)`: correct → locked and that digit's note removed from every cell in its row, column and box (the same applies to a digit revealed by `hint`); a wrong digit removes no notes; wrong → `mistakes++`, digit kept as wrong; same wrong digit again → no-op; locked/given cells and "no selection" → no-op; returns an event (`correct` | `wrong` | `ignored` | `gameOver` | `solved`)
- [x] `toggleNote(state, cell, digit)`: only in empty cells; note on → off, off → on; **no validation against peers** – a note is allowed even if the digit already stands in the same row, column or box
- [x] `hint(state)`: the three situations of PRD 3.4 (wrong digit → empty it, selected empty cell → reveal, otherwise next logical cell via `techniques.js`); after game over → counter 2/3 and dialog closed; returns what happened (cell, kind) so the view can animate it
- [x] Game over at 3 mistakes (`dialogOpen`), win detection
- [x] `highlight.js`: for a selection compute `sel`, `same` (identical digits), `peer` (row/column/box), `conflict` (rule duplicates), `wrong` sets (PRD 3.3)
- [x] State is plain JSON: `serialize`/`deserialize` with validation (reject malformed/tampered data)
- [x] Digit completion: `remaining(state, digit)` for greying out the number row

Tests (unit):
- [x] Correct digit locks; later input to that cell and notes in it are ignored
- [x] Wrong digit increments mistakes once, stays red, can be overwritten by right/other wrong digit, same wrong digit twice counts once
- [x] Notes: long-press toggle on → off → on; blocked in filled cells (right or wrong); replaced by an entered digit
- [x] Notes: a note can be set although the same digit is already in the row, column or box (no peer validation)
- [x] Notes: a correct digit (entered or via Hint) removes its note from all cells of the row, column and box, and leaves other digits' notes alone; a wrong digit removes no notes
- [x] Third mistake → game over; New Game path (new state) works; Hint after game over → 2/3, wrong cell emptied, next wrong digit → game over again
- [x] Hint matrix: wrong digit present / selected empty cell / nothing selected / several wrong digits (selected first, else most recent); hint never changes the mistake counter in normal play
- [x] Win detection on the last correct digit
- [x] Highlight sets for empty cell, filled cell, conflicts (visible duplicates) and wrong-but-not-conflicting digits
- [x] Serialize → deserialize round trip is identical; garbage input is rejected
- [x] Property test: random legal play sequences never violate the invariants (locked cells never change, mistakes ≤ 3 until reset)
- [x] e2e: earlier tests pass

Gate → commit `Sudoku: phase 4 – game model and highlighting`.

## Phase 5 – Board UI, layouts, colour schemes

Goal: the static look from PRD 3.1, 3.3, 3.6 with selection and highlighting wired to the model.

- [x] `view.js`: render header (title, **New Game**), status row (Level ▾, Mistakes n/3, Colours ▾), board (81 cells, thick box borders, ARIA roles/labels), Hint button, number row (portrait) / 3×3 pad (landscape)
- [x] `base.css`: portrait layout from `portrait-layout-6inch.jpg`; landscape side-panel layout; board sized by `min(width, dvh − chrome)`; safe-area insets; `touch-action: manipulation`, no text selection; touch targets ≥ 44 pt
- [x] `themes.css`: Black & White (default), Classic Blue, Sepia, Dark, Forest as CSS variable sets, including the highlight layers, locked digit, wrong digit and conflict red; `theme-color` meta follows the scheme
- [x] Tap on a cell selects it; highlight classes from `highlight.js` applied; given/locked/wrong/note rendering (notes as a 3×3 mini grid inside the cell)
- [x] Temporary dev entry in `main.js`: starts a game from a fixed fixture puzzle (replaced by the real flow in phase 7)

Tests:
- [x] Unit: view-model helpers – not applicable: nothing was split out of `view.js`; its logic is covered by the browser tests and by the unit tests of `highlight.js` (phase 4)
- [x] e2e (all four projects): no horizontal or vertical page scroll; board is square and fits the viewport; number row visible on iPhone, 3×3 pad on iPad landscape; all touch targets ≥ 44 px  (delivered: buttons and selects ≥ 44 px; number buttons ≥ 44 px high and ≥ 36 px wide, as in PRD 3.1; board cells are not touch-target checked)
- [x] e2e: tap an empty cell → its row, column and box have the highlight class and nothing else does; tap a filled cell → identical digits + peers highlighted
- [x] e2e: switching colour scheme (via dropdown) changes computed background/colours; B/W is the default; contrast check of digit vs. background ≥ 4.5:1 for every scheme (computed in the page)
- [x] e2e: visual regression screenshots of the B/W layout, one baseline per device project (iPhone, iPad portrait, iPad landscape, desktop), compared with a 2 % tolerance (baselines are Windows-rendered: `*-win32.png`)
- [x] e2e: earlier tests pass

Gate → commit `Sudoku: phase 5 – board UI, layouts and colour schemes`.

## Phase 6 – Input and gameplay

Goal: playable game according to PRD 3.2 and 3.4.

- [x] `numpad.js`: pointer events, ~350 ms timer from `config.js`; tap → digit, hold → note applied **at the threshold**, visual press/hold feedback, abort on `pointercancel`/leaving the button; `navigator.vibrate` where available; callout/selection/context-menu suppression
- [x] Wire number row/pad to `enterDigit` / `toggleNote`; do nothing (and dim the row) without an editable selected cell; grey out digits with nine placed
- [x] Mistake counter display; wrong digit red; conflict cells red (colour is not the only signal: bold/pattern in B/W)
- [x] Game-over dialog: modal, **New Game** / **Hint**, focus handling
- [x] **Hint** button: slow-motion fade-out of a wrong digit; slow fade-in plus pulsing outline for a revealed digit; `prefers-reduced-motion` shortens animations; input blocked while animating
- [x] "Solved!" message with **New Game**
- [x] First-run tip "Hold a number to add a note" shown until the first note is made (`sudoku.tipShown`)
- [x] Keyboard: arrows move selection, `1–9` digit, `Shift+1–9` note, `H` hint, `Esc` closes nothing destructive

Tests:
- [x] Unit: `numpad.js` timing logic with a fake clock (tap vs. hold, cancel, threshold boundary, no double-fire on release after a hold)
- [x] e2e: tap digit in a selected empty cell → digit appears, locked if right; wrong digit → red, counter 1/3, other peers flagged if duplicate; overwrite works
- [x] e2e: **long press** (pointer down, wait past threshold, up) creates a note and no digit; second hold removes it; short tap enters a digit instead; tip disappears after the first note
- [x] e2e: a note can be turned on for a digit that is already in the same row/column/box; setting the correct digit elsewhere in that row/column/box removes the note, a wrong digit does not
- [x] e2e: number tap without selection / on a locked cell does nothing
- [x] e2e: three wrong digits → dialog; **Hint** → wrong cell animates empty, counter 2/3, game continues; another wrong digit → dialog again; **New Game** → new puzzle
- [x] e2e: Hint without any wrong digit reveals a digit with the pulse; Hint twice (wrong digit → emptied → reveal) matches the PRD flow
- [x] e2e: solving a whole fixture puzzle shows "Solved!"
- [x] e2e: keyboard play on desktop project (digit, Shift+digit, hint, arrows)
- [x] e2e: earlier tests pass

Gate → commit `Sudoku: phase 6 – input and gameplay`.

## Phase 7 – Levels, New Game flow, persistence

Goal: real games, settings and resume (PRD 3.5, 3.7).

- [x] `settings.js`: `sudoku.scheme` and `sudoku.level` with safe (try/catch) localStorage wrappers and defaults (`bw`, `beginner`)
- [x] `store.js`: save the complete state after every move (`sudoku.game`), restore on load (including notes, mistakes, open dialog), delete when solved; invalid/corrupt data → start a new game
- [x] Level dropdown and **New Game**: confirmation if a game is in progress; new puzzle from `pool.js` (worker), "Preparing puzzle…" state if the pool is empty; background refill after use
- [x] Wire the real flow in `main.js`: load settings → restore game or start new → render; remove the phase 5 fixture entry but keep a documented `?seed=<n>&level=<l>` URL parameter for deterministic tests
- [x] Colour-scheme dropdown applies live and persists
- [x] Storage unavailable (private mode / throws) → game still works without persistence

Tests:
- [x] Unit: settings defaults, invalid stored values fall back to defaults; store save/restore/clear with a storage stub, corrupt JSON handled; storage that throws handled
- [x] e2e: select scheme and level → reload → both preserved; B/W default on a clean profile
- [x] e2e: play some moves (digits, a note, a mistake) → reload → identical board, notes, mistakes; reload while the game-over dialog is open → dialog still open
- [x] e2e: solved game is not restored after reload (new game starts)
- [x] e2e: each of Beginner/Expert/Master starts a game with a clue count in the PRD range; New Game asks for confirmation when progress exists and not when the board is untouched
- [x] e2e: New Game is fast (< 300 ms) when the pool is filled; works with an empty pool
- [x] e2e: with `localStorage` access forced to throw, the game still loads and is playable
- [x] e2e: earlier tests pass

Gate → commit `Sudoku: phase 7 – levels, new game and persistence`.

## Phase 8 – Offline / PWA and GitHub Pages readiness

Goal: PRD 6 – playable and restartable with no network.

- [x] `manifest.webmanifest` (name, `start_url: "./"`, `scope: "./"`, standalone, theme/background colour), icons (192, 512, maskable, apple-touch-icon), `apple-mobile-web-app-*` meta tags
- [x] `sw.js`: precache every app file at install (explicit list kept in sync by a test), cache-first with background update, versioned cache name `sudoku-v<N>`, old caches deleted on activate, scope limited to the Sudoku folder
- [x] Service-worker registration in `main.js` (only on `https` or `localhost`, errors swallowed)
- [x] All URLs relative; no external requests anywhere (fonts, CDN, analytics)
- [x] Verify the app works when served from a sub-path (e.g. `/niceties/Sudoku/`) and not only from the server root

Tests:
- [x] Unit: the precache list in `sw.js` equals the set of files actually referenced by the app (HTML, CSS, JS modules, worker, manifest, icons) – fails if a file is forgotten
- [x] e2e: **offline test** – load once online and wait for the service worker to take control, `context.setOffline(true)`, reload, play a few moves, start a new game at each level, solve or hit game over → all work
- [x] e2e: network log of a full session contains no request to a foreign origin
- [x] e2e: served from a sub-path via the test server, the app and the service worker still work
- [x] e2e: a new cache version replaces the old cache after an update (activate cleans up)
- [x] e2e: manifest is valid (required fields, icons exist and load)
- [x] e2e: earlier tests pass

Gate → commit `Sudoku: phase 8 – offline PWA`.

## Phase 9 – Polish, accessibility, documentation, release

Goal: finish PRD 8–9 and publish.

- [x] Accessibility: visible focus, ARIA labels (`row 3, column 5, 7, locked`), dialog roles, announcements for mistakes/solved via an `aria-live` region, `prefers-reduced-motion`
- [x] Colour is never the only signal for errors in any scheme (verified, see test)
- [x] Performance pass: no layout thrash on selection, generation never blocks the UI
- [x] `README.md`: playing, rules, Hint behaviour, long-press notes, running locally, tests, **Add to Home Screen** and the iOS cache caveat, GitHub Pages URL
- [ ] GitHub Pages: enable Pages for the repo (manual step by the owner), check the live URL, add the link to the README — **open: owner action** (README explains the steps; the sub-path and offline behaviour are tested against a local sub-path)
- [ ] Manual device checklist executed on a real iPhone and iPad (Safari and Add to Home Screen): layout fits, long-press feels right (tune the threshold in `config.js`), offline in airplane mode, resume after killing Safari, no zoom or scroll glitches

Tests:
- [x] e2e: automated accessibility scan (e.g. axe-core via a dev dependency, or a hand-written check of roles/labels/contrast) passes on the main screen and the dialog in every scheme
- [x] e2e: error states distinguishable without colour (computed styles differ beyond colour)
- [x] e2e: full regression – every earlier e2e test, in all projects
- [x] Unit: full regression, plus a final larger seeded generation batch (e.g. 300 puzzles across levels, unique + symmetric + graded)
- [x] PRD acceptance criteria 1–10 (PRD 9) mapped one by one to tests; the mapping table is added at the end of this file

Gate → commit `Sudoku: phase 9 – polish, accessibility and release`.

---

## Acceptance traceability

| PRD 9 criterion | Test(s) |
|---|---|
| 1 No ads/network/timer/score | e2e offline: *a whole session talks only to the own origin*; e2e a11y: *there is no timer, no score, and no Undo / Erase / Notes button*; unit pwa: *no root-absolute or external URLs anywhere in the app files* |
| 2 Empty cell highlights | e2e highlight: *tap an empty cell*; unit highlight: *empty cell* |
| 3 Filled cell highlights | e2e highlight: *tap a filled cell*; unit highlight: *filled cell* |
| 4 Wrong digit, locking, no Undo/Erase | e2e gameplay: *a wrong digit is red, counted once…*, *a locked digit cannot be changed*, *…duplicates a visible digit marks the conflicting cells red*; unit game (locking, mistakes, property test); e2e a11y (no Undo/Erase buttons) |
| 5 Game-over dialog, Hint | e2e gameplay: *three wrong digits open the dialog…*, *dialog Hint…*, *dialog New Game…*, *Hint with a wrong digit empties it…*; e2e animation (slow motion); unit game (hint matrix) |
| 5a Tap vs. long press | unit numpad (fake clock, threshold boundary); e2e gameplay: *long press creates a note…*, *a short tap enters a digit…*, *moving the pointer off the button cancels the press* |
| 5b Reload restores game | e2e persistence: *the game is saved after every move…*, *reloading while the three-mistakes dialog is open…*; unit settings/store round trip |
| 6 Levels, uniqueness, symmetry | unit levels (50 per level), unit batch (100 per level), unit generator; e2e persistence: *level … starts a game with the clue count of the PRD* |
| 7 Scheme and level persistence | e2e persistence: *a clean profile starts with Black & White and Beginner*, *scheme and level survive a reload*; e2e themes; unit settings |
| 8 Layout iPhone/iPad | e2e layout (all four device projects: no scroll, square board, pad layout, touch targets); e2e visual baselines |
| 9 Offline play and new game | e2e offline: *after one online load the game loads, can be solved and a new game can be started*, *a new game at every level, hints, scheme change*, *works from a sub-path* |
| 10 New Game < 300 ms | e2e persistence: *New Game is instant when the pool is filled*, *also works with an empty pool* |

## Risks to watch

- **Master generation time / hit rate:** measured in phase 3; if too slow, widen the clue range slightly or relax symmetry before touching the grading rules.
- **Long press on iOS Safari** (callout, selection, scroll cancelling the pointer): only a real device settles it; the plan includes it in the phase 9 manual checklist, and a Notes toggle button remains the fallback (PRD 3.2.1).
- **WebKit in headless tests** differs from iOS Safari in details (viewport units, service-worker timing); the WebKit project is a stand-in, not a replacement for the device check.
- **Shared origin on GitHub Pages:** storage keys and caches are prefixed (`sudoku.`, `sudoku-`); a test guards against un-prefixed keys.

## After the release

- [x] **Confetti when a game is solved** (like Untangle Me): `js/confetti.js` (canvas burst, ~4.5 s, fades out, above the "Solved!" message, never blocks taps), fired once per solved game, also when the last cell came from a Hint. Stopped by New Game, never shown with reduced motion or after a reload. Tests: unit `confetti.test.js`, e2e `confetti.spec.js`. `sw.js` VERSION raised to 2.

- [x] **Wrong digit stops the game** (change request): while a wrong digit is on the board only that cell accepts input (no digits, no notes elsewhere; warning text; number buttons inactive). It is changed to the right digit, replaced by another wrong one (new mistake), or cleared — by tapping the same digit again, Backspace / Delete, or Hint. No Clear button. Model: `clearCell`, `isBlocked`, `hasWrong`, `enterDigit` results `blocked` / `cleared`. Tests: unit `game.test.js` (blocking, clearing, property test: at most one wrong digit), e2e `gameplay.spec.js` (blocking, clearing by same digit and by keys, Hint unblocks), screen reader messages in `a11y.spec.js`; the other specs were adapted to the new rule.
