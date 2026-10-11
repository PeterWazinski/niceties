// SVG board rendering and pointer dragging. Knows the DOM, not the rules.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});
  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(name, cls) {
    const el = document.createElementNS(SVG_NS, name);
    if (cls) el.setAttribute("class", cls);
    return el;
  }

  // svg: the <svg id="board"> element. Returns {show(game), refresh()}.
  function createBoardView(svg) {
    const board = UM.config.BOARD,
          coords = UM.boardcoords;
    svg.setAttribute("viewBox", "0 0 " + board.width + " " + board.height);

    const gEdges = svgEl("g"), gMarks = svgEl("g"), gNodes = svgEl("g");
    svg.appendChild(gEdges);
    svg.appendChild(gMarks);
    svg.appendChild(gNodes);

    let game = null, unsubscribe = null, edgeEls = [], nodeEls = [];

    function render(state) {
      state.edges.forEach((e, i) => {
        const a = coords.unitToBoard(state.positions[e[0]]),
              b = coords.unitToBoard(state.positions[e[1]]),
              el = edgeEls[i];
        el.setAttribute("x1", a[0]); el.setAttribute("y1", a[1]);
        el.setAttribute("x2", b[0]); el.setAttribute("y2", b[1]);
        el.setAttribute("class", "edge" + (state.edgeFlags[i] ? " x" : ""));
      });
      nodeEls.forEach((el, i) => {
        const p = coords.unitToBoard(state.positions[i]);
        el.setAttribute("cx", p[0]); el.setAttribute("cy", p[1]);
        el.setAttribute("class", "node" + (state.nodeFlags[i] ? " x" : "") +
                                 (el.dataset.grab ? " grab" : "") +
                                 (state.assistNodes.indexOf(i) >= 0 ? " hint" : ""));
      });
      while (gMarks.firstChild) gMarks.removeChild(gMarks.firstChild);
      state.points.forEach((pt) => {
        const p = coords.unitToBoard(pt), m = svgEl("circle", "mark");
        m.setAttribute("cx", p[0]); m.setAttribute("cy", p[1]); m.setAttribute("r", 6);
        gMarks.appendChild(m);
      });
    }

    function attachDrag(el, index) {
      el.addEventListener("pointerdown", (ev) => {
        if (!game || ev.button > 0 || game.getState().assisting) return;
        ev.preventDefault();
        try { el.setPointerCapture(ev.pointerId); } catch (e) { /* pointer already gone */ }
        el.dataset.grab = "1";
        game.beginDrag();
        const inv = svg.getScreenCTM().inverse(),
              start = coords.clientToUnit(inv, ev.clientX, ev.clientY),
              node = game.getState().positions[index],
              dx = node[0] - start[0], dy = node[1] - start[1];

        function move(e) {
          const m = svg.getScreenCTM().inverse(),
                u = coords.clientToUnit(m, e.clientX, e.clientY);
          game.moveNode(index, u[0] + dx, u[1] + dy);
        }
        function up() {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
          el.removeEventListener("pointercancel", up);
          delete el.dataset.grab;
          game.endDrag();
          if (game) render(game.getState());
        }
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
      });
    }

    return {
      // Shows a game (replaces the previous one).
      show: function (g) {
        if (unsubscribe) unsubscribe();
        game = g;
        const state = g.getState();
        while (gEdges.firstChild) gEdges.removeChild(gEdges.firstChild);
        while (gNodes.firstChild) gNodes.removeChild(gNodes.firstChild);
        edgeEls = state.edges.map(() => gEdges.appendChild(svgEl("line", "edge")));
        nodeEls = state.positions.map((_, i) => {
          const c = svgEl("circle", "node");
          c.setAttribute("r", 13);
          c.setAttribute("data-index", i);
          attachDrag(c, i);
          return gNodes.appendChild(c);
        });
        unsubscribe = g.subscribe((e) => render(e.state));
        render(state);
      }
    };
  }

  UM.view = { createBoardView: createBoardView };
})();
