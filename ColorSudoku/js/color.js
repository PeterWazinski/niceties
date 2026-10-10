// Colour adjustments for the digit palette: saturation, vibrance and tint (hue rotation).
// Works on "#rrggbb" strings; all sliders use -100..100 (tint: -180..180 degrees), 0 = unchanged.
(function (root) {
  "use strict";

  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    let h = 0, s = 0;
    if (d > 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  function hslToHex(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(v * 255).toString(16).padStart(2, "0");
    };
    return "#" + f(0) + f(8) + f(4);
  }

  function adjust(hex, o) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const c = hexToHsl(hex);
    let s = c.s;
    // Saturation: scales every colour equally (-100 = grey, +100 = double).
    s = Math.min(1, s * (1 + o.saturation / 100));
    // Vibrance: lifts dull colours more than vivid ones (negative values mute the vivid ones more).
    const v = o.vibrance / 100;
    s = v >= 0 ? s + (1 - s) * v : s * (1 + v * (0.5 + 0.5 * s));
    const h = (((c.h + o.tint) % 360) + 360) % 360;
    return hslToHex(h, Math.max(0, Math.min(1, s)), c.l);
  }

  const api = { adjust, hexToHsl, hslToHex };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ColorSudokuColor = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
