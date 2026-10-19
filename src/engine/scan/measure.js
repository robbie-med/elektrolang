// Trace → ECG model. Takes the lead cells found in a scan and fills the same
// structure the DRAW / MEASURE tabs edit (meta, iv, leads), so the existing
// reasoning engine runs on scanned tracings unchanged.
// Units match leads.js: amplitudes in mm at 10 mm/mV, times in ms.

import { LAYOUT, LEADS, blankLead, newCase } from "../leads.js";
import { inkMap, autoThreshold, extractCell, fillGaps, median } from "./image.js";

const NaNs = (n) => new Float32Array(n).fill(NaN);

// ── signal preparation ─────────────────────────────────────────────────────
function prepLead(cell, g) {
  const { hi, lo, ctr } = cell;
  const ok = fillGaps(hi) && fillGaps(lo) && fillGaps(ctr);
  if (!ok) return null;
  const w = ctr.length;
  const base = median(Array.from(ctr));
  const th = median(Array.from(lo, (v, i) => v - hi[i] + 1));
  const half = Math.max(0, (th - 1) / 2);
  const mm = (y) => ((base - y) / g.pxPerMm) * (10 / g.gain);

  // Bin columns so one sample ≈ 4 ms or coarser.
  const k = Math.max(1, Math.round(4 / g.msPerPx));
  const n = Math.floor(w / k);
  const H = new Float32Array(n), L = new Float32Array(n), C = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    let h = -Infinity, l = Infinity, c = 0;
    for (let x = j * k; x < (j + 1) * k; x++) {
      let top = hi[x] + half, bot = lo[x] - half;
      if (top > bot) top = bot = (hi[x] + lo[x]) / 2;
      h = Math.max(h, mm(top)); l = Math.min(l, mm(bot)); c += mm(ctr[x]);
    }
    H[j] = h; L[j] = l; C[j] = c / k;
  }
  // Light smoothing on the centre line only (envelopes keep their peaks).
  const Cs = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const a = C[Math.max(0, j - 1)], b = C[j], c = C[Math.min(n - 1, j + 1)];
    Cs[j] = (a + 2 * b + c) / 4;
  }
  const act = new Float32Array(n);
  const scale = 4 / (k * g.msPerPx);
  for (let j = 1; j < n; j++) act[j] = Math.max(Math.abs(H[j] - H[j - 1]), Math.abs(L[j] - L[j - 1])) * scale;
  // Slope over the 3 samples *before* each point: sees the slow, sustained start
  // of a q wave, ignores 1-px staircase jitter, and never looks into the stroke
  // that is still ahead of it (walking backwards from the onset).
  const slow = new Float32Array(n);
  for (let j = 3; j < n; j++) slow[j] = Math.max(Math.abs(H[j] - H[j - 3]), Math.abs(L[j] - L[j - 3])) * scale / 3;
  return { H, L, C: Cs, act, slow, n, dt: k * g.msPerPx, cover: cell.cover, thMs: Math.max(0, th - 1) * g.msPerPx };
}

// ── QRS detection on the activity trace of one column of leads ─────────────
function findBeats(act, dt) {
  const n = act.length;
  const ms = (x) => Math.max(1, Math.round(x / dt));
  const cand = [];
  for (let j = 1; j < n - 1; j++) if (act[j] >= 0.15 && act[j] >= act[j - 1] && act[j] > act[j + 1]) cand.push(j);
  cand.sort((a, b) => act[b] - act[a]);
  const peaks = [];
  for (const j of cand) if (peaks.every(p => Math.abs(p - j) > ms(200))) peaks.push(j);
  if (!peaks.length) return [];
  const mx = act[peaks[0]];
  const ref = median(peaks.filter(j => act[j] >= 0.35 * mx).map(j => act[j]));
  const low = Math.max(0.12, 0.22 * ref);
  const qn = ms(24);
  const expand = (j, dir) => {
    let k = j, quiet = 0, last = j;
    while (k + dir >= 0 && k + dir < n && quiet < qn) {
      k += dir;
      if (act[k] > low) { last = k; quiet = 0; } else quiet++;
    }
    return last;
  };
  return peaks.filter(j => act[j] >= 0.4 * ref).sort((a, b) => a - b).map(j => {
    const on = expand(j, -1), off = expand(j, 1);
    return { c: j, on, off };
  }).filter(b => b.on > 1 && b.off < n - 2);
}

