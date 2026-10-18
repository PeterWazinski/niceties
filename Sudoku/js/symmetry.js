// Symmetry types for the givens (PRD 5.3) as orbits of cell indices: cells that
// map onto each other under the symmetry are removed or kept together.
import { SYMMETRY_TYPES } from "./config.js";
import { CELLS } from "./grid.js";

const at = (r, c) => r * 9 + c;
const rot180 = (i) => at(8 - Math.floor(i / 9), 8 - (i % 9));
const rot90 = (i) => at(i % 9, 8 - Math.floor(i / 9));
const mirrorH = (i) => at(8 - Math.floor(i / 9), i % 9); // swaps top and bottom
const mirrorV = (i) => at(Math.floor(i / 9), 8 - (i % 9)); // swaps left and right
const diagonal = (i) => at(i % 9, Math.floor(i / 9));
const antiDiagonal = (i) => at(8 - (i % 9), 8 - Math.floor(i / 9));

// Generating maps of each symmetry; its orbits are the closure under them.
export const GENERATORS = {
  rot180: [rot180],
  rot90: [rot90],
  mirrorH: [mirrorH],
  mirrorV: [mirrorV],
  diagonal: [diagonal],
  antiDiagonal: [antiDiagonal],
  bothDiagonals: [diagonal, antiDiagonal],
  bothAxes: [mirrorH, mirrorV]
};

// Partition of the 81 cells into orbits (sorted lists, ordered by first cell).
export function orbits(type) {
  const gens = GENERATORS[type];
  if (!gens) throw new Error("unknown symmetry: " + type);
  const seen = new Array(CELLS).fill(false);
  const result = [];
  for (let start = 0; start < CELLS; start++) {
    if (seen[start]) continue;
    const orbit = [start];
    seen[start] = true;
    for (let k = 0; k < orbit.length; k++) {
      for (const f of gens) {
        const j = f(orbit[k]);
        if (!seen[j]) { seen[j] = true; orbit.push(j); }
      }
    }
    result.push(orbit.sort((a, b) => a - b));
  }
  return result;
}

export { SYMMETRY_TYPES };
