# UntangleMe – implementation plan (for review)

Status: **draft, nothing implemented yet.** Builds on [refactor.md](refactor.md) and your answers.

## 1. Decisions taken (from your answers)

| Topic | Decision |
|---|---|
| Themes | Two, switchable: **Blueprint (default)** and **Neon**. Pure CSS variables. Mock-ups C and A are the visual reference. |
| Nodes | Presets Easy 6 / Normal 8 / Hard 14 / Insane 25 + slider **6–30**. Preset click = new puzzle immediately; slider applies on release. |
| Edge density | Not in UI. Constant `EDGE_DENSITY = 1.0` (full triangulation) in `config.js`. |
| Seeds | `mulberry32` PRNG. Puzzle = `(n, seed)`, kept in URL hash `#n=8&seed=4821`. "Copy link to this puzzle" button. No daily puzzle. |
| Reset | Button restores the starting scramble of the current puzzle (moves/time reset). No undo. |
| Pause | Timer pauses when the tab is hidden and resumes automatically when visible again. |
| Win | Confetti only (no banner, no overlay). Crossing counter turns "0". |
| View toggles | Show/hide crossing markers, show/hide timer (timer only). |
| Persistence | `localStorage`: theme, node count, marker toggle, timer toggle. No records. All access wrapped in try/catch. |
| Language | English only. |
| Small screens | Blocking notice ("Your display is too small – please use a tablet or larger"), no "play anyway". Tablets (portrait + landscape) work. |
| Hosting | GitHub Pages from `main`, entry page renamed to `index.html`. |
| Git | Work directly on `main`; **one commit per phase after its tests are green**. Pushing is a separate step I will ask you about (every push goes live on Pages). |
| Mock-ups | `refactor/proposals/` stays for now. |

### Additional decisions I'd like you to confirm (flagged in §7)

1. **Drop d3 from the game.** After the refactor only `scale.linear`, `select` and `drag` are used; plain DOM/SVG + pointer events (already proven in the mock-ups) is shorter, works with the responsive `viewBox`, and is easier to test. `d3.js` is deleted from `untangleMe/` (still in git history). This is consistent with "don't upgrade d3": nothing is upgraded, the dependency just goes away.
2. **No drag jitter.** The old `Math.random()*1e-4` offset is removed (it breaks determinism of seeded puzzles); coincident nodes are handled by the intersection logic instead.
3. **Small-screen check uses the device screen** (`min(screen.width, screen.height) < 600` CSS px), not the window size, so a small laptop window is not blocked – the board just scales down.

## 2. Target structure

```
untangleMe/
  index.html            (renamed from untangleMe.html)
  css/
    base.css            reset, flex layout, controls, notice
    themes.css          [data-theme=blueprint] / [data-theme=neon] variables + theme-specific bits
  js/                   classic <script> files, one namespace `UM`, works from file:// and Pages
    config.js           constants (MIN/MAX/DEFAULT nodes, PRESETS, EDGE_DENSITY, BOARD size, MIN_SCREEN_SIDE)
    rng.js              mulberry32(seed), randomSeed()
    geometry.js         cross, segment intersection (robust), countCrossings -> {count, edgeFlags, nodeFlags, points}
    graph.js            planarGraph(n, rng, density), scramble(graph, rng)  [pure, no DOM]
    puzzle.js           createPuzzle(n, seed) -> {n, seed, nodes, edges, solution, start}
    game.js             state machine, moves, timer (injectable clock), reset, pause/resume
    urlstate.js         parse/serialise hash, clamping
    settings.js         localStorage load/save with defaults
    confetti.js         canvas particles, honours prefers-reduced-motion
    view.js             SVG rendering, pointer drag, DOM bindings
    main.js             wiring: boot, events, visibility, small-screen check
  assets/favicon.svg
  tests/
    unit/*.test.js      node:test
    e2e/*.spec.js       Playwright
    e2e/server.js       20-line static server (so e2e runs over http like Pages)
  package.json  playwright.config.js  .gitignore (node_modules, test-results)
  README.md
```

Module pattern for each `js/*.js`: `const UM = (globalThis.UM = globalThis.UM || {}); UM.rng = {...};` – loads in the browser via `<script>` and in Node tests via `require()`, no bundler.

