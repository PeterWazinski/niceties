# Penrose Colors – exploration results (phase 6)

What the colour tool ([color_tool](../color_tool/)) tells us about the three questions of [vision.md](vision.md).
The numbers come from `node tools/explore.mjs` (run it in `color_tool/` to reproduce them). The remarks on how
colourings *look* are **my impressions from screenshots** and have to be confirmed by you; the screenshots are in
[exploration/](exploration/). Everything about how a puzzle *feels to play* is still open: I could not play it, so the
swap budgets below are arithmetic, not experience.

Open the tool with the links (start `PenroseColors\start.cmd` first, then replace the start of the address):
`http://localhost:4175/color_tool/index.html` + the query.

> **Update (change request round 1):** the *angular* mapping (E in the gallery, the angular rows of the numbers) was dropped
> afterwards as too hard to understand, radial gained a bright/dark centre option, and every tiling now starts with default
> anchors. The numbers below are from before and stay valid for what they describe.

## 1. Which tilings make appealing puzzles?

| Seed | Depth | Tiles | Thick / thin | Symmetries | Capacity (max minimum swaps) | A full shuffle needs on average |
|---|---|---|---|---|---|---|
| wheel | 1 | 10 | 5 / 5 | 10 | 8 | 6 |
| wheel | 2 | 20 | 10 / 10 | 10 | 18 | 15 |
| wheel | 3 | 60 | 35 / 25 | 10 | 58 | 53 |
| wheel | 4 | 160 | 100 / 60 | 10 | 158 | 150 |
| wheel | 5 | 430 | 265 / 165 | 10 | 428 | 419 |
| half | 3 | 28 | 16 / 12 | 1 | 26 | 22 |
| half | 4 | 77 | 48 / 29 | 1 | 75 | 69 |
| half | 5 | 210 | 129 / 81 | 1 | 208 | 200 |
| fan | 3 | 16 | 9 / 7 | 1 | 14 | 11 |
| fan | 4 | 45 | 28 / 17 | 1 | 43 | 38 |
| fan | 5 | 124 | 76 / 48 | 1 | 122 | 114 |

(*Capacity* = tiles − 2, because thick and thin tiles are two separate permutations. Depth 1–2 are too small to be
puzzles.)

**Findings**
- The **wheel** is the most beautiful: a round, five-fold symmetric patch with a centre of five thick rhombs. Its
  symmetry group has 10 elements (five rotations, five reflections) at every depth.
- **Half** and **fan** are asymmetric (only the identity), with organic outlines. They are interesting for puzzles
  because the picture has a clear "up", but the fan's outline is odd and small (my impression).
- **Depth 5** (430 tiles) is gorgeous to look at but far too big to solve (see 4). Depth 3–4 is the puzzle range.
- Lone half-rhombs at the edge are dropped, so the outline is jagged. This looks fine for the wheel; for half and fan
  it gives isolated tiles at the edge (see the fan in the gallery). Keeping the halves as extra shapes is an option.

## 2. Which colourings are appealing, and nice to repair?

Gallery: [exploration/](exploration/). Links (add to the address above):

| | Colouring | Query | My impression |
|---|---|---|---|
| A | plane, wheel d3 | `?depth=3` | clean, smooth, easy to read; the default |
| B | plane, blue→magenta | `?depth=4&h0=200&h1=340&s=70&l=55&ds=-30&dl=-20&rot=20` | very harmonious and calm; neighbouring tiles differ little, so a hard repair |
| C | radial, default | `?depth=4&map=radial` | **has a hard seam** on the left (see below) |
| D | radial rainbow | `?depth=4&map=radial&h0=0&h1=360&s=75&l=60&ds=0&dl=-30` | striking: a colour wheel with the lightness falling towards the rim; no seam |
| E | angular, full circle | `?depth=4&map=angular&s=80&l=55&h0=30&h1=330` | striking five-fold "colour wheel" look; large regions of similar colour |
| F | plane, half | `?seed=half&depth=4&rot=135&h0=20&h1=200&ds=30&dl=15&dt=6` | organic, warm; pleasant |
| G | plane, fan | `?seed=fan&depth=4&h0=90&h1=300` | works, but the shape is awkward |
| H | plane, wheel d5 | `?depth=5&h0=270&h1=60&s=55&l=62&ds=-35&dl=-35&rot=330&gap=0.5` | the most beautiful, but 430 tiles |

**Findings**
- **Plane colourings** (A, B, F, H) are always smooth and seamless. They suit patches of any shape.
- **Radial and angular colourings need a full hue circle** (`h0=0`, `h1=360`). With a partial range (C: 250→70) hue
  jumps from the end value back to the start where the angle wraps around (the left side), which shows as a straight
  hard edge. That answers the open question about hue wrap-around: *the seam is only a problem for partial ranges*.
  Idea: when the mapping is radial or angular, default the hue range to the full circle.
