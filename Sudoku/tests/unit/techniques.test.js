import test from "node:test";
import assert from "node:assert/strict";
import { TECHNIQUES, techniqueLevel, applyStep, nextStep, gradePuzzle, candidates } from "../../js/techniques.js";
import { parseGrid } from "../../js/grid.js";

const bits = (...ds) => ds.reduce((m, d) => m | (1 << (d - 1)), 0);
const finder = (name) => TECHNIQUES.find((t) => t.name === name).find;
const empty = () => new Array(81).fill(0);
// Candidate arrays for hand-made positions: 0 = "solved cell", so only the cells set below matter.
const at = (r, c) => r * 9 + c;
const elims = (step) => step.eliminations.map((e) => e.cell + ":" + e.digit).sort();

test("catalogue: techniques ascend in difficulty and cover all three levels", () => {
  assert.deepEqual(TECHNIQUES.map((t) => t.name), [
    "nakedSingle", "hiddenSingle", "pointing", "claiming", "nakedPair", "hiddenPair",
    "nakedTriple", "hiddenTriple", "xWing", "xyWing", "swordfish"
  ]);
  assert.equal(techniqueLevel("hiddenSingle"), "beginner");
  assert.equal(techniqueLevel("nakedTriple"), "expert");
  assert.equal(techniqueLevel("swordfish"), "master");
  assert.equal(techniqueLevel("nope"), null);
});

test("naked pair: the pair digits leave the rest of the unit", () => {
  const cand = empty();
  cand[0] = bits(1, 2); cand[1] = bits(1, 2); cand[2] = bits(1, 2, 3); cand[3] = bits(2, 4);
  const step = finder("nakedPair")(empty(), cand);
  assert.equal(step.technique, "nakedPair");
  assert.deepEqual(step.cells, [0, 1]);
  assert.deepEqual(elims(step), ["2:1", "2:2", "3:2"]);
});

test("naked triple", () => {
  const cand = empty();
  cand[0] = bits(1, 2); cand[1] = bits(2, 3); cand[2] = bits(1, 3); cand[3] = bits(1, 2, 3, 4);
  const step = finder("nakedTriple")(empty(), cand);
  assert.deepEqual(step.cells, [0, 1, 2]);
  assert.deepEqual(elims(step), ["3:1", "3:2", "3:3"]);
});

test("hidden pair: the pair cells lose all other candidates", () => {
  const cand = empty();
  cand[0] = bits(1, 2, 3, 4); cand[1] = bits(1, 2, 5); cand[2] = bits(3, 4, 5, 6); cand[3] = bits(3, 5, 6);
  const step = finder("hiddenPair")(empty(), cand);
  assert.equal(step.technique, "hiddenPair");
  assert.deepEqual(step.cells.slice().sort(), [0, 1]);
  assert.deepEqual(elims(step), ["0:3", "0:4", "1:5"]);
});

test("hidden triple", () => {
  const cand = empty();
  cand[0] = bits(1, 2, 7); cand[1] = bits(2, 3, 8); cand[2] = bits(1, 3, 9); cand[3] = bits(7, 8, 9); cand[4] = bits(7, 8, 9);
  const step = finder("hiddenTriple")(empty(), cand);
  assert.deepEqual(step.cells.slice().sort(), [0, 1, 2]);
  assert.deepEqual(elims(step), ["0:7", "1:8", "2:9"]);
});

test("pointing: a digit confined to one line of a box leaves the rest of the line", () => {
  const cand = empty();
  cand[0] = bits(5, 6); cand[1] = bits(5, 7); cand[5] = bits(5, 8);
  const step = finder("pointing")(empty(), cand);
  assert.equal(step.technique, "pointing");
  assert.deepEqual(elims(step), ["5:5"]);
});

test("claiming: a digit confined to one box of a line leaves the rest of the box", () => {
  const cand = empty();
  cand[0] = bits(5, 6); cand[1] = bits(5, 7); cand[at(1, 1)] = bits(5, 9);
  const step = finder("claiming")(empty(), cand);
  assert.equal(step.technique, "claiming");
  assert.deepEqual(elims(step), [at(1, 1) + ":5"]);
});

test("X-Wing: two rows, two columns", () => {
  const cand = empty();
  for (const [r, c] of [[1, 2], [1, 6], [4, 2], [4, 6], [7, 2]]) cand[at(r, c)] = bits(5);
  const step = finder("xWing")(empty(), cand);
  assert.equal(step.technique, "xWing");
  assert.deepEqual(elims(step), [at(7, 2) + ":5"]);
});

test("Swordfish: three rows, three columns", () => {
  const cand = empty();
  for (const [r, c] of [[0, 1], [0, 4], [3, 4], [3, 7], [6, 1], [6, 7], [8, 4]]) cand[at(r, c)] = bits(3);
  const step = finder("swordfish")(empty(), cand);
  assert.equal(step.technique, "swordfish");
  assert.deepEqual(elims(step), [at(8, 4) + ":3"]);
});

test("XY-Wing: the digit shared by both wings leaves the cells that see both", () => {
  const cand = empty();
  cand[at(0, 0)] = bits(1, 2); cand[at(0, 1)] = bits(1, 3); cand[at(1, 0)] = bits(2, 3);
  cand[at(1, 1)] = bits(3, 9);
  const step = finder("xyWing")(empty(), cand);
  assert.equal(step.technique, "xyWing");
  assert.deepEqual(step.cells, [0, 1, 9]);
  assert.deepEqual(elims(step), [at(1, 1) + ":3"]);
});

test("finders return null when nothing applies", () => {
  const cand = empty();
  cand[0] = bits(1, 2, 3, 4);
  for (const t of TECHNIQUES.slice(2)) assert.equal(t.find(empty(), cand), null, t.name);
});

test("applyStep places a digit (peers lose it) or applies eliminations", () => {
  const grid = empty();
  const cand = new Array(81).fill(0x1ff);
  applyStep(grid, cand, { technique: "nakedSingle", cell: 0, digit: 5 });
  assert.equal(grid[0], 5);
  assert.equal(cand[0], 0);
  assert.equal(cand[1] & bits(5), 0);   // row peer
  assert.equal(cand[9] & bits(5), 0);   // column peer
  assert.equal(cand[10] & bits(5), 0);  // box peer
  assert.ok(cand[80] & bits(5));        // not a peer
  applyStep(grid, cand, { technique: "pointing", eliminations: [{ cell: 80, digit: 5 }] });
  assert.equal(cand[80] & bits(5), 0);
});

test("nextStep prefers the easiest technique", () => {
  const g = parseGrid("530070000600195000098000060800060003400803001700020006060000280000419005000080079");
  const step = nextStep(g, candidates(g));
  assert.ok(step.technique === "nakedSingle" || step.technique === "hiddenSingle");
});

test("grader: a puzzle that needs more than singles is not graded as singles-only", () => {
  const g = parseGrid("800000000003600000070090200050007000000045700000100030001000068008500010090000400");
  const r = gradePuzzle(g);
  assert.ok(!(r.solved && r.hardest === "beginner"));
});
