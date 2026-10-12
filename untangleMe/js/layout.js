// Makes a crossing-free drawing prettier without ever introducing a crossing.
// Pure functions, no DOM.
//
// The graphs here are triangulated point sets, so every inner face is a
// triangle. A drawing stays planar as long as no triangle flips orientation
// (or collapses), and that is a local check. The layout is relaxed towards
// equal edge lengths one node at a time; a move is only taken if all triangles
// around the node keep their orientation and no node circle gets closer to
// another node or a foreign edge than it needs to be.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") { require("./config.js"); require("./geometry.js"); }

  const SWEEPS = 150,
        STEP = 0.4,          // share of the force applied per move, divided by node degree
        BACKTRACKS = 6,      // how often a rejected move is halved before giving up
        MIN_AREA = 0.05,     // smallest triangle area allowed, as a share of the average one
        CLEARANCE_GAP = 6,   // visible gap between a node circle and a foreign edge, in board units
        REPEL = 12,          // weight of the clearance push relative to the edge-length spring
        SETTLE = 1;          // stop once a sweep moves nodes by less than this in total, in board units

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

  // Point of segment a-b nearest to q: {pt, t} with t in [0,1] from a to b.
  function closestOnSegment(q, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy,
          t = len2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / len2)) : 0;
    return { pt: [a[0] + t * dx, a[1] + t * dy], t: t };
  }

  function segmentDistance(q, a, b) {
    const c = closestOnSegment(q, a, b).pt;
    return Math.hypot(q[0] - c[0], q[1] - c[1]);
  }

  // Returns a new, crossing-free layout in [0,1]^2 with more even edge lengths
  // and no node circle touching a foreign edge or another node. The work is done
  // in board units, so the clearance means what the player sees. Falls back to
  // the plain bounding-box fit (or to a copy of the input) whenever the
  // relaxation cannot be trusted.
  function beautify(positions, edges) {
    const geo = UM.geometry,
          cfg = UM.config,
          R = cfg.NODE_RADIUS,
          W = cfg.BOARD.width - 2 * cfg.BOARD.padding,
          H = cfg.BOARD.height - 2 * cfg.BOARD.padding,
          clear = R + CLEARANCE_GAP,
          n = positions.length,
          copy = positions.map((p) => [p[0], p[1]]);
    if (n < 3 || geo.countCrossings(copy, edges).count > 0) return copy;

    const fitted = fitToUnitSquare(copy);
    if (geo.countCrossings(fitted, edges).count > 0) return copy;

    const faces = triangleFaces(fitted, edges);
    if (!faces.length) return fitted;

    const p = fitted.map((q) => [q[0] * W, q[1] * H]);

    // Per face: which way it is wound, and the smallest doubled area it may
    // shrink to (never above what it already has, so thin faces never get thinner).
    const sign = [], floor = [], around = p.map(() => []);
    for (let f = 0; f < faces.length; f++) {
      const a = orient(p[faces[f][0]], p[faces[f][1]], p[faces[f][2]]);
      if (a === 0) return fitted;
      sign.push(a > 0 ? 1 : -1);
      floor.push(Math.min(2 * MIN_AREA * W * H / faces.length, Math.abs(a)));
      faces[f].forEach((v) => around[v].push(f));
    }

    const neighbours = p.map(() => []), incident = p.map(() => []);
    edges.forEach((e) => {
      neighbours[e[0]].push(e[1]); neighbours[e[1]].push(e[0]);
      incident[e[0]].push(e); incident[e[1]].push(e);
    });

    // Edge length of equilateral triangles that tile the board.
    const target = Math.sqrt(4 * W * H / (Math.sqrt(3) * faces.length));

    function windingOk(v) {
      return around[v].every((f) => {
        const t = faces[f];
        return sign[f] * orient(p[t[0]], p[t[1]], p[t[2]]) >= floor[f];
      });
    }

    // Tightest spot node v takes part in: v against other nodes (centre distance
    // minus one radius), v against foreign edges, and v's own edges against
    // foreign nodes. A value of `clear` or more means no visible overlap.
    function clearance(v) {
      let c = Infinity;
      for (let w = 0; w < n; w++) {
        if (w !== v) c = Math.min(c, Math.hypot(p[w][0] - p[v][0], p[w][1] - p[v][1]) - R);
      }
      edges.forEach((e) => {
        if (e[0] !== v && e[1] !== v) c = Math.min(c, segmentDistance(p[v], p[e[0]], p[e[1]]));
      });
      incident[v].forEach((e) => {
        for (let w = 0; w < n; w++) {
          if (w !== e[0] && w !== e[1]) c = Math.min(c, segmentDistance(p[w], p[e[0]], p[e[1]]));
        }
      });
      return c;
    }

    // Adds to `force` a push on v away from everything closer than twice `clear`.
    function repel(v, force) {
      const reach = 2 * clear;
      function away(from, base, weight) {
        const dx = base[0] - from[0], dy = base[1] - from[1], d = Math.hypot(dx, dy);
        if (d >= reach) return;
        const k = weight * (reach - d) / (d || 1e-9);
        force[0] += k * dx;
        force[1] += k * dy;
      }
      edges.forEach((e) => {
        if (e[0] !== v && e[1] !== v) away(closestOnSegment(p[v], p[e[0]], p[e[1]]).pt, p[v], REPEL);
      });
      incident[v].forEach((e) => {
        const u = e[0] === v ? e[1] : e[0];
        for (let w = 0; w < n; w++) {
          if (w === v || w === u) continue;
          // Pushes v so that its edge moves away from w; the near end of the edge moves most.
          const c = closestOnSegment(p[w], p[v], p[u]);
          away(p[w], c.pt, REPEL * (1 - c.t));
        }
      });
      for (let w = 0; w < n; w++) {
        if (w !== v) away(p[w], p[v], REPEL);
      }
    }

    for (let sweep = 0; sweep < SWEEPS; sweep++) {
      let moved = 0;
      for (let v = 0; v < n; v++) {
        if (!neighbours[v].length) continue;
        const force = [0, 0];
        neighbours[v].forEach((u) => {
          const dx = p[u][0] - p[v][0], dy = p[u][1] - p[v][1],
                d = Math.hypot(dx, dy) || 1e-9,
                k = (d - target) / d;
          force[0] += k * dx;
          force[1] += k * dy;
        });
        repel(v, force);
        const old = p[v],
              need = Math.min(clear, clearance(v)); // a tight spot may only get looser
        let step = STEP / neighbours[v].length;
        for (let t = 0; t < BACKTRACKS; t++, step /= 2) {
          p[v] = [Math.min(W, Math.max(0, old[0] + step * force[0])),
                  Math.min(H, Math.max(0, old[1] + step * force[1]))];
          if (windingOk(v) && clearance(v) >= need - 1e-9) break;
          p[v] = old;
        }
        moved += Math.abs(p[v][0] - old[0]) + Math.abs(p[v][1] - old[1]);
      }
      if (moved < SETTLE) break;
    }

    const out = p.map((q) => [q[0] / W, q[1] / H]);
    return geo.countCrossings(out, edges).count === 0 ? out : fitted;
  }

  UM.layout = { beautify: beautify, fitToUnitSquare: fitToUnitSquare };
})();
