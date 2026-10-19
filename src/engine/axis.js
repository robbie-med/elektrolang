import { LEAD_ANGLE, LEAD_GAIN } from "./leads.js";

const RAD = Math.PI / 180;

export const normDeg = (d) => {
  let x = ((d + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
};

// Least-squares fit of a frontal-plane vector (x, y) to the net amplitudes
// of any subset of limb leads: a_L = g_L * (x cos φ_L + y sin φ_L).
export function fitAxis(nets) {
  let sxx = 0, sxy = 0, syy = 0, bx = 0, by = 0;
  const names = Object.keys(nets);
  for (const n of names) {
    const g = LEAD_GAIN[n], c = g * Math.cos(LEAD_ANGLE[n] * RAD), s = g * Math.sin(LEAD_ANGLE[n] * RAD);
    sxx += c * c; sxy += c * s; syy += s * s;
    bx += c * nets[n]; by += s * nets[n];
  }
  const det = sxx * syy - sxy * sxy;
  if (names.length < 2 || Math.abs(det) < 1e-9) return null;
  const x = (syy * bx - sxy * by) / det;
  const y = (sxx * by - sxy * bx) / det;
  const deg = normDeg(Math.atan2(y, x) / RAD);
  const mag = Math.hypot(x, y);
  const residuals = {};
  for (const n of names) {
    const pred = LEAD_GAIN[n] * (x * Math.cos(LEAD_ANGLE[n] * RAD) + y * Math.sin(LEAD_ANGLE[n] * RAD));
    residuals[n] = nets[n] - pred;
  }
  return { deg, mag, x, y, residuals };
}

// Circular spread (max angular distance) of a list of angles.
export function angularRange(degs) {
  if (degs.length < 2) return { lo: degs[0], hi: degs[0], width: 0 };
  // Unwrap around the circular mean so ranges straddling ±180 stay contiguous.
  const mx = degs.reduce((a, d) => a + Math.cos(d * RAD), 0);
  const my = degs.reduce((a, d) => a + Math.sin(d * RAD), 0);
  const mean = Math.atan2(my, mx) / RAD;
  const rel = degs.map(d => normDeg(d - mean));
  const lo = Math.min(...rel) + mean, hi = Math.max(...rel) + mean;
  return { lo: normDeg(lo), hi: normDeg(hi), width: hi - lo };
}

export function axisCategory(deg) {
  if (deg >= -30 && deg <= 90) return "normal";
  if (deg < -30 && deg >= -90) return "lad";
  if (deg > 90 && deg <= 180) return "rad";
  return "extreme";
}

// Is `deg` inside [lo, hi] going clockwise from lo?
export const inArc = (deg, lo, hi) => normDeg(deg - lo) >= 0 && normDeg(deg - lo) <= normDeg(hi - lo);
