# UntangleMe – analysis & refactor plan (for review)

Status: **draft for your review – no game code has been changed yet.**

## 1. What the game is today

Files: `untangleMe.html` (markup + CSS), `untangleMe.js` (183 lines), `d3.js` (**v2.7.4**, 2011).

| Aspect | Current behaviour |
|---|---|
| Graph generation | `n` random points; each point is linked to one random other point, then **every** pair is tried and added if it crosses no existing edge. Result: an (almost) maximal planar graph with up to `3n-6` edges. |
| Scrambling | Random positions are re-rolled until at least one crossing exists. |
| Interaction | Drag nodes (d3 v2 drag, mouse + touch). Every drag event re-counts all crossings (O(E²), fine for ≤ ~50 nodes). |
| Feedback | Crossing edges + their end nodes turn blue, others pink. Counter shows `0! Well done!`. |
| Stats | Moves (counted on drag end), seconds (runs while crossings > 0), crossings. |
| Customisation | Only the node count (`<input type=number>`, min 4, no max). |

## 2. Findings (bugs / smells)

1. **Difficulty is only `n`.** Density is always "triangulation", so every puzzle of a given size is structurally equally hard. No difficulty presets, no seeds.
2. **Global state everywhere** (`w, h, x, y, graph, count, moves …`), plus an implicit global `lastCount`, an empty `go()`, and the graph is generated twice on start (top of file, then in `generate()`).
3. **The win state is not a state.** The timer just stops when `count == 0`; dragging a node afterwards silently resumes it. No end-of-game moment, no record, no "play again" prompt.
4. **Move counter counts clicks**, not moves (every `dragend`, even with no displacement).
5. **Timer starts at generation**, not at first touch.
6. `intersect()` treats *identical* segments as intersecting and silently ignores collinear overlaps (`rxs == 0` → `NaN`). Harmless for generated graphs, but wrong in principle.
7. **Unbounded input**: node count has no max and no validation (type "500" → browser freezes; "abc" → `NaN`).
8. **Fixed 800×600** layout in an HTML `<table>`, not responsive, unusable on phones; page is unstyled apart from colours.
9. Dragging jitters positions by `Math.random()*1e-4` to avoid coincident nodes – works but makes results non-deterministic.
10. Mixed tabs/spaces, inline styles, `var`-only ES5 style.

None of these are fatal – the game works. They matter mainly because the improvements in §4 need a cleaner base.

## 3. UI proposals (the main goal)

Three static, *draggable* mock-ups live in `untangleMe/refactor/proposals/` – just double-click the HTML files (they share `mock.js`, no server, no d3). They use a hard-coded 8-node graph; crossing count, timer, moves and win state are live so you can judge the feel. "Peek" shows a solved layout so you can see the win state quickly.

| | Proposal | Look | Strengths | Risks |
|---|---|---|---|---|
| **A** | [A-neon-arcade.html](proposals/A-neon-arcade.html) | Dark synthwave: glowing green/magenta edges on a neon grid, big monospace stats, "UNTANGLED!" overlay. | Most "fancy"; crossings are unmistakable (edges flip green→magenta). | Glow filters cost a bit on very large graphs; dark-only. |
| **B** | [B-paper-minimal.html](proposals/B-paper-minimal.html) | Warm paper background, serif title, dotted board, crossing edges dashed + red crossing points, toast on win. | Calm, readable, prints/screenshots well, light-mode friendly. | Least "wow"; relies on dashing for colour-blind safety (good) but looks plain. |
| **C** | [C-blueprint.html](proposals/C-blueprint.html) | Engineering blueprint: blue sheet with grid, title block, "APPROVED" stamp, parameter sliders. | Thematically fits a maths puzzle; distinctive; sidebar naturally hosts more settings. | Monospace-heavy; less playful. |

All three share improvements over today: crossing **points** are marked, stats are large and grouped, controls (difficulty, node slider, new puzzle) are in one place, win has a visible reward, layout scales to the viewport (SVG `viewBox`) and works with touch via pointer events.

**Decision needed:** pick A, B or C (or "A's colours with C's layout", etc.). Optional extra: ship **two themes** (e.g. A dark + B light) switchable by a toggle – cheap once colours are CSS variables.

## 4. Further improvement ideas

Grouped by effort/value; tick what you want in the "scope" section below.

