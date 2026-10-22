// Seeded random numbers (mulberry32), so shuffles and tests are reproducible.
/** @param {number} seed */
export function createRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Integer in [0, n). @param {number} n */
    int: (n) => Math.floor(next() * n),
    /** In-place Fisher-Yates shuffle; returns the array. @param {any[]} arr */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  };
}