// Per-lead refinement of the beat extents. The column-wide detector is tuned to
// the steepest lead, so it can clip a small initial q (or a late S tail) in a
// lead whose own slopes are gentler.
function refine(sig, beat) {
  const { act, slow, n, dt } = sig;
  const ms = (x) => Math.max(1, Math.round(x / dt));
  let pk = 0;
  for (let j = beat.on; j <= beat.off; j++) pk = Math.max(pk, act[j]);
  const go = (from, dir, a, low, quiet, limit) => {
    let k = from, q = 0, last = from;
    while (k + dir >= 0 && k + dir < n && q < quiet && Math.abs(k - from) < limit) {
      k += dir;
      if (a[k] > low) { last = k; q = 0; } else q++;
    }
    return last;
  };
  // Backwards: stop at the flat PR segment (so the P wave is never swallowed).
  const on = go(beat.on, -1, slow, 0.05, ms(20), ms(36));
  const off = go(beat.off, 1, act, Math.max(0.15, 0.12 * pk), ms(12), ms(40));
  return { on, off, pk };
}

// ── QRS morphology: alternating turning points → q / R / S / R′ ────────────
function zigzag(v, delta) {
  const piv = [];
  let mode = 0, ref = v[0], candI = 0, candV = v[0];
  for (let i = 1; i < v.length; i++) {
    if (mode === 0) {
      if (v[i] - ref >= delta) { mode = 1; candI = i; candV = v[i]; }
      else if (ref - v[i] >= delta) { mode = -1; candI = i; candV = v[i]; }
    } else if (mode === 1) {
      if (v[i] > candV) { candI = i; candV = v[i]; }
      else if (candV - v[i] >= delta) { piv.push({ i: candI, t: 1 }); mode = -1; candI = i; candV = v[i]; }
    } else if (v[i] < candV) { candI = i; candV = v[i]; }
    else if (v[i] - candV >= delta) { piv.push({ i: candI, t: -1 }); mode = 1; candI = i; candV = v[i]; }
  }
  if (mode !== 0) piv.push({ i: candI, t: mode });
  return piv;
}

function qrsShape(sig, beat, iso, dt) {
  const adj = sig.thMs / 2; // pen thickness smears a steep stroke by ±½ line width
  const { H, L, C } = sig;
  const a = Math.max(0, beat.on - 1), b = Math.min(sig.n - 1, beat.off + 1);
  const seg = [];
  for (let j = a; j <= b; j++) seg.push(C[j] - iso);
  const piv = zigzag(seg, 0.4).map(p => {
    const j = a + p.i;
    let v;
    if (p.t > 0) { v = -Infinity; for (let k = j - 2; k <= j + 2; k++) if (k >= 0 && k < sig.n) v = Math.max(v, H[k] - iso); }
    else { v = Infinity; for (let k = j - 2; k <= j + 2; k++) if (k >= 0 && k < sig.n) v = Math.min(v, L[k] - iso); }
    return { i: j, v };
  }).filter(p => Math.abs(p.v) >= 0.25);

  const waves = [];
  for (const p of piv) {
    const s = Math.sign(p.v), w = waves[waves.length - 1];
    if (w && w.s === s) { w.n++; if (Math.abs(p.v) > Math.abs(w.v)) { w.v = p.v; w.i = p.i; } }
    else waves.push({ s, v: p.v, i: p.i, n: 1 });
  }
  const o = { q: 0, qDur: 0, r: 0, rpt: NaN, s: 0, r2: 0, frag: waves.some(w => w.n >= 2) };
  let k = 0;
  if (waves[0] && waves[0].s < 0) {
    if (waves[1] && waves[1].s > 0) {
      o.q = -waves[0].v;
      let j = waves[0].i;
      while (j < b && C[j] - iso < -0.1) j++;
      o.qDur = Math.max(8, (j - beat.on) * dt - adj);
      k = 1;
    } else { o.s = -waves[0].v; return o; } // QS
  }
  if (waves[k] && waves[k].s > 0) { o.r = waves[k].v; o.rpt = Math.max(5, (waves[k].i - beat.on) * dt - adj); k++; }
  if (waves[k] && waves[k].s < 0) { o.s = -waves[k].v; k++; }
  // R′ must be a real peak that comes back down before the J point; a rise that
  // simply ends at an elevated J point is ST elevation, not a second R wave.
  if (waves[k] && waves[k].s > 0) {
    const down = waves[k].v - (C[b] - iso);
    if (waves[k].v >= 0.75 && down >= 0.5) o.r2 = waves[k].v;
    k++;
  }
  if (waves.length - k >= 1) o.frag = true;
  return o;
}

