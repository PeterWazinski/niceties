import test from "node:test";
import assert from "node:assert/strict";
import { CELLS, UNITS } from "../../js/grid.js";
import { countSolutions } from "../../js/solver.js";
import { createRng } from "../../js/rng.js";
import { generate, pickSymmetry } from "../../js/generator.js";
import { gradePuzzle } from "../../js/techniques.js";
import { GENERATORS } from "../../js/symmetry.js";
import { LEVELS, LEVEL_CONFIG, SYMMETRY_TYPES } from "../../js/config.js";

const full = (g) => UNITS.every((u) => u.map((i) => g[i]).sort().join("") === "123456789");

function checkPuzzle(p, level, label) {
  const cfg = LEVEL_CONFIG[level];
  assert.equal(p.fallback, undefined, label + " fell back");
  assert.equal(p.level, level, label);
  assert.equal(countSolutions(p.givens, 2), 1, label + " unique");
  assert.ok(p.clues >= cfg.minClues && p.clues <= cfg.maxClues, label + " clues " + p.clues);
  assert.equal(p.givens.filter((d) => d).length, p.clues, label);
  assert.ok(full(p.solution), label);
  const sym = GENERATORS[p.symmetry];
  for (let i = 0; i < CELLS; i++) {
    if (p.givens[i]) assert.equal(p.givens[i], p.solution[i], label);
    for (const f of sym) assert.equal(p.givens[i] !== 0, p.givens[f(i)] !== 0, label + " symmetry " + p.symmetry);
  }
  const g = gradePuzzle(p.givens);
  assert.ok(g.solved, label + " solvable by the catalogue");
  assert.equal(g.hardest, level, label + " graded " + g.hardest);
  assert.deepEqual(g.grid, p.solution, label);
}

for (const level of LEVELS) {
  test("50 seeded " + level + " puzzles: unique, clue range, symmetric, graded " + level, () => {
    for (let seed = 1; seed <= 50; seed++) {
      checkPuzzle(generate(level, createRng(seed), { symmetry: "random" }), level, level + " seed " + seed);
    }
  });
}

test("every symmetry type yields valid unique Beginner puzzles", () => {
  for (const symmetry of SYMMETRY_TYPES) {
    for (let seed = 1; seed <= 5; seed++) {
      const p = generate("beginner", createRng(seed), { symmetry });
      assert.equal(p.symmetry, symmetry);
      checkPuzzle(p, "beginner", symmetry + " seed " + seed);
    }
  }
});

test("Master generation terminates within the attempt limit for 20 seeds", () => {
  const t0 = performance.now();
  for (let seed = 1000; seed < 1020; seed++) {
    const p = generate("master", createRng(seed), { symmetry: "random" });
    assert.equal(p.fallback, undefined, "seed " + seed);
  }
  const avg = (performance.now() - t0) / 20;
  assert.ok(avg < 1000, "average " + avg.toFixed(0) + " ms");
});

test("random mode picks all symmetries, 180 degrees most often", () => {
  const rng = createRng(1), count = {};
  for (let i = 0; i < 2000; i++) { const s = pickSymmetry(rng); count[s] = (count[s] || 0) + 1; }
  assert.equal(Object.keys(count).length, SYMMETRY_TYPES.length);
  assert.ok(count.rot180 > count.rot90 * 2);
});

test("an impossible request falls back to the closest easier puzzle, flagged", () => {
  // Master with almost no attempts cannot be found; the result is easier and flagged.
  const p = generate("master", createRng(3), { maxAttempts: 3 });
  assert.equal(p.fallback, true);
  assert.equal(p.level, "master");
  assert.equal(countSolutions(p.givens, 2), 1);
  assert.ok(p.graded !== "master");
});
