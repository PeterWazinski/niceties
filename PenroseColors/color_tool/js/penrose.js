// Penrose P3 tilings by subdivision (deflation) of Robinson triangles.
//
// A Robinson triangle is a half of a rhomb, cut along its symmetry axis. Every triangle is
// (kind, apex A, base end B, base end C):
//   kind 0 "red":  36-72-72 triangle (legs 1, base 1/phi), two of them make a THIN rhomb
//   kind 1 "blue": 108-36-36 triangle (legs 1, base phi),  two of them make a THICK rhomb
// The two halves of a rhomb are mirror images that share the base. Subdivision cuts each triangle
// into smaller ones of the same two kinds (the well-known scheme from Preshing's Penrose article).
// Halves whose partner lies outside the patch cannot form a rhomb; they are returned separately
// and are not tiles.
import { PHI } from "./config.js";

/** @typedef {import("./types.js").Pt} Pt */
/** @typedef {import("./types.js").Tile} Tile */
/** @typedef {import("./types.js").Patch} Patch */
/** @typedef {{ kind: 0 | 1, a: Pt, b: Pt, c: Pt, path: number[] }} Tri */

const pol = (r, angle) => ({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
/** Point at fraction f of the way from p to q. */
const lerp = (p, q, f) => ({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f });

// Which of the ten triangles of the wheel a seed uses.
const SEED_TRIANGLES = {
  wheel: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  half: [0, 1, 2, 3, 4],
  fan: [0, 1, 2]
};
export const SEED_NAMES = Object.keys(SEED_TRIANGLES);

/** The ten red triangles around the origin; every second one is mirrored (B and C swapped). */
function wheel() {
  /** @type {Tri[]} */
  const tris = [];
  for (let i = 0; i < 10; i++) {
    let b = pol(1, (2 * i - 1) * Math.PI / 10), c = pol(1, (2 * i + 1) * Math.PI / 10);
    if (i % 2 === 0) [b, c] = [c, b];
    tris.push({ kind: 0, a: { x: 0, y: 0 }, b, c, path: [] });
  }
  return tris;
}

/** @param {Tri[]} tris @returns {Tri[]} */
function subdivide(tris) {
  /** @type {Tri[]} */
  const out = [];
  tris.forEach((t, p) => {
    const path = [...t.path, p];
    const { a, b, c } = t;
    if (t.kind === 0) {
      const P = lerp(a, b, 1 / PHI);
      out.push({ kind: 0, a: c, b: P, c: b, path }, { kind: 1, a: P, b: c, c: a, path });
    } else {
      const Q = lerp(b, a, 1 / PHI);
      const R = lerp(b, c, 1 / PHI);
      out.push({ kind: 1, a: R, b: c, c: a, path }, { kind: 1, a: Q, b: R, c: b, path }, { kind: 0, a: R, b: Q, c: a, path });
    }
  });
  return out;
}

/** Area of a polygon (shoelace). @param {Pt[]} pts */
export function area(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

// Corners that are computed twice differ by about 1e-16; rounding to 1e-6 makes them equal.
const vkey = (p) => Math.round(p.x * 1e6) + "," + Math.round(p.y * 1e6);
const ekey = (p, q) => { const a = vkey(p), b = vkey(q); return a < b ? a + "|" + b : b + "|" + a; };

/**
 * Generates a patch.
 * @param {string} seed one of SEED_NAMES
 * @param {number} depth number of subdivisions (>= 0)
 * @returns {Patch}
 */
export function generate(seed, depth) {
  const use = SEED_TRIANGLES[seed] || SEED_TRIANGLES.wheel;
  const all = wheel();
  /** @type {Tri[]} */
  let tris = use.map((i) => all[i]);
  const seedArea = tris.reduce((s, t) => s + area([t.a, t.b, t.c]), 0);
  for (let d = 0; d < depth; d++) tris = subdivide(tris);

  // Pair the triangles that share their base (same kind, same two base corners).
  /** @type {Map<string, Tri[]>} */
  const byBase = new Map();
  for (const t of tris) {
    const key = t.kind + ":" + ekey(t.b, t.c);
    const list = byBase.get(key);
    if (list) list.push(t); else byBase.set(key, [t]);
  }
  /** @type {Tile[]} */
  const tiles = [];
  /** @type {Pt[][]} */
  const halves = [];
  for (const list of byBase.values()) {
    if (list.length === 2) {
      const [t1, t2] = list;
      const pts = [t1.a, t1.b, t2.a, t1.c];
      tiles.push({
        id: -1, type: t1.kind === 0 ? "thin" : "thick", pts,
        cx: (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4, cy: (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4,
        neighbours: [], ancestors: t1.path, boundary: false
      });
    } else if (list.length === 1) {
      halves.push([list[0].a, list[0].b, list[0].c]);
    } else {
      throw new Error("more than two triangles share a base");
    }
  }
  // Stable ids: top to bottom, then left to right (rounded so float noise cannot reorder).
  tiles.sort((p, q) => Math.round(p.cy * 1e6) - Math.round(q.cy * 1e6) || Math.round(p.cx * 1e6) - Math.round(q.cx * 1e6));
  tiles.forEach((t, i) => { t.id = i; });

  // Neighbours: tiles that share an edge.
  /** @type {Map<string, number[]>} */
  const edges = new Map();
  for (const t of tiles) {
    for (let k = 0; k < 4; k++) {
      const key = ekey(t.pts[k], t.pts[(k + 1) % 4]);
      const list = edges.get(key);
      if (list) list.push(t.id); else edges.set(key, [t.id]);
    }
  }
  for (const ids of edges.values()) {
    if (ids.length === 2) {
      tiles[ids[0]].neighbours.push(ids[1]);
      tiles[ids[1]].neighbours.push(ids[0]);
    } else if (ids.length === 1) {
      tiles[ids[0]].boundary = true;
    } else {
      throw new Error("an edge is shared by more than two tiles");
    }
  }
  for (const t of tiles) t.neighbours.sort((p, q) => p - q);
  return { tiles, halves, seedArea, seed, depth };
}

/**
 * Scales and centres the patch into a width x height box.
 * @param {Tile[]} tiles
 * @returns {{ scale: number, dx: number, dy: number }} screen = scale * point + (dx, dy)
 */
export function fit(tiles, width, height, margin = 12) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tiles) for (const p of t.pts) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  if (!isFinite(x0)) return { scale: 1, dx: width / 2, dy: height / 2 };
  const scale = Math.max(1e-9, Math.min((width - 2 * margin) / (x1 - x0), (height - 2 * margin) / (y1 - y0)));
  return { scale, dx: width / 2 - scale * (x0 + x1) / 2, dy: height / 2 - scale * (y0 + y1) / 2 };
}
