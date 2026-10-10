# Color Sudoku

Generates three random, complete Sudokus that never share a digit at the same
position and draws them nested into one colourful pattern: the first Sudoku as
large squares, the second as medium squares inside them, the third as small
squares in the middle. Inspired by
[nested colouring patterns](http://www.theguardian.com/books/2015/sep/17/nested-fish-and-golden-triangles-adult-colouring-and-the-beauty-of-maths).

No server, no build step: open `index.html` (double-click) or host the folder on
any static web host (GitHub Pages works).

## Using it

- **New pattern** (or press `N`) generates three new Sudokus.
- **Save as PNG** downloads the current pattern.
- **Layers**: show or hide the large, medium and small squares. **Print numbers**
  writes the digit into each square.
- **Digits**: click a digit in the legend to highlight it in all three layers;
  click again to clear.
- **Sudoku colours**:
  - *Colour set*: Classic, Stained glass, Autumn, Harbor.
  - *Saturation*: scales the colourfulness of all colours.
  - *Vibrance*: lifts dull colours more than vivid ones.
  - *Tint*: rotates the hue of all colours around the colour wheel.
  - *Reset colours* sets the three sliders back to 0.
- The colour set and slider positions are remembered in the browser
  (localStorage).

## Project layout

```
index.html          page
css/base.css        structure and behaviour
css/themes.css      the pastel app look and the colour sets (CSS variables --d1 .. --d9)
js/sudoku.js        generator: three full grids without equal digits per cell
js/color.js         saturation / vibrance / tint adjustment of the palette
js/render.js        draws the nested squares on a canvas
js/main.js          wiring, legend, colour sliders, PNG export
assets/favicon.svg  icon
refactor/           UI and colour set suggestions (see refactor/README.md)
```

## Adding a colour set

Add a `[data-palette="name"]` block with `--d1` .. `--d9` to `css/themes.css`,
an `<option>` to the colour set select in `index.html`, the name to `PALETTES`
in `js/main.js` and to the regex in the inline script in the `<head>`.

## Checks

The generator can be tested without a browser:

```
node -e "const g=require('./js/sudoku.js').generate(); console.log(g.length)"
```
