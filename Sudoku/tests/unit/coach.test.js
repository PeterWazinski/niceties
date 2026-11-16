import test from "node:test";
import assert from "node:assert/strict";
import { CELLS } from "../../js/grid.js";
import { createRng } from "../../js/rng.js";
import { generate } from "../../js/generator.js";
import { candidates, nextStep, applyStep, validStep, techniqueLevel } from "../../js/techniques.js";
import { coachChain, explain, cellNamer, TECHNIQUE_TITLES } from "../../js/coach.js";
import { newGame, enterDigit, coachGrid, coachSteps } from "../../js/game.js";

const bits = (...ds) => ds.reduce((m, d) => m | (1 << (d - 1)), 0);
const at = (r, c) => r * 9 + c;

// Plays generated games to the end with the Coach only; calls visit(chain, grid, puzzle) per move.
function playWithCoach(level, seeds, visit) {
  for (const seed of seeds) {
    const puzzle = generate(level, createRng(seed));
    const grid = puzzle.givens.slice();
    while (grid.includes(0)) {
      const chain = coachChain(grid);
      visit(chain, grid, puzzle);
      assert.ok(chain.placement, `seed ${seed}: the Coach must always find a move`);
      grid[chain.placement.cell] = chain.placement.digit;
    }
  }
}

const SEEDS = Array.from({ length: 10 }, (_, k) => 2000 + k);
const used = { beginner: new Set(), expert: new Set(), master: new Set() };
let prunedSomewhere = false;

for (const level of ["beginner", "expert", "master"]) {
  test(`${level}: the Coach solves generated games correctly, chain by chain`, () => {
    playWithCoach(level, SEEDS, ({ steps, placement }, grid, puzzle) => {
      // placement = the solution, and the last step places it
      assert.equal(placement.digit, puzzle.solution[placement.cell]);
      const last = steps[steps.length - 1];
      assert.ok(!last.eliminations && last.cell === placement.cell && last.digit === placement.digit);
      // no step removes the solution digit; every step holds when replayed in order
      const g = grid.slice(), cand = candidates(g);
      for (const step of steps) {
        for (const e of step.removed) assert.notEqual(e.digit, puzzle.solution[e.cell], "removed the solution digit");
        assert.ok(validStep(g, cand, step), `${step.technique} must hold in the replayed state`);
        if (step.eliminations) applyStep(g, cand, step);
        used[level].add(step.technique);
      }
      // the unpruned chain starts with the easiest available step
      const raw = coachChain(grid, { prune: false });
      assert.equal(raw.steps[0].technique, nextStep(grid, candidates(grid)).technique);
      // pruning never makes a chain longer
      assert.ok(raw.steps.length >= steps.length);
      if (raw.steps.length > steps.length) prunedSomewhere = true;
    });
  });
}

test("the batches use techniques of their level, and pruning happens", () => {
  assert.ok([...used.beginner].every((t) => techniqueLevel(t) === "beginner"));
  assert.ok([...used.expert].some((t) => techniqueLevel(t) === "expert"), "expert games need expert techniques");
  assert.ok([...used.master].some((t) => techniqueLevel(t) === "master"), "master games need master techniques");
  assert.ok(prunedSomewhere, "some chain had an unneeded elimination step");
});

test("easiest wins: when a single exists, the chain is just that single", () => {
  const grid = generate("beginner", createRng(7)).givens.slice();
  const first = nextStep(grid, candidates(grid));
  assert.ok(!first.eliminations, "a fresh beginner puzzle starts with a single");
  const { steps, placement } = coachChain(grid);
  assert.equal(steps.length, 1);
  assert.deepEqual(placement, { cell: first.cell, digit: first.digit });
  assert.equal(steps[0].technique, first.technique);
});

test("no technique applies → no placement", () => {
  assert.deepEqual(coachChain(new Array(CELLS).fill(0)), { steps: [], placement: null });
});

test("decorated steps: candidates only in the involved cells, removed ones among them", () => {
  let checked = 0;
  playWithCoach("master", [2100, 2101, 2102], ({ steps }) => {
    for (const s of steps) {
      const involved = new Set([...s.keyCells, ...s.removed.map((e) => e.cell)]);
      assert.deepEqual(Object.keys(s.shown).map(Number).sort((a, b) => a - b), [...involved].sort((a, b) => a - b));
      for (const e of s.removed) assert.ok(s.shown[e.cell] & bits(e.digit), "a removed candidate is shown before removal");
      for (const k of s.key) assert.ok(s.shown[k.cell] & bits(k.digit), "a key candidate is shown");
      if (s.eliminations) assert.ok(s.removed.length > 0);
      assert.ok(s.units.every((u) => u >= 0 && u < 27));
      checked++;
    }
  });
  assert.ok(checked > 0);
});

test("cell names: long on first mention, short afterwards, per session", () => {
  const name = cellNamer();
  assert.equal(name(at(3, 5)), "row 4, column 6");
  assert.equal(name(at(3, 5)), "r4c6");
  assert.equal(name(at(0, 0)), "row 1, column 1");
  assert.equal(cellNamer()(at(3, 5)), "row 4, column 6", "a new session starts over");
});

