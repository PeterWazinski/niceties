import test from "node:test";
import assert from "node:assert/strict";
import { parseGrid, gridToString, UNITS, PEERS, CELLS } from "../../js/grid.js";
import { solve, countSolutions, isValidGrid } from "../../js/solver.js";
import { createRng } from "../../js/rng.js";

const EASY = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const EASY_SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const INKALA = "800000000003600000070090200050007000000045700000100030001000068008500010090000400";
const NORVIG = "000000907000420180000705026100904000050000040000507009920108000034059000507000000";
const EMPTY = new Array(81).fill(0);

function isCompleteSolution(grid, givens) {
  for (const unit of UNITS) {
    if (unit.map((i) => grid[i]).sort().join("") !== "123456789") return false;
  }
  return givens.every((d, i) => d === 0 || d === grid[i]);
}

test("grid geometry: 27 units of 9 cells, 20 peers per cell", () => {
  assert.equal(UNITS.length, 27);
  for (const u of UNITS) assert.equal(new Set(u).size, 9);
  assert.equal(PEERS.length, 81);
  for (let i = 0; i < CELLS; i++) {
    assert.equal(PEERS[i].length, 20);
    assert.ok(!PEERS[i].includes(i));
  }
});

test("parse / print round trip", () => {
  assert.equal(gridToString(parseGrid(EASY)), EASY.replace(/0/g, "."));
  assert.deepEqual(parseGrid("." + "0".repeat(80)), EMPTY);
  assert.throws(() => parseGrid("123"));
});

test("solves the classic easy puzzle to the known solution", () => {
  assert.equal(gridToString(solve(parseGrid(EASY))), EASY_SOLUTION);
});

test("solves the hard puzzles with a valid solution", () => {
  for (const s of [INKALA, NORVIG]) {
    const g = parseGrid(s), sol = solve(g);
    assert.ok(sol, s);
    assert.ok(isCompleteSolution(sol, g));
  }
});

test("countSolutions: unique puzzles give 1", () => {
  assert.equal(countSolutions(parseGrid(EASY)), 1);
  assert.equal(countSolutions(parseGrid(INKALA)), 1);
});

test("countSolutions: ambiguous grids are capped at the limit", () => {
  assert.equal(countSolutions(EMPTY), 2);
  assert.equal(countSolutions(EMPTY, 5), 5);
  // Dropping one clue of a unique puzzle can only keep or increase the count.
  const g = parseGrid(EASY);
  g[0] = 0; g[1] = 0; g[4] = 0;
  assert.ok(countSolutions(g) >= 1);
});

test("countSolutions: contradictory and unsolvable grids give 0", () => {
  const dup = EMPTY.slice();
  dup[0] = 5; dup[1] = 5; // two 5s in a row
  assert.equal(isValidGrid(dup), false);
  assert.equal(countSolutions(dup), 0);
  assert.equal(solve(dup), null);

  const dead = EMPTY.slice();
  for (let c = 0; c < 8; c++) dead[c] = c + 1; // row 0: 1..8, cell (0,8) needs 9
  dead[17] = 9;                                 // but 9 already stands in its column
  assert.equal(isValidGrid(dead), true);
  assert.equal(countSolutions(dead), 0);
  assert.equal(solve(dead), null);
});

test("an empty grid with a random generator yields random, valid full grids", () => {
  const a = solve(EMPTY, createRng(1));
  const b = solve(EMPTY, createRng(2));
  const a2 = solve(EMPTY, createRng(1));
  assert.ok(isCompleteSolution(a, EMPTY));
  assert.ok(isCompleteSolution(b, EMPTY));
  assert.deepEqual(a, a2);
  assert.notDeepEqual(a, b);
});

test("speed guard: 100 random partial grids are counted quickly", () => {
  const rng = createRng(2024);
  const t0 = performance.now();
  for (let k = 0; k < 100; k++) {
    const g = solve(EMPTY, rng);
    for (let i = 0; i < 45; i++) g[rng.int(81)] = 0;
    const n = countSolutions(g);
    assert.ok(n >= 1 && n <= 2);
  }
  const ms = performance.now() - t0;
  assert.ok(ms < 5000, "took " + Math.round(ms) + " ms");
});
