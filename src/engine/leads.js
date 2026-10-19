// Lead geometry, ECG state model, templates, and the waveform sampler shared by
// the drawing editor and the reasoning engine.
// Units: amplitudes in mm (10 mm = 1 mV), times in ms, t = 0 at QRS onset.

export const LIMB = ["I", "II", "III", "aVR", "aVL", "aVF"];
export const PRECORDIAL = ["V1", "V2", "V3", "V4", "V5", "V6"];
export const LEADS = [...LIMB, ...PRECORDIAL];

// Standard printed layout: 4 columns x 3 rows.
export const LAYOUT = [
  ["I", "aVR", "V1", "V4"],
  ["II", "aVL", "V2", "V5"],
  ["III", "aVF", "V3", "V6"],
];

// Hexaxial angles (degrees, positive = inferior) and relative gain.
// Augmented leads record sqrt(3)/2 of the projection (Goldberger).
export const LEAD_ANGLE = { I: 0, II: 60, III: 120, aVR: -150, aVL: -30, aVF: 90 };
export const LEAD_GAIN = { I: 1, II: 1, III: 1, aVR: Math.sqrt(3) / 2, aVL: Math.sqrt(3) / 2, aVF: Math.sqrt(3) / 2 };

// Limb leads expressed through I and II (sample-wise identities).
export const FROM_I_II = {
  I: [1, 0], II: [0, 1], III: [-1, 1],
  aVR: [-0.5, -0.5], aVL: [1, -0.5], aVF: [-0.5, 1],
};

export const blankLead = () => ({
  p: 0, pNeg: 0, pNegDur: 0,
  q: 0, qDur: 0, r: 0, rpt: 40, s: 0, r2: 0,
  st: 0, t: 0, frag: false,
});

const lead = (o) => ({ ...blankLead(), ...o });

export const netQRS = (l) => (l.r + (l.r2 || 0)) - l.q - l.s;

const NORMAL_LEADS = {
  I:   lead({ p: 1,     q: 0.5, qDur: 20, r: 8,   rpt: 35, s: 0.5,  t: 2.5 }),
  II:  lead({ p: 1.5,   q: 0.5, qDur: 20, r: 12,  rpt: 38, s: 1,    t: 3 }),
  III: lead({ p: 0.5,             r: 5,   rpt: 35, s: 1.5,  t: 0.5 }),
  aVR: lead({ p: -1.25,           r: 1,   rpt: 20, s: 9.75, t: -2.75 }),
  aVL: lead({ p: 0.25,  q: 0.5, qDur: 20, r: 4,   rpt: 30, s: 1.75, t: 1 }),
  aVF: lead({ p: 1,               r: 8,   rpt: 38, s: 1,    t: 1.75 }),
  V1:  lead({ p: 0.5, pNeg: 0.5, pNegDur: 30, r: 2, rpt: 20, s: 9,  t: 0.5 }),
  V2:  lead({ p: 0.8,             r: 4,   rpt: 25, s: 14,   st: 1,   t: 3 }),
  V3:  lead({ p: 0.8,             r: 8,   rpt: 30, s: 8,    st: 0.5, t: 3.5 }),
  V4:  lead({ p: 0.8,             r: 14,  rpt: 35, s: 5,    t: 3 }),
  V5:  lead({ p: 0.8,   q: 0.5, qDur: 20, r: 14,  rpt: 40, s: 2,    t: 2.5 }),
  V6:  lead({ p: 0.8,   q: 0.5, qDur: 20, r: 11,  rpt: 40, s: 1,    t: 2 }),
};

const NORMAL_IV = { pDur: 100, pDurHi: null, pNotch: false, pr: 160, qrs: 90, qt: 380 };

const NORMAL_META = { hr: null, rhythm: "", pEveryQrs: "", delta: false, sex: "", age: null };

const clone = (x) => JSON.parse(JSON.stringify(x));

export function newCase() {
  return {
    meta: clone(NORMAL_META),
    iv: clone(NORMAL_IV),
    leads: clone(NORMAL_LEADS),
    reviewed: {},      // lead name -> true once shaped/confirmed by the user
    ivReviewed: {},    // interval key -> true once set by the user
  };
}

