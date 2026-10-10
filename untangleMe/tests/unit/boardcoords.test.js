const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/boardcoords.js");
const { unitToBoard, boardToUnit, clientToUnit } = globalThis.UM.boardcoords;

const board = { width: 800, height: 560, padding: 40 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " != " + b);

test("unit corners map into the padded board area", () => {
  assert.deepEqual(unitToBoard([0, 0], board), [40, 40]);
  assert.deepEqual(unitToBoard([1, 1], board), [760, 520]);
  assert.deepEqual(unitToBoard([0.5, 0.5], board), [400, 280]);
});

test("boardToUnit is the inverse of unitToBoard", () => {
  for (const p of [[0, 0], [1, 1], [0.25, 0.8], [0.5, 0.5]]) {
    const r = boardToUnit(unitToBoard(p, board), board);
    close(r[0], p[0]);
    close(r[1], p[1]);
  }
});

test("positions outside the padded area map outside [0,1] (clamping is the game's job)", () => {
  const r = boardToUnit([0, 0], board);
  assert.ok(r[0] < 0 && r[1] < 0);
});

test("clientToUnit applies the inverse screen matrix (scaled and offset board)", () => {
  // SVG drawn at 2x scale and shifted by (100, 50) on screen: screen = 2*board + offset.
  const inverse = { a: 0.5, b: 0, c: 0, d: 0.5, e: -50, f: -25 };
  // Board centre (400,280) is at screen (900, 610).
  const u = clientToUnit(inverse, 900, 610, board);
  close(u[0], 0.5);
  close(u[1], 0.5);
  // Board point (40,40) -> screen (180,130) -> unit (0,0)
  const o = clientToUnit(inverse, 180, 130, board);
  close(o[0], 0);
  close(o[1], 0);
});

test("default board comes from config", () => {
  const p = unitToBoard([0, 0]);
  assert.deepEqual(p, [globalThis.UM.config.BOARD.padding, globalThis.UM.config.BOARD.padding]);
});
