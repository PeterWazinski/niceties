# Ammann-Beenker Tiling

An aperiodic tiling of squares and rhombi with eightfold symmetry. It is built by
repeatedly subdividing right triangles and rhombi; the method is adapted from
[this article](https://geometricolor.wordpress.com/2013/08/24/iterative-method-for-the-ammann-beenker-tiling-using-vector/).

No server, no build step: open `index.html` (double-click) or host the folder on
any static web host (GitHub Pages works).

## Using it

- **Degree 1-5**: the number of subdivision steps. Degree 1 has 10 tiles,
  degree 3 has 338, degree 5 has 11,482. The counts of squares and rhombi are shown.
- **Draw again** (or press `N`) replays the build-up animation.
- **Save as PNG** downloads the current tiling.
- **Drawing speed**: Instant, Fast (2.5 s, default), Normal (6 s), Slow (12 s).
- **Show edges**: toggle the tile outlines.
- **Colour set**: Green & blue (the original), Sunset (coral and plum),
  Ink & paper (cream and black).
- Degree, speed, edges and colour set are remembered in the browser (localStorage).

## Project layout

```
index.html          page
css/base.css        structure and behaviour
css/themes.css      the pastel app look and the colour sets (CSS variables)
js/tiling.js        subdivision algorithm: generate(degree, width, height) -> tiles
js/main.js          wiring, animation, colours, PNG export
assets/favicon.svg  icon
```

## Adding a colour set

Add a `[data-palette="name"]` block with `--sq`, `--rh`, `--edge` and `--paper` to
`css/themes.css`, an `<option>` to the colour set select in `index.html`, the name
to `PALETTES` in `js/main.js` and to the regex in the inline script in the `<head>`.
