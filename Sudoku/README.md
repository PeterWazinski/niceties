# Sudoku

An ad-free Sudoku for the browser. Three levels, symmetric puzzles generated on
the device, no timer, no score, and it works offline once it has been loaded.
Made for an iPhone (~6") and an iPad (~10"); it should work on Android and
desktop browsers too.

Specification: [design/PRD.md](design/PRD.md) · plan: [design/implementation.md](design/implementation.md)

## Playing

- **Select a cell**, then tap a number. A correct digit is locked and can no
  longer be changed. A wrong digit turns red and counts as a mistake (`n/3`),
  and a popup tells you so. After **OK** the wrong digit fades out slowly.
- **Highlighting:** an empty cell lights up its row, column and box. A filled
  cell also lights up every identical digit. Digits that break a rule are red.
- **Notes:** *hold* a number (about 0.35 s) to add or remove a pencil note in
  the selected empty cell. A note may be set even if the digit is already in the
  row, column or box. When you place a correct digit, its notes disappear from
  that row, column and box. The first time, a small tip explains this.
- **Hint**: the selected empty cell (or the next logical cell) slowly shows its
  digit.
- **Coach**: explains the easiest next move on the whole board, step by step. The
  cells involved show their candidates; candidates that a step removes are red
  and struck through, the deciding ones bold. Often no cell can be filled
  directly: then some steps only remove candidates ("Step 1 of 3"), each confirmed
  with **Next**; the last step, a single, is confirmed with **Fill**, which places
  the digit. **Close** stops
  at any time and costs nothing. Your own notes are hidden while coaching and come
  back unchanged.
- **Helps:** Hint and Coach share four helps per game, shown as four dots between
  the two buttons (a filled dot is a used help). After the fourth both buttons do
  nothing.
- **Three mistakes lose the game:** the board shakes, the screen fades to grey
  and a popup offers *Play Again*.
- **Winning:** confetti rains over the *Solved!* message – in the Star Wars scheme
  a shockwave of light races out from the last cell instead. Neither appears with
  "Reduce Motion" switched on.
- **Star Wars quotes:** the mistake popups (encouraging after the first, a warning
  after the second), the lost and the solved popup each show a Star Wars quote –
  some real film lines with their speaker, mostly parodies. The lists live in
  `design/quotes-en.md` and `design/quotes-de.md`; after editing them run
  `node tools/make-quotes.mjs`.
- **New Game** and the **Level** dropdown (Youngling, Padawan, Jedi – in German
  Jüngling, Padawan, Jedi) ask before
  they abandon a game with progress. **Colours** switches the colour scheme
  (Star Wars – a starfield with a glowing blue board – is the default; also Black &
  White, Blue, Sepia, Dark, Forest and Rainbow).
- **Language:** English and German. The game starts in the language of your
  device (German on a German device, English otherwise); the **🌐 EN / 🌐 DE**
  button in the header shows the current language and switches with one tap.
  Technique names in the Coach stay English.
- Your colour scheme, language, level and the complete game in progress
  (including notes and mistakes) are remembered in the browser.
- Keyboard (desktop): arrow keys move, `1`–`9` enter a digit, `Shift+1`–`9`
  toggle a note, `H` gives a hint, `C` opens the Coach (`Enter` = Next/Fill,
  `Esc` closes it), `Esc` cancels a question.

| Level | Clues | Hardest technique needed |
|---|---|---|
| Youngling | 38–42 | singles |
| Padawan | 30–34 | + pairs, triples, pointing/claiming |
| Jedi | 24–28 | + X-Wing, Swordfish, XY-Wing |

## Offline and "Add to Home Screen"

A service worker caches the whole app on the first visit. After that the game
loads and plays without a network, and *New Game* works offline, because puzzles
are generated on the device (in a Web Worker, with a pre-generated puzzle per
level kept ready).

- Open the page once while online. To check, switch to airplane mode and reload.
- On iPhone/iPad use *Share → Add to Home Screen* for a full-screen app without
  the Safari toolbars. **iOS may delete the cached files of a website that has
  not been used for about a week; an app added to the Home Screen is exempt.**
  If it ever happens, just open the page once online again.
- The service worker needs HTTPS (or `localhost`).

## Running locally

No build step. Serve this folder with any static web server (ES modules and the
service worker do not work from `file://`):

```
node tests/e2e/server.js        # http://localhost:4174/
```

`?seed=N` in the URL makes the games reproducible (N, N+1, …; used by the tests).

## Publishing on GitHub Pages

The game is a static folder; there is nothing to build.

1. In the repository settings enable **Pages** (deploy from the branch that holds
   this folder, root).
2. The game is then served at `https://<user>.github.io/<repo>/Sudoku/`.
   All URLs inside the app are relative, so the sub-path works.
3. After changing app files, increase `VERSION` in `sw.js`, so that devices fetch
   the new version. An open or installed app picks it up on its next start: the new
   version installs in the background and the page reloads itself once (the game in
   progress is kept).

All projects of the repository share one origin; this game prefixes its
`localStorage` keys with `sudoku.` and its caches with `sudoku-` and its service
worker only controls the Sudoku folder.

## Tests

```
npm install
npx playwright install     # once
npm test                   # unit tests (node --test)
npm run test:e2e           # headless browser tests: iPhone, iPad portrait/landscape, desktop
npm run test:all
```

The browser tests include an offline test (`context.setOffline(true)`), layout
checks on the device sizes, accessibility checks and screenshot baselines
(`tests/e2e/*-snapshots`, rendered on Windows; regenerate with
`npm run test:e2e -- --update-snapshots` on another OS).

## Project layout

```
index.html, manifest.webmanifest, sw.js
css/base.css, css/themes.css      layout / colour schemes (CSS variables)
js/                               game logic (pure) and the DOM layer
  grid, rng, solver, symmetry     geometry, seeded random, bitmask solver, symmetries
  techniques, generator           human solving techniques, puzzle generation + grading
  coach                           Coach chain, pruning, board marks and explanation texts
  i18n                            every text in English and German, device-language detection
  quotes                          Star Wars quotes for the popups (generated), shuffled deck
  generator.worker, generator-client, pool
                                  generation off the main thread, one puzzle per level in storage
  game, highlight                 rules: locking, mistakes, notes, hint, coach fill; highlight sets
  view, numpad, controller        rendering, tap-vs-hold, wiring
  confetti, shockwave             win celebrations (shockwave only in Star Wars)
  settings, store, storage        remembered scheme/level/language, saved game, safe localStorage
icons/, tools/make-icons.mjs      app icons and their generator
tools/make-quotes.mjs             writes js/quotes.js from design/quotes-*.md
tests/unit, tests/e2e             node:test and Playwright
```