// Demo: superior axis, QRS 116 ms, notched borderline-long P, inferior notching.
export function demoCase() {
  const c = newCase();
  c.meta = { hr: 72, rhythm: "regular", pEveryQrs: "yes", delta: false, sex: "m", age: 64 };
  c.iv = { pDur: 116, pDurHi: 128, pNotch: true, pr: 184, qrs: 116, qt: 400 };
  Object.assign(c.leads, {
    I:   lead({ p: 1,    q: 0.5, qDur: 20, r: 8,  rpt: 40, s: 0.5, t: 2 }),
    II:  lead({ p: 1.5,              r: 2,  rpt: 22, s: 5,   t: 1.5 }),
    III: lead({ p: 0.5,              r: 1.5, rpt: 20, s: 12, t: -0.5, frag: true }),
    aVR: lead({ p: -1.25,            r: 1,  rpt: 20, s: 3,   t: -1.75 }),
    aVL: lead({ p: 0.25, q: 1, qDur: 24, r: 10, rpt: 54, s: 0,  t: 1.25 }),
    aVF: lead({ p: 1,                r: 1.5, rpt: 20, s: 8.5, t: 0.5, frag: true }),
    V1:  lead({ p: 0.5, pNeg: 0.8, pNegDur: 40, r: 2, rpt: 20, s: 16, t: 0.5 }),
    V2:  lead({ p: 0.8,              r: 4,  rpt: 25, s: 18, st: 1, t: 3 }),
    V3:  lead({ p: 0.8,              r: 7,  rpt: 30, s: 15, st: 0.5, t: 3 }),
    V4:  lead({ p: 0.8,              r: 14, rpt: 38, s: 8,  t: 3 }),
    V5:  lead({ p: 0.8,              r: 18, rpt: 44, s: 3,  t: 2.5 }),
    V6:  lead({ p: 0.8,              r: 14, rpt: 44, s: 2,  t: 2 }),
  });
  LEADS.forEach(n => { c.reviewed[n] = true; });
  ["pDur", "pr", "qrs", "qt"].forEach(k => { c.ivReviewed[k] = true; });
  return c;
}

// Demo: RBBB + LAFB + first-degree AV block.
export function demoBifascicular() {
  const c = newCase();
  c.meta = { hr: 64, rhythm: "regular", pEveryQrs: "yes", delta: false, sex: "f", age: 78 };
  c.iv = { pDur: 104, pDurHi: null, pNotch: false, pr: 236, qrs: 138, qt: 460 };
  Object.assign(c.leads, {
    I:   lead({ p: 1,    q: 0.5, qDur: 20, r: 7,  rpt: 40, s: 2.5, t: 1.5 }),
    II:  lead({ p: 1.5,              r: 2,  rpt: 24, s: 5,  t: 1 }),
    III: lead({ p: 0.5,              r: 1.5, rpt: 22, s: 8.5, t: -0.5 }),
    aVR: lead({ p: -1.25,            r: 1,  rpt: 20, s: 3, r2: 1.5, t: -1.25 }),
    aVL: lead({ p: 0.25, q: 1, qDur: 24, r: 7,  rpt: 52, s: 0.5, t: 1 }),
    aVF: lead({ p: 1,                r: 1.5, rpt: 22, s: 6.5, t: 0.25 }),
    V1:  lead({ p: 0.6,              r: 2,  rpt: 20, s: 3, r2: 8, st: -0.5, t: -2 }),
    V2:  lead({ p: 0.8,              r: 3,  rpt: 22, s: 6, r2: 6, st: -0.5, t: -1 }),
    V3:  lead({ p: 0.8,              r: 7,  rpt: 30, s: 8,  t: 2 }),
    V4:  lead({ p: 0.8,              r: 10, rpt: 36, s: 6,  t: 2.5 }),
    V5:  lead({ p: 0.8,  q: 0.5, qDur: 20, r: 11, rpt: 40, s: 4, t: 2 }),
    V6:  lead({ p: 0.8,  q: 0.5, qDur: 20, r: 9,  rpt: 40, s: 3, t: 1.5 }),
  });
  LEADS.forEach(n => { c.reviewed[n] = true; });
  ["pDur", "pr", "qrs", "qt"].forEach(k => { c.ivReviewed[k] = true; });
  return c;
}

// ── Waveform sampler ───────────────────────────────────────────────────────
export const T_START = -360;
export const T_END = 640;

const hump = (u) => Math.sin(Math.PI * u);

