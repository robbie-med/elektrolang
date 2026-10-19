// Live checks for the drawing view: what the other leads say this lead should be.
import { PRECORDIAL, FROM_I_II, netQRS } from "./leads.js";

// Net QRS that Einthoven/Goldberger predict for `name` from the other limb leads.
export function expectedNet(name, ecg) {
  const net = (n) => (ecg.reviewed[n] ? netQRS(ecg.leads[n]) : null);
  if (name === "I") { const a = net("II"), b = net("III"); return a == null || b == null ? null : a - b; }
  if (name === "II") { const a = net("I"), b = net("III"); return a == null || b == null ? null : a + b; }
  if (!(name in FROM_I_II)) return null;
  const I = net("I"), II = net("II");
  if (I == null || II == null) return null;
  const [ka, kb] = FROM_I_II[name];
  return ka * I + kb * II;
}

// Smallest change to R/S that makes the lead's net equal `target`.
export function snapToNet(l, target) {
  const diff = target - netQRS(l);
  const out = { ...l };
  const q4 = (x) => Math.round(x * 4) / 4;
  if (diff > 0) {
    const fromS = Math.min(out.s, diff);
    out.s = q4(out.s - fromS);
    out.r = q4(out.r + (diff - fromS));
  } else {
    const fromR = Math.min(out.r, -diff);
    out.r = q4(out.r - fromR);
    out.s = q4(out.s + (-diff - fromR));
  }
  return out;
}

export function ghostMismatch(name, ecg) {
  if (!ecg.reviewed[name]) return null;
  const e = expectedNet(name, ecg);
  if (e == null) return null;
  const d = netQRS(ecg.leads[name]);
  const tol = Math.max(1, 0.15 * Math.max(Math.abs(e), Math.abs(d)));
  return Math.abs(d - e) > tol ? { drawn: d, expected: e } : null;
}

export function rProgression(ecg, W) {
  const out = [];
  const vs = PRECORDIAL.filter(n => ecg.reviewed[n]);
  if (vs.length < 5) return out;
  const trans = vs.find(n => ecg.leads[n].r > ecg.leads[n].s);
  if (trans && (trans === "V1" || trans === "V2")) out.push({ level: "warn", text: W.rProg.early(trans) });
  if (!trans || trans === "V5" || trans === "V6") out.push({ level: "warn", text: W.rProg.late(trans || "—") });
  for (let i = 1; i < vs.length - 1; i++) {
    const [a, b, c] = [vs[i - 1], vs[i], vs[i + 1]].map(n => ecg.leads[n].r);
    if (b < a - 2 && c > b + 2 && ["V1", "V2", "V3", "V4"].includes(vs[i])) {
      out.push({ level: "warn", text: W.rProg.reversed(vs[i - 1], vs[i]) });
      break;
    }
  }
  return out;
}
