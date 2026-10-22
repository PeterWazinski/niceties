import test from "node:test";
import assert from "node:assert/strict";
import { generate, area, fit, SEED_NAMES } from "../../js/penrose.js";
import { PHI, MAX_DEPTH } from "../../js/config.js";

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
// angle at corner k of a polygon, in degrees
const angleAt = (pts, k) => {
  const p = pts[k], a = pts[(k + 3) % 4], b = pts[(k + 1) % 4];
  const v = { x: a.x - p.x, y: a.y - p.y }, w = { x: b.x - p.x, y: b.y - p.y };
  return Math.acos((v.x * w.x + v.y * w.y) / (Math.hypot(v.x, v.y) * Math.hypot(w.x, w.y))) * 180 / Math.PI;
};

test("the seeds are wheel, half and fan", () => {
  assert.deepEqual(SEED_NAMES, ["wheel", "half", "fan"]);
});

test("tile counts per seed and depth (checked against the geometry below)", () => {
  const expected = {
    wheel: [0, 10, 20, 60, 160, 430],
    half: [0, 4, 9, 28, 77, 210],
    fan: [0, 2, 5, 16, 45, 124]
  };
  for (const seed of SEED_NAMES) {
    for (let d = 0; d <= MAX_DEPTH; d++) {
      assert.equal(generate(seed, d).tiles.length, expected[seed][d], `${seed} depth ${d}`);
    }
  }
});

test("depth 0 has no whole rhombs: only the halves of the seed", () => {
  assert.equal(generate("wheel", 0).tiles.length, 0);
  assert.equal(generate("wheel", 0).halves.length, 10);
  assert.equal(generate("half", 0).halves.length, 5);
});

test("every tile is a rhomb with the right edge length and angles", () => {
  for (const seed of SEED_NAMES) {
    for (let d = 1; d <= 4; d++) {
      const side = Math.pow(PHI, -d);
      for (const t of generate(seed, d).tiles) {
        for (let k = 0; k < 4; k++) {
          assert.ok(Math.abs(dist(t.pts[k], t.pts[(k + 1) % 4]) - side) < 1e-9, `${seed} d${d} tile ${t.id} side`);
        }
        const [a, b] = t.type === "thick" ? [72, 108] : [36, 144];
        const angles = [0, 1, 2, 3].map((k) => angleAt(t.pts, k));
        assert.ok(Math.abs(angles[0] - angles[2]) < 1e-6 && Math.abs(angles[1] - angles[3]) < 1e-6);
        assert.ok(Math.abs(Math.min(angles[0], angles[1]) - a) < 1e-6, `${seed} d${d} tile ${t.id} ${t.type} acute angle`);
        assert.ok(Math.abs(Math.max(angles[0], angles[1]) - b) < 1e-6, `${seed} d${d} tile ${t.id} ${t.type} obtuse angle`);
      }
    }
  }
});

test("the tiles and the halves together cover exactly the area of the seed", () => {
  for (const seed of SEED_NAMES) {
    for (let d = 0; d <= MAX_DEPTH; d++) {
      const p = generate(seed, d);
      const total = p.tiles.reduce((s, t) => s + area(t.pts), 0) + p.halves.reduce((s, h) => s + area(h), 0);
      assert.ok(Math.abs(total - p.seedArea) < 1e-9, `${seed} depth ${d}`);
    }
  }
});

test("no overlaps: no tile centre lies inside another tile, every edge is shared by at most two tiles", () => {
  const inside = (pt, poly) => {
    // the rhomb is convex: the point is inside when it is on the same side of all four edges
    let sign = 0;
    for (let k = 0; k < 4; k++) {
      const p = poly[k], q = poly[(k + 1) % 4];
      const cross = (q.x - p.x) * (pt.y - p.y) - (q.y - p.y) * (pt.x - p.x);
      if (Math.abs(cross) < 1e-12) return false;
      if (sign === 0) sign = Math.sign(cross); else if (Math.sign(cross) !== sign) return false;
    }
    return true;
  };
  for (const seed of SEED_NAMES) {
    for (let d = 1; d <= 3; d++) {
      const tiles = generate(seed, d).tiles; // generate() throws if an edge is shared by more than two tiles
      for (const a of tiles) for (const b of tiles) {
        if (a !== b) assert.equal(inside({ x: a.cx, y: a.cy }, b.pts), false, `${seed} d${d}: ${a.id} in ${b.id}`);
      }
    }
  }
});

test("thick : thin tends to the golden ratio", () => {
  const tiles = generate("wheel", 5).tiles;
  const thick = tiles.filter((t) => t.type === "thick").length;
  assert.ok(Math.abs(thick / (tiles.length - thick) - PHI) < 0.1);
});