// ---- texts for hand-made steps -------------------------------------------------

test("texts: singles", () => {
  const ns = { technique: "nakedSingle", cell: at(3, 5), digit: 7 };
  assert.deepEqual(explain(ns), {
    title: "Naked Single", level: "Youngling",
    text: "Row 4, column 6 can only be 7: every other digit already stands in its row, column or box."
  });
  assert.equal(explain(ns, cellNamer(), { afterEliminations: true }).text, "Row 4, column 6 can only be 7: all other candidates are gone.");
  const hs = { technique: "hiddenSingle", cell: at(3, 5), digit: 7, unit: 22 };
  assert.equal(explain(hs).text, "In box 5, the 7 fits only into row 4, column 6.");
});

test("texts: pointing and claiming", () => {
  const p = { technique: "pointing", digit: 5, box: 18, line: 9, cells: [at(0, 0), at(1, 0)], eliminations: [] };
  assert.equal(explain(p).text, "In box 1, the 5 can only be in column 1. So the 5 is removed from the rest of column 1.");
  assert.equal(explain(p).level, "Padawan");
  const c = { technique: "claiming", digit: 2, line: 4, box: 21, cells: [], eliminations: [] };
  assert.equal(explain(c).text, "In row 5, the 2 can only be in box 4. So the 2 is removed from the rest of box 4.");
});

test("texts: subsets", () => {
  const np = { technique: "nakedPair", cells: [at(1, 2), at(1, 6)], digits: [4, 8], unit: 1, eliminations: [] };
  assert.equal(explain(np).text,
    "Row 2, column 3 and row 2, column 7 can only hold 4 and 8. So 4 and 8 are removed from the other cells of row 2.");
  const nt = { technique: "nakedTriple", cells: [0, 1, 2], digits: [1, 2, 3], unit: 18, eliminations: [] };
  assert.match(explain(nt).text, /can only hold 1, 2 and 3 between them\. So 1, 2 and 3 are removed from the other cells of box 1\.$/);
  const hp = { technique: "hiddenPair", cells: [at(0, 4), at(8, 4)], digits: [3, 9], unit: 13, eliminations: [] };
  assert.equal(explain(hp).text,
    "In column 5, 3 and 9 fit only into row 1, column 5 and row 9, column 5. So all other candidates are removed from these cells.");
  assert.equal(explain({ ...hp, technique: "hiddenTriple" }).title, "Hidden Triple");
});

test("texts: fish", () => {
  const xw = { technique: "xWing", digit: 7, base: [1, 4], cover: [10, 17], cells: [], eliminations: [] };
  assert.deepEqual(explain(xw), {
    title: "X-Wing", level: "Jedi",
    text: "In rows 2 and 5, the 7 fits only into columns 2 and 9. So in columns 2 and 9 the 7 must be in rows 2 and 5, and it is removed from the rest of columns 2 and 9."
  });
  const sf = { technique: "swordfish", digit: 3, base: [9, 12, 16], cover: [0, 4, 8], cells: [], eliminations: [] };
  assert.match(explain(sf).text, /^In columns 1, 4 and 8, the 3 fits only into rows 1, 5 and 9\./);
});

test("texts: XY-Wing names the pivot, both cases and the removed digit", () => {
  const p = at(2, 2), a = at(2, 5), b = at(5, 2);
  const step = {
    technique: "xyWing", pivot: p, pincers: [a, b], digit: 6, cells: [p, a, b], eliminations: [],
    shown: { [p]: bits(2, 9), [a]: bits(9, 6), [b]: bits(2, 6) }
  };
  assert.equal(explain(step).text,
    "Row 3, column 3 can only be 2 or 9. If it is 9, row 3, column 6 must be 6; if it is 2, row 6, column 3 must be 6. " +
    "Either way one of r3c6 and r6c3 is 6, so the 6 is removed from every cell that sees both.");
});

test("every technique has a title", () => {
  for (const t of ["nakedSingle", "hiddenSingle", "pointing", "claiming", "nakedPair", "hiddenPair",
    "nakedTriple", "hiddenTriple", "xWing", "xyWing", "swordfish"]) assert.ok(TECHNIQUE_TITLES[t], t);
});

// ---- game adapter --------------------------------------------------------------

test("game: the Coach works on givens + correct digits, a wrong digit is left out", () => {
  const puzzle = generate("beginner", createRng(12));
  const s = newGame(puzzle);
  const empty = s.givens.findIndex((g) => g === 0);
  const wrong = (s.solution[empty] % 9) + 1;
  enterDigit(s, empty, wrong);
  assert.equal(coachGrid(s)[empty], 0);
  assert.deepEqual(coachGrid(s), s.givens);
  const { placement } = coachSteps(s);
  assert.equal(placement.digit, s.solution[placement.cell]);
});
