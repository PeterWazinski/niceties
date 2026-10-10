// Puzzle identity in the URL hash: #n=8&seed=4821
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") { require("./config.js"); require("./rng.js"); }

  const MAX_SEED = 4294967295; // mulberry32 works on 32 bit seeds

  function toInt(text) {
    return /^\d{1,10}$/.test(text) ? parseInt(text, 10) : null;
  }

  // Parses a hash such as "#n=8&seed=4821".
  // Anything missing or invalid falls back: n -> opts.defaultN (default
  // DEFAULT_NODES), seed -> opts.randomSeed() (default a fresh random seed).
  // n is clamped to [MIN_NODES, MAX_NODES].
  // Returns {n, seed, seedFromUrl}.
  function parse(hash, opts) {
    const c = UM.config,
          o = opts || {},
          defaultN = o.defaultN === undefined ? c.DEFAULT_NODES : o.defaultN,
          pick = o.randomSeed || UM.rng.randomSeed,
          values = {};

    String(hash || "").replace(/^#/, "").split("&").forEach((pair) => {
      const eq = pair.indexOf("=");
      if (eq > 0) values[pair.slice(0, eq)] = pair.slice(eq + 1);
    });

    let n = toInt(values.n);
    if (n === null) n = defaultN;
    n = Math.max(c.MIN_NODES, Math.min(c.MAX_NODES, n));

    let seed = toInt(values.seed);
    const seedFromUrl = seed !== null && seed >= 1 && seed <= MAX_SEED;
    if (!seedFromUrl) seed = pick();

    return { n: n, seed: seed, seedFromUrl: seedFromUrl };
  }

  function serialise(puzzleId) {
    return "#n=" + puzzleId.n + "&seed=" + puzzleId.seed;
  }

  UM.urlstate = { parse: parse, serialise: serialise, MAX_SEED: MAX_SEED };
})();
