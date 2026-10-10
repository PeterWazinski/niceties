# Color Sudoku - suggestions

Open the HTML files directly in a browser (they use `../js/sudoku.js` and `../js/render.js`).

## UI suggestions

| File | Idea | Good for |
| --- | --- | --- |
| `ui-suggestion-1-studio.html` | **Studio.** No sidebar: the pattern fills the screen, a floating dock holds new / layers / numbers / theme, and a filmstrip keeps the last 12 patterns so a nice one is never lost. Space generates. | Tablets and phones, "just make pretty pictures", saving favourites |
| `ui-suggestion-2-explorer.html` | **Explorer.** Shows how the pattern is built: the three source Sudokus next to the pattern. Hover a cell to see the same position in every layer, click a digit to follow it through all three. | Understanding the puzzle idea, teaching, Sudoku fans |

Either could be merged into the main app: Studio replaces the panel by a dock (the
history is just an array of the three grids), Explorer adds the mini grids as a
third panel section. Both reuse `render.js` unchanged.

## Colour set suggestions (`themes-suggestion.html`)

The app has one fixed pastel look and ships four digit colour sets: Classic, Stained glass,
Autumn and Harbor. Two more candidates (the page also previews them on a matching paper colour):

### Risograph
Fluorescent inks, flat and slightly retro. Works best on warm paper.

```css
[data-palette="riso"] {
  --d1: #0078bf; --d2: #ff48b0; --d3: #ffe800;
  --d4: #00a95c; --d5: #ff6c2f; --d6: #765ba7;
  --d7: #00838a; --d8: #ff665e; --d9: #92d5e6;
}
```

### Mediterranean
Glazed-tile blues with terracotta, olive and cream.

```css
[data-palette="tiles"] {
  --d1: #1f5fa8; --d2: #e07a2f; --d3: #f2c14e;
  --d4: #3a8f5c; --d5: #c8472f; --d6: #2b2b6b;
  --d7: #88b7d5; --d8: #e8d9b5; --d9: #7a8f3a;
}
```

To enable one: paste the block into `css/themes.css`, add an `<option>` to the colour set
select in `ColorSudoko.html`, and add the name to `PALETTES` in `js/main.js` and to the
regex in the inline script in the `<head>`.
