// Human solving techniques, used to grade a puzzle (and later to give hints).
// Every finder looks at the grid plus the candidate masks and returns one step:
//   placement   { technique, cell, digit }
//   elimination { technique, eliminations: [{ cell, digit }], cells: [...] }
// The grader always applies the easiest technique that makes progress, so the
// techniques it ends up using are the ones the puzzle really requires.
import { CELLS, ROW, COL, BOX, UNITS, PEERS } from "./grid.js";

export const FULL = 0x1ff; // bits 0..8 = digits 1..9

export const LEVEL_ORDER = ["beginner", "expert", "master"];

const popcount = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const digitsOf = (m) => { const r = []; for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1))) r.push(d); return r; };
const isPeer = Array.from({ length: CELLS }, (_, i) => {
  const row = new Array(CELLS).fill(false);
  for (const j of PEERS[i]) row[j] = true;
  return row;
});

// All k-element combinations of arr.
function combos(arr, k) {
  const out = [];
  const rec = (start, chosen) => {
    if (chosen.length === k) { out.push(chosen.slice()); return; }
    for (let i = start; i < arr.length; i++) { chosen.push(arr[i]); rec(i + 1, chosen); chosen.pop(); }
  };
  rec(0, []);
  return out;
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

// ---- beginner: singles -------------------------------------------------------

export function findNakedSingle(grid, cand = candidates(grid)) {
  for (let i = 0; i < CELLS; i++) {
    if (cand[i] && popcount(cand[i]) === 1) return { technique: "nakedSingle", cell: i, digit: digitsOf(cand[i])[0] };
  }
  return null;
}

export function findHiddenSingle(grid, cand = candidates(grid)) {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      let cell = -1, n = 0;
      for (const i of unit) if (cand[i] & bit) { cell = i; n++; }
      if (n === 1) return { technique: "hiddenSingle", cell, digit: d };
    }
  }
  return null;
}

// ---- expert: subsets, pointing and claiming ---------------------------------

// size cells of a unit whose candidates together are only size digits: those
// digits can go nowhere else in the unit.
function findNakedSubset(size, name) {
  return (grid, cand) => {
    for (const unit of UNITS) {
      const cells = unit.filter((i) => cand[i] && popcount(cand[i]) <= size);
      for (const combo of combos(cells, size)) {
        const union = combo.reduce((m, i) => m | cand[i], 0);
        if (popcount(union) !== size) continue;
        const eliminations = [];
        for (const i of unit) {
          if (combo.includes(i)) continue;
          for (const d of digitsOf(cand[i] & union)) eliminations.push({ cell: i, digit: d });
        }
        if (eliminations.length) return { technique: name, cells: combo, eliminations };
      }
    }
    return null;
  };
}

// size digits that fit only into size cells of a unit: those cells hold nothing else.
function findHiddenSubset(size, name) {
  return (grid, cand) => {
    for (const unit of UNITS) {
      const where = {}; // digit -> cells of the unit that can take it
      for (let d = 1; d <= 9; d++) {
        const cells = unit.filter((i) => cand[i] & (1 << (d - 1)));
        if (cells.length >= 2 && cells.length <= size) where[d] = cells;
      }
      for (const ds of combos(Object.keys(where).map(Number), size)) {
        const cells = [...new Set(ds.flatMap((d) => where[d]))];
        if (cells.length !== size) continue;
        const keep = ds.reduce((m, d) => m | (1 << (d - 1)), 0);
        const eliminations = [];
        for (const i of cells) for (const d of digitsOf(cand[i] & ~keep)) eliminations.push({ cell: i, digit: d });
        if (eliminations.length) return { technique: name, cells, eliminations };
      }
    }
    return null;
  };
}

// Inside a box a digit is confined to one row/column: remove it from the rest of that line.
function findPointing(grid, cand) {
  for (let b = 0; b < 9; b++) {
    const box = UNITS[18 + b];
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      const cells = box.filter((i) => cand[i] & bit);
      if (cells.length < 2) continue;
      for (const line of [ROW, COL]) {
        if (!cells.every((i) => line[i] === line[cells[0]])) continue;
        const eliminations = [];
        for (let j = 0; j < CELLS; j++) {
          if (line[j] === line[cells[0]] && BOX[j] !== b && (cand[j] & bit)) eliminations.push({ cell: j, digit: d });
        }
        if (eliminations.length) return { technique: "pointing", cells, eliminations };
      }
    }
  }
  return null;
}

// In a row/column a digit is confined to one box: remove it from the rest of that box.
function findClaiming(grid, cand) {
  for (let u = 0; u < 18; u++) {
    const line = UNITS[u];
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      const cells = line.filter((i) => cand[i] & bit);
      if (cells.length < 2 || !cells.every((i) => BOX[i] === BOX[cells[0]])) continue;
      const eliminations = [];
      for (const j of UNITS[18 + BOX[cells[0]]]) {
        if (!line.includes(j) && (cand[j] & bit)) eliminations.push({ cell: j, digit: d });
      }
      if (eliminations.length) return { technique: "claiming", cells, eliminations };
    }
  }
  return null;
}

