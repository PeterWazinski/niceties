const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/geometry.js");
const { crossingPoint, edgesCross, countCrossings } = globalThis.UM.geometry;

// Four free nodes 0..3: edges [0,1] and [2,3].
const E01 = [0, 1], E23 = [2, 3];

test("X crossing is detected and the point is correct", () => {
  const pos = [[0, 0], [1, 1], [0, 1], [1, 0]];
  const p = crossingPoint(pos, E01, E23);
  assert.ok(p);
  assert.ok(Math.abs(p[0] - 0.5) < 1e-9 && Math.abs(p[1] - 0.5) < 1e-9);
});

test("separate segments do not cross", () => {
  const pos = [[0, 0], [1, 0], [0, 1], [1, 1]];
  assert.equal(edgesCross(pos, E01, E23), false);
});

test("segments that would cross only when extended do not cross", () => {
  const pos = [[0, 0], [0.4, 0.4], [0, 1], [1, 0]];
  assert.equal(edgesCross(pos, E01, E23), false);
});

test("T-touch (node on another edge) counts as a crossing", () => {
  const pos = [[0, 0], [1, 0], [0.5, 0], [0.5, 1]];
  assert.equal(edgesCross(pos, E01, E23), true);
});

test("collinear overlapping segments cross", () => {
  const pos = [[0, 0], [0.6, 0], [0.4, 0], [1, 0]];
  assert.equal(edgesCross(pos, E01, E23), true);
});

test("collinear disjoint segments do not cross", () => {
  const pos = [[0, 0], [0.3, 0], [0.5, 0], [1, 0]];
  assert.equal(edgesCross(pos, E01, E23), false);
});

test("edges sharing a node do not cross when they diverge", () => {
  const pos = [[0, 0], [1, 0], [0, 1]];
  assert.equal(edgesCross(pos, [0, 1], [0, 2]), false);
});

test("edges sharing a node cross when they overlap collinearly", () => {
  const pos = [[0, 0], [1, 0], [0.5, 0]];
  assert.equal(edgesCross(pos, [0, 1], [0, 2]), true);
});

test("edges sharing a node and pointing in opposite directions do not cross", () => {
  const pos = [[0.5, 0], [1, 0], [0, 0]];
  assert.equal(edgesCross(pos, [0, 1], [0, 2]), false);
});

test("identical edges (also reversed) are not crossings", () => {
  const pos = [[0, 0], [1, 1]];
  assert.equal(edgesCross(pos, [0, 1], [0, 1]), false);
  assert.equal(edgesCross(pos, [0, 1], [1, 0]), false);
});

test("zero-length edges (coincident nodes) never produce NaN", () => {
  const pos = [[0.5, 0.5], [0.5, 0.5], [0, 0], [1, 1]];
  const r = crossingPoint(pos, [0, 1], [2, 3]);
  assert.ok(r === null || (Number.isFinite(r[0]) && Number.isFinite(r[1])));
  const pos2 = [[0.2, 0.2], [0.2, 0.2], [0.9, 0.1], [0.1, 0.9]];
  assert.equal(edgesCross(pos2, [0, 1], [2, 3]), false);
});

test("countCrossings reports count, flags and points", () => {
  // K4 drawn with a crossing diagonal pair: square 0,1,2,3 with both diagonals.
  const pos = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]];
  const r = countCrossings(pos, edges);
  assert.equal(r.count, 1);
  assert.equal(r.points.length, 1);
  assert.deepEqual(r.edgeFlags, [false, false, false, false, true, true]);
  assert.deepEqual(r.nodeFlags, [true, true, true, true]);
});

test("countCrossings on a planar drawing is zero", () => {
  const pos = [[0, 0], [1, 0], [0.5, 1]];
  const r = countCrossings(pos, [[0, 1], [1, 2], [2, 0]]);
  assert.equal(r.count, 0);
  assert.deepEqual(r.edgeFlags, [false, false, false]);
});
