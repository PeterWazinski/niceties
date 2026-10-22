// Uniqueness analysis (PRD 7): colour ties and symmetry ambiguity, and the smallest anchor set.
//
// A symmetry g of the patch turns the sorted picture into another arrangement: tile t shows the colour of
// tile g(t). It is a second, equally regular picture unless some ANCHORED tile t would change its colour
// (colour(g(t)) != colour(t)): anchors never move, so such an arrangement is ruled out.

import { colourStats } from "./color.js";

/** @typedef {import("./symmetry.js").Symmetry} Symmetry */

const MAX_EXACT = 20; // up to 2^20 coverage states for the exact search

/** Indices (into `syms`) of the symmetries that change the colouring, i.e. give another picture. */
function relevantSymmetries(colours, syms) {
  /** @type {number[]} */
  const out = [];
  syms.forEach((g, j) => {
    for (let t = 0; t < colours.length; t++) if (colours[g.perm[t]] !== colours[t]) { out.push(j); return; }
  });
  return out;
}

/**
 * @param {string[]} colours sorted colour per tile id
 * @param {Symmetry[]} syms symmetries of the patch (identity included)
 * @param {Iterable<number>} anchors anchored tile ids
 * @returns {{ ties: number[][], tiedTiles: number, relevant: number[], open: number[], unique: boolean, anchors: number }}
 */
export function analyse(colours, syms, anchors) {
  const fixed = [...new Set(anchors)];
  const { ties } = colourStats(colours);
  const relevant = relevantSymmetries(colours, syms);
  const open = relevant.filter((j) => !fixed.some((t) => colours[syms[j].perm[t]] !== colours[t]));
  return {
    ties, tiedTiles: ties.reduce((s, g) => s + g.length, 0),
    relevant, open, unique: open.length === 0, anchors: fixed.length
  };
}

/**
 * The smallest set of anchors that rules out every symmetric second picture. Tiles are grouped by the
 * symmetries they rule out; a search over the coverage of those symmetries finds the fewest groups
 * (exact up to MAX_EXACT symmetries, greedy beyond that).
 * @param {string[]} colours
 * @param {Symmetry[]} syms
 * @returns {{ anchors: number[], exact: boolean }}
 */
export function minimalAnchors(colours, syms) {
  const rel = relevantSymmetries(colours, syms);
  const m = rel.length;
  if (m === 0) return { anchors: [], exact: true };
  // signature of a tile: bit k set if the tile rules out the k-th relevant symmetry
  /** @type {Map<number, number>} signature -> lowest tile id */
  const reps = new Map();
  for (let t = 0; t < colours.length; t++) {
    let sig = 0;
    for (let k = 0; k < m; k++) if (colours[syms[rel[k]].perm[t]] !== colours[t]) sig |= 1 << k;
    if (sig && !reps.has(sig)) reps.set(sig, t);
  }
  const sigs = [...reps.keys()];
  const full = m >= 31 ? -1 : (1 << m) - 1;
  if (m > MAX_EXACT) { // greedy
    let covered = 0;
    /** @type {number[]} */
    const chosen = [];
    while (covered !== full) {
      let best = 0, gain = 0;
      for (const s of sigs) {
        let g = 0;
        for (let k = 0; k < m; k++) if ((s >> k & 1) && !(covered >> k & 1)) g++;
        if (g > gain) { gain = g; best = s; }
      }
      if (!gain) break;
      covered |= best;
      chosen.push(/** @type {number} */ (reps.get(best)));
    }
    return { anchors: chosen.sort((a, b) => a - b), exact: false };
  }
  // exact: breadth-first search over covered sets
  const size = 1 << m;
  const parent = new Int32Array(size).fill(-1);
  const via = new Int32Array(size).fill(-1);
  const seen = new Uint8Array(size);
  seen[0] = 1;
  let frontier = [0];
  while (frontier.length && !seen[full]) {
    /** @type {number[]} */
    const next = [];
    for (const state of frontier) {
      for (let i = 0; i < sigs.length; i++) {
        const to = state | sigs[i];
        if (!seen[to]) { seen[to] = 1; parent[to] = state; via[to] = i; next.push(to); }
      }
    }
    frontier = next;
  }
  /** @type {number[]} */
  const anchors = [];
  for (let s = full; s !== 0; s = parent[s]) anchors.push(/** @type {number} */ (reps.get(sigs[via[s]])));
  return { anchors: anchors.sort((a, b) => a - b), exact: true };
}