## 3. Key design rules

- **Determinism:** same `(n, seed)` ⇒ identical graph, solution layout and scramble, in every browser. No `Math.random()` anywhere in game logic.
- **Intersection semantics** (`geometry.js`): two edges sharing a node cross only if they overlap collinearly; otherwise a proper intersection **or a node lying on another edge** counts as a crossing. Zero-length edges are impossible by construction but must not produce `NaN`. Identical segments are not reported as crossings (old bug).
- **Scramble:** re-roll until ≥ 1 crossing, with an attempt cap (10 000) that throws; unit-tested for all n in 6–30.
- **Game states:** `idle` (scrambled, untouched) → `playing` (first real displacement; timer starts) → `solved` (crossings == 0; timer stops, confetti). In `solved`, further drags are allowed but never restart the timer or re-fire confetti until New/Reset. A "move" is a drag that displaced a node by more than an epsilon.
- **Timer:** monotonic clock injected (`now()`), accumulates elapsed time across pause/resume; displayed `0.0`.
- **Layout:** flex; board is an SVG with fixed `viewBox` 800×560 scaled to the available space; `touch-action: none` on the board; pointer events + pointer capture.
- **No build step, no runtime dependencies.** Node/Playwright are dev-only.

## 4. Phases

Rule for every phase: implement → add/extend tests → run `npm test` (and `npm run test:e2e` from phase 5 on) → fix until green → commit on `main` → tick the boxes here. If a test fails and the fix would change a decision above, I stop and ask you.

Commit trailer for every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Phase 0 – Tooling & scaffolding
- [x] Install Node LTS with Chocolatey (`choco install nodejs-lts -y`; needs an **elevated** shell – if mine isn't, I'll ask you to run that one command).
- [x] `npm init`, dev-dependency `@playwright/test`; `npx playwright install chromium firefox webkit`.
- [x] Add `.gitignore` (`node_modules`, `test-results`, `playwright-report`).
- [x] Add npm scripts: `test` (node --test), `test:e2e` (playwright), `test:all`.
- [x] Entry page is now `index.html` (done in Phase 4 together with the new page).
- [x] ~~Characterisation e2e test of the **old** game~~ skipped: the old game was replaced in Phase 4 before it paid off; the new e2e suite covers the same ground. Original text: Characterisation e2e test of the **old** game: page loads, 8 circles, crossings > 0, "New Graph" changes the graph, node count input changes circle count.
- **Tests:** the characterisation spec runs green in Chromium/Firefox/WebKit; a trivial unit test proves `node --test` works.
- [x] Commit: "Add Node/Playwright tooling, rename entry page to index.html".

- Note: Playwright runs with `retries: 2` because a page load occasionally stalls ~10 s (test server / WebKit on Windows; not the game). It is capped at `workers: 2` in `playwright.config.js` - 3-4 parallel browsers made page loads stall on this machine.

### Phase 1 – Pure core: rng, geometry, graph
- [x] `config.js`, `rng.js` (mulberry32), `geometry.js`, `graph.js`, `puzzle.js` per §2/§3 (ported from the old `planarGraph`, `addPlanarLink`, `scramble`, `intersect`, with density limit and attempt cap).
- [x] Minimal `package.json` (`npm test`) and `.gitignore` added here, because Phase 1 needs the unit-test runner (rest of Phase 0 still open).
- **Tests (unit):**
  - rng: same seed ⇒ same sequence; different seeds differ; values in [0,1).
  - geometry: X-cross, T-touch, shared endpoint, collinear overlap, collinear disjoint, identical segments, zero-length edge (no NaN), node on edge.
  - graph: for n = 6…30 and 50 seeds each: generated layout has **0** crossings; edge count within `2n−3 … 3n−6` at density 1.0 (a maximal straight-line planar graph has `3n−3−h` edges, `h` = hull nodes, so it is *not* always `3n−6`), and `≤ round(density·(3n−6))` for lower densities; scramble has ≥ 1 crossing; same `(n, seed)` ⇒ deep-equal puzzle; solution layout still has 0 crossings.
  - performance guard: n = 30 puzzle creation < 200 ms.
