// Random planar graph generation and scrambling. Pure functions, no DOM.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") { require("./config.js"); require("./geometry.js"); }

  // Generates a planar graph with n nodes drawn without crossings.
  // rng() must return floats in [0,1). Returns {positions, edges}.
  // At density 1 the graph is maximal (no further edge fits without a crossing);
  // lower densities stop at density * (3n - 6) edges.
  function planarGraph(n, rng, density) {
    const geo = UM.geometry,
          maxEdges = Math.round((density === undefined ? 1 : density) * (3 * n - 6)),
          positions = [],
          edges = [];

    for (let i = 0; i < n; i++) positions.push([rng(), rng()]);

    function addLink(i, j) {
      if (i === j || edges.length >= maxEdges) return;
      const link = [Math.min(i, j), Math.max(i, j)];
      for (let k = 0; k < edges.length; k++) {
        if (edges[k][0] === link[0] && edges[k][1] === link[1]) return;
        if (geo.edgesCross(positions, link, edges[k])) return;
      }
      edges.push(link);
    }

    // One random link per node first (variety), then every remaining pair.
    for (let i = 0; i < n; i++) addLink(i, Math.floor(rng() * n));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) addLink(i, j);
    return { positions: positions, edges: edges };
  }

  // Random node positions that contain at least one crossing.
  function scramble(n, edges, rng, maxAttempts) {
    const limit = maxAttempts || UM.config.SCRAMBLE_MAX_ATTEMPTS;
    for (let attempt = 0; attempt < limit; attempt++) {
      const positions = [];
      for (let i = 0; i < n; i++) positions.push([rng(), rng()]);
      if (UM.geometry.countCrossings(positions, edges).count > 0) return positions;
    }
    throw new Error("scramble: no crossing layout found after " + limit + " attempts");
  }

  UM.graph = { planarGraph: planarGraph, scramble: scramble };
})();