// ---- master: fish and wings ---------------------------------------------------

// size rows (or columns) in which a digit sits in only size columns (rows): the
// digit is removed from those columns (rows) elsewhere. size 2 = X-Wing, 3 = Swordfish.
function findFish(size, name) {
  return (grid, cand) => {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      for (const byRow of [true, false]) {
        const cellAt = (line, k) => (byRow ? line * 9 + k : k * 9 + line);
        const spans = []; // [line, mask of cross positions]
        for (let line = 0; line < 9; line++) {
          let mask = 0;
          for (let k = 0; k < 9; k++) if (cand[cellAt(line, k)] & bit) mask |= 1 << k;
          const n = popcount(mask);
          if (n >= 2 && n <= size) spans.push([line, mask]);
        }
        for (const combo of combos(spans, size)) {
          const union = combo.reduce((m, [, mask]) => m | mask, 0);
          if (popcount(union) !== size) continue;
          const used = combo.map(([line]) => line);
          const eliminations = [];
          for (let k = 0; k < 9; k++) {
            if (!(union & (1 << k))) continue;
            for (let line = 0; line < 9; line++) {
              if (!used.includes(line) && (cand[cellAt(line, k)] & bit)) eliminations.push({ cell: cellAt(line, k), digit: d });
            }
          }
          if (eliminations.length) {
            const cells = [];
            for (const line of used) for (let k = 0; k < 9; k++) if (union & (1 << k) && (cand[cellAt(line, k)] & bit)) cells.push(cellAt(line, k));
            return { technique: name, digit: d, cells, eliminations };
          }
        }
      }
    }
    return null;
  };
}

// Pivot {a,b} with wings {a,c} and {b,c}, both seeing the pivot: c goes from every
// cell that sees both wings.
function findXYWing(grid, cand) {
  for (let p = 0; p < CELLS; p++) {
    if (popcount(cand[p]) !== 2) continue;
    const pivot = cand[p];
    const wings = PEERS[p].filter((i) => popcount(cand[i]) === 2 && popcount(cand[i] & pivot) === 1);
    for (const w1 of wings) {
      const shared = cand[w1] & pivot;
      const c = cand[w1] & ~pivot;
      const need = (pivot & ~shared) | c;
      for (const w2 of wings) {
        if (w2 === w1 || cand[w2] !== need) continue;
        const eliminations = [];
        for (let j = 0; j < CELLS; j++) {
          if (j !== p && j !== w1 && j !== w2 && (cand[j] & c) && isPeer[j][w1] && isPeer[j][w2]) {
            eliminations.push({ cell: j, digit: digitsOf(c)[0] });
          }
        }
        if (eliminations.length) return { technique: "xyWing", cells: [p, w1, w2], eliminations };
      }
    }
  }
  return null;
}

// Technique catalogue in ascending difficulty. level = the level that first requires it.
export const TECHNIQUES = [
  { name: "nakedSingle", level: "beginner", find: findNakedSingle },
  { name: "hiddenSingle", level: "beginner", find: findHiddenSingle },
  { name: "pointing", level: "expert", find: findPointing },
  { name: "claiming", level: "expert", find: findClaiming },
  { name: "nakedPair", level: "expert", find: findNakedSubset(2, "nakedPair") },
  { name: "hiddenPair", level: "expert", find: findHiddenSubset(2, "hiddenPair") },
  { name: "nakedTriple", level: "expert", find: findNakedSubset(3, "nakedTriple") },
  { name: "hiddenTriple", level: "expert", find: findHiddenSubset(3, "hiddenTriple") },
  { name: "xWing", level: "master", find: findFish(2, "xWing") },
  { name: "xyWing", level: "master", find: findXYWing },
  { name: "swordfish", level: "master", find: findFish(3, "swordfish") }
];

export function techniqueLevel(name) {
  const t = TECHNIQUES.find((x) => x.name === name);
  return t ? t.level : null;
}

// Applies a step to the grid and candidate masks (in place).
export function applyStep(grid, cand, step) {
  if (step.eliminations) {
    for (const { cell, digit } of step.eliminations) cand[cell] &= ~(1 << (digit - 1));
    return;
  }
  const bit = 1 << (step.digit - 1);
  grid[step.cell] = step.digit;
  cand[step.cell] = 0;
  for (const j of PEERS[step.cell]) cand[j] &= ~bit;
}

// The easiest applicable step, or null when the techniques are exhausted.
export function nextStep(grid, cand) {
  for (const t of TECHNIQUES) {
    const step = t.find(grid, cand);
    if (step) return step;
  }
  return null;
}

// Solves with the implemented techniques only. Returns { solved, hardest, steps, grid }:
// hardest = level of the hardest technique used (null if none); solved is false
// when the puzzle needs something beyond the catalogue.
export function gradePuzzle(givens) {
  const grid = givens.slice();
  const cand = candidates(grid);
  const steps = [];
  let hardestRank = -1;
  while (grid.some((d) => d === 0)) {
    const step = nextStep(grid, cand);
    if (!step) break;
    applyStep(grid, cand, step);
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