// ── one beat in one lead ────────────────────────────────────────────────────
function measureBeat(sig, gbeat, prev, next) {
  const { C, n, dt } = sig;
  const ms = (x) => Math.round(x / dt);
  const out = {};
  const rf = refine(sig, gbeat);
  const beat = { ...gbeat, on: rf.on, off: rf.off };
  const i0 = beat.on - ms(30), i1 = beat.on - ms(6);
  if (i0 < 0) return null;
  let iso = 0, cnt = 0;
  for (let j = i0; j <= i1; j++) { iso += C[j]; cnt++; }
  iso /= cnt;

  Object.assign(out, qrsShape(sig, beat, iso, dt));
  out.qrs = (beat.off - beat.on) * dt - sig.thMs;

  // ST at J + 60 ms
  const sj = beat.off + ms(60);
  if (sj + 1 < n) out.st = (C[sj - 1] + C[sj] + C[sj + 1]) / 3 - iso;

  // T wave: from J + 60 ms until the next P could start
  const tEndCap = Math.min(beat.off + ms(440), next ? next.on - ms(200) : n - 1, n - 2);
  const tStart = beat.off + ms(60);
  if (tEndCap - tStart >= ms(120)) {
    let pk = tStart;
    for (let j = tStart; j <= tEndCap; j++) if (Math.abs(C[j] - iso) > Math.abs(C[pk] - iso)) pk = j;
    const amp = C[pk] - iso;
    out.t = Math.abs(amp) < 0.25 ? 0 : amp;
    if (Math.abs(amp) >= 0.8) {
      const thr = Math.max(0.12, 0.1 * Math.abs(amp));
      let j = pk, run = 0;
      while (j < tEndCap && run < 3) { j++; if (Math.abs(C[j] - iso) <= thr) run++; else run = 0; }
      if (run >= 3) out.qt = (j - 2 - beat.on) * dt;
    }
  }

  // P wave: between the previous T and this QRS
  const pCap = ms(320);
  let pStart = beat.on - pCap;
  if (prev) pStart = Math.max(pStart, prev.off + ms(200));
  const pEnd = beat.on - ms(30);
  if (pStart >= 0 && pEnd - pStart >= ms(100)) {
    let pp = 0, ppI = pStart, pn = 0, pnI = pStart;
    for (let j = pStart; j <= pEnd; j++) {
      const v = C[j] - iso;
      if (v > pp) { pp = v; ppI = j; }
      if (v < pn) { pn = v; pnI = j; }
    }
    const POS = pp >= 0.25, NEG = -pn >= (pp >= 0.25 ? 0.4 : 0.25);
    out.p = 0; out.pNeg = 0; out.pNegDur = 0;
    let mainI = null, mainV = 0;
    if (POS && NEG) {
      out.p = pp; out.pNeg = -pn; mainI = ppI; mainV = pp;
      let a = pnI, b2 = pnI;
      while (a > pStart && C[a] - iso < -0.1) a--;
      while (b2 < pEnd && C[b2] - iso < -0.1) b2++;
      out.pNegDur = (b2 - a) * dt;
    } else if (POS) { out.p = pp; mainI = ppI; mainV = pp; }
    else if (NEG) { out.p = pn; mainI = pnI; mainV = pn; }
    if (mainI != null && Math.abs(mainV) >= 0.8) {
      const thr = Math.max(0.2, 0.15 * Math.abs(mainV));
      let a = mainI, b2 = mainI;
      while (a > pStart && Math.abs(C[a] - iso) > thr) a--;
      while (b2 < pEnd && Math.abs(C[b2] - iso) > thr) b2++;
      out.pr = (beat.on - a) * dt; out.pDur = (b2 - a) * dt;
    }
  }
  return out;
}

