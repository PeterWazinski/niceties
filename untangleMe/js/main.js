// Wiring: boot, puzzle lifecycle, DOM controls.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  const root = document.documentElement;

  // Phones are too small for the board: show the notice and do not start.
  const shortSide = Math.min(screen.width, screen.height);
  if (shortSide < UM.config.MIN_SCREEN_SIDE) {
    root.classList.add("too-small");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const els = {
    timer: $("timer"), moves: $("moves"), crossings: $("crossings"),
    newPuzzle: $("new-puzzle")
  };

  const boardView = UM.view.createBoardView($("board"));
  let game = null;
  let tickId = null;

  function formatTime(ms) { return (ms / 1000).toFixed(1); }

  function renderStats(state) {
    els.moves.textContent = state.moves;
    els.crossings.textContent = state.crossings;
    els.timer.textContent = formatTime(state.elapsed);
    root.setAttribute("data-status", state.status);
  }

  function startPuzzle(n, seed) {
    const puzzle = UM.puzzle.createPuzzle(n, seed);
    game = UM.game.createGame(puzzle);
    boardView.show(game);
    game.subscribe((e) => renderStats(e.state));
    renderStats(game.getState());
    if (tickId === null) {
      tickId = setInterval(() => {
        els.timer.textContent = formatTime(game.elapsed());
      }, 100);
    }
  }

  // Makes (n, seed) the current puzzle and mirrors it into the URL hash.
  function go(n, seed) {
    const hash = UM.urlstate.serialise({ n: n, seed: seed });
    if (location.hash !== hash) history.replaceState(null, "", hash);
    startPuzzle(n, seed);
  }

  function newPuzzle(n) {
    const size = n === undefined ? game.puzzle.n : n;
    let seed = UM.rng.randomSeed();
    if (size === game.puzzle.n && seed === game.puzzle.seed) seed = (seed % UM.config.MAX_RANDOM_SEED) + 1;
    go(size, seed);
  }

  els.newPuzzle.addEventListener("click", () => newPuzzle());

  window.addEventListener("hashchange", () => {
    const id = UM.urlstate.parse(location.hash, { defaultN: game.puzzle.n });
    if (id.seedFromUrl && (id.n !== game.puzzle.n || id.seed !== game.puzzle.seed)) go(id.n, id.seed);
  });

  const settings = UM.settings.load();
  const id = UM.urlstate.parse(location.hash, { defaultN: settings.nodes });
  go(id.n, id.seed);

  UM.app = {
    getGame: () => game,
    newPuzzle: newPuzzle,
    go: go
  };
})();
