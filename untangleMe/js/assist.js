// Animated help: moves nodes onto the aligned solution with a slow tween.
// The clock and frame scheduler are injectable so tests can drive time.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") { require("./hint.js"); }

  const HINT_MS = 1100, SOLVE_MS = 1900;

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // opts: {now: () => ms, raf: (fn) => id, hintNodes: nodes per hint (default 1)}
  function createAssistant(opts) {
    const o = opts || {},
          now = o.now || (() => performance.now()),
          raf = o.raf || ((fn) => requestAnimationFrame(fn)),
          hintCount = o.hintNodes || 1;
    let token = 0;

    // Tweens `nodes` of `game` onto `target`; resolves true if it ran to the end.
    function animate(game, kind, nodes, target, duration) {
      const mine = ++token,
            from = game.getState().positions,
            t0 = now();
      game.beginAssist(kind, nodes);
      return new Promise((resolve) => {
        function step() {
          if (mine !== token || !game.getState().assisting) { resolve(false); return; }
          const t = duration > 0 ? Math.min(1, (now() - t0) / duration) : 1,
                e = t >= 1 ? 1 : ease(t);
          nodes.forEach((i) => {
            game.assistMove(i,
              from[i][0] + (target[i][0] - from[i][0]) * e,
              from[i][1] + (target[i][1] - from[i][1]) * e);
          });
          if (t >= 1) { game.endAssist(); resolve(true); } else raf(step);
        }
        raf(step);
      });
    }

    function alignedTarget(game) {
      const s = game.getState();
      return UM.hint.alignSolution(game.puzzle.solution, s.positions);
    }

    function canAssist(game) {
      const s = game.getState();
      return s.status !== "solved" && !s.assisting;
    }

    return {
      // Moves one (or `hintNodes`) well-chosen node(s) towards the solution.
      hint: function (game) {
        if (!canAssist(game)) return Promise.resolve(false);
        const s = game.getState(),
              target = alignedTarget(game),
              nodes = UM.hint.chooseHintNodes(s.positions, s.edges, target, hintCount);
        if (!nodes.length) return Promise.resolve(false);
        return animate(game, "hint", nodes, target, HINT_MS);
      },

      // Moves every misplaced node onto the solution.
      solve: function (game) {
        if (!canAssist(game)) return Promise.resolve(false);
        const s = game.getState(),
              target = alignedTarget(game),
              nodes = s.positions.map((_, i) => i).filter((i) =>
                Math.abs(s.positions[i][0] - target[i][0]) > 1e-6 ||
                Math.abs(s.positions[i][1] - target[i][1]) > 1e-6);
        if (!nodes.length) return Promise.resolve(false);
        return animate(game, "solve", nodes, target, SOLVE_MS);
      },

      // Abandons a running animation (the game must be left or reset by the caller).
      cancel: function () { token++; }
    };
  }

  UM.assist = { createAssistant: createAssistant, HINT_MS: HINT_MS, SOLVE_MS: SOLVE_MS };
})();
