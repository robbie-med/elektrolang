// Detectors: turn the measured case (+ the existing workup result) into
//  1. per-lead flags       — "ST elevation in V3", "pathologic Q in III" …
//  2. finding groups       — flags merged by coronary territory / globally, with
//                            a weight that says how much to trust the group
// Output is language-neutral (ids and numbers); i18n/patterns.js words it.

import { LEADS, LIMB, netQRS } from "../leads.js";
import { FINDINGS, TERR, terrOf, causesFor } from "./catalog.js";

const CERT = { definite: 1, probable: 0.85, possible: 0.45 };
const PRECORDIAL_UP = ["V2", "V3", "V4", "V5", "V6"];

// comp = which row of the lead card the flag belongs to.
export const COMP_OF = {
  p_tall: "p", p_biph: "p", p_inv: "p",
  q_path: "q",
  r_tall: "r", r_v1_tall: "r", r_poor: "r",
  s_deep: "s",
  rsr: "shape", frag: "shape",
  ste: "st", std: "st",
  t_peaked: "t", t_inv: "t", t_flat: "t",
};

export function steThreshold(n, demo) {
  if (n === "V2" || n === "V3") {
    if (demo.sex === "f") return 1.5;
    if (demo.sex === "m") return demo.age != null && demo.age < 40 ? 2.5 : 2;
    return 2;
  }
  return 1;
}

// Same rule the workup engine uses for "pathologic Q".
function pathologicQ(n, l) {
  if (n === "aVR" || n === "V1") return false;
  if (l.r === 0 && l.s > 0) return true; // QS
  if (n === "V2" || n === "V3") return l.q > 0 && l.qDur >= 20;
  return l.q >= 1 && l.qDur >= 30;
}

function leadFlags(n, l, demo, ctx) {
  const f = [];
  const add = (type) => f.push({ lead: n, type });
  // P wave
  if (["II", "III", "aVF"].includes(n) && l.p >= 2.5) add("p_tall");
  if (n === "V1" && l.pNeg >= 1 && l.pNegDur >= 40) add("p_biph");
  if (["I", "II", "V4", "V5", "V6"].includes(n) && l.p <= -0.5) add("p_inv");
  // Q / R / S / shape
  if (pathologicQ(n, l)) add("q_path");
  const tall = (n === "V5" || n === "V6") ? l.r >= 25 : n === "aVL" ? l.r >= 11 : n === "I" ? l.r >= 14 : n === "aVF" ? l.r >= 20 : false;
  if (tall) add("r_tall");
  if (n === "V1" && !ctx.rbbb && (l.r >= 7 || (l.r > l.s && l.r > 0))) add("r_v1_tall");
  if (["V1", "V2", "V3"].includes(n) && l.s >= 25) add("s_deep");
  if ((n === "V1" || n === "V2") && l.r2 > 0) add("rsr");
  const bbbR = ctx.rbbb && (n === "V1" || n === "V2");
  if (l.frag && !bbbR && n !== "aVR") add("frag");
  // ST
  if (n === "aVR") { if (l.st >= 1) add("ste"); }
  else {
    if (l.st >= steThreshold(n, demo)) add("ste");
    if (l.st <= -0.5) add("std");
  }
  // T
  const limbPeak = LIMB.includes(n) ? 6 : 10;
  if (n !== "aVR" && l.t >= limbPeak) add("t_peaked");
  if (n !== "aVR" && n !== "V1" && l.t <= -1 && !(n === "III" && l.t > -2)) add("t_inv");
  else if (["I", "II", "V4", "V5", "V6"].includes(n) && Math.abs(l.t) < 0.5) add("t_flat");
  return f;
}

