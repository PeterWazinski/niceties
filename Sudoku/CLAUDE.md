# Sudoku

Ad-free, offline-capable Sudoku PWA. The general working rules (phases, checkboxes, test gate,
commit after green tests) are in [../CLAUDE.md](../CLAUDE.md).

- Specification: [design/PRD.md](design/PRD.md). Build log and checklists: [design/implementation.md](design/implementation.md);
  larger change requests have their own plan: [implementation-coach.md](design/implementation-coach.md) (Coach,
  incl. the list of checks still to run on the dev notebook), [implementation-i18n.md](design/implementation-i18n.md) (German).
  Read the relevant PRD section before changing behaviour, and update both files with the change.
- Player-facing description: [README.md](README.md).

## Commands (run in this folder)

```
npm test                                   # unit tests, ~5 s
npx playwright test --project=desktop      # e2e, one project, ~3 min
npm run test:e2e                           # e2e, all four projects, ~10 min
npx playwright test tests/e2e/visual.spec.js --update-snapshots   # only for intended layout changes
node tests/e2e/server.js                   # dev server on http://localhost:4174/
node tools/make-quotes.mjs                 # after editing design/quotes-en.md / quotes-de.md
```

## Code map (`js/`)

- Pure logic, no DOM: `game.js` (state and rules: mistakes, hints, lock, notes, save/restore),
  `config.js` (all constants: `MAX_MISTAKES`, `MAX_HINTS`, animation times, levels), `grid.js`,
  `solver.js`, `techniques.js` (human solving techniques, also the hint engine), `coach.js` (Coach
  chain, pruning, board marks, explanations), `i18n.js` (every text in English and German, `t()`,
  device-language detection), `quotes.js` (Star Wars quotes for the popups, **generated** from
  `design/quotes-*.md` – never edit it by hand; shuffled deck), `generator.js`, `symmetry.js`,
  `rng.js`, `highlight.js`.
- DOM: `view.js` (render, dialogs, animations), `controller.js` (taps, keyboard, popups, animation
  flow, new game), `numpad.js` (tap vs. long press), `store.js` / `settings.js` / `storage.js`
  (localStorage, keys start with `sudoku.`), `pool.js` + `generator-client.js` + `generator.worker.js`
  (puzzles are generated off the main thread), `confetti.js` (win celebration in every scheme but Star
  Wars), `shockwave.js` (win celebration in Star Wars: flash, ring, sparks), `main.js`.
- CSS: `css/base.css` (layout: portrait one column, landscape board left and panel right; short
  landscape screens up to 520 px high use the one-row number strip), `css/themes.css` (seven colour
  schemes via CSS variables; Star Wars – first in the list and the default – and Rainbow add
  scheme-scoped effects at the end). Scheme ids and order are in `js/schemes.js`, names in `i18n.js`
  (`scheme.<id>`); a removed scheme gets an entry in `RENAMED_SCHEMES` in `settings.js`.
- `sw.js` is the service worker; `index.html` loads `main.js` as a module. A new `VERSION` installs
  fresh (`cache: "reload"`), takes over at once, and `main.js` reloads the page once on
  `controllerchange` – so e2e tests that register another worker must expect a navigation
  (`offline.spec.js` shows how).

## Game rules in short (PRD 3.2 and 3.4)

- A correct digit is locked. A wrong digit is red and counts as a mistake (`n/3`); mistake 1 and 2
  show a modal popup, after OK the digit fades out; mistake 3 loses the game (shake, grey, "Play Again").
- The mistake, lost and solved popups show a Star Wars quote (PRD 3.9): lists `mistake1`
  (encouraging), `mistake2` (warning), `lost`, `won`; real film lines carry a speaker line. Levels are
  displayed as Youngling / Padawan / Jedi (ids stay `beginner` / `expert` / `master`).
- Hint and Coach share at most 4 helps per game, shown as four dots between the two buttons (filled =
  used); the Coach explains the easiest next move step by step (Next per elimination, Fill at the end,
  Close is free). New game resets mistakes and helps.
