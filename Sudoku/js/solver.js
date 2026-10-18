// Bitmask backtracking solver ("fewest candidates first") and solution counter.
import { CELLS, SIZE, ROW, COL, BOX } from "./grid.js";

const FULL = 0x1ff; // bits 0..8 = digits 1..9
const bitCount = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

// True if no digit appears twice in a row, column or box (zeros are ignored).
export function isValidGrid(grid) {
  const rows = new Array(SIZE).fill(0), cols = new Array(SIZE).fill(0), boxes = new Array(SIZE).fill(0);
  for (let i = 0; i < CELLS; i++) {
    const d = grid[i];
    if (d === 0) continue;
    if (!(d >= 1 && d <= 9)) return false;
    const bit = 1 << (d - 1);
    if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & bit) return false;
    rows[ROW[i]] |= bit; cols[COL[i]] |= bit; boxes[BOX[i]] |= bit;
  }
  return true;
}

// Walks the search tree. Calls onSolution(grid) for each solution found; the walk
// stops as soon as onSolution returns true. rng (optional) randomises digit order.
function search(grid, onSolution, rng) {
  const g = grid.slice();
  const rows = new Array(SIZE).fill(0), cols = new Array(SIZE).fill(0), boxes = new Array(SIZE).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (g[i]) {
      const bit = 1 << (g[i] - 1);
      rows[ROW[i]] |= bit; cols[COL[i]] |= bit; boxes[BOX[i]] |= bit;
    }
  }

  function rec() {
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < CELLS; i++) {
      if (g[i]) continue;
      const mask = FULL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
      const n = bitCount(mask);
      if (n < bestCount) {
        best = i; bestMask = mask; bestCount = n;
        if (n <= 1) break;
      }
    }
    if (best === -1) return onSolution(g);
    if (bestCount === 0) return false;
    const digits = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << (d - 1))) digits.push(d);
    if (rng) rng.shuffle(digits);
    const r = ROW[best], c = COL[best], b = BOX[best];
    for (const d of digits) {
      const bit = 1 << (d - 1);
      g[best] = d; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (rec()) return true;
      g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    return false;
  }
  rec();
}

// First solution as a new array, or null. With rng the digit order is random,
// so solving an empty grid yields a random full grid.
export function solve(grid, rng) {
  if (!isValidGrid(grid)) return null;
  let found = null;
  search(grid, (g) => { found = g.slice(); return true; }, rng);
  return found;
}

// Number of solutions, counted up to limit (default 2: "unique or not").
export function countSolutions(grid, limit = 2) {
  if (!isValidGrid(grid)) return 0;
  let n = 0;
  search(grid, () => ++n >= limit, null);
  return n;
}