export function detect(ecg, result) {
  const demo = { age: ecg.meta.age ?? null, sex: ecg.meta.sex || null };
  const lead = (n) => (ecg.reviewed[n] ? ecg.leads[n] : null);
  const reviewed = LEADS.filter(n => lead(n));
  const keys = new Map(result.findings.map(f => [f.key, f]));
  const has = (k) => keys.has(k);
  const certW = (k) => CERT[keys.get(k)?.certainty] ?? 1;
  const iv = (k) => (ecg.ivReviewed[k] ? ecg.iv[k] : null);
  const ctx = {
    lbbb: has("lbbb"), rbbb: has("rbbb") || has("irbbb"), lafb: has("lafb"),
    bifasc: has("bifasc"), lvh: has("lvh"),
  };

  // ── per-lead flags ────────────────────────────────────────────────────────
  const flags = [];
  for (const n of reviewed) flags.push(...leadFlags(n, lead(n), demo, ctx));

  // Poor R progression → tied to V3
  const V3 = lead("V3");
  if (V3 && V3.r < 3 && lead("V2") && !ctx.lbbb) flags.push({ lead: "V3", type: "r_poor" });

  // ── groups ────────────────────────────────────────────────────────────────
  const groups = [];
  const mk = (type, scope, leads, weight, extra = {}) => {
    const g = { key: `${type}:${scope}`, type, scope, leads, weight, step: FINDINGS[type].step, causes: causesFor(type, scope), ...extra };
    groups.push(g);
    return g;
  };
  const flagsOf = (t) => flags.filter(f => f.type === t);
  const leadsOf = (t) => flagsOf(t).map(f => f.lead);
  const order = (ls) => LEADS.filter(n => ls.includes(n));

  // Territory-structured types (ste, std, t_inv, q_path, frag)
  for (const type of ["ste", "std", "t_inv", "q_path", "frag"]) {
    const ls = leadsOf(type);
    if (!ls.length) continue;
    const terrs = Object.keys(TERR).filter(t => t !== "avr" && ls.some(n => terrOf(n) === t));
    const diffuseOk = type === "ste" || type === "std" || type === "t_inv";
    const deepT = type === "t_inv" && ls.filter(n => lead(n).t <= -5).length >= 2;
    if (diffuseOk && (terrs.length >= 3 || deepT)) {
      const leadsD = order(ls.filter(n => n !== "aVR"));
      mk(type, "diffuse", leadsD, 1);
      if (type === "ste" && ls.includes("aVR")) mk("ste", "avr", ["aVR"], 0.6);
      continue;
    }
    for (const t of Object.keys(TERR)) {
      const g = order(ls.filter(n => terrOf(n) === t));
      if (!g.length) continue;
      let w = g.length >= 2 ? 1 : 0.5;
      if (type === "q_path" && t === "inf" && g.length === 1 && g[0] === "III") w = 0.15;
      if (type === "frag" && g.length < 2) w = 0.3;
      if (type === "ste" && t === "avr") w = 0.6;
      mk(type, t, g, w);
    }
  }
  // Single-group types
  const single = (type, scopeFn, wFn) => {
    const ls = order(leadsOf(type));
    if (!ls.length) return;
    mk(type, scopeFn ? scopeFn(ls) : "default", ls, wFn ? wFn(ls) : 1);
  };
  single("p_tall");
  single("p_biph");
  single("p_inv", (ls) => (ls.includes("I") ? "I" : "default"));
  single("r_tall", null, (ls) => (ls.length >= 2 ? 1 : 0.7));
  single("r_v1_tall");
  single("s_deep");
  single("rsr");
  single("t_peaked", null, (ls) => (ls.length >= 2 ? 1 : 0.6));
  single("t_flat", null, (ls) => (ls.length >= 3 ? 0.8 : 0.4));
  single("r_poor", null, () => 0.7);

  // Engine-derived P-wave abnormality when the lead flag was not raised
  if (has("laa") && !groups.some(g => g.type === "p_biph")) mk("p_biph", "default", [], certW("laa"));
  if (has("raa") && !groups.some(g => g.type === "p_tall")) mk("p_tall", "default", [], certW("raa"));

  // ── whole-tracing findings ────────────────────────────────────────────────
  const hr = ecg.meta.hr;
  if (hr != null && hr < 60) mk("rate_low", "default", [], 1, { value: { hr } });
  if (hr != null && hr > 100) mk("rate_high", "default", [], 1, { value: { hr } });
  if (ecg.meta.rhythm === "irregirreg") mk("rhythm_irreg", "default", [], 1);
  if (ecg.meta.rhythm === "regirreg") mk("rhythm_regirreg", "default", [], 0.8);
  if (ecg.meta.pEveryQrs === "no") mk("p_dissoc", "default", [], 0.8);

  const cat = result.metrics?.axisCat;
  if (has("reversal")) mk("axis_reversal", "default", [], certW("reversal"), { value: { deg: result.metrics.axisDeg } });
  if (cat === "lad" && !ctx.lafb && !ctx.bifasc) mk("axis_lad", "default", [], 1, { value: { deg: result.metrics.axisDeg } });
  if (cat === "rad") mk("axis_rad", "default", [], 1, { value: { deg: result.metrics.axisDeg } });
  if (cat === "extreme") mk("axis_extreme", "default", [], 1, { value: { deg: result.metrics.axisDeg } });

  const pr = iv("pr");
  if (pr != null && pr > 200) mk("pr_long", "default", [], 1, { value: { pr } });
  if (pr != null && pr < 120) mk(ecg.meta.delta ? "pr_short_delta" : "pr_short", "default", [], 1, { value: { pr } });
  if (ecg.meta.delta && !(pr != null && pr < 120)) mk("pr_short_delta", "default", [], 0.6, { value: { pr } });

  if (has("bifasc")) mk("qrs_bifasc", "default", [], certW("bifasc"));
  else {
    if (has("lbbb")) mk("qrs_lbbb", "default", [], certW("lbbb"));
    if (has("rbbb")) mk("qrs_rbbb", "default", [], certW("rbbb"));
    if (has("lafb")) mk("qrs_lafb", "default", [], certW("lafb"));
  }
  if (has("irbbb")) mk("qrs_irbbb", "default", [], certW("irbbb"));
  if (has("lpfb")) mk("qrs_lpfb", "default", [], certW("lpfb"));
  if (has("ivcd")) mk("qrs_ivcd", "default", [], certW("ivcd"));
  if (has("qtLong")) mk("qt_long", "default", [], 1, { value: { qtc: result.metrics?.qtc } });
  if (has("qtShort")) mk("qt_short", "default", [], 1, { value: { qtc: result.metrics?.qtc } });
  if (has("lvh")) mk("volt_lvh", "default", [], certW("lvh"));
  if (has("rvh")) mk("rvh_pattern", "default", [], certW("rvh"));
  if (has("sgarbossa")) mk("sgarbossa", "default", [], 1);

  const limb = LIMB.map(lead).filter(Boolean);
  if (limb.length >= 4 && limb.every(l => l.r + Math.max(l.s, l.q) < 5)) mk("low_voltage", "default", [], 1);

  const I = lead("I"), III = lead("III");
  if (I && III && I.s >= 1.5 && III.q >= 1 && III.t <= -0.5) mk("s1q3t3", "default", ["I", "III"], 1);

  // aVR elevation with diffuse depression collapses into one left-main pattern.
  const aVR = lead("aVR");
  const stdCount = reviewed.filter(n => n !== "aVR" && lead(n).st <= -0.5).length;
  if (aVR && aVR.st >= 1 && stdCount >= 6) {
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if ((g.type === "ste" && g.scope === "avr") || (g.type === "std" && g.scope === "diffuse")) groups.splice(i, 1);
    }
    mk("avr_diffuse_std", "default", order(reviewed.filter(n => lead(n).st <= -0.5)), 1);
  }

  // Conduction patterns are *visible* on the tracing: only offer them as the cause
  // of some other change if the tracing actually shows them (no "LBBB" as the
  // explanation for notching on a 100 ms QRS). Their own findings are exempt, and
  // so are rSR′ / dominant-R-in-V1, where the pattern itself is the explanation.
  const visible = {
    lbbb: has("lbbb"), rbbb: has("rbbb") || has("irbbb"), lafb: has("lafb") || has("bifasc"), lpfb: has("lpfb"),
    wpw: !!ecg.meta.delta || (pr != null && pr < 120),
    pacing: (iv("qrs") ?? 0) >= 120,
  };
  for (const g of groups) {
    if (["rsr", "r_v1_tall"].includes(g.type)) continue;
    g.causes = g.causes.filter(([id]) => visible[id] !== false);
  }

  // ── context adjustments ───────────────────────────────────────────────────
  const secondary = (g, why) => { g.weight *= 0.25; g.secondary = why; };
  for (const g of groups) {
    if (ctx.lbbb && !has("sgarbossa")) {
      if (["std", "t_inv"].includes(g.type) && ["lat", "ant", "default"].includes(g.scope)) secondary(g, "lbbb");
      else if (g.type === "ste" && g.scope === "ant") secondary(g, "lbbb");
      else if (g.type === "q_path" && g.scope === "ant") secondary(g, "lbbb");
      else if (["r_poor", "s_deep", "r_tall"].includes(g.type)) secondary(g, "lbbb");
    } else if (ctx.rbbb) {
      if (["std", "t_inv"].includes(g.type) && g.scope === "ant") secondary(g, "rbbb");
      else if (g.type === "rsr") secondary(g, "rbbb");
    }
    if ((ctx.lafb || ctx.bifasc) && g.type === "r_poor") g.weight *= 0.5;
  }

  // Reciprocal changes: ST elevation in one territory + depression in another.
  const steG = groups.filter(g => g.type === "ste" && ["inf", "lat", "ant"].includes(g.scope) && !g.secondary);
  const stdG = groups.filter(g => g.type === "std" && ["inf", "lat", "ant"].includes(g.scope) && !g.secondary);
  if (steG.length && stdG.length && !groups.some(g => g.type === "ste" && g.scope === "diffuse")) {
    for (const s of steG) {
      s.reciprocal = true;
      s.causes = s.causes.map(([id, w]) => (id === "stemi" ? [id, w + 6] : [id, w]));
    }
    for (const d of stdG) {
      if (steG.some(s => s.scope !== d.scope)) {
        d.type = "std_recip"; d.key = `std_recip:${d.scope}`;
        d.causes = causesFor("std_recip", d.scope); d.reciprocal = true;
      }
    }
  }

  // Bifascicular block absorbs its parts (already dropped above); keep order stable.
  groups.sort((a, b) => a.step - b.step || a.key.localeCompare(b.key));

  // Tie each flag to its group so the lead cards can show the causes.
  for (const f of flags) {
    const g = groups.find(g => g.leads.includes(f.lead) && (g.type === f.type || (f.type === "std" && g.type === "std_recip")));
    f.gkey = g ? g.key : null;
  }

  return { demo, reviewed, flags, groups, ctx };
}

export { netQRS, PRECORDIAL_UP };
