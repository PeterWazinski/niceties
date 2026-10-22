// Shared JSDoc types (no code).

/** @typedef {{ x: number, y: number }} Pt */

/**
 * One rhomb of the tiling.
 * @typedef {{
 *   id: number,
 *   type: "thick" | "thin",
 *   pts: Pt[],            // the four corners, in order around the tile
 *   cx: number, cy: number,
 *   neighbours: number[], // ids of the tiles that share an edge
 *   ancestors: number[],  // per coarser subdivision level: position of the parent triangle (of the tile's first triangle)
 *   boundary: boolean     // has an edge that no other tile shares
 * }} Tile
 */

/**
 * A generated patch.
 * @typedef {{
 *   tiles: Tile[],
 *   halves: Pt[][],       // triangles whose partner lies outside the patch (not tiles)
 *   seedArea: number,     // area of the seed (= tiles + halves)
 *   seed: string, depth: number
 * }} Patch
 */

export {};
