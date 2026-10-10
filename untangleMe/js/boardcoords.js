// Mapping between unit coordinates ([0,1]^2, used by the game) and board
// (SVG viewBox) coordinates. Pure functions, so they can be unit tested.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  if (typeof require === "function") require("./config.js");

  // Unit position -> viewBox position.
  function unitToBoard(p, board) {
    const b = board || UM.config.BOARD;
    return [b.padding + p[0] * (b.width - 2 * b.padding),
            b.padding + p[1] * (b.height - 2 * b.padding)];
  }

  // viewBox position -> unit position (not clamped).
  function boardToUnit(p, board) {
    const b = board || UM.config.BOARD;
    return [(p[0] - b.padding) / (b.width - 2 * b.padding),
            (p[1] - b.padding) / (b.height - 2 * b.padding)];
  }

  // Screen (client) position -> unit position. `inverse` is the inverse of the
  // SVG's screen CTM, i.e. a DOMMatrix-like {a,b,c,d,e,f}.
  function clientToUnit(inverse, clientX, clientY, board) {
    const m = inverse,
          x = m.a * clientX + m.c * clientY + m.e,
          y = m.b * clientX + m.d * clientY + m.f;
    return boardToUnit([x, y], board);
  }

  UM.boardcoords = { unitToBoard: unitToBoard, boardToUnit: boardToUnit, clientToUnit: clientToUnit };
})();
