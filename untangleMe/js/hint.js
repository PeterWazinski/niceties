// Hint logic: which nodes to move, and where to. Pure functions, no DOM.
//
// A puzzle carries one known crossing-free layout (`solution`). The player may
// be building a rotated or mirrored copy of it, so the solution is first
// aligned to the current layout; hints then move nodes onto that aligned
// target and never fight what the player has already done.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") { require("./geometry.js"); }

  const AT_TARGET = 1e-6; // closer than this counts as "already there"

  // The 8 symmetries of the unit square (4 rotations, each optionally mirrored).
  const SYMMETRIES = [
    (p) => [p[0], p[1]],
    (p) => [1 - p[0], p[1]],
    (p) => [p[0], 1 - p[1]],
    (p) => [1 - p[0], 1 - p[1]],
    (p) => [p[1], p[0]],
    (p) => [1 - p[1], p[0]],
    (p) => [p[1], 1 - p[0]],
    (p) => [1 - p[1], 1 - p[0]]
  ];

  function dist2(a, b) {
    const dx = a[0] - b[0], dy = a[1] - b[1];
    return dx * dx + dy * dy;
  }

  // The symmetric copy of `solution` that lies closest to `positions`
  // (sum of squared distances). Ties keep the unmodified solution.
  function alignSolution(solution, positions) {
    let best = null, bestCost = Infinity;
    SYMMETRIES.forEach((sym) => {
      const candidate = solution.map(sym);
      let cost = 0;
      for (let i = 0; i < candidate.length; i++) cost += dist2(candidate[i], positions[i]);
      if (cost < bestCost - 1e-12) { bestCost = cost; best = candidate; }
    });
    return best;
  }

  // Up to `count` node indices to move onto `target`, best first. Greedy: each
  // pick is the node whose move removes the most crossings (ties: the node
  // involved in more crossing edges, then the one that is farther away). If no
  // move helps, the pick is still a node that is part of a crossing. Nodes
  // already at their target are never chosen, so repeated hints always finish.
  function chooseHintNodes(positions, edges, target, count) {
    const geo = UM.geometry,
          work = positions.map((p) => [p[0], p[1]]),
          picked = [];
    for (let k = 0; k < (count || 1); k++) {
      const base = geo.countCrossings(work, edges);
      if (base.count === 0) break;
      let best = -1, bestGain = -Infinity, bestInvolved = -1, bestDist = -1;
      for (let i = 0; i < work.length; i++) {
        const d = dist2(work[i], target[i]);
        if (d < AT_TARGET * AT_TARGET) continue;
        const saved = work[i];
        work[i] = target[i];
        const gain = base.count - geo.countCrossings(work, edges).count;
        work[i] = saved;
        let involved = 0;
        edges.forEach((e, ei) => { if (base.edgeFlags[ei] && (e[0] === i || e[1] === i)) involved++; });
        const better = gain > bestGain ||
          (gain === bestGain && (involved > bestInvolved ||
            (involved === bestInvolved && d > bestDist)));
        if (better) { best = i; bestGain = gain; bestInvolved = involved; bestDist = d; }
      }
      if (best < 0) break;
      picked.push(best);
      work[best] = target[best];
    }
    return picked;
  }

  UM.hint = { alignSolution: alignSolution, chooseHintNodes: chooseHintNodes };
})();
