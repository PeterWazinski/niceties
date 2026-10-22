# Penrose Colors – Colour Tool: Implementation Plan

Implements the **exploration tool (step 1)** of [PRD.md](PRD.md). Section numbers (e.g. "PRD 6")
refer to it. **Only the colour tool is planned here.** The puzzle game (PRD 9) gets its own plan
later, after the inception phase with the tool.

## Folders

```
PenroseColors/
  start.cmd, server.mjs     launcher and local web server (exist; serve the whole PenroseColors folder)
  color_tool/               this plan: the colour tool (index.html, css/, js/, tests/, package.json)
  PenrosePuzzle/            later: the puzzle game (not part of this plan)
  design/                   PRD.md, vision.md, this file, exploration results
```

Paths in the PRD ("`js/`", "`index.html`") are relative to `color_tool/`. The tool is served at
`http://localhost:4175/color_tool/`. The logic modules (tiling, colouring, shuffle, uniqueness) are
written without any dependency on the tool's UI, so the puzzle can import them later (by relative
path, or after moving them to a shared folder).

## Working rules

The rules of the repository [CLAUDE.md](../../CLAUDE.md) apply. In short:

1. **Phases are done in order.** Each phase ends with a green test run and a commit.
2. **Checkboxes** in this file are ticked at the end of each phase, only for work that is
   delivered *and* covered by passing tests; an item not delivered stays unticked with a note why,
   or moves to a later phase. The updated file is part of the phase commit.
3. **Phase gate (every phase):**
   - [ ] `npm run typecheck` (`tsc --noEmit`, TypeScript as a checker for the JSDoc-typed JavaScript) reports no errors.
   - [ ] `npm test` (unit, `node --test`) passes: **all** tests.
   - [ ] `npm run test:e2e` (headless Playwright, all four projects: iPhone, iPad portrait, iPad landscape, desktop) passes: **all** tests.
   - [ ] No skipped, `.only` or quarantined tests, no retries (`retries: 0`); a flaky test is fixed, not rerun.
   - [ ] Tests written in the phase cover every work item of the phase; earlier tests still pass.
   - [ ] This file is updated (boxes ticked).
   - [ ] All files of the phase committed (`git add -A` in `PenroseColors/color_tool`, `git status` clean afterwards), message `PenroseColors color tool: phase N – <title>`, with the attribution line configured for the repository.
   - Never commit red. If a test fails, fix the cause in the same phase.