- **Tile count versus look:** more tiles give smoother gradients (H), fewer give bolder, more readable patches (A).
- The thin-tile lightness shift `dt` (small values) keeps the rhomb structure visible in very smooth colourings (F).
- Hard-to-repair colourings are those with little contrast between neighbours (B, H). Easy ones have strong regional
  differences (D, E).

## 3. How many tiles must stay fixed so that the solution is unique?

Strict, mathematical definition as in the PRD (colour = 8-bit sRGB; other pictures = symmetric copies of the target).

| Patch | Colouring | Symmetries (incl. identity) | Change the colouring | Anchors needed |
|---|---|---|---|---|
| wheel d3 / d4 | every colouring tried (plane, plane rotated, warm, radial, rainbow, angular, hue only) | 10 | 9 | **1** |
| half d4, fan d4 | every colouring tried | 1 | 0 | **0** |

- A **symmetric patch needs one anchor**, on any tile that no symmetry fixes (a tile on a mirror axis does *not*
  rule out that reflection, the tool shows this). *Suggest anchors* always finds a single tile.
- An **asymmetric patch is unique without any anchor**.
- More than one anchor is only needed for artificial colourings, where most tiles keep their colour under a symmetry
  (the unit tests construct such cases and check the minimum by brute force over all anchor subsets).
- **Colour ties:** the "hue only" plane colouring (`ds=dl=0`) ties 50 of 60 tiles (wheel d3), 146 of 160 (d4):
  tiles at the same height share a colour. Radial and angular colourings tie 6–80 tiles. Plane colourings with a
  slope in saturation or lightness (the defaults) have **no ties**.

**What this means:** under the strict definition, uniqueness is *cheap* (0 or 1 anchor). It is not the hard part.
The hard part is **perceptual**: the closest two different colours of a patch are only 1–14 apart in RGB distance
(of 441 at most): wheel d3 plane 13, wheel d4 plane 7, radial 3 (d4); angular and hue-only 1. Two tiles that close
cannot be told apart by eye, so the *visible* ambiguity of a puzzle is far larger than the symmetry question. This is the
ΔE question you decided to leave for step 2; the data says it matters more than the anchors.

## 4. Swap budgets (30 / 80 / 150–200)

A full shuffle needs a little less than the number of tiles (tiles minus the number of cycles, a handful; see the table), so the budgets give the tile counts:

| Budget (minimum swaps) | Patches where a **full** shuffle gives about that | Patches that can give it as a **partial** shuffle (`sw=`) |
|---|---|---|
| ≈ 30 (beginner) | wheel d3 needs 53 (too many), half d3 needs 22 – use partial | wheel d3, wheel d4, half d4, fan d4 |
| ≈ 80 (medium) | half d4 needs 69, wheel d4 needs 150 | wheel d4 (`sw=80`), half d5, fan d5 |
| 150 – 200 (expert) | **wheel d4 = 150**, **half d5 = 200** | wheel d4 (full), wheel d5, half d5 |

- Practical proposal: beginner = wheel d3 with `sw=30` (half of the tiles misplaced), medium = wheel d4 with `sw=80`
  or half d4 full, expert = wheel d4 full shuffle (about 150) or half d5 (about 200).
- A partial shuffle leaves many tiles already in place. Whether that is nicer than a full shuffle of a smaller
  patch is a **play-test question**.
- **Not verified:** how long a human needs, and how many *actual* swaps (not minimum) people make. The minimum
  swap counter in the tool is the baseline for that test. Try the three levels yourself with
  `?depth=3&shuffle=7&sw=30`, `?depth=4&shuffle=7&sw=80`, `?depth=4&shuffle=7` (full, about 150).

## 5. Recommendation for the puzzle

- **Go**, with these starting points: wheel (round, symmetric, one anchor) for the main puzzles, plane colourings
  with slopes (no ties) and full-circle radial/angular colourings for variety; half-wheel as an asymmetric variant.
- Take the **perceptual closeness (ΔE) of neighbouring and tied colours** into the puzzle design from the start: it
  decides the real difficulty, much more than symmetry or anchors.
- Decide the **swap rules** early: same-shape swaps only (done in the tool) and the anchor dots as a hint of
  orientation.
- Possible improvements to the tool before the puzzle: seeds *sun* and *star* (need the matching rules), full-circle
  hue as the default for radial and angular, keeping the edge half-rhombs as optional extra shapes, a ΔE report.

## Open questions for the puzzle plan

1. Does the human difficulty follow the minimum swaps (arithmetic above), or is the colour closeness decisive?
2. Full shuffle of a small patch, or partial shuffle of a large one?
3. Timer, score, move limit; how the "sorted preview" works in a game.
4. Perceptual difficulty measure (ΔE) and the choice of levels from it.
5. Hierarchy-based colouring (PRD 13) as a way to break ties and add structure.
