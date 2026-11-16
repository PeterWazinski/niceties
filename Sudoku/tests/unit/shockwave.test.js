import test from "node:test";
import assert from "node:assert/strict";
import { createShockwave } from "../../js/shockwave.js";

function fakeCanvas() {
  const calls = [];
  const ctx = {
    calls, fillStyle: "", strokeStyle: "", lineWidth: 1,
    clearRect() { calls.push("clear"); },
    setTransform() {},
    save() {}, restore() {}, translate() {}, rotate() {},
    beginPath() {}, moveTo() {}, lineTo() {},
    ellipse() { calls.push("ring"); },
    stroke() { calls.push("stroke"); },
    fillRect() { calls.push("flash"); },
    createRadialGradient() { return { addColorStop() {} }; }
  };
  return { width: 400, height: 800, clientWidth: 400, clientHeight: 800, hidden: true, dataset: {}, ctx, getContext() { return ctx; } };
}

function fakeEnv(extra) {
  const env = {
    t: 0, queue: [],
    now() { return env.t; },
    raf(fn) { env.queue.push(fn); return env.queue.length; },
    caf() { env.queue.length = 0; },
    step(ms) { env.t += ms; env.queue.splice(0).forEach((fn) => fn()); }
  };
  return Object.assign(env, extra);
}

test("fire starts at the given point, spawns the sparks and shows the canvas", () => {
  const canvas = fakeCanvas(), s = createShockwave(canvas, fakeEnv({ count: 40 }));
  assert.equal(s.fire({ x: 120, y: 300 }), true);
  assert.deepEqual(s.origin(), { x: 120, y: 300 });
  assert.equal(s.sparkCount(), 40);
  assert.equal(s.isActive(), true);
  assert.equal(canvas.hidden, false);
  assert.equal(canvas.dataset.fired, "1");
  assert.equal(canvas.dataset.origin, "120,300");
});

test("without a point it starts in the middle of the screen", () => {
  const s = createShockwave(fakeCanvas(), fakeEnv());
  s.fire(null);
  assert.deepEqual(s.origin(), { x: 200, y: 400 });
});

test("frames draw the flash, the ring (three strokes) and the sparks, then clean up after the duration", () => {
  const canvas = fakeCanvas(), env = fakeEnv({ count: 30, duration: 1700 });
  const s = createShockwave(canvas, env);
  s.fire({ x: 100, y: 100 });
  env.step(100);
  const calls = canvas.ctx.calls;
  assert.ok(calls.includes("flash"), "soft flash at the start");
  assert.equal(calls.filter((c) => c === "ring").length, 3);
  assert.ok(calls.filter((c) => c === "stroke").length >= 3 + 30 - 1, "ring strokes plus the live sparks");
  calls.length = 0;
  env.step(600);
  assert.ok(!calls.includes("flash"), "the flash is over after 0.45 s");
  env.step(1100); // past 1700 ms
  assert.equal(s.isActive(), false);
  assert.equal(s.sparkCount(), 0);
  assert.equal(canvas.hidden, true);
  assert.equal(env.queue.length, 0, "no animation frame left scheduled");
});

test("a second fire while running is ignored; after the end it fires again", () => {
  const canvas = fakeCanvas(), env = fakeEnv({ duration: 500 });
  const s = createShockwave(canvas, env);
  assert.equal(s.fire(), true);
  assert.equal(s.fire(), false);
  env.step(600);
  assert.equal(s.fire(), true);
  assert.equal(s.firedCount(), 2);
  assert.equal(canvas.dataset.fired, "2");
});

test("reduced motion: no shockwave at all", () => {
  const canvas = fakeCanvas(), s = createShockwave(canvas, fakeEnv({ reducedMotion: () => true }));
  assert.equal(s.fire({ x: 1, y: 1 }), false);
  assert.equal(canvas.hidden, true);
  assert.equal(canvas.dataset.fired, undefined);
});

test("stop ends a running burst at once and is harmless when idle", () => {
  const canvas = fakeCanvas(), env = fakeEnv();
  const s = createShockwave(canvas, env);
  s.stop();
  s.fire();
  s.stop();
  assert.equal(s.isActive(), false);
  assert.equal(canvas.hidden, true);
  assert.equal(env.queue.length, 0);
});
