const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/puzzle.js");
require("../../js/game.js");
const UM = globalThis.UM;

function setup(n, seed) {
  const clock = { t: 1000 };
  const puzzle = UM.puzzle.createPuzzle(n || 8, seed || 42);
  const game = UM.game.createGame(puzzle, { now: () => clock.t });
  return { clock, puzzle, game };
}

// Drags every node onto its solution position, one drag per node.
function solve(game, puzzle) {
  puzzle.solution.forEach((p, i) => {
    game.beginDrag();
    game.moveNode(i, p[0], p[1]);
    game.endDrag();
  });
}

test("a new game is idle with crossings and zeroed stats", () => {
  const { game, puzzle } = setup();
  const s = game.getState();
  assert.equal(s.status, "idle");
  assert.equal(s.moves, 0);
  assert.equal(s.elapsed, 0);
  assert.ok(s.crossings > 0);
  assert.deepEqual(s.positions, puzzle.start);
});

test("the timer does not run before the first displacement", () => {
  const { game, clock } = setup();
  clock.t += 5000;
  assert.equal(game.elapsed(), 0);
  assert.equal(game.getState().status, "idle");
});

test("a click without movement is not a move and does not start the game", () => {
  const { game, puzzle } = setup();
  const p = puzzle.start[0];
  game.beginDrag();
  assert.equal(game.moveNode(0, p[0], p[1]), false);
  game.endDrag();
  const s = game.getState();
  assert.equal(s.moves, 0);
  assert.equal(s.status, "idle");
});

test("first real displacement starts the game and the timer", () => {
  const { game, puzzle, clock } = setup();
  const p = puzzle.start[0];
  game.beginDrag();
  assert.equal(game.moveNode(0, p[0] > 0.5 ? p[0] - 0.1 : p[0] + 0.1, p[1]), true);
  assert.equal(game.getState().status, "playing");
  clock.t += 2500;
  assert.equal(game.elapsed(), 2500);
  game.endDrag();
});

test("a drag with many pointer events counts as one move", () => {
  const { game, puzzle } = setup();
  const p = puzzle.start[0], dx = p[0] > 0.5 ? -0.01 : 0.01;
  game.beginDrag();
  for (let k = 1; k <= 10; k++) game.moveNode(0, p[0] + dx * k, p[1]);
  game.endDrag();
  assert.equal(game.getState().moves, 1);
});

test("coordinates are clamped to [0,1]", () => {
  const { game } = setup();
  game.beginDrag();
  game.moveNode(0, -5, 7);
  game.endDrag();
  assert.deepEqual(game.getState().positions[0], [0, 1]);
});

test("moving all nodes to the solution solves the game and emits 'solved' once", () => {
  const { game, puzzle, clock } = setup();
  const events = [];
  game.subscribe((e) => events.push(e.type));
  clock.t += 100;
  solve(game, puzzle);
  const s = game.getState();
  assert.equal(s.crossings, 0);
  assert.equal(s.status, "solved");
  assert.equal(events.filter((t) => t === "solved").length, 1);
});

test("timer and moves are frozen after solving; no second 'solved' event", () => {
  const { game, puzzle, clock } = setup();
  const events = [];
  game.subscribe((e) => events.push(e.type));
  solve(game, puzzle);
  const doneMoves = game.getState().moves, doneTime = game.elapsed();
  clock.t += 10000;
  assert.equal(game.elapsed(), doneTime);

  // Mess it up and fix it again.
  game.beginDrag();
  const other = puzzle.start[0];
  game.moveNode(0, other[0], other[1]);
  game.endDrag();
  solve(game, puzzle);
  clock.t += 10000;
  const s = game.getState();
  assert.equal(s.status, "solved");
  assert.equal(s.elapsed, doneTime);
  assert.equal(s.moves, doneMoves);
  assert.equal(events.filter((t) => t === "solved").length, 1);
});

