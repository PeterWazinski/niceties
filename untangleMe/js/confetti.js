// Subtle confetti burst on a canvas. The environment (animation frame, clock,
// reduced-motion check) is injectable so the module can be unit tested.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});

  const COLORS = ["#ff2e93", "#7c5cff", "#00f0c8", "#ffd23f", "#ffffff", "#6ec6ff"];

  // canvas: a <canvas> (or a stand-in with getContext/width/height/hidden).
  // env (all optional): raf, caf, now, reducedMotion(), random(), count, duration.
  function createConfetti(canvas, env) {
    const e = env || {},
          raf = e.raf || ((fn) => requestAnimationFrame(fn)),
          caf = e.caf || ((id) => cancelAnimationFrame(id)),
          now = e.now || (() => performance.now()),
          reducedMotion = e.reducedMotion || (() => false),
          random = e.random || Math.random,
          count = e.count || 120,
          duration = e.duration || 4500;

    let particles = [], active = false, startedAt = 0, frameId = null, fired = 0, last = 0;

    function width() { return canvas.clientWidth || canvas.width; }
    function height() { return canvas.clientHeight || canvas.height; }

    function spawn() {
      const w = width();
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: random() * w,
          y: -10 - random() * 80,
          vx: (random() - 0.5) * 90,         // px / s
          vy: 60 + random() * 120,
          size: 4 + random() * 5,
          rot: random() * Math.PI * 2,
          vr: (random() - 0.5) * 5,
          color: COLORS[Math.floor(random() * COLORS.length)]
        });
      }
    }

    function clear(ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }

    function finish() {
      active = false;
      particles = [];
      if (frameId !== null) { caf(frameId); frameId = null; }
      const ctx = canvas.getContext("2d");
      if (ctx) clear(ctx);
      canvas.hidden = true;
    }

    function frame() {
      frameId = null;
      const t = now(), dt = Math.min(0.05, Math.max(0, (t - last) / 1000)), ctx = canvas.getContext("2d");
      last = t;
      if (t - startedAt >= duration) { finish(); return; }
      const fade = Math.min(1, (duration - (t - startedAt)) / 600);
      clear(ctx);
      ctx.globalAlpha = fade;
      particles.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      frameId = raf(frame);
    }

    return {
      // Returns true if a burst was started.
      fire: function () {
        if (active || reducedMotion()) return false;
        // Show first: a hidden canvas has no layout size to measure.
        canvas.hidden = false;
        const dpr = (globalThis.devicePixelRatio || 1);
        canvas.width = Math.round((canvas.clientWidth || canvas.width) * Math.min(dpr, 2));
        canvas.height = Math.round((canvas.clientHeight || canvas.height) * Math.min(dpr, 2));
        // Particles are laid out in CSS px; scale the context to match.
        const ctx = canvas.getContext("2d");
        if (ctx.setTransform) ctx.setTransform(canvas.width / (width() || 1), 0, 0, canvas.height / (height() || 1), 0, 0);
        spawn();
        active = true;
        startedAt = last = now();
        fired++;
        if (canvas.dataset) canvas.dataset.fired = String(fired);
        frameId = raf(frame);
        return true;
      },
      stop: function () { if (active) finish(); },
      isActive: function () { return active; },
      particleCount: function () { return particles.length; },
      firedCount: function () { return fired; }
    };
  }

  UM.confetti = { createConfetti: createConfetti };
})();
