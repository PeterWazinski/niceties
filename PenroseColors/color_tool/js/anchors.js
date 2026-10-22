// Default anchors: tiles that start fixed (PRD 7). Anchors help the player a lot: the more there are, the
// easier the puzzle. The player can remove them or add others, like any anchor.
//  - the extreme tile in each of the four directions right, down, left and up: the most distant tiles
//    horizontally and vertically, equally distributed around the perimeter of a round patch
//  - wheel and half wheel: one more anchor, the tile nearest the middle of the patch
//    (the fan has no middle anchor: it gets only the four extremes)

/** @typedef {import("./types.js").Tile} Tile */

/**
 * @param {Tile[]} tiles
 * @param {string} seed
 * @returns {number[]} tile ids, ascending
 */
export function defaultAnchors(tiles, seed) {
  if (!tiles.length) return [];
  /** @type {Set<number>} */
  const taken = new Set();
  /** The tile with the highest score that is not taken yet (the lowest id wins a tie). */
  const pick = (score) => {
    let best = -1, bestScore = -Infinity;
    for (const t of tiles) {
      if (taken.has(t.id)) continue;
      const s = score(t);
      if (s > bestScore + 1e-9) { bestScore = s; best = t.id; }
    }
    if (best >= 0) taken.add(best);
  };
  const mx = tiles.reduce((s, t) => s + t.cx, 0) / tiles.length;
  const my = tiles.reduce((s, t) => s + t.cy, 0) / tiles.length;
  if (seed !== "fan") pick((t) => -Math.hypot(t.cx - mx, t.cy - my));
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    // furthest in the direction; a tile on the axis wins over one beside it
    pick((t) => (t.cx - mx) * dx + (t.cy - my) * dy - 0.01 * Math.abs((t.cx - mx) * dy - (t.cy - my) * dx));
  }
  return [...taken].sort((a, b) => a - b);
}
