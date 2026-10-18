// Generates the app icons (plain PNGs, no dependencies): a white Sudoku board on black.
// Run: node tools/make-icons.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../icons");

function render(size) {
  const px = Buffer.alloc(size * size * 3);
  const margin = Math.round(size * 0.14); // inside the 80% safe zone of maskable icons
  const board = size - 2 * margin;
  const thin = Math.max(1, Math.round(size / 200)), thick = Math.max(2, Math.round(size / 48));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 17; // background
      const bx = x - margin, by = y - margin;
      if (bx >= 0 && by >= 0 && bx < board && by < board) {
        v = 255;
        const near = (p, k, w) => Math.abs(p - (board * k) / 9) < w / 2 || (k === 0 && p < w / 2) || (k === 9 && p > board - w / 2);
        for (let k = 0; k <= 9; k++) {
          const w = k % 3 === 0 ? thick : thin;
          if (near(bx, k, w) || near(by, k, w)) { v = 17; break; }
        }
      }
      const o = (y * size + x) * 3;
      px[o] = px[o + 1] = px[o + 2] = v;
    }
  }
  return px;
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const px = render(size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bit, RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))
  ]);
}

fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-512.png", 512], ["apple-touch-icon.png", 180]]) {
  fs.writeFileSync(path.join(out, name), png(size));
  console.log("wrote", name, size + "x" + size);
}
