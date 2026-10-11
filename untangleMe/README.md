# Untangle Me

A small browser puzzle: a planar graph is scrambled so that its edges cross.
Drag the vertices until no two lines cross. Time and moves are counted.

No server, no build step: open `index.html` (double-click) or host the folder on
any static web host (GitHub Pages works).

## Playing

- **Puzzle** presets (Easy 6 / Normal 8 / Hard 14 / Insane 25 vertices) and a
  slider (6-30 vertices) start a new puzzle.
- **New puzzle** shuffles a new puzzle of the same size. **Reset** returns to the
  starting scramble of the current puzzle.
- **Copy link** copies a URL like `index.html#n=8&seed=4821`.
  Anyone opening it gets exactly the same puzzle.
- **View**: toggle crossing markers, hide the timer, switch the theme
  (Blueprint / Neon). Your choices are remembered in the browser (localStorage).
- The timer starts with your first move and pauses while the tab is hidden.
- Works on laptops and tablets. On phones (screen shorter side < 600 px) a notice
  is shown instead of the game.

## Project layout

```
index.html          page
css/base.css        structure and behaviour
css/themes.css      Blueprint and Neon (CSS variables)
js/config.js        constants: node limits, presets, edge density, ...
js/rng.js           seeded random numbers (mulberry32)
js/geometry.js      crossing detection
js/graph.js         planar graph generation, scrambling
js/puzzle.js        (n, seed) -> puzzle
js/game.js          state machine: moves, timer, solved, reset, pause
js/urlstate.js      #n=..&seed=.. parsing
js/settings.js      localStorage preferences
js/boardcoords.js   unit <-> SVG coordinate mapping
js/view.js          SVG board and dragging
js/confetti.js      win animation
js/main.js          wiring
tests/unit/         node --test
tests/e2e/          Playwright (Chromium, Firefox, WebKit, iPad, iPhone)
```

All scripts are classic `<script>` files sharing one global `UM` namespace, so the
game also works from `file://` (ES modules would not).

## Things to tweak

Everything is in [js/config.js](js/config.js): `MIN_NODES`, `MAX_NODES`,
`DEFAULT_NODES`, `PRESETS`, `EDGE_DENSITY` (1 = as many edges as fit without
crossings, lower = easier), `MIN_SCREEN_SIDE`, `THEMES`.

## Development

Needs Node.js LTS. Dev dependencies are only Playwright.

```
npm install
npx playwright install chromium firefox webkit   # once
npm test            # unit tests (seconds)
npm run test:e2e    # browser tests, starts a tiny static server itself
npm run test:all    # both
npm run test:live   # read-only smoke test of the deployed game
```

`npm run test:e2e` writes screenshots of both themes to `screenshots/`.
Playwright runs with 2 workers and 2 retries: on the Windows dev machine a page
load occasionally stalls for ~10 s in the test harness (never seen in the game).

## History

Originally based on Mike Bostock's d3 "Untangle" demo (d3 v2). The d3 dependency
was removed in the 2.0 refactor; see `refactor/` for the analysis, the UI
proposals and the implementation plan.
