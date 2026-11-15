import test from "node:test";
import assert from "node:assert/strict";
import { TECHNIQUES, techniqueLevel, applyStep, nextStep, gradePuzzle, candidates, validStep } from "../../js/techniques.js";
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

// ---- Coach metadata and validStep (PRD 3.4.1) ------------------------------------

// [technique, candidate setup, expected metadata, change that breaks the pattern]
const FIXTURES = [
  ["nakedPair", (c) => { c[0] = bits(1, 2); c[1] = bits(1, 2); c[2] = bits(1, 2, 3); c[3] = bits(2, 4); },
    { unit: 0, digits: [1, 2] }, (c) => { c[1] |= bits(3); }],
  ["nakedTriple", (c) => { c[0] = bits(1, 2); c[1] = bits(2, 3); c[2] = bits(1, 3); c[3] = bits(1, 2, 3, 4); },
    { unit: 0, digits: [1, 2, 3] }, (c) => { c[0] |= bits(4); }],
  ["hiddenPair", (c) => { c[0] = bits(1, 2, 3, 4); c[1] = bits(1, 2, 5); c[2] = bits(3, 4, 5, 6); c[3] = bits(3, 5, 6); },
    { unit: 0, digits: [1, 2] }, (c) => { c[2] |= bits(1); }],
  ["hiddenTriple", (c) => { c[0] = bits(1, 2, 7); c[1] = bits(2, 3, 8); c[2] = bits(1, 3, 9); c[3] = bits(7, 8, 9); c[4] = bits(7, 8, 9); },
    { unit: 0, digits: [1, 2, 3] }, (c) => { c[3] |= bits(1); }],
  ["pointing", (c) => { c[0] = bits(5, 6); c[1] = bits(5, 7); c[5] = bits(5, 8); },
    { digit: 5, box: 18, line: 0 }, (c) => { c[at(1, 1)] = bits(5); }],
  ["claiming", (c) => { c[0] = bits(5, 6); c[1] = bits(5, 7); c[at(1, 1)] = bits(5, 9); },
    { digit: 5, line: 0, box: 18 }, (c) => { c[5] = bits(5); }],
  ["xWing", (c) => { for (const [r, k] of [[1, 2], [1, 6], [4, 2], [4, 6], [7, 2]]) c[at(r, k)] = bits(5); },
    { digit: 5, base: [1, 4], cover: [11, 15] }, (c) => { c[at(1, 4)] = bits(5); }],
  ["swordfish", (c) => { for (const [r, k] of [[0, 1], [0, 4], [3, 4], [3, 7], [6, 1], [6, 7], [8, 4]]) c[at(r, k)] = bits(3); },
    { digit: 3, base: [0, 3, 6], cover: [10, 13, 16] }, (c) => { c[at(0, 2)] = bits(3); }],
  ["xyWing", (c) => { c[at(0, 0)] = bits(1, 2); c[at(0, 1)] = bits(1, 3); c[at(1, 0)] = bits(2, 3); c[at(1, 1)] = bits(3, 9); },
    { pivot: 0, pincers: [1, 9], digit: 3 }, (c) => { c[0] = bits(1, 2, 4); }]
];

for (const [name, setup, meta, breakIt] of FIXTURES) {
  test(`${name}: Coach metadata, and validStep holds only while the pattern does`, () => {
    const cand = empty();
    setup(cand);
    const step = finder(name)(empty(), cand);
    for (const [k, v] of Object.entries(meta)) {
      const got = Array.isArray(step[k]) ? step[k].slice().sort((a, b) => a - b) : step[k];
      assert.deepEqual(got, v, k);
    }
    assert.equal(validStep(empty(), cand, step), true, "valid where it was found");
    const done = cand.slice();
    applyStep(empty(), done, step);
    assert.equal(validStep(empty(), done, step), false, "nothing left to remove");
    const broken = cand.slice();
    breakIt(broken);
    assert.equal(validStep(empty(), broken, step), false, "pattern broken");
  });
}

test("singles: hidden single knows its unit; validStep checks both singles", () => {
  const cand = empty();
  cand[at(0, 3)] = bits(4, 5); cand[at(0, 4)] = bits(5, 6); cand[at(0, 5)] = bits(5, 6);
  const hs = finder("hiddenSingle")(empty(), cand);
  assert.deepEqual([hs.cell, hs.digit, hs.unit], [at(0, 3), 4, 0]);
  assert.equal(validStep(empty(), cand, hs), true);
  const other = cand.slice(); other[at(0, 4)] |= bits(4);
  assert.equal(validStep(empty(), other, hs), false);
  const ns = { technique: "nakedSingle", cell: at(0, 3), digit: 4 };
  assert.equal(validStep(empty(), cand, ns), false, "two candidates: not a naked single");
  const one = cand.slice(); one[at(0, 3)] = bits(4);
  assert.equal(validStep(empty(), one, ns), true);
});
