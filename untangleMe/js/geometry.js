// Crossing detection for straight-line graph drawings.
// Positions are [x, y] pairs, edges are [i, j] node-index pairs.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});

  const EPS = 1e-9;

  function orient(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }

  // p is known to be (nearly) collinear with a-b: is it within the segment?
  function inSegment(a, b, p) {
    return p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS &&
           p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;
  }

  // Crossing point of two segments that share no node, or null.
  // A node touching the other segment counts as a crossing.
  function segmentCrossing(a0, a1, b0, b1) {
    const d1 = orient(b0, b1, a0), d2 = orient(b0, b1, a1),
          d3 = orient(a0, a1, b0), d4 = orient(a0, a1, b1);
    if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
        ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) {
      const t = d1 / (d1 - d2);
      return [a0[0] + t * (a1[0] - a0[0]), a0[1] + t * (a1[1] - a0[1])];
    }
    if (Math.abs(d1) <= EPS && inSegment(b0, b1, a0)) return a0;
    if (Math.abs(d2) <= EPS && inSegment(b0, b1, a1)) return a1;
    if (Math.abs(d3) <= EPS && inSegment(a0, a1, b0)) return b0;
    if (Math.abs(d4) <= EPS && inSegment(a0, a1, b1)) return b1;
    return null;
  }

  // Crossing point of edges e and f (or null). Edges sharing exactly one node
  // cross only when they overlap collinearly; identical edges never cross.
  function crossingPoint(pos, e, f) {
    const shared = [];
    if (e[0] === f[0] || e[0] === f[1]) shared.push(e[0]);
    if (e[1] === f[0] || e[1] === f[1]) shared.push(e[1]);
    if (shared.length >= 2) return null;
    if (shared.length === 1) {
      const k = shared[0], p = pos[k],
            a = pos[e[0] === k ? e[1] : e[0]],
            b = pos[f[0] === k ? f[1] : f[0]],
            u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]];
      const overlap = Math.abs(u[0] * v[1] - u[1] * v[0]) <= EPS && u[0] * v[0] + u[1] * v[1] > 0;
      return overlap ? p : null;
    }
    return segmentCrossing(pos[e[0]], pos[e[1]], pos[f[0]], pos[f[1]]);
  }

  function edgesCross(pos, e, f) {
    return crossingPoint(pos, e, f) !== null;
  }

  // Full analysis of a drawing:
  // {count, edgeFlags[], nodeFlags[], points[]} - flags are true for edges and
  // nodes involved in at least one crossing, points are the crossing locations.
  function countCrossings(pos, edges) {
    const edgeFlags = edges.map(() => false),
          nodeFlags = pos.map(() => false),
          points = [];
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const pt = crossingPoint(pos, edges[i], edges[j]);
        if (!pt) continue;
        points.push([pt[0], pt[1]]);
        edgeFlags[i] = edgeFlags[j] = true;
        nodeFlags[edges[i][0]] = nodeFlags[edges[i][1]] = true;
        nodeFlags[edges[j][0]] = nodeFlags[edges[j][1]] = true;
      }
    }
    return { count: points.length, edgeFlags: edgeFlags, nodeFlags: nodeFlags, points: points };
  }

  UM.geometry = {
    EPS: EPS,
    crossingPoint: crossingPoint,
    edgesCross: edgesCross,
    countCrossings: countCrossings
  };
})();
