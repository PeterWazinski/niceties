// Human solving techniques, used to grade a puzzle (and later to give hints).
// Each technique finds one placement or elimination; the grader always applies
// the easiest technique that makes progress, so the techniques it ends up needing
// are the ones the puzzle really requires.
import { CELLS, ROW, COL, BOX, UNITS } from "./grid.js";

export const FULL = 0x1ff; // bits 0..8 = digits 1..9

// Technique catalogue in ascending difficulty. level = the lowest level whose
// puzzles may require it (harder techniques are added in phase 3).
export const TECHNIQUES = [
  { name: "nakedSingle", level: "beginner" },
  { name: "hiddenSingle", level: "beginner" }
];

export const LEVEL_ORDER = ["beginner", "expert", "master"];

export function techniqueLevel(name) {
  const t = TECHNIQUES.find((x) => x.name === name);
  return t ? t.level : null;
}

// Candidate bitmask per cell (0 for filled cells).
export function candidates(grid) {
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (grid[i]) {
      const bit = 1 << (grid[i] - 1);
      rows[ROW[i]] |= bit; cols[COL[i]] |= bit; boxes[BOX[i]] |= bit;
    }
  }
  return Array.from({ length: CELLS }, (_, i) =>
    grid[i] ? 0 : FULL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]));
}

const single = (mask) => (mask && (mask & (mask - 1)) === 0 ? Math.log2(mask) + 1 : 0);

// A cell with exactly one candidate.
export function findNakedSingle(grid, cand = candidates(grid)) {
  for (let i = 0; i < CELLS; i++) {
    const d = single(cand[i]);
    if (d) return { technique: "nakedSingle", cell: i, digit: d };
  }
  return null;
}

// A digit with exactly one possible cell in a row, column or box.
export function findHiddenSingle(grid, cand = candidates(grid)) {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      let cell = -1, n = 0;
      for (const i of unit) {
        if (cand[i] & bit) { cell = i; n++; }
      }
      if (n === 1) return { technique: "hiddenSingle", cell, digit: d };
    }
  }
  return null;
}

// Solves with the implemented techniques only. Returns
// { solved, hardest, steps, grid }: hardest is the level of the hardest technique
// used (null if none), solved is false when the puzzle needs something harder.
export function gradePuzzle(givens) {
  const grid = givens.slice();
  const steps = [];
  let hardestRank = -1;
  for (;;) {
    if (grid.every((d) => d !== 0)) break;
    const cand = candidates(grid);
    const step = findNakedSingle(grid, cand) || findHiddenSingle(grid, cand);
    if (!step) break;
    grid[step.cell] = step.digit;
    steps.push(step);
    hardestRank = Math.max(hardestRank, LEVEL_ORDER.indexOf(techniqueLevel(step.technique)));
  }
  return {
    solved: grid.every((d) => d !== 0),
    hardest: hardestRank < 0 ? null : LEVEL_ORDER[hardestRank],
    steps,
    grid
  };
}