- Texts: never write a user-visible or screen-reader string in the code; add a key to both tables in
  `i18n.js` (the unit tests check that every key used exists and that German has every key). Quotes
  go into `design/quotes-en.md` and `quotes-de.md` (same numbering), then `node tools/make-quotes.mjs`;
  `quotes.test.js` fails if `js/quotes.js` and the Markdown files differ.
- The whole game (including `hints` and `lost`) is saved after every move and restored on load.

## Testing notes

- Pure-logic modules are unit-tested; `tests/e2e/helpers.js` opens the game with `?seed=12`
  (deterministic puzzle, `puzzleFor(12)` in `play-helpers.js` gives the same one to the test).
- A wrong digit stays on the board only after a reload (the popup removes it otherwise): e2e tests
  use `keepWrong(page, cell, digit)`. `ackMistake` confirms the popup, `threeMistakes` loses the game.
- Most e2e specs run with `reducedMotion: "reduce"` (short animations); `animation.spec.js` uses the
  real timings.
- The e2e tests run in English because Playwright's default locale is `en-US`; German tests set
  `test.use({ locale: "de-DE" })` (`language.spec.js`). Coach tests load prepared positions through
  `coach-helpers.js`; `quotes.spec.js` loads an almost-solved game the same way.
- Dialog texts are quotes now: check them against `QUOTES` from `js/quotes.js` (any entry of the right
  list), not against a fixed string.
- The default scheme is Star Wars (dark): tests that need the light B/W look select it explicitly
  (`visual.spec.js` does, so the `*-bw.png` baselines stay valid).
  `confetti.spec.js` plays in B/W (Star Wars celebrates with the shockwave, `shockwave.spec.js`).
- Checks that cannot run in the cloud session (real WebKit, axe, screenshot baselines, the real iPad,
  the wording of the real film quotes) are collected in [design/implementation-coach.md](design/implementation-coach.md)
  under "Still to do on the dev notebook".

## Refactoring backlog (review 2026-11-16, not done yet)

Behaviour must stay exactly the same; the existing unit and e2e tests are the safety net.

**A – small cleanup** (low risk, do any time):
- [ ] `confetti.js` and `shockwave.js` share ~40 identical lines (env defaults, canvas sizing,
  `finish()`, `stop()`, frame loop): extract a shared `canvas-effect.js`.
- [ ] `controller.js`: the animation pattern (duration from `reducedMotion()`, `animating = true`,
  `view.setBusy(true)`, `setTimeout` to unblock) appears 4× – one helper.
- [ ] `controller.js`: building the Coach texts (`cellNamer` + `explain` per step) appears 2×
  (`startCoach`, `toggleLang`) – one function.
- [ ] Dead code: `TECHNIQUE_TITLES` in `coach.js` (titles come from `i18n.js`; only a test uses it).
  Test-only exports: `parseGrid` / `gridToString` (`grid.js`), `QUOTE_LISTS` (`quotes.js`) – keep
  or move to test helpers.
- [ ] Test duplicates: `fakeCanvas` / `fakeEnv` (confetti and shockwave unit tests), `almostSolved()`
  (`quotes.spec.js`, `shockwave.spec.js`), `hex()` (`coach.spec.js`, `themes.spec.js`) – shared helpers.
- [ ] Naming: `HINT_ANIM_MS` / `HINT_ANIM_REDUCED_MS` also time the Coach – rename to `FILL_ANIM_*`.

**B – split the two god functions** (medium effort, before the next bigger feature):
- [ ] `controller.js` → `startApp()` is one ~350-line closure (21 inner functions, ~15 shared
  variables: input, keyboard, mistake popups, Hint, Coach, language, dialogs, New Game, pool,
  saving, celebration). Move the Coach flow (~100 lines) and the win celebration into their own
  modules.
- [ ] `view.js` → `createView()` is ~270 lines (board, dialogs, Coach panel and marks, language,
  animations). Move the dialogs and the Coach panel / board marks into their own modules.

**Not worth it:** renaming `state.hints` (it counts Hint *and* Coach helps) – saved games would need
a migration; the meaning is documented in `game.js` and here.
