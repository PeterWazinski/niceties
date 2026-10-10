// Ammann-Beenker tiling by iterative subdivision of right triangles and rhombi.
// Adapted from https://geometricolor.wordpress.com/2013/08/24/iterative-method-for-the-ammann-beenker-tiling-using-vector/
// generate(level, width, height) returns a flat list of tiles:
//   { p: [x0, y0, x1, y1, x2, y2, x3, y3], kind: 0 (square) | 1 (rhombus) }
(function (root) {
  "use strict";

  const F = 1 / (1 + Math.SQRT2);
  const SQUARE = 0, RHOMBUS = 1;

  const lerp = (t, a, b) => ({ x: (1 - t) * a.x + t * b.x, y: (1 - t) * a.y + t * b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });

  function generate(level, width, height, margin) {
    margin = margin === undefined ? 50 : margin;
    const tiles = [];

    function quad(a, b, c, kind) {
      const d = add(sub(c, a), b);
      tiles.push({ p: [a.x, a.y, b.x, b.y, d.x, d.y, c.x, c.y], kind });
    }

    function triangle(a, b, c, lev) {
      if (lev === 0) return quad(a, b, c, SQUARE);
      const m = lerp(0.5, b, c);
      const z = lerp(F, m, a);
      const mc = lerp(F, m, c);
      const mb = lerp(F, m, b);
      const ac = lerp(F, a, c);
      const ba = lerp(F, b, a);
      triangle(z, mc, mb, lev - 1);
      triangle(mc, c, ac, lev - 1);
      triangle(z, a, ba, lev - 1);
      rhomb(z, mb, ba, lev - 1);
      rhomb(a, ac, z, lev - 1);
    }

    function rhomb(a, b, c, lev) {
      if (lev === 0) return quad(a, b, c, RHOMBUS);
      const d = add(sub(c, a), b);
      const z = lerp(0.5, a, d);
      const g = F / (2 + F);
      const za = lerp(g, z, a);
      const zd = lerp(g, z, d);
      const ac = lerp(F, a, c);
      const ab = lerp(F, a, b);
      const dc = lerp(F, d, c);
      const db = lerp(F, d, b);
      triangle(za, c, ac, lev - 1);
      triangle(za, b, ab, lev - 1);
      triangle(zd, c, dc, lev - 1);
      triangle(zd, b, db, lev - 1);
      rhomb(c, za, zd, lev - 1);
      rhomb(a, ab, ac, lev - 1);
      rhomb(d, dc, db, lev - 1);
    }

    const v1 = { x: margin, y: margin };
    const v2 = { x: width - margin, y: margin };
    const v3 = { x: margin, y: height - margin };
    const v4 = { x: width - margin, y: height - margin };
    triangle(v1, v2, v3, level);
    triangle(v4, v2, v3, level);
    return tiles;
  }

  const api = { generate, SQUARE, RHOMBUS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AmmannBeenker = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
