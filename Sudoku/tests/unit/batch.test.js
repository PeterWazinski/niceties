import test from "node:test";
import assert from "node:assert/strict";
import { CELLS, UNITS } from "../../js/grid.js";
import { countSolutions } from "../../js/solver.js";
import { createRng } from "../../js/rng.js";
import { generate } from "../../js/generator.js";
import { gradePuzzle } from "../../js/techniques.js";
import { GENERATORS } from "../../js/symmetry.js";
import { LEVELS, LEVEL_CONFIG } from "../../js/config.js";

// Final release check: a large seeded batch, 100 puzzles per level (300 in total), as the app
// generates them (random symmetry): unique, in the clue range, symmetric, graded exactly as asked.
for (const level of LEVELS) {
  test("release batch: 100 " + level + " puzzles", () => {
    const cfg = LEVEL_CONFIG[level];
    const symmetries = new Set();
    let fallbacks = 0;
    for (let seed = 5000; seed < 5100; seed++) {
      const p = generate(level, createRng(seed), { symmetry: "random" });
      if (p.fallback) { fallbacks++; continue; }
      symmetries.add(p.symmetry);
      assert.equal(countSolutions(p.givens, 2), 1, level + " " + seed + " unique");
      assert.ok(p.clues >= cfg.minClues && p.clues <= cfg.maxClues, level + " " + seed + " clues " + p.clues);
      assert.ok(UNITS.every((u) => u.map((i) => p.solution[i]).sort().join("") === "123456789"));
      for (let i = 0; i < CELLS; i++) {
        if (p.givens[i]) assert.equal(p.givens[i], p.solution[i]);
        for (const f of GENERATORS[p.symmetry]) assert.equal(p.givens[i] !== 0, p.givens[f(i)] !== 0, level + " " + seed + " symmetry");
      }
      const g = gradePuzzle(p.givens);
      assert.ok(g.solved && g.hardest === level, level + " " + seed + " graded " + g.hardest);
    }
    assert.equal(fallbacks, 0, "no fallback puzzles");
    assert.ok(symmetries.size >= 4, "variety of symmetries: " + [...symmetries].join(","));
  });
}
