// Puzzle generation (PRD 5.2): random full grid, symmetric dig that keeps the
// solution unique, grade with the human-technique solver. Pure functions.
import { CELLS } from "./grid.js";
import { solve, countSolutions } from "./solver.js";
import { orbits } from "./symmetry.js";
import { gradePuzzle, LEVEL_ORDER } from "./techniques.js";
import { LEVEL_CONFIG, SYMMETRY_TYPES } from "./config.js";

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

// Symmetry for "random" mode: 180-degree rotation is the favourite, the others add variety.
export function pickSymmetry(rng) {
  const weighted = ["rot180", "rot180", "rot180", "rot180", ...SYMMETRY_TYPES.filter((t) => t !== "rot180")];
  return weighted[rng.int(weighted.length)];
}

// Generates a puzzle for `level`. options:
//   symmetry     a symmetry type (default "rot180") or "random" (see pickSymmetry);
//                in random mode a hard level falls back to rot180 after fallbackAfter attempts
//   maxAttempts  dig attempts before giving up on the exact level (default 3000)
// Returns { givens, solution, level, symmetry, clues, graded }. If no puzzle of exactly
// the requested level was found, the closest one is returned with fallback: true.
export function generate(level, rng, options = {}) {
  const cfg = LEVEL_CONFIG[level];
  if (!cfg) throw new Error("unknown level: " + level);
  const random = options.symmetry === "random";
  let symmetry = random ? pickSymmetry(rng) : (options.symmetry || "rot180");
  const maxAttempts = options.maxAttempts || 3000;
  const fallbackAfter = options.fallbackAfter || 300;
  const wanted = LEVEL_ORDER.indexOf(level);

  let best = null, bestRank = -2;
  let solution = fullGrid(rng);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // A few dig orders per full grid, then a fresh grid.
    if (attempt > 0 && attempt % 5 === 0) solution = fullGrid(rng);
    if (random && attempt === fallbackAfter) symmetry = "rot180";
    const target = cfg.minClues + rng.int(cfg.maxClues - cfg.minClues + 1);
    const { givens, clues } = dig(solution, symmetry, rng, target, cfg.minClues);
    if (clues > cfg.maxClues) continue;
    const graded = gradePuzzle(givens);
    const puzzle = { givens, solution, level, symmetry, clues, graded: graded.hardest };
    if (graded.solved && graded.hardest === level) return puzzle;
    // Remember the best solvable puzzle that is not harder than asked for.
    const rank = graded.solved ? LEVEL_ORDER.indexOf(graded.hardest) : -1;
    if (graded.solved && rank <= wanted && rank > bestRank) { best = puzzle; bestRank = rank; }
  }
  if (!best) throw new Error("generation failed for level " + level);
  return { ...best, fallback: true };
}
