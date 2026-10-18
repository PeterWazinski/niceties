// Board geometry: a grid is an array of 81 numbers, 0 = empty, row-major.
export const SIZE = 9;
export const CELLS = 81;

export const ROW = Array.from({ length: CELLS }, (_, i) => Math.floor(i / SIZE));
export const COL = Array.from({ length: CELLS }, (_, i) => i % SIZE);
export const BOX = Array.from({ length: CELLS }, (_, i) => Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3));

// The 27 units: 9 rows, 9 columns, 9 boxes (each a list of 9 cell indices).
export const UNITS = [];
for (let u = 0; u < SIZE; u++) UNITS.push(Array.from({ length: SIZE }, (_, k) => u * SIZE + k));
for (let u = 0; u < SIZE; u++) UNITS.push(Array.from({ length: SIZE }, (_, k) => k * SIZE + u));
for (let u = 0; u < SIZE; u++) {
  const r0 = Math.floor(u / 3) * 3, c0 = (u % 3) * 3;
  UNITS.push(Array.from({ length: SIZE }, (_, k) => (r0 + Math.floor(k / 3)) * SIZE + c0 + (k % 3)));
}

// The 20 cells sharing a row, column or box with each cell.
export const PEERS = Array.from({ length: CELLS }, (_, i) => {
  const set = new Set();
  for (let j = 0; j < CELLS; j++) {
    if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) set.add(j);
  }
  return [...set];
});

// "53..7...." style strings ('0' or '.' = empty) to a grid and back.
export function parseGrid(str) {
  const s = str.replace(/\s+/g, "");
  if (s.length !== CELLS) throw new Error("grid string must have 81 characters");
  return Array.from(s, (ch) => (ch === "." ? 0 : Number(ch)));
}

export function gridToString(grid) {
  return grid.map((d) => (d === 0 ? "." : String(d))).join("");
}
