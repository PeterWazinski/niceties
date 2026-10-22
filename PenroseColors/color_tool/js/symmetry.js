// Symmetries of a patch (PRD 4.2): the rotations and reflections about the origin (the centre of
// the wheel, which every seed uses) that map the tile set onto itself, as permutations of tile ids.

/** @typedef {import("./types.js").Tile} Tile */
/** @typedef {{ kind: "rotation" | "reflection", angle: number, perm: number[] }} Symmetry */

const STEP = 18; // degrees: the symmetry axes of the P3 wheel lie at multiples of 18 degrees

/**
 * All symmetries of the patch, the identity first. A candidate transform counts if it maps every tile
 * (type and centre) onto a tile of the same type, and the mapping is one-to-one.
 * @param {Tile[]} tiles
 * @returns {Symmetry[]}
 */
export function findSymmetries(tiles) {
  const n = tiles.length;
  const key = (type, x, y) => type + "|" + Math.round(x * 1e5) + "|" + Math.round(y * 1e5);
  const at = new Map(tiles.map((t) => [key(t.type, t.cx, t.cy), t.id]));
  /** @type {Symmetry[]} */
  const found = [];
  /** @type {{ kind: "rotation" | "reflection", angle: number, map: (x: number, y: number) => [number, number] }[]} */
  const candidates = [];
  for (let k = 0; k < 360 / STEP; k++) {
    const a = k * STEP * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    candidates.push({ kind: "rotation", angle: k * STEP, map: (x, y) => [x * c - y * s, x * s + y * c] });
  }
  for (let k = 0; k < 180 / STEP; k++) {
    const a = 2 * k * STEP * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    candidates.push({ kind: "reflection", angle: k * STEP, map: (x, y) => [x * c + y * s, x * s - y * c] });
  }
  for (const cand of candidates) {
    const perm = new Array(n);
    let ok = true;
    const used = new Set();
    for (const t of tiles) {
      const [x, y] = cand.map(t.cx, t.cy);
      const id = at.get(key(t.type, x, y));
      if (id === undefined || used.has(id)) { ok = false; break; }
      used.add(id);
      perm[t.id] = id;
    }
    if (ok) found.push({ kind: cand.kind, angle: cand.angle, perm });
  }
  return found;
}

/** Human-readable name: "identity", "rotation by 72°", "reflection across the axis at 36°". @param {Symmetry} s */
export function describe(s) {
  if (s.kind === "rotation") return s.angle === 0 ? "identity" : `rotation by ${s.angle}°`;
  return `reflection across the axis at ${s.angle}°`;
}