// Returns { pts: [[t, y], ...], anchors: {key: [t, y]} }.
export function traceLead(l, iv) {
  const pts = [];
  const anchors = {};
  const pOn = -iv.pr;
  const pEnd = pOn + iv.pDur;
  const pNegDur = l.pNeg > 0 ? Math.min(Math.max(l.pNegDur || 30, 8), iv.pDur - 8) : 0;
  const pPosEnd = pEnd - pNegDur;

  pts.push([T_START, 0]);
  anchors.pOn = [pOn, 0];

  // P wave
  const STEP = 2;
  let pPeak = [pOn + (pPosEnd - pOn) / 2, l.p];
  for (let t = pOn; t <= pPosEnd; t += STEP) {
    const u = (t - pOn) / (pPosEnd - pOn || 1);
    let y;
    if (iv.pNotch && l.p > 0) {
      const g = (c) => Math.exp(-((u - c) ** 2) / (2 * 0.13 ** 2));
      y = l.p * Math.max(g(0.3), 0.95 * g(0.72)) * Math.sqrt(hump(u));
      pPeak = [pOn + 0.3 * (pPosEnd - pOn), l.p];
    } else {
      y = l.p * hump(u);
    }
    pts.push([t, y]);
  }
  anchors.pPeak = pPeak;
  if (pNegDur > 0) {
    for (let t = pPosEnd; t <= pEnd; t += STEP) {
      pts.push([t, -l.pNeg * hump((t - pPosEnd) / pNegDur)]);
    }
    anchors.pNeg = [pPosEnd + pNegDur / 2, -l.pNeg];
  } else {
    anchors.pNeg = [pEnd - 15, 0];
  }
  pts.push([pEnd, 0]);
  anchors.pEnd = [pEnd, 0];

  // QRS (piecewise linear: it is a fast deflection)
  const qrs = iv.qrs;
  const rpt = Math.min(Math.max(l.rpt, 10), qrs - 10);
  const v = [[0, 0]];
  const qDur = l.q > 0 ? Math.min(Math.max(l.qDur || 20, 8), Math.max(rpt - 4, 8)) : 0;
  if (l.q > 0) {
    v.push([qDur / 2, -l.q]);
    anchors.q = [qDur / 2, -l.q];
    if (l.r > 0) v.push([qDur, 0]);
  } else {
    anchors.q = [Math.min(12, rpt / 2), 0];
  }
  let sT;
  if (l.r > 0) {
    v.push([rpt, l.r]);
    anchors.r = [rpt, l.r];
    const sEnd = l.r2 > 0 ? rpt + (qrs - rpt) * 0.62 : qrs;
    sT = rpt + (sEnd - rpt) * 0.5;
  } else {
    anchors.r = [rpt, 0];
    sT = qrs * 0.45;
  }
  if (l.s > 0) {
    v.push([sT, -l.s]);
  }
  anchors.s = [sT, -l.s];
  if (l.r2 > 0) {
    const r2T = rpt + (qrs - rpt) * 0.78;
    v.push([r2T, l.r2]);
    anchors.r2 = [r2T, l.r2];
  } else {
    anchors.r2 = [rpt + (qrs - rpt) * 0.78, 0];
  }
  v.push([qrs, l.st]);
  anchors.j = [qrs, l.st];

  // Fragmentation: notch on the largest downstroke/upstroke after the R peak.
  if (l.frag && v.length >= 3) {
    let best = 1, bestD = -1;
    for (let i = 1; i < v.length; i++) {
      const d = Math.abs(v[i][1] - v[i - 1][1]);
      if (d > bestD) { bestD = d; best = i; }
    }
    const [a, b] = [v[best - 1], v[best]];
    const lerp = (f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    const dir = Math.sign(b[1] - a[1]) || 1;
    const n1 = lerp(0.42), n3 = lerp(0.62);
    const n2 = [n1[0] + (n3[0] - n1[0]) * 0.5, n1[1] - dir * Math.max(1.2, bestD * 0.12)];
    v.splice(best, 0, n1, n2, n3);
  }
  pts.push(...v);

  // ST segment → T wave
  const qt = Math.max(iv.qt, qrs + 80);
  const tOn = qrs + (qt - qrs) * 0.32;
  pts.push([tOn, l.st]);
  let tPeak = [tOn, l.st];
  for (let t = tOn; t <= qt; t += STEP) {
    const u = (t - tOn) / (qt - tOn);
    const shape = Math.pow(Math.sin(Math.PI * Math.pow(u, 1.3)), 1.2);
    const y = l.st * (1 - u) + l.t * shape;
    pts.push([t, y]);
    if (Math.abs(shape - 1) < 0.02) tPeak = [t, y];
  }
  // Exact T peak (u where u^1.3 = 0.5)
  const uPk = Math.pow(0.5, 1 / 1.3);
  tPeak = [tOn + uPk * (qt - tOn), l.st * (1 - uPk) + l.t];
  anchors.tPeak = tPeak;
  anchors.tEnd = [qt, 0];
  pts.push([qt, 0], [T_END, 0]);
  return { pts, anchors, tPeakU: uPk };
}

// Combine two traces sample-wise (used for the Einthoven ghost).
export function combineTraces(a, b, ka, kb) {
  const sample = (pts, t) => {
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][0] >= t) {
        const [t0, y0] = pts[i - 1], [t1, y1] = pts[i];
        return t1 === t0 ? y1 : y0 + ((y1 - y0) * (t - t0)) / (t1 - t0);
      }
    }
    return 0;
  };
  const ts = Array.from(new Set([...a.map(p => p[0]), ...b.map(p => p[0])])).sort((x, y) => x - y);
  return ts.map(t => [t, ka * sample(a, t) + kb * sample(b, t)]);
}

export function ghostFor(name, ecg) {
  if (!LIMB.includes(name)) return null;
  // Use the two other bipolar/derived leads that don't include `name`.
  const basis = name === "I" ? ["II", "III"] : name === "II" ? ["I", "III"] : ["I", "II"];
  if (!basis.every(b => ecg.reviewed[b])) return null;
  const A = traceLead(ecg.leads[basis[0]], ecg.iv).pts;
  const B = traceLead(ecg.leads[basis[1]], ecg.iv).pts;
  if (name === "I") return combineTraces(A, B, 1, -1);   // I = II − III
  if (name === "II") return combineTraces(A, B, 1, 1);   // II = I + III
  const [ka, kb] = FROM_I_II[name];
  return combineTraces(A, B, ka, kb);
}
