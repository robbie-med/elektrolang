// Test helper: renders an ECG case (leads.js model) as a raster "scan" — pink
// grid, black trace, lead-label blobs, leads overlapping their neighbours — so
// the extractor can be verified against known ground truth. Not used by the app.

import { traceLead, LAYOUT } from "../leads.js";

export function renderEkg(ecg, o = {}) {
  const { pxPerMm = 6, hr = ecg.meta.hr || 72, thick = 2, colMm = 62.5, rowMm = 30, marginMm = 10,
    grid = [255, 200, 200], gridMajor = [255, 150, 150], ink = [0, 0, 0], jitter = 0 } = o;
  const cols = 4, rows = 3;
  const Wmm = cols * colMm + 2 * marginMm, Hmm = rows * rowMm + 2 * marginMm;
  const width = Math.round(Wmm * pxPerMm), height = Math.round(Hmm * pxPerMm);
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const put = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = (y * width + x) * 4;
    data[p] = c[0]; data[p + 1] = c[1]; data[p + 2] = c[2];
  };
  for (let mmx = 0; mmx <= Wmm; mmx++) for (let y = 0; y < height; y++) put(mmx * pxPerMm, y, mmx % 5 ? grid : gridMajor);
  for (let mmy = 0; mmy <= Hmm; mmy++) for (let x = 0; x < width; x++) put(x, mmy * pxPerMm, mmy % 5 ? grid : gridMajor);

  const RR = 60000 / hr;
  const msPerMm = 40; // 25 mm/s
  const disc = (x, y) => {
    const r = thick / 2;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      if (dx * dx + dy * dy <= r * r + 0.3) put(x + dx, y + dy, ink);
    }
  };
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const name = LAYOUT[r][c];
      const { pts } = traceLead(ecg.leads[name], ecg.iv);
      const sample = (t) => {
        if (t <= pts[0][0] || t >= pts[pts.length - 1][0]) return 0;
        for (let i = 1; i < pts.length; i++) {
          if (pts[i][0] >= t) {
            const [t0, y0] = pts[i - 1], [t1, y1] = pts[i];
            return t1 === t0 ? y1 : y0 + ((y1 - y0) * (t - t0)) / (t1 - t0);
          }
        }
        return 0;
      };
      const x0mm = marginMm + c * colMm, base = (marginMm + r * rowMm + rowMm / 2) * pxPerMm;
      let prev = null;
      for (let xp = 0; xp <= colMm * pxPerMm; xp += 0.25) {
        const tau = (xp / pxPerMm) * msPerMm + 300;
        const k = Math.floor((tau - 400 + 0.35 * RR) / RR);
        const phi = tau - 400 - k * RR;
        const y = base - sample(phi) * pxPerMm + (jitter ? rnd() * jitter : 0);
        const x = x0mm * pxPerMm + xp;
        if (prev) {
          const n = Math.ceil(Math.max(Math.abs(x - prev[0]), Math.abs(y - prev[1])) * 2);
          for (let i = 1; i <= n; i++) disc(prev[0] + ((x - prev[0]) * i) / n, prev[1] + ((y - prev[1]) * i) / n);
        } else disc(x, y);
        prev = [x, y];
      }
      // lead label: a dark blob like printed text
      const lx = x0mm * pxPerMm + 3 * pxPerMm, ly = (marginMm + r * rowMm) * pxPerMm + 2 * pxPerMm;
      for (let dy = 0; dy < 1.6 * pxPerMm; dy++) for (let dx = 0; dx < 4 * pxPerMm; dx++) put(lx + dx, ly + dy, ink);
    }
  }
  return {
    img: { data, width, height },
    block: { x0: marginMm * pxPerMm, y0: marginMm * pxPerMm, x1: (marginMm + cols * colMm) * pxPerMm, y1: (marginMm + rows * rowMm) * pxPerMm },
    pxPerMm,
  };
}
