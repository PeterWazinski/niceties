const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/confetti.js");
const { createConfetti } = globalThis.UM.confetti;

function fakeCanvas() {
  const calls = [];
  const ctx = {
    calls: calls,
    globalAlpha: 1,
    fillStyle: "",
    clearRect() { calls.push("clear"); },
    setTransform() {},
    save() {}, restore() {}, translate() {}, rotate() {},
    fillRect() { calls.push("rect"); }
  };
  return { width: 800, height: 600, clientWidth: 800, clientHeight: 600, hidden: true,
           dataset: {}, ctx: ctx, getContext() { return ctx; } };
}

// Manual animation frame driver with a fake clock.
function fakeEnv(extra) {
  const env = {
    t: 0, queue: [],
    now() { return env.t; },
    raf(fn) { env.queue.push(fn); return env.queue.length; },
    caf() { env.queue.length = 0; },
    step(ms) {
      env.t += ms;
      const fns = env.queue.splice(0);
      fns.forEach((fn) => fn());
    }
  };
  return Object.assign(env, extra);
}

test("fire spawns the configured number of particles and shows the canvas", () => {
  const canvas = fakeCanvas(), env = fakeEnv({ count: 50, duration: 2000 });
  const c = createConfetti(canvas, env);
  assert.equal(c.fire(), true);
  assert.equal(c.isActive(), true);
  assert.equal(c.particleCount(), 50);
  assert.equal(canvas.hidden, false);
  assert.equal(canvas.dataset.fired, "1");
});

test("frames draw every particle until the duration is over, then clean up", () => {
  const canvas = fakeCanvas(), env = fakeEnv({ count: 30, duration: 1000 });
  const c = createConfetti(canvas, env);
  c.fire();
  env.step(100);
  assert.equal(canvas.ctx.calls.filter((x) => x === "rect").length, 30);
  assert.equal(c.isActive(), true);
  env.step(500);
  assert.equal(c.isActive(), true);
  env.step(600); // past 1000 ms
  assert.equal(c.isActive(), false);
  assert.equal(c.particleCount(), 0);
  assert.equal(canvas.hidden, true);
  assert.equal(env.queue.length, 0, "no animation frame left scheduled");
});

test("a second fire while a burst is running is ignored", () => {
  const canvas = fakeCanvas(), env = fakeEnv({ count: 10 });
  const c = createConfetti(canvas, env);
  assert.equal(c.fire(), true);
  assert.equal(c.fire(), false);
  assert.equal(c.firedCount(), 1);
});

test("a new burst is possible after the previous one finished", () => {
  const canvas = fakeCanvas(), env = fakeEnv({ count: 10, duration: 500 });
  const c = createConfetti(canvas, env);
  c.fire();
  env.step(100);
  env.step(600);
  assert.equal(c.isActive(), false);
  assert.equal(c.fire(), true);
  assert.equal(c.firedCount(), 2);
});

test("reduced motion: nothing is drawn or shown", () => {
  const canvas = fakeCanvas(), env = fakeEnv({ reducedMotion: () => true });
  const c = createConfetti(canvas, env);
  assert.equal(c.fire(), false);
  assert.equal(c.isActive(), false);
  assert.equal(canvas.hidden, true);
  assert.equal(env.queue.length, 0);
});

test("stop cancels a running burst immediately", () => {
  const canvas = fakeCanvas(), env = fakeEnv({ count: 10 });
  const c = createConfetti(canvas, env);
  c.fire();
  c.stop();
  assert.equal(c.isActive(), false);
  assert.equal(canvas.hidden, true);
  assert.equal(env.queue.length, 0);
});

test("particles start above the canvas and move downwards", () => {
  const canvas = fakeCanvas(), env = fakeEnv({ count: 20, duration: 5000, random: () => 0.5 });
  const c = createConfetti(canvas, env);
  c.fire();
  const ys = [];
  canvas.ctx.translate = (x, y) => ys.push(y);
  env.step(16);
  env.step(16);
  // Second frame draws lower than the first.
  const half = ys.length / 2;
  assert.ok(ys[half] > ys[0]);
});