- [x] Commit: "Core: seeded planar graph generation and robust crossing detection".

### Phase 2 – Game state machine
- [x] `game.js`: `createGame(puzzle, clock)`, `moveNode(i, x, y)`, `beginDrag/endDrag` (move counting), `reset()`, `pause()/resume()`, `elapsed()`, derived `crossings`, `status`, subscribe/notify.
- **Tests (unit, fake clock):** idle→playing on first displacement only; click without movement is not a move; timer starts on first move, not at creation; solved when moved to `solution`; timer frozen after solved; dragging after solved doesn't resume timer or re-emit `solved`; reset restores start positions, zero moves/time, status idle; pause/resume excludes paused span; pause while idle is a no-op; clamping to [0,1].
- [x] Commit: "Game state machine with timer, moves, reset and pause".

### Phase 3 – URL state & settings
- [x] `urlstate.js`: `parse(hash) → {n, seed}`, `serialise`, clamp `n` to `[MIN_NODES, MAX_NODES]`, invalid/missing seed ⇒ random seed (then written back with `history.replaceState`).
- [x] `settings.js`: load/save `{theme, nodes, showMarkers, showTimer}` with defaults, tolerant of corrupt JSON and unavailable storage.
- **Tests (unit):** hash round trips; garbage (`#n=abc&seed=-3`, `#n=999`) is clamped/replaced; unknown keys ignored; settings defaults; corrupt JSON ⇒ defaults; storage throwing ⇒ defaults and no exception; unknown theme name ⇒ Blueprint.
- [x] Commit: "URL hash and persisted settings".

### Phase 4 – New page, layout, Blueprint theme, view
- [x] New `index.html`: header (title, tagline), flex layout with board + side panel (stats, controls placeholders), meta viewport, `data-theme` on `<html>`.
- [x] `css/base.css`, `css/themes.css` – Blueprint complete, ported from mock-up C (grid sheet, title block, stat rows).
- [x] `view.js`: render edges/nodes/crossing markers from game state, pointer drag with `getScreenCTM` conversion, live crossing counter + timer + moves.
- [x] `main.js`: boot from URL hash → puzzle → game → view; "New puzzle" button; remove d3 `<script>`, delete `d3.js`, `untangleMe.js`, inline CSS.
- [x] Small-screen notice (§1 decision 3) with CSS + JS gate; game is not initialised while blocked.
- **Tests:**
  - unit: view helper that maps client coords → board coords (pure function, tested with a fake matrix).
  - e2e (3 engines): page loads with n = 8 circles; counters render; dragging a node with the real mouse changes `cx/cy`, increments moves, starts timer; dragging all nodes onto `UM.game` solution positions gives crossings 0 and `status === 'solved'`; `#n=10&seed=7` yields 10 nodes and the same edge list on reload; **iPad** viewport (landscape + portrait) shows the board; **iPhone** emulation shows the notice and no board.
- [x] Commit: "New responsive UI with Blueprint theme (d3 removed)".

### Phase 5 – Controls: presets, slider, reset, copy link, toggles, theme, pause
- [x] Preset buttons (6/8/14/25) → new puzzle; slider 6–30 (applies on release, label shows value); **Reset**; **Copy link** (`navigator.clipboard`, fallback `execCommand`/selectable input; brief "Copied" label).
- [x] Toggles: crossing markers, timer visibility; **Theme switch** (Blueprint ⇄ Neon, placeholder Neon = Blueprint variables until phase 7).
- [x] Persist settings on change; restore on load (hash n wins over stored n).
- [x] `visibilitychange` → `game.pause()/resume()`.
- **Tests:**
  - e2e: each preset yields the right node count and updates the URL hash; slider release changes node count, bounds 6/30 respected; Reset restores identical coordinates and zeroes counters; Copy link puts the current URL on the clipboard (Chromium permission granted; other engines assert the fallback input value); markers toggle hides `.mark` elements; timer toggle hides only the timer; reload keeps theme/toggles/node count; hash overrides stored node count; simulated `visibilitychange` (dispatch + `document.hidden` override) pauses and resumes the timer (elapsed unchanged while hidden).
