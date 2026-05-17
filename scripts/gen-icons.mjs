// Dependency-free PNG icon generator for the EKG Reader PWA.
// Rasterizes a simple ECG glyph and encodes PNGs using only Node's zlib.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const BG = [6, 13, 20, 255];      // #060d14
const GRID = [20, 56, 36, 255];   // #143824
const LINE = [0, 230, 118, 255];  // #00e676

// CRC32
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIcon(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const o = (y * size + x) * 4;
    buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = c[3];
  };
  // Background
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG);

  // Faint grid
  const gridStep = Math.max(8, Math.round(size / 12));
  for (let g = 0; g < size; g += gridStep) {
    for (let p = 0; p < size; p++) { set(g, p, GRID); set(p, g, GRID); }
  }

  // Safe area: maskable icons need content inside the central ~80%.
  const pad = maskable ? size * 0.2 : size * 0.1;
  const innerW = size - pad * 2;
  const mid = size / 2;

  // Normalized ECG waveform control points (x 0..1, y where 0=top,1=bottom; 0.5=baseline)
  const pts = [
    [0.00, 0.5], [0.18, 0.5], [0.30, 0.5], [0.36, 0.62],
    [0.42, 0.06], [0.48, 0.86], [0.54, 0.5], [0.68, 0.5],
    [0.78, 0.42], [0.86, 0.5], [1.00, 0.5],
  ];
  const amp = innerW * 0.42;
  const px = (t) => Math.round(pad + t * innerW);
  const py = (v) => Math.round(mid + (v - 0.5) * amp);

  const thick = Math.max(2, Math.round(size / 42));
  const stamp = (cx, cy) => {
    for (let dy = -thick; dy <= thick; dy++)
      for (let dx = -thick; dx <= thick; dx++)
        if (dx * dx + dy * dy <= thick * thick) set(cx + dx, cy + dy, LINE);
  };
  for (let i = 0; i < pts.length - 1; i++) {
    let x0 = px(pts[i][0]), y0 = py(pts[i][1]);
    const x1 = px(pts[i + 1][0]), y1 = py(pts[i + 1][1]);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      stamp(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  return encodePNG(size, size, buf);
}

mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-512-maskable.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];
for (const [name, size, maskable] of targets) {
  writeFileSync(join(OUT_DIR, name), makeIcon(size, { maskable }));
  console.log(`wrote icons/${name} (${size}x${size}${maskable ? ", maskable" : ""})`);
}
