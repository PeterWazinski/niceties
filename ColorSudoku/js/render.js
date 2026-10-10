// Draws the three nested Sudoku layers onto a 2D canvas context.
// Logical coordinate system: 45 x 45 units (9 cells of 5 units), scaled by `unit` pixels.
(function (root) {
  "use strict";

  const CELLS = 9;
  const PITCH = 5; // units per Sudoku cell
  const SIZE = CELLS * PITCH;

  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return 0.5;
    const n = parseInt(m[1], 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  function easeOutBack(t) {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  /**
   * opts: palette  array indexed by digit 1..9 of CSS colours
   *       unit     pixels per logical unit (default 15)
   *       layers   [bool, bool, bool] visibility of large / medium / small squares
   *       numbers  print the digit in every square
   *       progress 0..1 pop-in animation (default 1 = fully drawn)
   *       popFraction share of the animation each square needs to pop in; when given the
   *                squares appear one after another (layer by layer, row by row)
   *       focus    digit 1..9 to emphasise, others are dimmed (default none)
   */
  function draw(ctx, sudokus, opts) {
    const unit = opts.unit || 15;
    const layers = opts.layers || [true, true, true];
    const progress = opts.progress === undefined ? 1 : opts.progress;
    const focus = opts.focus || 0;
    const sequential = opts.popFraction > 0;
    const visible = layers.filter(Boolean).length;
    let drawn = 0; // index of the square in reveal order

    for (let layer = 0; layer < 3; layer++) {
      if (!layers[layer]) continue;
      const grid = sudokus[layer];
      const side = (PITCH - 2 * layer) * unit;
      // While an inner layer covers the middle, the digit sits in the 1-unit ring corner.
      const inRing = layer < 2 && layers[layer + 1];
      const fontPx = inRing ? unit * 0.7 : side * 0.5;

      for (let row = 0; row < CELLS; row++) {
        for (let col = 0; col < CELLS; col++) {
          let start = layer * 0.28 + ((row + col) / 16) * 0.3, span = 0.42;
          if (sequential) {
            span = opts.popFraction;
            start = (drawn++ / (visible * CELLS * CELLS)) * (1 - span);
          }
          const t = Math.max(0, Math.min(1, (progress - start) / span));
          if (t === 0) continue;
          const s = progress >= 1 ? 1 : easeOutBack(t);

          const v = grid[row * CELLS + col];
          const x = (col * PITCH + layer) * unit;
          const y = (row * PITCH + layer) * unit;
          const cx = x + side / 2, cy = y + side / 2;
          const color = opts.palette[v];

          ctx.globalAlpha = focus && focus !== v ? 0.18 : 1;
          ctx.fillStyle = color;
          ctx.fillRect(cx - (side * s) / 2, cy - (side * s) / 2, side * s, side * s);

          if (opts.numbers && s > 0.6) {
            ctx.fillStyle = luminance(color) > 0.6 ? "#1b1b1b" : "#ffffff";
            ctx.font = "600 " + fontPx + "px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const tx = inRing ? x + unit / 2 : cx, ty = inRing ? y + unit / 2 : cy;
            ctx.fillText(String(v), tx, ty + fontPx * 0.04);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  const api = { draw, luminance, SIZE, PITCH, CELLS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ColorSudokuRender = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