test("ids are 0..n-1 and stable: the same seed and depth give the same tiles", () => {
  const a = generate("half", 4), b = generate("half", 4);
  assert.deepEqual(a, b);
  a.tiles.forEach((t, i) => assert.equal(t.id, i));
  for (let i = 1; i < a.tiles.length; i++) assert.ok(a.tiles[i].cy >= a.tiles[i - 1].cy - 1e-6, "sorted top to bottom");
});

test("neighbours are symmetric, at most four per tile, and the boundary flag matches", () => {
  const { tiles } = generate("wheel", 3);
  for (const t of tiles) {
    assert.ok(t.neighbours.length <= 4);
    assert.ok(t.neighbours.length >= 1);
    for (const n of t.neighbours) assert.ok(tiles[n].neighbours.includes(t.id));
    assert.equal(t.boundary, t.neighbours.length < 4 || t.boundary, "boundary tiles may have fewer neighbours");
  }
  assert.ok(tiles.some((t) => t.boundary));
  // a tile with all four neighbours has no free edge
  for (const t of tiles) if (t.neighbours.length === 4) assert.equal(t.boundary, false);
});

test("every tile has one ancestor per coarser level", () => {
  for (const d of [1, 2, 3, 4]) {
    for (const t of generate("wheel", d).tiles) assert.equal(t.ancestors.length, d);
  }
  // the first ancestor is one of the ten seed triangles
  assert.ok(generate("wheel", 3).tiles.every((t) => t.ancestors[0] >= 0 && t.ancestors[0] < 10));
});

test("the wheel centre after one subdivision is the five-fold vertex of five thick rhombs", () => {
  const { tiles } = generate("wheel", 1);
  assert.equal(tiles.length, 10);
  const atCentre = tiles.filter((t) => t.pts.some((p) => Math.hypot(p.x, p.y) < 1e-9));
  assert.equal(atCentre.length, 5);
  assert.ok(atCentre.every((t) => t.type === "thick"));
});

test("fit scales and centres the patch inside the box", () => {
  const { tiles } = generate("wheel", 3);
  for (const [w, h] of [[800, 600], [390, 390], [300, 900]]) {
    const f = fit(tiles, w, h, 10);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const t of tiles) for (const p of t.pts) {
      const x = p.x * f.scale + f.dx, y = p.y * f.scale + f.dy;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    assert.ok(x0 >= 10 - 1e-6 && x1 <= w - 10 + 1e-6 && y0 >= 10 - 1e-6 && y1 <= h - 10 + 1e-6, `${w}x${h}`);
    assert.ok(Math.abs((x0 + x1) / 2 - w / 2) < 1e-6 && Math.abs((y0 + y1) / 2 - h / 2) < 1e-6, "centred");
    assert.ok(Math.abs(x1 - x0 - (w - 20)) < 1e-6 || Math.abs(y1 - y0 - (h - 20)) < 1e-6, "touches the margin on one axis");
  }
  assert.deepEqual(fit([], 100, 100), { scale: 1, dx: 50, dy: 50 });
});

test("half and fan are turned so that their long axis runs from left to right, the wheel centre on the left", () => {
  for (const seed of ["half", "fan"]) {
    for (let d = 2; d <= 5; d++) {
      const { tiles } = generate(seed, d);
      const n = tiles.length;
      const mx = tiles.reduce((s, t) => s + t.cx, 0) / n, my = tiles.reduce((s, t) => s + t.cy, 0) / n;
      let sxx = 0, syy = 0, sxy = 0;
      for (const t of tiles) { sxx += (t.cx - mx) ** 2; syy += (t.cy - my) ** 2; sxy += (t.cx - mx) * (t.cy - my); }
      assert.ok(sxx > syy, `${seed} d${d}: wider than tall`);
      assert.ok(Math.abs(sxy) < 1e-9 * (sxx + syy), `${seed} d${d}: the principal axis is horizontal`);
      assert.ok(mx > 0, `${seed} d${d}: the wheel centre (the origin) lies to the left of the middle`);
    }
  }
});

test("turning keeps the tiles intact: same counts, rhombs, area", () => {
  for (const seed of ["half", "fan"]) {
    const p = generate(seed, 4);
    const total = p.tiles.reduce((s, t) => s + area(t.pts), 0) + p.halves.reduce((s, h) => s + area(h), 0);
    assert.ok(Math.abs(total - p.seedArea) < 1e-9);
    for (const t of p.tiles) assert.ok(Math.abs(t.cx - t.pts.reduce((s, q) => s + q.x, 0) / 4) < 1e-12);
  }
});

test("the wheel is not turned: its centre is the origin and the tiles are symmetric about it", () => {
  const { tiles } = generate("wheel", 3);
  const mx = tiles.reduce((s, t) => s + t.cx, 0) / tiles.length, my = tiles.reduce((s, t) => s + t.cy, 0) / tiles.length;
  assert.ok(Math.hypot(mx, my) < 1e-9);
});