**Gameplay / customisation**
- **Difficulty presets** (Easy 6 / Normal 8 / Hard 14 / Insane 25 nodes) *and* a free node slider with sane bounds (4–40).
- **Edge density** slider: fewer edges = easier, 100 % = full triangulation (needs a small change in `planarGraph`: stop after `density·(3n-6)` edges).
- **Seeded puzzles**: small PRNG (mulberry32) → puzzle number in the URL hash (`#n=8&seed=4821`). Enables "retry same puzzle", sharing a link, and a **daily puzzle** with no server.
- **Best times / moves** per node count in `localStorage` (client-side only), shown with "new record!".
- **Star rating** at the end (based on time and moves vs. n).
- **Undo** last move, **Reset** to the starting scramble.
- **Hint**: briefly highlight the node involved in most crossings, or flash the solved layout for 1 s (costs a penalty on time).
- **Pause on blur** (timer stops when tab hidden).
- **Win overlay** with time, moves, record, "Next puzzle (n+1)" button – optionally a *level mode* that increases n each time.

**Polish**
- Smooth transitions on colour changes, node "pickup" scale, subtle confetti/pulse on win.
- Optional sound (muted by default) – uses WebAudio, no assets.
- Keyboard accessibility: arrow keys move the focused node; `N` new puzzle; `Z` undo.
- Colour-blind-safe cues (dash pattern/crossing markers, not colour only) – already in the B and C mock-ups.
- Show/hide crossing markers, show/hide timer ("zen mode") toggles.
- Page title / favicon updates, `<meta viewport>`, German/English toggle if you like (the game has very little text).

## 5. Refactor plan for `untangleMe.js`

Goal: same behaviour, readable and testable; **still plain `<script>` files, no build step, no server**.

1. **Split by responsibility** inside one or two files (IIFE or ES modules via `<script type="module">` – works from `file://` only for classic scripts, so I recommend an IIFE with a small namespace to keep double-click-to-play working):
   - `graph.js` – `planarGraph(n, density, rng)`, `scramble`, `intersect`, `countCrossings` (pure functions, no DOM).
   - `game.js` – state object `{graph, moves, startTime, status: idle|playing|solved}`, undo stack, win detection, records.
   - `view.js` – all d3 rendering/drag, DOM bindings.
   - `rng.js` – seeded PRNG.
2. Replace globals with one `state` object; remove `go()`, `lastCount`, double generation.
3. Fix items 3–7 of §2: explicit `solved` state (locks the timer), timer starts on first drag, move counted only when a node actually moved, input validation/clamping, robust `intersect` (collinear overlap handled, identical segments are not "crossings").
4. Guard `scramble` with an attempt limit (today it can theoretically loop forever for sparse graphs once density is configurable).
5. Move CSS out of the HTML into `untangleMe.css` using CSS variables (theme switch = swap variables).
6. Replace the `<table>` layout with the chosen proposal's markup (CSS grid/flex, responsive SVG `viewBox` instead of fixed 800×600 – requires converting pointer coordinates via `getScreenCTM`, d3 v2's drag origin math needs a small adaptation).
7. Keep the `d3.js` **v2.7.4** file. It still works and only a few calls are used (`scale.linear`, `behavior.drag`, `select`, `timer`). *Upgrade is not urgent*; I'd only revisit it if we want pointer-event drag from d3 v7 – and the mock-ups show plain pointer events work fine, so d3 could even become optional later. No change proposed now.
8. Add a tiny `tests.html` (open in browser) asserting: planar graphs have 0 crossings at generation, scramble produces ≥ 1 crossing, `intersect` edge cases, seeded generation is deterministic.

## 6. Proposed execution order

1. You choose a UI proposal and the optional features (§7).
2. Refactor `untangleMe.js` into modules, behaviour-preserving, plus `tests.html`.
3. Port the chosen look into `untangleMe.html/.css`, make layout responsive.
4. Add the selected gameplay features (presets, density, seeds, records, undo…).
5. Manual test in Chrome/Edge/Firefox + a phone-size viewport; commit on a branch.

## 7. Questions / decisions for you

1. **UI**: A (Neon), B (Paper), C (Blueprint), a mix, or two switchable themes?
2. **Scope of extras**: which of §4 do you want? My suggestion for a first round: presets + density slider + seeds/URL + best times + undo + win overlay + responsive/touch.
3. **Language**: keep English UI texts, or German (or switchable)?
4. **File structure**: OK to split into several files (`graph.js`, `game.js`, `view.js`, `untangleMe.css`), or do you prefer to keep a single JS file?
5. **Maximum node count** – is 40 a good cap, or do you want to allow "silly" sizes?
6. **Branch**: work on a feature branch (`untangleMe-ui`) and keep the current version playable as is until you approve? (I'd recommend yes.)
