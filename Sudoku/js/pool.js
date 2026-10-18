// One pre-generated puzzle per level, kept in storage, so New Game is instant
// (also offline and after a cold start). Storage and generator are injected.
import { LEVELS, CELLS_PER_BOARD } from "./config.js";

export const POOL_KEY = "sudoku.pool";

function validPuzzle(p, level) {
  const ok = (a, lo) => Array.isArray(a) && a.length === CELLS_PER_BOARD &&
    a.every((d) => Number.isInteger(d) && d >= lo && d <= 9);
  return !!p && p.level === level && ok(p.givens, 0) && ok(p.solution, 1) &&
    p.givens.every((d, i) => d === 0 || d === p.solution[i]);
}

export function createPool({ storage, generate, key = POOL_KEY }) {
  function load() {
    try {
      const data = JSON.parse(storage.getItem(key));
      const pool = {};
      for (const level of LEVELS) pool[level] = data && validPuzzle(data[level], level) ? data[level] : null;
      return pool;
    } catch (e) {
      return Object.fromEntries(LEVELS.map((l) => [l, null]));
    }
  }
  function save(pool) {
    try { storage.setItem(key, JSON.stringify(pool)); } catch (e) { /* storage unavailable: fine */ }
  }

  return {
    has: (level) => load()[level] !== null,

    // A puzzle for the level: the stored one (removed from the pool) or a fresh one.
    async take(level) {
      const pool = load();
      const stored = pool[level];
      if (stored) { pool[level] = null; save(pool); return stored; }
      return generate(level);
    },

    // Fills the empty slots (one level after the other).
    async refill(levels = LEVELS) {
      for (const level of levels) {
        if (load()[level]) continue;
        const puzzle = await generate(level);
        const pool = load();
        pool[level] = puzzle;
        save(pool);
      }
    }
  };
}
