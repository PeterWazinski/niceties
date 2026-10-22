// Constants and the settings table shared by the logic and the UI.
export const PHI = (1 + Math.sqrt(5)) / 2;

export const MAX_DEPTH = 5;
export const WARN_TILES = 250;  // above this a puzzle needs too many swaps
export const MAX_TILES = 700;   // above this the tool refuses to draw

export const SEEDS = ["wheel", "half", "fan"];
export const MAPS = ["plane", "radial"];
export const CENTRES = ["bright", "dark"];

/**
 * The colour sliders (also URL parameters). `maps` lists the colouring modes a slider applies to.
 * @type {{ key: string, label: string, min: number, max: number, step: number, maps: string[] }[]}
 */
export const SLIDERS = [
  { key: "h0", label: "Hue start", min: 0, max: 360, step: 1, maps: ["plane", "radial"] },
  { key: "h1", label: "Hue end", min: 0, max: 360, step: 1, maps: ["plane", "radial"] },
  { key: "s", label: "Saturation", min: 0, max: 100, step: 1, maps: ["plane", "radial"] },
  { key: "l", label: "Lightness", min: 0, max: 100, step: 1, maps: ["plane", "radial"] },
  { key: "ds", label: "Saturation slope", min: -100, max: 100, step: 0.5, maps: ["plane", "radial"] },
  { key: "dl", label: "Lightness slope", min: -100, max: 100, step: 0.5, maps: ["plane", "radial"] },
  { key: "rot", label: "Rotation", min: 0, max: 359, step: 1, maps: ["plane", "radial"] },
  { key: "dt", label: "Thin tile lightness", min: -30, max: 30, step: 1, maps: ["plane", "radial"] },
  { key: "gap", label: "Gap", min: 0, max: 6, step: 0.5, maps: ["plane", "radial"] }
];

/**
 * @typedef {{ seed: string, depth: number, map: string, h0: number, h1: number, s: number, l: number,
 *   ctr: string, ds: number, dl: number, rot: number, dt: number, gap: number, shuffle: number, sw: number, anchors: string }} Settings
 */

/** @type {Settings} */
export const DEFAULTS = {
  seed: "wheel", depth: 3, map: "plane", ctr: "bright",
  h0: 250, h1: 70, s: 60, l: 60, ds: -20, dl: -25, rot: 0, dt: 0, gap: 1,
  shuffle: 0, // seed of the current shuffle, 0 = sorted
  sw: 0,      // target number of minimum swaps for the shuffle, 0 = full shuffle
  anchors: "" // "" = the default anchors of the tiling, "none" = no anchor, else ids of the fixed tiles, comma separated
};
