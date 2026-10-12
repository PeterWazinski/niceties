// Makes a crossing-free drawing prettier without ever introducing a crossing.
// Pure functions, no DOM.
//
// The graphs here are triangulated point sets, so every inner face is a
// triangle. A drawing stays planar as long as no triangle flips orientation
// (or collapses), and that is a local check. The layout is relaxed towards
// equal edge lengths one node at a time; a move is only taken if all triangles
// around the node keep their orientation.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") { require("./geometry.js"); }

  const SWEEPS = 400,
        STEP = 0.4,        // share of the force applied per move, divided by node degree
        BACKTRACKS = 6,    // how often a rejected move is halved before giving up
        MIN_AREA = 0.05;   // smallest triangle area allowed, as a share of the average one

  function orient(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }

  // Stretches the bounding box of `positions` over the unit square. An axis-wise
  // scaling keeps every orientation, so planarity is preserved.
  function fitToUnitSquare(positions) {
    const xs = positions.map((p) => p[0]), ys = positions.map((p) => p[1]),
          x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs),
          y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys),
          w = x1 - x0, h = y1 - y0;
    return positions.map((p) => [w > 0 ? (p[0] - x0) / w : 0.5, h > 0 ? (p[1] - y0) / h : 0.5]);
  }

  // Every 3-cycle of the graph that has no node inside: the inner faces.
  function triangleFaces(positions, edges) {
    const n = positions.length,
          adj = positions.map(() => new Set()),
          faces = [];
    edges.forEach((e) => { adj[e[0]].add(e[1]); adj[e[1]].add(e[0]); });
    function inside(i, j, k, m) {
      const d1 = orient(positions[i], positions[j], positions[m]),
            d2 = orient(positions[j], positions[k], positions[m]),
            d3 = orient(positions[k], positions[i], positions[m]);
      return (d1 > 0 && d2 > 0 && d3 > 0) || (d1 < 0 && d2 < 0 && d3 < 0);
    }
    for (let i = 0; i < n; i++) {
      adj[i].forEach((j) => {
        if (j <= i) return;
        adj[j].forEach((k) => {
          if (k <= j || !adj[i].has(k)) return;
          for (let m = 0; m < n; m++) {
            if (m !== i && m !== j && m !== k && inside(i, j, k, m)) return;
          }
          faces.push([i, j, k]);
        });
      });
    }
    return faces;
  }

  // Returns a new, crossing-free layout in [0,1]^2 with more even edge lengths
  // and fewer thin triangles. Falls back to the plain bounding-box fit (or to a
  // copy of the input) whenever the relaxation cannot be trusted.
  function beautify(positions, edges) {
    const geo = UM.geometry,
          n = positions.length,
          copy = positions.map((p) => [p[0], p[1]]);
    if (n < 3 || geo.countCrossings(copy, edges).count > 0) return copy;

    const fitted = fitToUnitSquare(copy);
    if (geo.countCrossings(fitted, edges).count > 0) return copy;

    const faces = triangleFaces(fitted, edges);
    if (!faces.length) return fitted;

    // Per face: which way it is wound, and the smallest doubled area it may
    // shrink to (never above what it already has, so thin faces never get thinner).
    const sign = [], floor = [], around = fitted.map(() => []);
    for (let f = 0; f < faces.length; f++) {
      const a = orient(fitted[faces[f][0]], fitted[faces[f][1]], fitted[faces[f][2]]);
      if (a === 0) return fitted;
      sign.push(a > 0 ? 1 : -1);
      floor.push(Math.min(2 * MIN_AREA / faces.length, Math.abs(a)));
      faces[f].forEach((v) => around[v].push(f));
    }

    const neighbours = fitted.map(() => []);
    edges.forEach((e) => { neighbours[e[0]].push(e[1]); neighbours[e[1]].push(e[0]); });

    // Edge length of equilateral triangles that tile the unit square.
    const target = Math.sqrt(4 / (Math.sqrt(3) * faces.length)),
          p = fitted.map((q) => [q[0], q[1]]);

    function valid(v) {
      return around[v].every((f) => {
        const t = faces[f];
        return sign[f] * orient(p[t[0]], p[t[1]], p[t[2]]) >= floor[f];
      });
    }

    for (let sweep = 0; sweep < SWEEPS; sweep++) {
      for (let v = 0; v < n; v++) {
        if (!neighbours[v].length) continue;
        let fx = 0, fy = 0;
        neighbours[v].forEach((u) => {
          const dx = p[u][0] - p[v][0], dy = p[u][1] - p[v][1],
                d = Math.hypot(dx, dy) || 1e-9,
                k = (d - target) / d;
          fx += k * dx;
          fy += k * dy;
        });
        const old = p[v];
        let step = STEP / neighbours[v].length;
        for (let t = 0; t < BACKTRACKS; t++, step /= 2) {
          p[v] = [Math.min(1, Math.max(0, old[0] + step * fx)),
                  Math.min(1, Math.max(0, old[1] + step * fy))];
          if (valid(v)) break;
          p[v] = old;
        }
      }
    }

    return geo.countCrossings(p, edges).count === 0 ? p : fitted;
  }

  UM.layout = { beautify: beautify, fitToUnitSquare: fitToUnitSquare };
})();
