// Main-thread side of the generator: asks a module Web Worker for puzzles and
// falls back to generating on the main thread when no worker can be used.
import { generate } from "./generator.js";
import { createRng } from "./rng.js";

const randomSeed = () => Math.floor(Math.random() * 4294967296);

export function createGeneratorClient(opts = {}) {
  const WorkerCtor = "WorkerCtor" in opts ? opts.WorkerCtor : globalThis.Worker;
  const workerUrl = opts.workerUrl || new URL("./generator.worker.js", import.meta.url);
  const pending = new Map(); // id -> { resolve, reject, request }
  let worker = null, nextId = 1;
  const client = { usesWorker: false };

  function runOnMainThread(request) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try { resolve(generate(request.level, createRng(request.seed), request.options)); }
        catch (err) { reject(err); }
      }, 0);
    });
  }

  function giveUpOnWorker() {
    client.usesWorker = false;
    if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } }
    worker = null;
    const stuck = [...pending.values()];
    pending.clear();
    for (const p of stuck) runOnMainThread(p.request).then(p.resolve, p.reject);
  }

  if (WorkerCtor) {
    try {
      worker = new WorkerCtor(workerUrl, { type: "module" });
      client.usesWorker = true;
      worker.onmessage = (e) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.puzzle);
      };
      worker.onerror = () => giveUpOnWorker();
    } catch (err) {
      worker = null;
      client.usesWorker = false;
    }
  }

  // Resolves with a puzzle { givens, solution, level, symmetry, clues, ... }.
  client.generate = (level, { seed = randomSeed(), options } = {}) => {
    const request = { level, seed, options };
    if (!worker) return runOnMainThread(request);
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, request });
      worker.postMessage({ id, ...request });
    });
  };
  client.terminate = () => { if (worker) worker.terminate(); worker = null; client.usesWorker = false; };
  return client;
}
