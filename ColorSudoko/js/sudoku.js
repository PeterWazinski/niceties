// Generates three full Sudoku grids that never share a digit at the same cell,
// so they can be drawn as nested squares without two layers having equal colours.
// A grid is a flat array of 81 digits (1..9), index = row * 9 + col.
(function (root) {
  "use strict";

  const STEP_BUDGET = 20000; // backtracking steps before a grid is restarted

  function shuffled(rand) {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = v.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [v[i], v[j]] = [v[j], v[i]];
    }
    return v;
  }

  // Fills one grid. `used[n]` is a bitmask of digits that earlier grids put on cell n.
  // Returns null when the step budget is exhausted.
  function fillGrid(used, rand) {
    const grid = new Array(81).fill(0);
    const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
    let steps = 0;

    function fill(n) {
      if (n === 81) return true;
      if (++steps > STEP_BUDGET) return false;
      const r = Math.floor(n / 9), c = n % 9, b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      for (const v of shuffled(rand)) {
        const bit = 1 << v;
        if ((used[n] | rows[r] | cols[c] | boxes[b]) & bit) continue;
        grid[n] = v;
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        if (fill(n + 1)) return true;
        rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
        grid[n] = 0;
        if (steps > STEP_BUDGET) return false;
      }
      return false;
    }

    return fill(0) ? grid : null;
  }

  function generate(rand) {
    rand = rand || Math.random;
    for (;;) {
      const used = new Array(81).fill(0);
      const grids = [];
      for (let g = 0; g < 3; g++) {
        const grid = fillGrid(used, rand);
        if (!grid) break;
        grid.forEach((v, n) => { used[n] |= 1 << v; });
        grids.push(grid);
      }
      if (grids.length === 3) return grids;
    }
  }

  const api = { generate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Sudoku = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
