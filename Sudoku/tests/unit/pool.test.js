import test from "node:test";
import assert from "node:assert/strict";
import { createPool, POOL_KEY } from "../../js/pool.js";
import { createRng } from "../../js/rng.js";
import { generate } from "../../js/generator.js";
import { createGeneratorClient } from "../../js/generator-client.js";

function memoryStorage(initial) {
  const m = new Map(initial ? [[POOL_KEY, initial]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
}
function counting() {
  let n = 0;
  const fn = async (level) => generate(level, createRng(++n));
  fn.calls = () => n;
  return fn;
}

test("refill fills every empty slot, take empties it", async () => {
  const storage = memoryStorage(), gen = counting();
  const pool = createPool({ storage, generate: gen });
  assert.equal(pool.has("expert"), false);
  await pool.refill();
  assert.equal(gen.calls(), 3);
  for (const l of ["beginner", "expert", "master"]) assert.equal(pool.has(l), true);
  const p = await pool.take("expert");
  assert.equal(p.level, "expert");
  assert.equal(pool.has("expert"), false);
  assert.equal(pool.has("master"), true);
  await pool.refill();
  assert.equal(gen.calls(), 4); // only the missing slot was regenerated
  assert.equal(pool.has("expert"), true);
});

test("take with an empty pool generates a puzzle on the spot", async () => {
  const gen = counting();
  const pool = createPool({ storage: memoryStorage(), generate: gen });
  const p = await pool.take("beginner");
  assert.equal(p.level, "beginner");
  assert.equal(gen.calls(), 1);
});

test("the pool survives a new pool object on the same storage", async () => {
  const storage = memoryStorage();
  await createPool({ storage, generate: counting() }).refill(["master"]);
  assert.equal(createPool({ storage, generate: counting() }).has("master"), true);
});

test("corrupt or tampered storage is ignored", async () => {
  const bad = ["not json", "{}", "null", JSON.stringify({ beginner: { level: "beginner", givens: [1], solution: [1] } })];
  for (const raw of bad) {
    const gen = counting();
    const pool = createPool({ storage: memoryStorage(raw), generate: gen });
    assert.equal(pool.has("beginner"), false, raw);
    const p = await pool.take("beginner");
    assert.equal(p.level, "beginner");
    assert.equal(gen.calls(), 1);
  }
});

test("a puzzle whose givens contradict its solution is rejected", async () => {
  const good = await generate("beginner", createRng(1));
  const bad = { ...good, givens: good.givens.map((d) => (d ? (d % 9) + 1 : 0)) };
  const pool = createPool({ storage: memoryStorage(JSON.stringify({ beginner: bad })), generate: counting() });
  assert.equal(pool.has("beginner"), false);
});

test("storage that throws does not break the pool", async () => {
  const storage = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  const pool = createPool({ storage, generate: counting() });
  assert.equal(pool.has("beginner"), false);
  await pool.refill(["beginner"]);
  const p = await pool.take("beginner");
  assert.equal(p.level, "beginner");
});

test("generator client falls back to the main thread without a Worker", async () => {
  const client = createGeneratorClient({ WorkerCtor: undefined });
  assert.equal(client.usesWorker, false);
  const p = await client.generate("beginner", { seed: 5 });
  assert.deepEqual(p, generate("beginner", createRng(5)));
});

test("generator client falls back when creating the worker throws", async () => {
  const client = createGeneratorClient({ WorkerCtor: class { constructor() { throw new Error("no module workers"); } } });
  assert.equal(client.usesWorker, false);
  assert.equal((await client.generate("expert", { seed: 7 })).level, "expert");
});

test("generator client falls back when the worker reports an error", async () => {
  class BadWorker {
    postMessage() { setTimeout(() => this.onerror && this.onerror(new Error("boom")), 0); }
    terminate() {}
  }
  const client = createGeneratorClient({ WorkerCtor: BadWorker });
  assert.equal(client.usesWorker, true);
  const p = await client.generate("beginner", { seed: 9 });
  assert.equal(client.usesWorker, false);
  assert.deepEqual(p, generate("beginner", createRng(9)));
});

test("generator client uses a worker answer and rejects on a worker error message", async () => {
  class FakeWorker {
    postMessage(m) {
      const data = m.level === "master" ? { id: m.id, error: "nope" } : { id: m.id, puzzle: { level: m.level } };
      setTimeout(() => this.onmessage({ data }), 0);
    }
    terminate() {}
  }
  const client = createGeneratorClient({ WorkerCtor: FakeWorker });
  assert.deepEqual(await client.generate("expert", { seed: 1 }), { level: "expert" });
  await assert.rejects(client.generate("master", { seed: 1 }), /nope/);
});
