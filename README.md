# niceties

A collection of small browser games and toys. Each project is a static web page
without a build step, so a folder can simply be opened in a browser or hosted on
GitHub Pages. The live versions are served from
<https://peterwazinski.github.io/niceties/>.

| Project | What it is | Live |
|---|---|---|
| [Sudoku](Sudoku/) | An ad-free Sudoku with three levels (Beginner, Expert, Master), symmetric puzzles generated on the device, notes by long press, hints, colour schemes, and confetti when you win. No timer, no score. Works offline once loaded, and can be added to the iPhone/iPad Home Screen. | [Play](https://peterwazinski.github.io/niceties/Sudoku/) |
| [untangleMe](untangleMe/) | A planar-graph puzzle: the vertices of a scrambled graph are dragged until no two edges cross. Four size presets, a slider for 6–30 vertices, shareable puzzle links, and two themes. | [Play](https://peterwazinski.github.io/niceties/untangleMe/) |
| [ColorSudoku](ColorSudoku/) | Generates three random, complete Sudokus that never share a digit at the same position and draws them nested into one colourful pattern. Inspired by nested colouring patterns. | [Open](https://peterwazinski.github.io/niceties/ColorSudoku/) |
| [AmmanBeenker](AmmanBeenker/) | An aperiodic Ammann–Beenker tiling of squares and rhombi with eightfold symmetry, built by repeated subdivision, with adjustable degree. | [Open](https://peterwazinski.github.io/niceties/AmmanBeenker/) |
| [HealthInvaders](HealthInvaders/) | A Space-Invaders-style arcade game on a canvas, adapted from a CodePen by Anthony Del Ciotto, with device-status icons in the NAMUR NE 107 style. | [Play](https://peterwazinski.github.io/niceties/HealthInvaders/) |

## Running locally

Most projects work by opening their `index.html` (double-click). Sudoku uses ES
modules and a service worker, so it needs a web server, for example
`node tests/e2e/server.js` inside the `Sudoku` folder, then
<http://localhost:4174/>.

## Tests

`Sudoku` and `untangleMe` have automated tests (Node's test runner for logic,
Playwright for headless browser tests). In each of these folders:

```
npm install
npx playwright install     # once
npm run test:all
```

The other projects have no automated tests.

## Layout

```
Sudoku/          game, with design/PRD.md and design/implementation.md
untangleMe/      game
ColorSudoku/     pattern generator
AmmanBeenker/    tiling
HealthInvaders/  arcade game
scribble.txt     personal notes
```