test("the move that solves the puzzle is counted", () => {
  const { game, puzzle } = setup();
  const last = puzzle.solution.length - 1;
  // Place all nodes but the last one without drag bookkeeping side effects.
  puzzle.solution.forEach((p, i) => {
    if (i === last) return;
    game.beginDrag(); game.moveNode(i, p[0], p[1]); game.endDrag();
  });
  const before = game.getState().moves;
  game.beginDrag();
  game.moveNode(last, puzzle.solution[last][0], puzzle.solution[last][1]);
  game.endDrag();
  const s = game.getState();
  assert.equal(s.status, "solved");
  assert.equal(s.moves, before + 1);
});

test("reset restores the start layout, zeroes stats and returns to idle", () => {
  const { game, puzzle, clock } = setup();
  solve(game, puzzle);
  clock.t += 4000;
  game.reset();
  const s = game.getState();
  assert.deepEqual(s.positions, puzzle.start);
  assert.equal(s.moves, 0);
  assert.equal(s.elapsed, 0);
  assert.equal(s.status, "idle");
  assert.ok(s.crossings > 0);
  // and it is playable again
  const p = puzzle.start[0];
  game.beginDrag();
  game.moveNode(0, p[0] > 0.5 ? p[0] - 0.2 : p[0] + 0.2, p[1]);
  game.endDrag();
  assert.equal(game.getState().status, "playing");
});

test("reset does not modify the puzzle's start layout", () => {
  const { game, puzzle } = setup();
  const copy = JSON.parse(JSON.stringify(puzzle.start));
  game.beginDrag(); game.moveNode(0, 0.123, 0.456); game.endDrag();
  game.reset();
  assert.deepEqual(puzzle.start, copy);
});

test("pause and resume exclude the paused span", () => {
  const { game, puzzle, clock } = setup();
  const p = puzzle.start[0];
  game.beginDrag();
  game.moveNode(0, p[0] > 0.5 ? p[0] - 0.05 : p[0] + 0.05, p[1]);
  game.endDrag();
  clock.t += 1000;
  game.pause();
  clock.t += 60000;
  assert.equal(game.elapsed(), 1000);
  game.resume();
  clock.t += 500;
  assert.equal(game.elapsed(), 1500);
});

test("pausing while idle is a no-op and the timer starts on resume-then-move", () => {
  const { game, puzzle, clock } = setup();
  game.pause();
  clock.t += 5000;
  game.resume();
  assert.equal(game.elapsed(), 0);
  assert.equal(game.getState().status, "idle");
  const p = puzzle.start[0];
  game.beginDrag();
  game.moveNode(0, p[0] > 0.5 ? p[0] - 0.05 : p[0] + 0.05, p[1]);
  game.endDrag();
  clock.t += 700;
  assert.equal(game.elapsed(), 700);
});

test("a move made while paused starts the clock only after resume", () => {
  const { game, puzzle, clock } = setup();
  game.pause();
  const p = puzzle.start[0];
  game.beginDrag();
  game.moveNode(0, p[0] > 0.5 ? p[0] - 0.05 : p[0] + 0.05, p[1]);
  game.endDrag();
  clock.t += 3000;
  assert.equal(game.elapsed(), 0);
  game.resume();
  clock.t += 200;
  assert.equal(game.elapsed(), 200);
});

test("resume after solving does not restart the clock", () => {
  const { game, puzzle, clock } = setup();
  solve(game, puzzle);
  const t = game.elapsed();
  game.pause();
  game.resume();
  clock.t += 9000;
  assert.equal(game.elapsed(), t);
});

test("subscribers receive change events and can unsubscribe", () => {
  const { game, puzzle } = setup();
  let calls = 0;
  const off = game.subscribe(() => calls++);
  const p = puzzle.start[0];
  game.beginDrag();
  game.moveNode(0, p[0] > 0.5 ? p[0] - 0.05 : p[0] + 0.05, p[1]);
  game.endDrag();
  assert.ok(calls > 0);
  off();
  const before = calls;
  game.reset();
  assert.equal(calls, before);
});
