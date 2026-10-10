// Game state machine: positions, moves, timer, solved detection.
// No DOM; the clock is injectable so tests can control time.
//
// status: "idle"    scrambled, untouched
//         "playing" first real displacement happened, timer running
//         "solved"  no crossings left; timer and move counter are frozen
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") { require("./config.js"); require("./geometry.js"); }

  const MOVE_EPSILON = 1e-6; // smaller displacements are not a move

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // puzzle: result of UM.puzzle.createPuzzle. opts.now: () => milliseconds.
  function createGame(puzzle, opts) {
    const now = (opts && opts.now) || (() => Date.now()),
          listeners = [];

    let positions, analysis, moves, status;
    let accumulated, runningSince, paused;
    let dragging, dragMoved, dragCounts;

    function init() {
      positions = puzzle.start.map((p) => [p[0], p[1]]);
      moves = 0;
      status = "idle";
      accumulated = 0;
      runningSince = null;
      dragging = false;
      dragMoved = false;
      dragCounts = false;
      analyse();
    }

    function analyse() {
      analysis = UM.geometry.countCrossings(positions, puzzle.edges);
    }

    function elapsed() {
      return accumulated + (runningSince === null ? 0 : now() - runningSince);
    }

    function stopClock() {
      if (runningSince !== null) {
        accumulated += now() - runningSince;
        runningSince = null;
      }
    }

    function emit(type) {
      const snap = snapshot();
      listeners.slice().forEach((fn) => fn({ type: type, state: snap }));
    }

    function snapshot() {
      return {
        positions: positions.map((p) => [p[0], p[1]]),
        edges: puzzle.edges,
        moves: moves,
        status: status,
        crossings: analysis.count,
        edgeFlags: analysis.edgeFlags,
        nodeFlags: analysis.nodeFlags,
        points: analysis.points,
        elapsed: elapsed(),
        paused: paused
      };
    }

    paused = false;
    init();

    return {
      puzzle: puzzle,
      getState: snapshot,

      // fn({type: "change" | "solved" | "reset", state})
      subscribe: function (fn) {
        listeners.push(fn);
        return function () {
          const i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        };
      },

      beginDrag: function () {
        dragging = true;
        dragMoved = false;
        dragCounts = status !== "solved";
      },

      // Moves node i (coordinates are clamped to [0,1]). Returns true if it moved.
      moveNode: function (i, x, y) {
        const p = positions[i],
              nx = clamp01(x), ny = clamp01(y);
        if (Math.abs(nx - p[0]) < MOVE_EPSILON && Math.abs(ny - p[1]) < MOVE_EPSILON) return false;
        p[0] = nx;
        p[1] = ny;
        if (dragging) dragMoved = true;
        if (status === "idle") {
          status = "playing";
          if (!paused) runningSince = now();
        }
        analyse();
        let solvedNow = false;
        if (analysis.count === 0 && status === "playing") {
          stopClock();
          status = "solved";
          solvedNow = true;
        }
        emit("change");
        if (solvedNow) emit("solved");
        return true;
      },

      endDrag: function () {
        if (!dragging) return;
        dragging = false;
        if (dragMoved && dragCounts) {
          moves++;
          emit("change");
        }
        dragMoved = false;
      },

      // Back to the starting scramble: zero moves, zero time, status idle.
      reset: function () {
        init();
        emit("reset");
      },

      pause: function () {
        if (paused) return;
        paused = true;
        stopClock();
      },

      resume: function () {
        if (!paused) return;
        paused = false;
        if (status === "playing" && runningSince === null) runningSince = now();
      },

      elapsed: elapsed
    };
  }

  UM.game = { createGame: createGame };
})();
