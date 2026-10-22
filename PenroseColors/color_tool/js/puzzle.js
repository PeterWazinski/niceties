// The sorting puzzle state (PRD 6): colours move over fixed tile shapes.
// `perm[i]` = the id of the tile whose SORTED colour tile i shows now. Sorted means perm[i] = i.
// Only tiles of the same type swap, so thick and thin tiles are two independent permutations.

/**
 * @param {string[]} types the type of every tile ("thick" | "thin")
 * @param {Iterable<number>} [anchored] tiles that never move
 */
export function createPuzzle(types, anchored = []) {
  const n = types.length;
  const fixed = new Set(anchored);
  /** @type {number[]} */
  const perm = Array.from({ length: n }, (_, i) => i);
  /** @type {[number, number][]} */
  let history = [];

  const movable = (i) => !fixed.has(i);

  /** Swap the colours of tiles a and b. @returns {"ok" | "refused" | "anchored" | "same"} */
  function swap(a, b, record = true) {
    if (!(a >= 0 && a < n && b >= 0 && b < n) || a === b) return "same";
    if (fixed.has(a) || fixed.has(b)) return "anchored";
    if (types[a] !== types[b]) return "refused";
    [perm[a], perm[b]] = [perm[b], perm[a]];
    if (record) history.push([a, b]);
    return "ok";
  }

  const puzzle = {
    n, perm, types,
    isAnchored: (i) => fixed.has(i),
    swap,
    /** Takes the last swap back. @returns {boolean} false if there is nothing to undo */
    undo() {
      const last = history.pop();
      if (!last) return false;
      swap(last[0], last[1], false);
      return true;
    },
    /** Back to the sorted state. */
    reset() {
      for (let i = 0; i < n; i++) perm[i] = i;
      history = [];
    },
    /** Swaps made since the last reset or shuffle (undone swaps do not count). */
    get moves() { return history.length; },
    /**
     * Minimum number of swaps that sort the arrangement: tiles - cycles of the permutation.
     * (Exact when all colours are different; tied colours could make it smaller.)
     */
    minimumSwaps() {
      const seen = new Array(n).fill(false);
      let cycles = 0;
      for (let i = 0; i < n; i++) {
        if (seen[i]) continue;
        cycles++;
        for (let j = i; !seen[j]; j = perm[j]) seen[j] = true;
      }
      return n - cycles;
    },
    /** True if every tile shows its sorted colour (equal colours count as the same). @param {string[]} colours */
    solved(colours) {
      for (let i = 0; i < n; i++) if (colours[perm[i]] !== colours[i]) return false;
      return true;
    },
    /** How many swaps a shuffle can need at most: for every type, one less than the movable tiles of it. */
    capacity() {
      const count = { thick: 0, thin: 0 };
      for (let i = 0; i < n; i++) if (movable(i)) count[types[i]]++;
      return Math.max(0, count.thick - 1) + Math.max(0, count.thin - 1);
    },
    /** Random permutation inside each type (a full shuffle). @param {{ shuffle: (a: any[]) => any[] }} rng */
    shuffleFull(rng) {
      this.reset();
      for (const type of ["thick", "thin"]) {
        const ids = [];
        for (let i = 0; i < n; i++) if (movable(i) && types[i] === type) ids.push(i);
        const values = rng.shuffle(ids.slice());
        ids.forEach((id, k) => { perm[id] = values[k]; });
      }
    },
    /**
     * A shuffle whose minimum swap count is exactly `k` (or the capacity, if that is smaller):
     * k swaps that each join two different cycles.
     * @param {{ int: (n: number) => number }} rng
     * @param {number} k
     * @returns {number} the minimum swap count reached
     */
    shuffleSwaps(rng, k) {
      this.reset();
      const ids = [];
      for (let i = 0; i < n; i++) if (movable(i)) ids.push(i);
      const goal = Math.min(Math.max(0, Math.round(k)), this.capacity());
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      let done = 0;
      while (done < goal) {
        let a = -1, b = -1;
        for (let tries = 0; tries < 30 && a < 0; tries++) {
          const p = ids[rng.int(ids.length)], q = ids[rng.int(ids.length)];
          if (p !== q && types[p] === types[q] && find(p) !== find(q)) { a = p; b = q; }
        }
        if (a < 0) { // the random search failed (few components left): scan for any joining pair
          for (const p of ids) {
            for (const q of ids) if (p < q && types[p] === types[q] && find(p) !== find(q)) { a = p; b = q; break; }
            if (a >= 0) break;
          }
        }
        if (a < 0) break;
        [perm[a], perm[b]] = [perm[b], perm[a]];
        parent[find(a)] = find(b);
        done++;
      }
      history = [];
      return done;
    }
  };
  return puzzle;
}
