// Seeded pseudo random numbers (mulberry32). Same seed => same sequence.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") require("./config.js");

  // Returns a function producing floats in [0, 1).
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Picks a seed for a brand-new puzzle (the only non-deterministic spot).
  function randomSeed() {
    return 1 + Math.floor(Math.random() * UM.config.MAX_RANDOM_SEED);
  }

  UM.rng = { mulberry32: mulberry32, randomSeed: randomSeed };
})();