const numericKeys = ["q", "qDur", "r", "rpt", "s", "r2", "st", "t", "p", "pNeg", "pNegDur"];

// ── public entry point ─────────────────────────────────────────────────────
// opts: { block:{x0,y0,x1,y1}, pxPerMm, speed=25, gain=10, threshold?, layout=LAYOUT }
export function analyzeScan(img, opts) {
  const { block, pxPerMm, speed = 25, gain = 10, layout = LAYOUT } = opts;
  const W = img.width;
  const rows = layout.length, cols = layout[0].length;
  const msPerPx = 1000 / (speed * pxPerMm);
  const g = { pxPerMm, msPerPx, gain };
  const bx0 = Math.max(0, Math.round(block.x0)), by0 = Math.max(0, Math.round(block.y0));
  const bx1 = Math.min(img.width, Math.round(block.x1)), by1 = Math.min(img.height, Math.round(block.y1));
  const cw = (bx1 - bx0) / cols, ch = (by1 - by0) / rows;
  const ink = inkMap(img);
  const thr = opts.threshold ?? autoThreshold(ink, W, { x0: bx0, y0: by0, x1: bx1, y1: by1 });

  const notes = [];
  const sigs = {}, overlay = {}, quality = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const name = layout[r][c];
      const rect = {
        x0: Math.round(bx0 + c * cw), x1: Math.round(bx0 + (c + 1) * cw),
        y0: Math.round(by0 + r * ch), y1: Math.round(by0 + (r + 1) * ch),
      };
      const cell = extractCell(ink, W, rect, thr, Math.round(ch * 0.5));
      const sig = cell.cover > 0.3 ? prepLead(cell, g) : null;
      quality[name] = { cover: cell.cover, beats: 0 };
      if (!sig) { notes.push({ code: "noTrace", lead: name }); continue; }
      sig.col = c; sig.rect = rect; sig.name = name;
      sigs[name] = sig;
      // centre line in image pixels for the on-screen overlay
      const pts = [];
      for (let x = 0; x < cell.w; x += 2) pts.push([rect.x0 + x, rect.y0 + (Number.isNaN(cell.ctr[x]) ? NaN : cell.ctr[x])]);
      overlay[name] = pts.filter(p => !Number.isNaN(p[1]));
    }
  }

  // Beats per column (leads in a column are simultaneous → union of activity).
  const colMs = (cw / pxPerMm) * (1000 / speed);
  const beatsByCol = [];
  for (let c = 0; c < cols; c++) {
    const members = layout.map(row => row[c]).filter(n => sigs[n]);
    if (!members.length) { beatsByCol.push({ dt: 4, beats: [] }); continue; }
    const dt = sigs[members[0]].dt;
    const n = Math.min(...members.map(m => sigs[m].n));
    // A real QRS is simultaneous in every lead of the column; an artifact (stray
    // ink, a neighbouring lead) shows in one. Use the 2nd-strongest lead's
    // activity when there are ≥3 leads so a single-lead blip cannot make a beat.
    const act = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      const v = members.map(m => sigs[m].act[j]).sort((a, b) => b - a);
      act[j] = members.length >= 3 ? v[1] : v[0];
    }
    beatsByCol.push({ dt, members, beats: findBeats(act, dt) });
  }

  // Rate & regularity from R–R across the contiguous columns.
  const times = [];
  const rrs = [];
  beatsByCol.forEach((bc, c) => {
    const t = bc.beats.map(b => c * colMs + b.c * bc.dt);
    times.push(...t);
    // R–R only inside one column: a beat clipped at the column edge would
    // otherwise show up as a (false) double interval.
    for (let i = 1; i < t.length; i++) { const d = t[i] - t[i - 1]; if (d > 250 && d < 2500) rrs.push(d); }
  });
  times.sort((a, b) => a - b);
  const meta = {};
  let rrMed = NaN;
  if (rrs.length >= 2) {
    rrMed = median(rrs);
    meta.hr = Math.round(60000 / rrMed);
    const dev = rrs.filter(d => Math.abs(d - rrMed) / rrMed > 0.12).length;
    meta.rhythm = dev === 0 ? "regular" : dev === 1 ? "regirreg" : "irregirreg";
    if (dev > 0) notes.push({ code: "irregular" });
  } else {
    notes.push({ code: "fewBeats" });
  }

  // Per-lead measurements (median over beats).
  const leads = {}, per = {};
  const qrsWidths = [];
  const tpl = newCase().leads;
  for (const name of LEADS) {
    const sig = sigs[name];
    if (!sig) continue;
    const bc = beatsByCol[sig.col];
    const rec = [];
    bc.beats.forEach((b, i) => {
      const m = measureBeat(sig, b, bc.beats[i - 1], bc.beats[i + 1]);
      if (m) rec.push(m);
    });
    quality[name].beats = rec.length;
    if (!rec.length) { notes.push({ code: "noQrs", lead: name }); continue; }
    const med = {};
    for (const k of [...numericKeys, "qt", "pr", "pDur"]) med[k] = median(rec.map(m => m[k]));
    med.frag = rec.filter(m => m.frag).length * 2 > rec.length;
    const l = blankLead();
    const missing = [];
    for (const k of numericKeys) {
      if (Number.isNaN(med[k])) {
        if (["p", "pNeg", "pNegDur"].includes(k)) { if (k === "p") missing.push("p"); l[k] = tpl[name][k]; }
        else if (k === "t" || k === "st") { missing.push(k); l[k] = tpl[name][k]; }
        else l[k] = tpl[name][k];
      } else l[k] = k === "rpt" || k === "qDur" || k === "pNegDur" ? Math.round(med[k]) : Math.round(med[k] * 4) / 4;
    }
    l.frag = med.frag;
    if (l.r === 0 && l.rpt !== l.rpt) l.rpt = 40;
    if (Number.isNaN(l.rpt)) l.rpt = 40;
    leads[name] = l;
    per[name] = { qt: med.qt, pr: med.pr, pDur: med.pDur, pAmp: l.p, tAmp: l.t, qrs: median(rec.map(m => m.qrs)) };
    if (missing.length) notes.push({ code: "unmeasured", lead: name, what: missing });
  }

  // QRS width: per beat across the whole column (earliest onset → latest offset).
  beatsByCol.forEach(bc => bc.beats.forEach(b => {
    let on = b.on, off = b.off;
    for (const m of bc.members) { const r = refine(sigs[m], b); on = Math.min(on, r.on); off = Math.max(off, r.off); }
    qrsWidths.push((off - on) * bc.dt - median(bc.members.map(m => sigs[m].thMs)));
  }));

  const iv = {};
  const qrs = median(qrsWidths);
  if (!Number.isNaN(qrs)) iv.qrs = Math.round(qrs);
  const bigP = Object.values(per).filter(p => Math.abs(p.pAmp) >= 0.8);
  const pr = median(bigP.map(p => p.pr)), pDur = median(bigP.map(p => p.pDur));
  if (!Number.isNaN(pr)) iv.pr = Math.round(pr);
  if (!Number.isNaN(pDur)) iv.pDur = Math.round(pDur);
  const qt = median(Object.values(per).filter(p => Math.abs(p.tAmp) >= 1).map(p => p.qt));
  if (!Number.isNaN(qt)) iv.qt = Math.round(qt);
  if (iv.pr == null) notes.push({ code: "noP" });
  if (iv.qt == null) notes.push({ code: "noT" });

  return { meta, iv, leads, per, quality, overlay, notes, threshold: thr, beatTimes: times };
}

// Merge a scan result into a fresh case. Unmeasured parts keep the (unreviewed)
// normal template so the reasoning engine treats them as unknown.
export function scanToCase(result, prior = {}) {
  const c = newCase();
  c.meta = { ...c.meta, ...result.meta, sex: prior.sex ?? "", age: prior.age ?? null };
  Object.assign(c.iv, result.iv);
  for (const [n, l] of Object.entries(result.leads)) {
    c.leads[n] = l;
    c.reviewed[n] = true;
  }
  for (const k of ["pDur", "pr", "qrs", "qt"]) if (result.iv[k] != null) c.ivReviewed[k] = true;
  c.scan = { at: Date.now(), notes: result.notes, quality: result.quality };
  return c;
}
