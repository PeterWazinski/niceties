const test = require("node:test");
const assert = require("node:assert/strict");
require("../../js/puzzle.js");
require("../../js/game.js");
require("../../js/assist.js");
const UM = globalThis.UM;

// Fake clock and frame queue: run(dt) advances time by dt per animation frame.
function setup(n, seed) {
  const clock = { t: 0 }, queue = [];
  const game = UM.game.createGame(UM.puzzle.createPuzzle(n || 8, seed || 42), { now: () => clock.t });
  const assistant = UM.assist.createAssistant({ now: () => clock.t, raf: (fn) => queue.push(fn) });
  function run(dt, maxFrames) {
    for (let k = 0; k < (maxFrames || 1000) && queue.length; k++) {
      clock.t += dt;
      queue.splice(0).forEach((fn) => fn());
    }
  }
  return { clock, game, assistant, run };
}

// The player drags the given nodes by hand to x(solution), y(solution).
function placeByHand(game, indices, mirror) {
  indices.forEach((i) => {
    const s = game.puzzle.solution[i];
    game.beginDrag();
    game.moveNode(i, mirror ? 1 - s[0] : s[0], s[1]);
    game.endDrag();
  });
}

test("hint moves one node, counts the hint but no move, and leaves the timer alone", async () => {
  const { game, assistant, run } = setup();
  const before = game.getState().positions;
  const done = assistant.hint(game);
  assert.equal(game.getState().assisting, true);
  assert.equal(game.getState().assistNodes.length, 1);
  run(50);
  assert.equal(await done, true);
  const s = game.getState();
  const changed = s.positions.filter((q, i) => q[0] !== before[i][0] || q[1] !== before[i][1]);
  assert.equal(changed.length, 1);
  assert.equal(s.hints, 1);
  assert.equal(s.moves, 0);
  assert.equal(s.status, "idle");
  assert.equal(s.elapsed, 0);
  assert.equal(s.assisting, false);
  assert.deepEqual(s.assistNodes, []);
});

test("the tween is gradual: a middle frame lies between start and target", async () => {
  const { game, assistant, run, clock } = setup();
  const start = game.getState().positions;
  const done = assistant.hint(game);
  const node = game.getState().assistNodes[0];
  run(100, 3); // 300 ms of 1100
  const mid = game.getState().positions[node];
  assert.equal(game.getState().assisting, true);
  assert.notDeepEqual(mid, start[node]);
  assert.notDeepEqual(mid, game.puzzle.solution[node]);
  run(100);
  await done;
  assert.ok(clock.t >= UM.assist.HINT_MS);
});

test("the board is locked while help animates", () => {
  const { game, assistant } = setup();
  assistant.hint(game);
  const before = game.getState().positions[0].slice();
  assert.equal(game.moveNode(0, 0.123, 0.456), false);
  assert.deepEqual(game.getState().positions[0], before);
  assert.equal(game.beginAssist("hint", [0]), false);
});

test("solve untangles the puzzle, marks it assisted and counts no move", async () => {
  const { game, assistant, run } = setup(14, 5);
  const events = [];
  game.subscribe((e) => events.push(e.type));
  const done = assistant.solve(game);
  run(50);
  assert.equal(await done, true);
  const s = game.getState();
  assert.equal(s.crossings, 0);
  assert.equal(s.status, "solved");
  assert.equal(s.assisted, true);
  assert.equal(s.moves, 0);
  assert.equal(s.hints, 0);
  assert.equal(s.assisting, false);
  assert.equal(events.filter((t) => t === "solved").length, 1);
});

test("a hint that finishes the puzzle solves it without the assisted flag", async () => {
  const { game, assistant, run } = setup();
  placeByHand(game, game.puzzle.solution.map((_, i) => i).slice(1));
  const done = assistant.hint(game);
  run(50);
  await done;
  const s = game.getState();
  assert.equal(s.status, "solved");
  assert.equal(s.assisted, false);
  assert.equal(s.hints, 1);
});

test("help does nothing on a solved puzzle", async () => {
  const { game, assistant, run } = setup();
  const done = assistant.solve(game);
  run(50);
  await done;
  assert.equal(await assistant.hint(game), false);
  assert.equal(await assistant.solve(game), false);
});

test("reset during an animation stops it and restores the scramble", async () => {
  const { game, assistant, run } = setup();
  const done = assistant.solve(game);
  run(100, 2);
  game.reset();
  run(100);
  assert.equal(await done, false);
  const s = game.getState();
  assert.deepEqual(s.positions, game.puzzle.start);
  assert.equal(s.hints, 0);
  assert.equal(s.assisted, false);
  assert.equal(s.assisting, false);
});

test("hints follow a mirrored layout the player is building", async () => {
  const { game, assistant, run } = setup();
  const n = game.puzzle.n;
  placeByHand(game, Array.from({ length: n - 2 }, (_, i) => i), true);
  const done = assistant.hint(game);
  const node = game.getState().assistNodes[0];
  run(50);
  await done;
  const q = game.getState().positions[node], s = game.puzzle.solution[node];
  assert.ok(Math.abs(q[0] - (1 - s[0])) < 1e-9);
  assert.ok(Math.abs(q[1] - s[1]) < 1e-9);
});
