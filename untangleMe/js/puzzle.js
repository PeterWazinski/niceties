// A puzzle is fully determined by (n, seed).
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") { require("./config.js"); require("./rng.js"); require("./graph.js"); require("./layout.js"); }

  // Returns {n, seed, edges, solution, start}: `solution` is a crossing-free
  // layout, `start` the scrambled layout the player begins with.
  function createPuzzle(n, seed) {
    const c = UM.config;
    if (!Number.isInteger(n) || n < c.MIN_NODES || n > c.MAX_NODES) {
      throw new RangeError("n must be an integer in [" + c.MIN_NODES + ", " + c.MAX_NODES + "]");
    }
    const rng = UM.rng.mulberry32(seed),
          g = UM.graph.planarGraph(n, rng, c.EDGE_DENSITY),
          start = UM.graph.scramble(n, g.edges, rng);
    return { n: n, seed: seed, edges: g.edges, solution: UM.layout.beautify(g.positions, g.edges), start: start };
  }

  UM.puzzle = { createPuzzle: createPuzzle };
})();
