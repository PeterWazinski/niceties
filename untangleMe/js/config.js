// Game constants. Change values here, not in the other modules.
(function () {
  const UM = (globalThis.UM = globalThis.UM || {});

  UM.config = {
    MIN_NODES: 6,
    MAX_NODES: 30,
    DEFAULT_NODES: 8,
    PRESETS: [
      { label: "Easy", n: 6 },
      { label: "Normal", n: 8 },
      { label: "Hard", n: 14 },
      { label: "Insane", n: 25 }
    ],
    // 1 = as many edges as fit without crossings (maximal planar graph).
    EDGE_DENSITY: 1,
    MAX_RANDOM_SEED: 99999,
    SCRAMBLE_MAX_ATTEMPTS: 10000,
    // Board coordinates: nodes live in [0,1]^2, drawn into this viewBox.
    BOARD: { width: 800, height: 560, padding: 34 },
    // Drawn node radius in board units; the layout keeps nodes clear of edges by this much plus a gap.
    NODE_RADIUS: 13,
    // Screens whose shorter side is below this (CSS px) get the "too small" notice.
    MIN_SCREEN_SIDE: 600,
    THEMES: ["blueprint", "neon"],
    DEFAULT_THEME: "blueprint"
  };
})();
