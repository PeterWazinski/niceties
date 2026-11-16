// Shockwave burst for a solved game in the Star Wars scheme (the other schemes keep
// the confetti): a soft flash on the last cell, a flat ring of light racing outward
// and sparks flying off (PRD 3.6). No pictures of ships or stations, just light.
// Same shape as confetti.js: the environment (animation frame, clock, reduced-motion
// check, random) is injectable for unit tests.

const SPARK_COLORS = ["255,255,255", "170,215,255", "170,215,255", "255,200,120"];

// canvas: a <canvas> (or a stand-in with getContext/width/height/hidden).
// env (all optional): raf, caf, now, reducedMotion(), random(), count, duration.
export function createShockwave(canvas, env = {}) {
  const raf = env.raf || ((fn) => requestAnimationFrame(fn)),
        caf = env.caf || ((id) => cancelAnimationFrame(id)),
        now = env.now || (() => performance.now()),
        reducedMotion = env.reducedMotion || (() => false),
        random = env.random || Math.random,
        count = env.count || 220,
        duration = env.duration || 1700;

  let sparks = [], active = false, startedAt = 0, frameId = null, fired = 0, origin = { x: 0, y: 0 };

  const width = () => canvas.clientWidth || canvas.width;
  const height = () => canvas.clientHeight || canvas.height;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);

  function spawn() {
    sparks = [];
    for (let i = 0; i < count; i++) {
      sparks.push({
        a: random() * Math.PI * 2,          // direction
        v: 120 + random() * 520,            // px over the life time
        len: 6 + random() * 22,             // streak length
        life: 0.7 + random() * 0.9,         // s
        flat: 0.55 + random() * 0.45,       // squashed like the ring
        color: SPARK_COLORS[Math.floor(random() * SPARK_COLORS.length)]
      });
    }
  }

  const clear = (ctx) => ctx.clearRect(0, 0, canvas.width, canvas.height);

  function finish() {
    active = false;
    sparks = [];
    if (frameId !== null) { caf(frameId); frameId = null; }
    const ctx = canvas.getContext("2d");
    if (ctx) clear(ctx);
    canvas.hidden = true;
  }

  // One frame at `t` seconds after the start.
  function draw(ctx, t) {
    const { x: ox, y: oy } = origin;
    const D = Math.hypot(width(), height());
    clear(ctx);
    // soft flash, once (no strobing): fades within 0.45 s
    const f = clamp(1 - t / 0.45);
    if (f > 0 && ctx.createRadialGradient) {
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, 40 + 140 * (1 - f));
      g.addColorStop(0, `rgba(255,255,255,${0.85 * f})`);
      g.addColorStop(0.35, `rgba(150,210,255,${0.55 * f})`);
      g.addColorStop(1, "rgba(80,160,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width(), height());
    }
    // the flat ring, slightly tilted, three strokes for the glow
    const p = ease(t / 1.5);
    const rx = 10 + p * D * 0.85, ry = rx * 0.22, ra = clamp(1 - t / 1.6);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(-0.18);
    for (const [wid, col, al] of [[18, "80,170,255", 0.25], [7, "160,215,255", 0.6], [2.2, "255,255,255", 0.95]]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${col},${al * ra})`;
      ctx.lineWidth = wid * (1 - 0.5 * p);
      ctx.stroke();
    }
    ctx.restore();
    // sparks
    ctx.lineWidth = 1.6;
    for (const k of sparks) {
      const lt = t / k.life;
      if (lt >= 1) continue;
      const d = k.v * ease(t / (k.life * 1.1)) * 1.4;
      const dx = Math.cos(k.a), dy = Math.sin(k.a) * k.flat;
      const x = ox + dx * d, y = oy + dy * d;
      ctx.strokeStyle = `rgba(${k.color},${1 - lt})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dx * k.len, y - dy * k.len);
      ctx.stroke();
    }
  }

  function frame() {
    frameId = null;
    const t = now() - startedAt;
    if (t >= duration) { finish(); return; }
    draw(canvas.getContext("2d"), t / 1000);
    frameId = raf(frame);
  }

  return {
    // at = { x, y } in CSS px (the last filled cell); default: the middle of the screen.
    // Returns true if a burst was started.
    fire(at) {
      if (active || reducedMotion()) return false;
      canvas.hidden = false; // show first: a hidden canvas has no layout size
      const dpr = globalThis.devicePixelRatio || 1;
      canvas.width = Math.round((canvas.clientWidth || canvas.width) * Math.min(dpr, 2));
      canvas.height = Math.round((canvas.clientHeight || canvas.height) * Math.min(dpr, 2));
      const ctx = canvas.getContext("2d");
      if (ctx.setTransform) ctx.setTransform(canvas.width / (width() || 1), 0, 0, canvas.height / (height() || 1), 0, 0);
      origin = at && Number.isFinite(at.x) && Number.isFinite(at.y) ? { x: at.x, y: at.y } : { x: width() / 2, y: height() / 2 };
      spawn();
      active = true;
      startedAt = now();
      fired++;
      if (canvas.dataset) {
        canvas.dataset.fired = String(fired);
        canvas.dataset.origin = `${Math.round(origin.x)},${Math.round(origin.y)}`; // for tests
      }
      frameId = raf(frame);
      return true;
    },
    stop() { if (active) finish(); },
    isActive: () => active,
    sparkCount: () => sparks.length,
    firedCount: () => fired,
    origin: () => ({ ...origin })
  };
}
