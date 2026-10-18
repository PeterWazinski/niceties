// Puzzle generation (PRD 5.2): random full grid, symmetric dig that keeps the
// solution unique, grade with the human-technique solver. Pure functions.
import { CELLS } from "./grid.js";
import { solve, countSolutions } from "./solver.js";
import { orbits } from "./symmetry.js";
import { gradePuzzle } from "./techniques.js";
import { LEVEL_CONFIG } from "./config.js";

const EMPTY = new Array(CELLS).fill(0);

export function fullGrid(rng) {
  return solve(EMPTY, rng);
}

// Removes whole symmetry orbits in random order while the puzzle keeps exactly one
// solution, until the clue count is at most `target` (never below `minClues`).
export function dig(solution, symmetry, rng, target, minClues) {
  const grid = solution.slice();
  let clues = CELLS;
  for (const orbit of rng.shuffle(orbits(symmetry).slice())) {
    if (clues <= target) break;
    if (clues - orbit.length < minClues) continue;
    const saved = orbit.map((i) => grid[i]);
    for (const i of orbit) grid[i] = 0;
    if (countSolutions(grid, 2) === 1) clues -= orbit.length;
    else orbit.forEach((i, k) => { grid[i] = saved[k]; });
  }
  return { givens: grid, clues };
}

// Generates a puzzle for `level`. options: symmetry (default "rot180"),
// maxAttempts (default 200). Returns { givens, solution, level, symmetry, clues }.
export function generate(level, rng, options = {}) {
  const cfg = LEVEL_CONFIG[level];
  if (!cfg) throw new Error("unknown level: " + level);
  if (level !== "beginner") throw new Error("level not supported yet: " + level);
  const symmetry = options.symmetry || "rot180";
  const maxAttempts = options.maxAttempts || 200;

  let solution = fullGrid(rng);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // A few dig orders per full grid, then a fresh grid.
    if (attempt > 0 && attempt % 5 === 0) solution = fullGrid(rng);
    const target = cfg.minClues + rng.int(cfg.maxClues - cfg.minClues + 1);
    const { givens, clues } = dig(solution, symmetry, rng, target, cfg.minClues);
    if (clues > cfg.maxClues) continue;
    const graded = gradePuzzle(givens);
    if (graded.solved && graded.hardest === level) {
      return { givens, solution, level, symmetry, clues };
    }
  }
  throw new Error("generation failed for level " + level);
}
