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
- **Hint** (at most four per game, shown as `Hint n/4`): the selected empty cell
  (or the next logical cell) slowly shows its digit. After the fourth hint the
  button does nothing.
- **Three mistakes lose the game:** the board shakes, the screen fades to grey
  and a popup offers *Play Again*.
- **New Game** and the **Level** dropdown (Beginner, Expert, Master) ask before
  they abandon a game with progress. **Colours** switches the colour scheme
  (Black & White is the default).
- Your colour scheme, level and the complete game in progress (including notes
  and mistakes) are remembered in the browser.
- Keyboard (desktop): arrow keys move, `1`–`9` enter a digit, `Shift+1`–`9`
  toggle a note, `H` gives a hint, `Esc` cancels a question.

| Level | Clues | Hardest technique needed |
|---|---|---|
| Beginner | 38–42 | singles |
| Expert | 30–34 | + pairs, triples, pointing/claiming |
| Master | 24–28 | + X-Wing, Swordfish, XY-Wing |

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
   the new version.

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
  generator.worker, generator-client, pool
                                  generation off the main thread, one puzzle per level in storage
  game, highlight                 rules: locking, mistakes, notes, hint; highlight sets
  view, numpad, controller        rendering, tap-vs-hold, wiring
  settings, store, storage        remembered scheme/level, saved game, safe localStorage
icons/, tools/make-icons.mjs      app icons and their generator
tests/unit, tests/e2e             node:test and Playwright
```
