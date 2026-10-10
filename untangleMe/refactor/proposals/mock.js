// Shared demo logic for the UI proposals. NOT the real game - just enough to
// make the mock-ups draggable so the look & feel can be judged.
(function () {
  var W = 800, H = 560, PAD = 34, NS = "http://www.w3.org/2000/svg";
  // Stacked triangulation of 8 nodes (planar, 18 edges).
  var E = [[0,1],[1,2],[0,2],[3,0],[3,1],[3,2],[4,0],[4,1],[4,3],
           [5,1],[5,2],[5,3],[6,0],[6,2],[6,3],[7,0],[7,1],[7,4]];
  var SOLVED = [[.5,.04],[.04,.92],[.96,.92],[.55,.62],[.33,.58],[.5,.82],[.65,.5],[.35,.4]];
  var pos = [[.18,.15],[.78,.12],[.45,.55],[.88,.62],[.1,.7],[.62,.9],[.3,.3],[.7,.4]];

  var svg = document.getElementById("board");
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  var gE = el("g"), gM = el("g"), gN = el("g");
  svg.appendChild(gE); svg.appendChild(gM); svg.appendChild(gN);

  var edges = E.map(function (e) { var l = el("line"); l.setAttribute("class", "edge"); gE.appendChild(l); return l; });
  var nodes = pos.map(function (_, i) {
    var c = el("circle"); c.setAttribute("class", "node"); c.setAttribute("r", 13);
    gN.appendChild(c); drag(c, i); return c;
  });
  var moves = 0, t0 = null, solved = false, tick = null;

  function el(n) { return document.createElementNS(NS, n); }
  function px(p) { return [PAD + p[0] * (W - 2 * PAD), PAD + p[1] * (H - 2 * PAD)]; }
  function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
  function hit(a, b) { // proper segment intersection, shared endpoints ignored
    if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) return null;
    var p = pos[a[0]], r = [pos[a[1]][0] - p[0], pos[a[1]][1] - p[1]],
        q = pos[b[0]], s = [pos[b[1]][0] - q[0], pos[b[1]][1] - q[1]],
        d = cross(r, s), qp = [q[0] - p[0], q[1] - p[1]];
    if (!d) return null;
    var t = cross(qp, s) / d, u = cross(qp, r) / d;
    return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6 ? [p[0] + t * r[0], p[1] + t * r[1]] : null;
  }
  function bind(k, v) {
    [].forEach.call(document.querySelectorAll("[data-bind=" + k + "]"), function (n) { n.textContent = v; });
  }
  function render() {
    var bad = edges.map(function () { return false; }), badN = pos.map(function () { return false; }),
        count = 0, marks = [];
    for (var i = 0; i < E.length; i++) for (var j = i + 1; j < E.length; j++) {
      var h = hit(E[i], E[j]);
      if (h) { count++; bad[i] = bad[j] = true;
        badN[E[i][0]] = badN[E[i][1]] = badN[E[j][0]] = badN[E[j][1]] = true; marks.push(h); }
    }
    E.forEach(function (e, i) {
      var a = px(pos[e[0]]), b = px(pos[e[1]]), l = edges[i];
      l.setAttribute("x1", a[0]); l.setAttribute("y1", a[1]);
      l.setAttribute("x2", b[0]); l.setAttribute("y2", b[1]);
      l.setAttribute("class", "edge" + (bad[i] ? " x" : ""));
    });
    nodes.forEach(function (c, i) {
      var p = px(pos[i]);
      c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]);
      c.setAttribute("class", "node" + (badN[i] ? " x" : ""));
    });
    while (gM.firstChild) gM.removeChild(gM.firstChild);
    marks.forEach(function (m) {
      var p = px(m), c = el("circle");
      c.setAttribute("class", "mark"); c.setAttribute("r", 5);
      c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); gM.appendChild(c);
    });
    bind("cross", count); bind("moves", moves);
    solved = count === 0;
    document.body.setAttribute("data-solved", solved);
    if (solved && tick) { clearInterval(tick); tick = null; }
  }
  function time() { return t0 ? ((Date.now() - t0) / 1000).toFixed(1) : "0.0"; }
  function startClock() {
    if (t0) return;
    t0 = Date.now();
    tick = setInterval(function () { bind("timer", time()); }, 100);
  }
  function drag(c, i) {
    c.addEventListener("pointerdown", function (ev) {
      c.setPointerCapture(ev.pointerId); startClock();
      c.classList.add("grab");
      function move(e) {
        var m = svg.getScreenCTM().inverse(), pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY; pt = pt.matrixTransform(m);
        pos[i] = [Math.max(0, Math.min(1, (pt.x - PAD) / (W - 2 * PAD))),
                  Math.max(0, Math.min(1, (pt.y - PAD) / (H - 2 * PAD)))];
        render();
      }
      function up() { c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up);
        c.classList.remove("grab"); moves++; render(); bind("timer", time()); }
      c.addEventListener("pointermove", move); c.addEventListener("pointerup", up);
    });
  }
  function reset() {
    do { pos = pos.map(function () { return [Math.random(), Math.random()]; }); render(); }
    while (document.body.getAttribute("data-solved") === "true");
    moves = 0; t0 = null; if (tick) clearInterval(tick); tick = null;
    bind("timer", "0.0"); render();
  }
  var b;
  if ((b = document.getElementById("new"))) b.onclick = reset;
  if ((b = document.getElementById("demo"))) b.onclick = function () {
    pos = SOLVED.map(function (p) { return p.slice(); }); startClock(); render(); bind("timer", time());
  };
  render();
})();
