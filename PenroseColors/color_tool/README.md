# Penrose Colors – colour tool

Draws Penrose P3 tilings (thick and thin rhombs), colours every tile with a gradient taken from a plane
through the HSL colour cone, and lets you shuffle the colours and sort them back by swapping tiles. It is
the exploration tool for a later colour-sorting puzzle; see [design/PRD.md](../design/PRD.md).

## Start

Double-click [`start.cmd`](../start.cmd) in the `PenroseColors` folder. It starts a small local web server
(needs Node) and opens `http://localhost:4175/color_tool/` in your browser. Close the console window to stop.
Opening `index.html` directly from the file system does not work (browsers block ES modules there).

## Using it

- **Tiling:** seed (*Wheel*, *Half wheel*, *Fan*) and depth (1–5). More than 250 tiles are too many for a puzzle.
- **Colour:** mapping *Plane* (hue left to right, saturation and lightness top to bottom), *Radial* (hue by angle,
  saturation and lightness by distance from the centre) or *Angular* (hue by angle). Sliders change the picture
  live: hue start/end, saturation, lightness, their slopes, rotation of the plane, lightness of thin tiles, gap.
  The panel shows how many different colours there are and how many tiles share one.
- **Puzzle:** *Shuffle* mixes the colours. *Target swaps* sets how many swaps the shuffle needs at least (0 = a
  full shuffle). Swap two tiles of the **same shape** by dragging one onto the other, or click one and then the
  other. *Undo*, *Reset*, and *Sorted preview* (shows the target) help. The panel shows the swaps made, the minimum
  swaps still needed, and "Solved!". Keyboard: arrow keys move between neighbouring tiles, Enter selects and
  swaps, Escape deselects.
- **Anchors and uniqueness:** *Edit anchors* lets you click tiles to fix them (a dot marks an anchor, anchored tiles
  never move). The panel tells whether the sorted picture is **unique**: a symmetric patch has other, equally
  regular pictures (a rotated or mirrored copy), and anchors rule them out. *Suggest anchors* finds the fewest
  anchors that do.
- **Copy link** copies the address; the address holds every setting.

## URL parameters

Only values that differ from the default appear in the address.

| Parameter | Meaning | Default |
|---|---|---|
| `seed` | `wheel`, `half`, `fan` | `wheel` |
| `depth` | subdivisions, 1–5 | `3` |
| `map` | `plane`, `radial`, `angular` | `plane` |
| `h0`, `h1` | hue start / end in degrees (0–360) | `250`, `70` |
| `s`, `l` | saturation / lightness at the centre (0–100) | `60`, `60` |
| `ds`, `dl` | saturation / lightness slope (−100…100) | `-20`, `-25` |
| `rot` | rotation of the plane in degrees | `0` |
| `dt` | lightness shift of thin tiles (−30…30) | `0` |
| `gap` | width of the lines between tiles in px (0–6) | `1` |
| `shuffle` | seed of the shuffle (0 = sorted) | `0` |
| `sw` | minimum swaps the shuffle needs (0 = full shuffle) | `0` |
| `anchors` | comma separated tile ids | – |

Invalid or unknown parameters are ignored and named in a short note.

## Tests

```
npm install
npx playwright install     # once
npm run typecheck          # TypeScript as a checker (JSDoc types, no build)
npm test                   # unit tests
npm run test:e2e           # browser tests: iPhone, iPad portrait, iPad landscape, desktop
```

Code map and working notes: [CLAUDE.md](CLAUDE.md). Plan: [design/color_tool_implementation.md](../design/color_tool_implementation.md).
