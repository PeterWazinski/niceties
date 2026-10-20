# Sudoku

Ad-free, offline-capable Sudoku PWA. The general working rules (phases, checkboxes, test gate,
commit after green tests) are in [../CLAUDE.md](../CLAUDE.md).

- Specification: [design/PRD.md](design/PRD.md). Build log and checklists: [design/implementation.md](design/implementation.md).
  Read the relevant PRD section before changing behaviour, and update both files with the change.
- Player-facing description: [README.md](README.md).

## Commands (run in this folder)

```
npm test                                   # unit tests, ~5 s
npx playwright test --project=desktop      # e2e, one project, ~3 min
npm run test:e2e                           # e2e, all four projects, ~10 min
npx playwright test tests/e2e/visual.spec.js --update-snapshots   # only for intended layout changes
node tests/e2e/server.js                   # dev server on http://localhost:4174/
```

## Code map (`js/`)

- Pure logic, no DOM: `game.js` (state and rules: mistakes, hints, lock, notes, save/restore),
  `config.js` (all constants: `MAX_MISTAKES`, `MAX_HINTS`, animation times, levels), `grid.js`,
  `solver.js`, `techniques.js` (human solving techniques, also the hint engine), `generator.js`,
  `symmetry.js`, `rng.js`, `highlight.js`.
- DOM: `view.js` (render, dialogs, animations), `controller.js` (taps, keyboard, popups, animation
  flow, new game), `numpad.js` (tap vs. long press), `store.js` / `settings.js` / `storage.js`
  (localStorage, keys start with `sudoku.`), `pool.js` + `generator-client.js` + `generator.worker.js`
  (puzzles are generated off the main thread), `confetti.js`, `main.js`.
- CSS: `css/base.css` (layout: portrait one column, landscape board left and panel right; short
  landscape screens up to 520 px high use the one-row number strip), `css/themes.css` (five colour
  schemes via CSS variables).
- `sw.js` is the service worker; `index.html` loads `main.js` as a module.

## Game rules in short (PRD 3.2 and 3.4)

- A correct digit is locked. A wrong digit is red and counts as a mistake (`n/3`); mistake 1 and 2
  show a modal popup, after OK the digit fades out; mistake 3 loses the game (shake, grey, "Play Again").
- At most 4 hints per game, counter `n/4` on the button. New game resets both counters.
- The whole game (including `hints` and `lost`) is saved after every move and restored on load.

## Testing notes

- Pure-logic modules are unit-tested; `tests/e2e/helpers.js` opens the game with `?seed=12`
  (deterministic puzzle, `puzzleFor(12)` in `play-helpers.js` gives the same one to the test).
- A wrong digit stays on the board only after a reload (the popup removes it otherwise): e2e tests
  use `keepWrong(page, cell, digit)`. `ackMistake` confirms the popup, `threeMistakes` loses the game.
- Most e2e specs run with `reducedMotion: "reduce"` (short animations); `animation.spec.js` uses the
  real timings.
