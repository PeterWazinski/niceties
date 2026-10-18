// Runs the generator off the main thread. Message in: { id, level, seed, options }.
// Message out: { id, puzzle } or { id, error }.
import { generate } from "./generator.js";
import { createRng } from "./rng.js";

self.onmessage = (event) => {
  const { id, level, seed, options } = event.data;
  try {
    self.postMessage({ id, puzzle: generate(level, createRng(seed), options) });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
