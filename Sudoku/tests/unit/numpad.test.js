import test from "node:test";
import assert from "node:assert/strict";
import { createPressTracker } from "../../js/numpad.js";
import { LONG_PRESS_MS } from "../../js/config.js";
import { safeGet, safeSet, safeRemove } from "../../js/storage.js";

// Fake clock: timers fire only when the test advances time.
function setup(threshold) {
  let now = 0, nextId = 1;
  const timers = new Map();
  const log = [];
  const tracker = createPressTracker({
    threshold,
    onTap: (d) => log.push(["tap", d]),
    onHold: (d) => log.push(["hold", d]),
    onChange: (type, d) => log.push(["change", type, d]),
    setTimer: (fn, ms) => { const id = nextId++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimer: (id) => timers.delete(id)
  });
  const advance = (ms) => {
    now += ms;
    for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); }
  };
  const events = () => log.filter((e) => e[0] !== "change");
  return { tracker, advance, log, events, timers };
}

test("the default threshold is the configured long-press time", () => {
  assert.equal(LONG_PRESS_MS, 350);
});

test("a release before the threshold is a tap", () => {
  const t = setup(350);
  t.tracker.down(1, 4);
  t.advance(349);
  t.tracker.up(1);
  assert.deepEqual(t.events(), [["tap", 4]]);
  assert.equal(t.timers.size, 0);
});

test("holding to the threshold toggles the note at once, not on release", () => {
  const t = setup(350);
  t.tracker.down(1, 7);
  t.advance(349);
  assert.deepEqual(t.events(), []);
  t.advance(1); // exactly the threshold
  assert.deepEqual(t.events(), [["hold", 7]]);
  t.advance(2000);
  t.tracker.up(1);
  assert.deepEqual(t.events(), [["hold", 7]], "no tap after a hold, no second note");
});

test("a release at exactly the threshold is a hold, one millisecond earlier a tap", () => {
  const a = setup(350);
  a.tracker.down(1, 2); a.advance(350); a.tracker.up(1);
  assert.deepEqual(a.events(), [["hold", 2]]);
  const b = setup(350);
  b.tracker.down(1, 2); b.advance(349); b.tracker.up(1);
  assert.deepEqual(b.events(), [["tap", 2]]);
});

test("cancel before the threshold: neither tap nor note", () => {
  const t = setup(350);
  t.tracker.down(1, 3);
  t.advance(100);
  t.tracker.cancel(1);
  t.advance(1000);
  t.tracker.up(1);
  assert.deepEqual(t.events(), []);
  assert.equal(t.tracker.isActive(), false);
});

test("cancel after the hold keeps the note, and a later release does nothing", () => {
  const t = setup(350);
  t.tracker.down(1, 3);
  t.advance(400);
  t.tracker.cancel(1);
  t.tracker.up(1);
  assert.deepEqual(t.events(), [["hold", 3]]);
});

test("a second finger is ignored while a press runs", () => {
  const t = setup(350);
  assert.equal(t.tracker.down(1, 1), true);
  assert.equal(t.tracker.down(2, 9), false);
  t.tracker.up(2); // not the active pointer
  assert.equal(t.tracker.isActive(), true);
  t.advance(10);
  t.tracker.up(1);
  assert.deepEqual(t.events(), [["tap", 1]]);
});

test("presses can follow each other", () => {
  const t = setup(350);
  t.tracker.down(1, 1); t.advance(10); t.tracker.up(1);
  t.tracker.down(2, 2); t.advance(500); t.tracker.up(2);
  t.tracker.down(3, 3); t.advance(10); t.tracker.up(3);
  assert.deepEqual(t.events(), [["tap", 1], ["hold", 2], ["tap", 3]]);
});

test("change notifications: press, hold, release", () => {
  const t = setup(350);
  t.tracker.down(1, 5); t.advance(400); t.tracker.up(1);
  assert.deepEqual(t.log.filter((e) => e[0] === "change").map((e) => e[1]), ["press", "hold", "release"]);
});

test("safe storage never throws", () => {
  globalThis.localStorage = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
    removeItem() { throw new Error("denied"); }
  };
  assert.equal(safeGet("a"), null);
  assert.equal(safeSet("a", "1"), false);
  assert.doesNotThrow(() => safeRemove("a"));
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  assert.equal(safeSet("a", "1"), true);
  assert.equal(safeGet("a"), "1");
  safeRemove("a");
  assert.equal(safeGet("a"), null);
  delete globalThis.localStorage;
});
