# Penrose Colors – colour tool

Exploration tool for Penrose P3 tilings coloured with HSL planes, plus a swap-sorting playground.
General working rules: [../../CLAUDE.md](../../CLAUDE.md). Specification: [../design/PRD.md](../design/PRD.md).
Plan and checklists: [../design/color_tool_implementation.md](../design/color_tool_implementation.md).
State of the design discussion: [../design/CLAUDE.md](../design/CLAUDE.md).

## Run and test (in this folder)

```
..\start.cmd              # (double-click) local server on http://localhost:4175/color_tool/ + browser
npm run typecheck         # tsc --noEmit: TypeScript as a checker for the JSDoc-typed JavaScript
npm test                  # unit tests, a few seconds
npx playwright test --project=desktop   # e2e, one project, about 10 s
npm run test:e2e          # e2e, all four projects
```

The server is `../server.mjs` (serves the whole PenroseColors folder, no caching). `file://` does not work
(ES modules). Playwright starts the same server itself.

## Code map (`js/`)

Pure logic, no DOM (runs under Node):
- `config.js` – φ, limits, the slider table, default settings
- `penrose.js` – P3 by subdivision of Robinson triangles; seeds `wheel`, `half`, `fan`; `generate(seed, depth)`
  returns tiles (rhombs: id, type, corners, centre, neighbours, ancestors, boundary) and the lone halves that are
  dropped; `fit()` scales a patch into a box
- `color.js` – HSL→sRGB, the mappings `plane` / `radial` / `angular`, `colourTiles`, `colourStats` (ties)
- `params.js` – settings ↔ URL query (only non-default values are written)
- `puzzle.js` – colours move over fixed shapes: permutation per tile, same-type swaps, undo, shuffle (full or to
  k minimum swaps), minimum swaps = tiles − cycles, anchored tiles never move
- `symmetry.js` – symmetries of a patch (rotations/reflections about the origin) as tile permutations; the wheel has 10,
  `half` and `fan` only the identity
- `uniqueness.js` – `analyse` (colour ties, symmetric copies not ruled out by the anchors) and `minimalAnchors`
  (exact search over which symmetries a tile rules out, greedy beyond 20 symmetries)
- `rng.js` – seeded random numbers
- `types.js` – JSDoc typedefs

DOM: `view.js` (SVG board, controls, drag and drop with pointer events, anchor dots), `controller.js` (settings, URL, selection,
keyboard), `main.js`. Styles: `css/style.css`.

## Things to know

- The 8-bit `#rrggbb` of a tile is its colour everywhere (display, ties, "solved").
- Lone half-rhombs at the patch boundary are dropped, so depth 0 has no tiles; the depth range is 1–5
  (10 – 430 tiles for the wheel). The wheel gets a five-fold centre of five thick rhombs from depth 1.
- Types: `tsconfig.json` has `checkJs`, not strict. Annotate shared data in `types.js`.
- e2e tests read `data-id`, `data-type` and the `fill` attribute of `.tile` polygons; `helpers.js` has `drag()`
  (mouse) and `solvingSwaps()` (computes the swaps that sort a shuffled picture from the DOM).
- `tools/explore.mjs` prints the numbers behind `../design/exploration-results.md` (`node tools/explore.mjs`).
- Anchors: edit mode in the UI, `?anchors=3,17` in the URL; changing seed or depth clears them; `Suggest anchors` = `minimalAnchors`.
- Test URLs: `?depth=3&shuffle=7&sw=6` = reproducible shuffle needing exactly 6 swaps.