4. **Stack:** plain HTML/CSS/**ES modules**, no framework, no build step, SVG rendering. Dev
   dependencies only `@playwright/test`, `typescript` and `@types/node`. TypeScript is used **only
   as a checker** (`checkJs`, `noEmit`): the sources stay `.js` with JSDoc types, nothing is compiled. Same conventions as Sudoku (`tests/unit/*.test.js`,
   `tests/e2e/`, `playwright.config.js`).
5. **Pure logic first, DOM later:** everything except `view.js`, `controller.js`, `main.js` runs
   under Node without a DOM.
6. **Determinism:** all randomness through the seeded `rng.js`; the same URL gives the same picture.
7. **Speed over polish:** the tool is to be built quickly; the aim is to see many colourings soon.
   Phases 1–3 give a usable tool; 4 and 5 add the uniqueness research and the finish.

## Test infrastructure (phase 0, used by all)

- `color_tool/package.json` scripts: `typecheck` → `tsc --noEmit`, `test` → `node --test "tests/unit/*.test.js"`,
  `test:e2e` → `playwright test`, `test:all` → typecheck + both. `"type": "module"`.
- `tsconfig.json`: `allowJs`, `checkJs`, `noEmit`, `target`/`module` ES2022, `lib` ES2022 + DOM, `strict` off
  at first (tightened later), `include` `js/**`, `tests/**`, `../server.mjs`. Core data types (`Tile`,
  `Settings`, `Arrangement`, …) are JSDoc `@typedef`s in `js/types.js`; public function signatures are annotated.
- `playwright.config.js`: `webServer` runs `node ../server.mjs` (port 4175, `reuseExistingServer`),
  `baseURL` `http://localhost:4175/color_tool/`, `retries: 0`, projects `iphone`, `ipad-portrait`,
  `ipad-landscape` (WebKit device descriptors) and `desktop` (Chromium).
- e2e helpers (`tests/e2e/helpers.js`): open the tool with a URL query (fixed seeds), read tile
  colours and types from the SVG (`data-id`, `data-type`, `fill`), drag a tile onto another with
  the mouse, tap two tiles.
- Unit tests compare against **known values** (tile counts, areas, colour conversions) and
  against brute force on small patches (symmetries, minimal anchors).

---

## Phase 0 – Scaffold and test harness

Goal: an empty but runnable tool with the test pipeline working.

- [x] `color_tool/` folder structure (`index.html`, `css/`, `js/`, `tests/unit`, `tests/e2e`), `.gitignore` (`node_modules`, `test-results`, `playwright-report`)
- [x] `package.json`, `npm install`, `npx playwright install` (same `@playwright/test` version as Sudoku)
- [x] TypeScript as a checker: dev dependencies `typescript` and `@types/node`, `tsconfig.json` and the `typecheck` script as described in the test infrastructure; `js/types.js` with the first `@typedef`s; VS Code shows the errors in the editor
  (no extension needed)
- [x] `playwright.config.js` with the four projects and the `webServer` of `../server.mjs`
- [x] `index.html` with an empty `<main id="app">` and `<script type="module" src="js/main.js">`; dark background; `viewport-fit=cover`
- [ ] `start.cmd` opens `http://localhost:4175/color_tool/` (written; the server behind it is tested, but the launcher itself still has to be double-clicked once by hand)
- [x] `color_tool/CLAUDE.md` (commands, code map placeholder); repository README table and root `CLAUDE.md` list the new project
- [x] Tests: `npm run typecheck` is clean (also proven by a deliberately wrong call that `tsc` rejects, checked once by hand); unit sanity test (imports `js/config.js`: φ, default settings); e2e smoke test (page loads, no console errors, `#app` exists) in all four projects

## Phase 1 – Tiling (PRD 4.1, 4.2 part 1)

Goal: generate P3 patches and draw them as plain outlines. *Delivered with a deviation: lone half-rhombs at the patch edge are dropped, so depth 0 has no tiles and the useful depths are 1–5 (10–430 tiles for the wheel).*

- [x] `rng.js`: seeded generator (e.g. mulberry32 or the one of Sudoku), `int(n)`, `shuffle(array)`
- [x] `penrose.js`: seeds as lists of Robinson triangles – **`wheel` (ten triangles), `half` (five) and `fan` (three)**; *sun* and *star* are not implemented (they need the arrow matching rules to label their triangles; the wheel gets a five-fold centre of five thick rhombs from depth 1 anyway); subdivision (deflation) of the two triangle kinds by the golden ratio; merging triangle pairs into thick and thin rhombs; snapping of shared vertices with a tolerance
- [x] Tile list: `id` (stable for seed + depth), `type` (`thick` | `thin`), vertices, centre, neighbour ids (shared edge), `ancestors` (parent id per coarser level, PRD 13); also boundary flag
- [x] Patch outline and bounding box; `fit(width, height)` transform (centred, scaled, margins)
- [x] `view.js` (first part): SVG with one `<polygon data-id data-type>` per tile, outlines only (no colours yet); `controller.js` + `main.js`: controls for **seed** and **depth**; warning above 250 tiles, refusal above 700 (PRD 4.1)
- [x] Unit: tile counts for every seed and depth 0–5 against known values; thick : thin tends to φ; total tile area equals the area of the patch outline (no gaps, no overlaps); every edge is shared by exactly two tiles or lies on the boundary; all tiles have the right angles (72°/108° thick, 36°/144° thin); determinism (same seed and depth → identical list); every tile has one ancestor per coarser level and ancestors nest correctly
- [x] e2e: seeds × depths render the expected number of polygons; the picture fits the window in all four layouts (no scrolling, margins); changing the controls redraws; refusal message above 700 tiles

## Phase 2 – Colouring, sliders and URL (PRD 4.3, 5, 8 part 1)

Goal: the heart of the tool: colour the tiles from a plane through the HSL cone, with live sliders.

- [x] `color.js`: HSL → sRGB (8-bit) and back, clamping; **the 8-bit sRGB value is the colour of a tile everywhere** (PRD 5)
- [x] Mappings: `plane` (hue along `u`, saturation and lightness by plane slopes, rotation), `radial`, `angular`; tile-type lightness shift `dt` (PRD 5.1–5.3)
- [x] `colouring.js` (or in `color.js`): `colourTiles(tiles, settings)` → array of `#rrggbb` per tile id; colour statistics: number of different colours, groups of tied tiles (PRD 5.4)
- [x] `params.js`: settings ↔ URL query (PRD 4.3 table), validation, defaults, unknown values ignored; the URL is updated without reload
- [x] Controls: mapping selector and **sliders** for hue start/end, saturation, lightness, saturation slope, lightness slope, rotation, tile-type shift, gap, each with a visible value; only the sliders that apply to the mapping are shown; **Copy link** button (clipboard, with fallback)
- [x] Redraw while a slider moves: recolour the existing polygons, never rebuild the tiling; statistics shown (colours, ties)
- [x] Unit: HSL→sRGB against known values and round trip; `plane` mapping is monotonic along `u` and continuous; for generic parameters all tile colours are distinct; `radial`/`angular` on a symmetric patch produce ties; `dt` changes only the lightness of thin tiles; `params` round trip and rejection of bad values; same settings → identical colours
- [x] e2e: URL parameters change the picture (compare `fill` values); every slider changes at least one tile colour and the URL; Copy link puts the current URL on the clipboard; reload with the same URL reproduces the colours; screenshot baselines for three default colourings per project

## Phase 3 – Shuffle and manual solving (PRD 6)

Goal: play with a colouring: shuffle, swap by drag and drop or by taps, count the swaps.

- [x] `puzzle.js`: state = target colours (from phase 2) + current arrangement; **two independent permutations** (thick, thin); `swap(a, b)` only for two tiles of the same type, returns `refused` otherwise; undo stack; reset; `solved`
- [x] Shuffle: seeded, by strength (all / percentage) and **to a target number of minimum swaps**; `minimumSwaps` = tiles − cycles per type, summed; shuffle seed in the URL (`shuffle`)
- [x] View: tile colours come from the arrangement; **drag and drop** with pointer events (the dragged colour follows the pointer, valid targets highlighted, drop elsewhere cancels; `touch-action: none` on the board); **two-tap swap** with selection highlight; sorted preview (button, hold or toggle); swap cross-fade ≈ 200 ms, shorter with `prefers-reduced-motion`
- [x] Controls and status: *Shuffle* with strength/target, *Reset*, *Undo*, *Sorted preview*; status line with swaps made, minimum swaps, "solved" message
- [x] Keyboard: arrow keys move the selection between neighbours, Enter selects/swaps, live region announces swaps and "solved"
- [x] Unit: shuffle determinism; shuffled arrangement is a permutation inside each type; thick/thin swap refused; `minimumSwaps` equals the length of an optimal solution found by brute force on small patches; shuffle to a target of k swaps yields minimum swaps k (or the closest possible, documented); undo/reset restore exactly; solving by the optimal swap sequence reaches `solved`
- [x] e2e: shuffle → picture differs from sorted and is reproducible from the URL; drag and drop swaps two colours; dropping on a tile of the other type or outside does nothing; two taps swap; the swap counter and minimum swaps are right; solving a small patch shows "solved"; touch (iPhone/iPad projects) works for tap and drag

## Phase 4 – Symmetry, uniqueness and anchors (PRD 4.2, 7)

Goal: answer vision question 3: how many tiles must stay fixed for a unique solution?

- [x] `symmetry.js`: symmetry group of a patch as permutations of tile ids: test the candidate rotations and reflections about the origin (multiples of 18°; every seed is cut from the wheel, so the origin is its centre) against the tile set (types and centres, with tolerance); identity always included
- [x] `uniqueness.js`: colour ties; for every symmetry *g* with `colour(g(t)) ≠ colour(t)` somewhere, the set of tiles that rule it out; unique ⇔ every such set meets the anchor set; **minimal anchor set** by greedy hitting set, exact search over the coverage of the symmetries (up to 20, greedy beyond); result object (unique?, ties, symmetries not ruled out, anchors used)
- [x] Anchors: edit mode (click/tap or long press toggles an anchor, dot drawn on the tile), *Clear anchors*, *Suggest* (fills the minimal set); anchors in the URL (`anchors`); shuffle never moves them; anchored tiles cannot be selected or dragged (phase 3 code honours them)
- [x] Status area: unique / not unique, number of symmetries not ruled out, tied tiles, anchors used
- [x] Unit: symmetry group sizes of the known seeds (e.g. 10 for a wheel with full dihedral symmetry, 2 for a half seed, 1 for an asymmetric patch); every symmetry maps tile centres and types onto tiles; colour ties found for symmetric colourings and none for generic plane colourings; for small patches the minimal anchor set is verified **by brute force over all anchor subsets**; the greedy result is never smaller than the exact one and always valid; anchored tiles never change in a shuffle
- [x] e2e: toggling anchors changes the uniqueness status; *Suggest* makes the status "unique"; anchored tiles refuse selection and drag; anchors survive a reload via the URL

## Phase 5 – Finish: layout, accessibility, robustness

Goal: pleasant to use on desktop, iPad and iPhone; no rough edges.

- [x] Layout: control panel beside the board (landscape) or below it (portrait), sliders usable by touch, all controls reachable at 390 px width; dark neutral background
- [x] Accessibility: labels for controls and sliders, visible focus, live region, `prefers-reduced-motion`
- [x] Robustness: bad or missing URL parameters fall back to defaults with a short note; very large patches handled as in phase 1; clipboard failure handled
- [x] Performance check: 250 tiles redraw smoothly while a slider moves; a swap and a shuffle feel instant (measured in an e2e test with a generous limit)
- [x] `color_tool/README.md` (what it is, how to start with `start.cmd`, the URL parameters, tests); `color_tool/CLAUDE.md` code map completed
- [x] Unit/e2e: layout fits in all four projects (no horizontal scroll, controls visible), automated accessibility scan (axe) passes, bad URL parameters, screenshot baselines refreshed

## Phase 6 – Exploration results (answers to the vision questions)

Goal: use the tool and write down what we learned, as input for the puzzle plan. Mostly manual work;
the tool is only fixed if the exploration finds bugs.

- [x] Collect **appealing patterns** (seed, depth, tile count) with screenshots or URLs – vision question 1
- [x] Collect **appealing colourings** as URLs (plane, radial, angular; hue ranges, slopes) and note which are pleasant to repair after shuffling – vision question 2
- [x] **Uniqueness:** for at least three seed/colouring combinations record the number of anchors that made them unique, and which colourings need none – vision question 3
- [ ] **Swap budgets:** try 30 / 80 / 200 minimum swaps by hand; note how long it takes and which tile counts feel right (PRD 12, open question 2) – *not done: needs a human player. The arithmetic (which patches carry which budget) is in `exploration-results.md` section 4; the play test is yours.*
- [x] `design/exploration-results.md` with the findings, URLs, and open questions for the puzzle; PRD 12–13 updated (hierarchy colouring, perceptual difficulty, hue ranges) where the findings change them
- [ ] Decision: go/no-go for the puzzle and the first outline of its plan (`PenrosePuzzle/`) – *the recommendation (go) is in `exploration-results.md` section 5; the decision is yours*

---

## Requirements trace

| PRD | Phase | Tests |
|---|---|---|
| 3 Platform (server, ES modules, touch + mouse) | 0, 3, 5 | e2e smoke, touch tests, layout |
| 4.1 Generation, seeds, depth | 1 | unit penrose (counts, area, edges, angles), e2e render and fit |
| 4.2 Symmetry data | 4 | unit symmetry |
| 4.3 URL parameters | 2, 3, 4 | unit params, e2e URL round trips |
| 5 Colouring | 2 | unit color, e2e sliders and baselines |
| 6 Shuffle, swaps, drag and drop, swap budgets | 3 | unit puzzle (min swaps, shuffle), e2e drag/tap |
| 7 Anchors and uniqueness | 4 | unit uniqueness (brute force), e2e anchors |
| 8 UI (sliders, layout, accessibility) | 2, 3, 5 | e2e, axe |
| 10.3 Performance | 2, 5 | e2e timing |
| 11 Acceptance criteria | 5, 6 | gate of phase 5; results document of phase 6 |

## Risks

- **Subdivision and merging** are fiddly (shared vertices, floating point). Mitigation: the phase 1
  unit tests (areas, shared edges, angles, known counts) must be green before anything is coloured.
- **Symmetry detection** with tolerances and non-centred seeds. Mitigation: seeds declare their
  symmetry centre and axes; the group is verified by checking that every permutation maps tiles to
  tiles of the same type.
- **Minimal anchor set** is a hitting-set problem (NP-hard in general). Mitigation: greedy first,
  exact search only for small instances; patches here have at most a few hundred tiles and a
  group of at most 20 elements, so the instances are small.
- **Drag and drop on touch** (scrolling, long-press callouts, WebKit). Mitigation: pointer events,
  `touch-action: none` on the board, tests in the WebKit projects; two-tap swap as fallback.
- **Slider performance** with SVG. Mitigation: recolour polygons only; switch to canvas only if
  measurements say so.
