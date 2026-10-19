// Pixel-level trace extraction from a scanned / photographed EKG.
// Works on ImageData-like objects ({ data: RGBA bytes, width, height }) so it runs
// unchanged in the browser and under node --test.

// "Ink" = darkest channel value. A red/pink grid keeps a high max-channel (R is
// high), a black trace has all channels low — so the trace separates cleanly.
export function inkMap(img) {
  const { data, width, height } = img;
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    out[i] = r > g ? (r > b ? r : b) : (g > b ? g : b);
  }
  return out;
}

// Otsu threshold over a rectangle, clamped to a sane band (the trace is a tiny
// fraction of the pixels, which makes plain Otsu drift on grid-heavy pages).
export function autoThreshold(ink, W, rect) {
  const hist = new Float64Array(256);
  let total = 0;
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) { hist[ink[y * W + x]]++; total++; }
  }
  if (!total) return 100;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sB = 0, best = 0, thr = 100;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (sum - sB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; thr = t; }
  }
  return Math.max(70, Math.min(150, thr));
}

// One lead cell → per-column ink extent. Returns arrays of length (x1 - x0):
//   hi / lo = topmost / bottommost ink row in that column (NaN = no ink)
//   ctr     = mean ink row, cover = fraction of columns with ink.
export function extractCell(ink, W, rect, thr, pad = 0) {
  const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
  // Deep complexes overlap the neighbouring row on a real EKG, so look past the
  // cell edge (pad rows each way); results stay relative to the cell's own top.
  const H = ink.length / W;
  const ey0 = Math.max(0, rect.y0 - pad), ey1 = Math.min(H, rect.y1 + pad);
  const eh = ey1 - ey0, off = rect.y0 - ey0; // off = rows above the cell inside the padded window
  const mask = new Uint8Array(w * eh);
  for (let y = 0; y < eh; y++) {
    const row = (ey0 + y) * W + rect.x0;
    for (let x = 0; x < w; x++) if (ink[row + x] < thr) mask[y * w + x] = 1;
  }

  // 8-connected components; keep the wide ones (the trace), drop text & specks.
  const label = new Int32Array(w * eh);
  const comps = [];
  const stack = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || label[s]) continue;
    const id = comps.length + 1;
    const c = { id, minX: w, maxX: 0, n: 0 };
    stack.push(s); label[s] = id;
    while (stack.length) {
      const p = stack.pop();
      const px = p % w, py = (p - px) / w;
      c.n++;
      if (px < c.minX) c.minX = px;
      if (px > c.maxX) c.maxX = px;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= eh) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (mask[q] && !label[q]) { label[q] = id; stack.push(q); }
        }
      }
    }
    comps.push(c);
  }
  const width = (c) => c.maxX - c.minX + 1;
  let keep = comps.filter(c => width(c) >= 0.12 * w);
  if (!keep.length) keep = comps.filter(c => width(c) >= 0.03 * w);
  const keepSet = new Set(keep.map(c => c.id));

  // Ink runs per column (kept components only).
  const runs = [];
  for (let x = 0; x < w; x++) {
    const rs = [];
    let cur = null;
    for (let y = 0; y < eh; y++) {
      const l = label[y * w + x];
      if (l && keepSet.has(l)) {
        if (cur) cur.bot = y; else { cur = { top: y, bot: y, sum: 0, n: 0 }; rs.push(cur); }
        cur.sum += y; cur.n++;
      } else cur = null;
    }
    runs.push(rs);
  }

  // Follow the trace: text or a neighbouring lead that touches the cell can add
  // extra runs in a column — keep the run continuous with the previous column.
  const inner = (rs) => rs.filter(r => r.bot >= off && r.top < off + h);
  const single = [];
  for (let x = 0; x < w; x++) { const rs = inner(runs[x]); if (rs.length === 1) single.push(rs[0].bot - rs[0].top + 1); }
  single.sort((a, b) => a - b);
  const thin = single.length ? single[single.length >> 1] : 0;
  let anchor = -1;
  let anchorRun = null;
  for (let x = 0; x < w && anchor < 0; x++) {
    const rs = inner(runs[x]);
    if (rs.length === 1 && rs[0].bot - rs[0].top + 1 <= Math.max(3, thin * 1.5)) { anchor = x; anchorRun = rs[0]; }
  }
  const chosen = new Array(w).fill(null);
  const centres = [];
  for (let x = 0; x < w; x++) { const rs = inner(runs[x]); if (rs.length === 1) centres.push(rs[0].sum / rs[0].n); }
  centres.sort((a, b) => a - b);
  const baseY = centres.length ? centres[centres.length >> 1] : off + h / 2;
  const gap = (a, b) => Math.max(0, a.top - b.bot, b.top - a.bot);
  const pick = (rs, prev) => {
    if (!rs.length) return null;
    if (!prev) return rs.length === 1 ? rs[0] : rs.reduce((a, b) => (b.n > a.n ? b : a));
    let best = rs[0], bd = Infinity;
    for (const r of rs) {
      // Continuous with the previous column first; among equals prefer the run
      // nearest the baseline (text and neighbouring leads sit away from it).
      const d = gap(r, prev) * 1000 + Math.abs(r.sum / r.n - baseY);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  };
  if (anchor >= 0) {
    chosen[anchor] = anchorRun;
    for (let x = anchor + 1, prev = chosen[anchor]; x < w; x++) { const r = pick(runs[x], prev); chosen[x] = r; if (r) prev = r; }
    for (let x = anchor - 1, prev = chosen[anchor]; x >= 0; x--) { const r = pick(runs[x], prev); chosen[x] = r; if (r) prev = r; }
  } else {
    for (let x = 0; x < w; x++) chosen[x] = pick(runs[x], null);
  }

  const hi = new Float32Array(w).fill(NaN), lo = new Float32Array(w).fill(NaN), ctr = new Float32Array(w).fill(NaN);
  let covered = 0;
  for (let x = 0; x < w; x++) {
    const r = chosen[x];
    if (r) { hi[x] = r.top - off; lo[x] = r.bot - off; ctr[x] = r.sum / r.n - off; covered++; }
  }
  return { hi, lo, ctr, cover: w ? covered / w : 0, w, h };
}

// Linear gap fill (inside the trace), nearest-value at the ends.
export function fillGaps(a) {
  const n = a.length;
  let first = -1, last = -1;
  for (let i = 0; i < n; i++) if (!Number.isNaN(a[i])) { if (first < 0) first = i; last = i; }
  if (first < 0) return false;
  for (let i = 0; i < first; i++) a[i] = a[first];
  for (let i = last + 1; i < n; i++) a[i] = a[last];
  let i = first;
  while (i <= last) {
    if (!Number.isNaN(a[i])) { i++; continue; }
    let j = i;
    while (Number.isNaN(a[j])) j++;
    for (let k = i; k < j; k++) a[k] = a[i - 1] + ((a[j] - a[i - 1]) * (k - i + 1)) / (j - i + 1);
    i = j;
  }
  return true;
}

export const median = (xs) => {
  const v = xs.filter(x => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