- [x] Commit: "Controls: presets, slider, reset, copy link, toggles, theme switch, pause on blur".

### Phase 6 – Neon theme
- [x] Port mock-up A into `themes.css` under `[data-theme=neon]` (glow via `filter: drop-shadow`, grid background, neon stats); both themes use the same markup.
- **Tests:** e2e – switching theme sets `data-theme`, changes computed edge stroke colour, persists across reload; screenshots of both themes (idle + solved) saved to `test-results/` for your eyeballing (no pixel-diff assertions – too brittle across engines).
- [x] Commit: "Neon theme".

### Phase 7 – Confetti, title, favicon
- [x] `confetti.js`: full-board canvas, ~120 particles, ≈4.5 s, `requestAnimationFrame`, removed afterwards, skipped under `prefers-reduced-motion`; fired once on transition to `solved`.
- [x] `<title>Untangle Me</title>`, `assets/favicon.svg` (tangled-graph glyph, theme-neutral); tab title shows "✓ Untangle Me" while solved.
- **Tests:** unit – confetti module with a fake canvas context: spawns N particles, stops and cleans up after duration; e2e – solving a puzzle creates the confetti canvas exactly once and it disappears; with `reducedMotion: 'reduce'` it never appears; title toggles on solve and resets on New; favicon link present.
- [x] Commit: "Confetti on win, title and favicon".

### Phase 8 – Cross-browser hardening
- [x] Playwright projects: Chromium, Firefox, WebKit (desktop), WebKit iPad landscape/portrait, WebKit iPhone (notice only).
- [x] One test loading `index.html` via `file://` (double-click scenario).
- [x] Touch drag test on iPad profile (`touchscreen` / pointer events).
- [x] Console-error guard: every e2e test fails on `pageerror` or `console.error`.
- [x] Stress: n = 30 drag stays responsive (a drag of 50 pointer moves finishes < 1 s).
- **Tests:** the above; full `npm run test:all` green on all projects.
- [x] Commit: "Cross-browser and device test matrix".

### Phase 9 – Docs & deployment
- [x] `untangleMe/README.md`: how to play, run locally (double-click or `npx http-server`), run tests, constants to tweak (`MAX_NODES`, `EDGE_DENSITY`, presets).
- [x] Update `refactor.md` status; keep `proposals/`.
- [ ] **Ask you** before pushing; then `git push`; you (or I via `gh`) enable Pages: Settings → Pages → *Deploy from branch → main / (root)*.
- [x] Live smoke test written (`npm run test:live`, config `tests/e2e/live.config.js`) - **to be run after the push and enabling Pages**.
- [ ] Commit: "Docs"; push after your OK.

---

## 5. Test strategy summary

| Layer | Tool | Runs | Covers |
|---|---|---|---|
| Unit | `node --test` (no packages) | `npm test`, < 5 s | rng, geometry, graph, puzzle, game, url, settings, confetti |
| E2E | Playwright (Chromium, Firefox, WebKit, iPad/iPhone emulation) | `npm run test:e2e` | real drag/solve, URL, controls, themes, persistence, pause, small-screen notice, `file://` |
| Manual | you | at the end | look & feel in Firefox/Chrome on laptop, then Safari on iPad |

Automatic regression: `npm run test:all` before every commit. CI on GitHub Actions is **not** planned (can be added later with ~15 lines).

## 6. Risks

- **Choco install needs admin rights** – may require you to run one command.
- **WebKit-on-Windows (Playwright)** is close to, but not identical to, iPad Safari; clipboard and touch quirks may only show on the real iPad.
- **Pointer drag on iPad** inside a scaled SVG: covered by the coordinate-mapping unit test plus the touch e2e test, but final proof is your iPad session.
- **Every push goes live** on Pages; I will ask before the first push.

## 7. Points to confirm in review

1. Dropping d3 entirely (decision 1 in §1) – OK?
2. Small-screen gate based on device screen size, threshold 600 CSS px (decision 3) – OK?
3. Tab title shows "✓ Untangle Me" while solved – nice or unnecessary?
4. Copy-link button text/behaviour: copies the full current URL incl. hash – OK?
5. Any change to the phase order or the "one commit per phase" rule?
