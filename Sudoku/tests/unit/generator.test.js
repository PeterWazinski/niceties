import test from "node:test";
import assert from "node:assert/strict";
import { CELLS, UNITS, parseGrid } from "../../js/grid.js";
import { countSolutions } from "../../js/solver.js";
import { createRng } from "../../js/rng.js";
import { generate, fullGrid, dig } from "../../js/generator.js";
import { gradePuzzle, candidates, findNakedSingle, findHiddenSingle } from "../../js/techniques.js";
import { orbits, GENERATORS } from "../../js/symmetry.js";
import { LEVEL_CONFIG } from "../../js/config.js";

const EASY = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const INKALA = "800000000003600000070090200050007000000045700000100030001000068008500010090000400";

const isFull = (g) => UNITS.every((u) => u.map((i) => g[i]).sort().join("") === "123456789");
const clueCount = (g) => g.filter((d) => d !== 0).length;
const rot180 = GENERATORS.rot180[0];

test("100 seeded Beginner puzzles are unique, in range, 180-degree symmetric and singles-only", () => {
  const cfg = LEVEL_CONFIG.beginner;
  for (let seed = 1; seed <= 100; seed++) {
    const p = generate("beginner", createRng(seed));
    assert.equal(p.level, "beginner");
    assert.equal(p.symmetry, "rot180");
    assert.equal(p.givens.length, CELLS);
    assert.equal(countSolutions(p.givens, 2), 1, "seed " + seed);
    assert.equal(p.clues, clueCount(p.givens));
    assert.ok(p.clues >= cfg.minClues && p.clues <= cfg.maxClues, "seed " + seed + " clues " + p.clues);
    for (let i = 0; i < CELLS; i++) {
      assert.equal(p.givens[i] !== 0, p.givens[rot180(i)] !== 0, "symmetry, seed " + seed);
      if (p.givens[i]) assert.equal(p.givens[i], p.solution[i]);
    }
    assert.ok(isFull(p.solution));
    const graded = gradePuzzle(p.givens);
    assert.ok(graded.solved && graded.hardest === "beginner", "seed " + seed);
    assert.deepEqual(graded.grid, p.solution);
  }
});

test("same seed gives an identical puzzle, different seeds differ", () => {
  const a = generate("beginner", createRng(99)), b = generate("beginner", createRng(99));
  const c = generate("beginner", createRng(100));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.givens, c.givens);
});

test("Beginner generation is fast (average well below 100 ms)", () => {
  const t0 = performance.now();
  for (let seed = 200; seed < 230; seed++) generate("beginner", createRng(seed));
  const avg = (performance.now() - t0) / 30;
  assert.ok(avg < 100, "average " + avg.toFixed(1) + " ms");
});

test("other symmetries also work through the options", () => {
  for (const symmetry of ["mirrorH", "diagonal", "rot90"]) {
    const p = generate("beginner", createRng(5), { symmetry });
    assert.equal(p.symmetry, symmetry);
    const f = GENERATORS[symmetry][0];
    for (let i = 0; i < CELLS; i++) assert.equal(p.givens[i] !== 0, p.givens[f(i)] !== 0);
    assert.equal(countSolutions(p.givens, 2), 1);
  }
});

test("dig removes whole orbits, keeps uniqueness and respects the clue bounds", () => {
  const rng = createRng(3);
  const solution = fullGrid(rng);
  const { givens, clues } = dig(solution, "rot180", rng, 40, 38);
  assert.ok(clues >= 38 && clues <= 41);
  assert.equal(clues, clueCount(givens));
  assert.equal(countSolutions(givens, 2), 1);
  for (const orbit of orbits("rot180")) {
    assert.equal(new Set(orbit.map((i) => givens[i] !== 0)).size, 1);
  }
});

test("generate rejects unknown levels and not yet supported levels", () => {
  assert.throws(() => generate("nope", createRng(1)));
  assert.throws(() => generate("master", createRng(1)), /not supported yet/);
});

test("grader: the classic easy puzzle is singles-only", () => {
  const r = gradePuzzle(parseGrid(EASY));
  assert.equal(r.solved, true);
  assert.equal(r.hardest, "beginner");
  assert.equal(r.steps.length, 51);
  assert.ok(r.steps.every((s) => s.technique === "nakedSingle" || s.technique === "hiddenSingle"));
});

test("grader: a puzzle that needs harder techniques is not graded as singles-only", () => {
  const r = gradePuzzle(parseGrid(INKALA));
  assert.equal(r.solved, false);
  assert.ok(r.steps.length < 60);
  // it must not claim to have solved it, and the partial grid must be consistent
  assert.ok(r.grid.some((d) => d === 0));
});

test("naked single and hidden single are found on small examples", () => {
  const g = new Array(81).fill(0);
  // row 0 holds 1..8: cell (0,8) is a naked single 9
  for (let c = 0; c < 8; c++) g[c] = c + 1;
  assert.deepEqual(findNakedSingle(g), { technique: "nakedSingle", cell: 8, digit: 9 });

  // a hidden single: digit 1 can only go to cell (0,0) in row 0 because 1 is
  // placed in the rows below it, in columns 1..8 (one per box-free column)
  const h = new Array(81).fill(0);
  h[1 * 9 + 3] = 1;  // blocks 1 in column 3 and row 1
  h[2 * 9 + 6] = 1;  // column 6
  h[3 * 9 + 1] = 1;  // column 1
  h[4 * 9 + 4] = 1;  // column 4
  h[5 * 9 + 7] = 1;  // column 7
  h[6 * 9 + 2] = 1;  // column 2
  h[7 * 9 + 5] = 1;  // column 5
  h[8 * 9 + 8] = 1;  // column 8
  const found = findHiddenSingle(h);
  assert.equal(found.technique, "hiddenSingle");
  assert.equal(found.digit, 1);
  assert.equal(found.cell, 0);
  // candidates of a filled cell are empty
  assert.equal(candidates(h)[1 * 9 + 3], 0);
});
