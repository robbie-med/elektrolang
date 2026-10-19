// Pattern layer entry point:
//   analyzePatterns(ecg, result) → per-lead component rows with ranked causes,
//   a reading-order thought process with a running differential, and the final
//   top-3 synthesis. Language-neutral — i18n/patterns.js turns it into words.

import { LEADS, LAYOUT, netQRS } from "../leads.js";
import { detect, COMP_OF } from "./detect.js";
import { rankGroup, synthesize, runningDifferential } from "./synthesis.js";
import { STEPS, FINDINGS } from "./catalog.js";

export const LEAD_ORDER = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"];
export const COMPS = ["p", "q", "r", "s", "shape", "st", "t"];

// First precordial lead where the QRS turns net-positive.
function transition(ecg) {
  const ps = ["V1", "V2", "V3", "V4", "V5", "V6"];
  if (!ps.every(n => ecg.reviewed[n])) return null;
  for (const n of ps) if (netQRS(ecg.leads[n]) > 0) return n;
  return "none";
}

export function analyzePatterns(ecg, result) {
  const { demo, reviewed, flags, groups, ctx } = detect(ecg, result);
  for (const g of groups) g.ranked = rankGroup(g, demo);
  const byKey = Object.fromEntries(groups.map(g => [g.key, g]));
  const synth = synthesize(groups, demo);

  // Per-lead rows
  const leads = {};
  for (const n of LEAD_ORDER) {
    const done = reviewed.includes(n);
    leads[n] = {
      name: n, measured: done,
      rows: COMPS.map(comp => ({
        comp,
        flags: flags.filter(f => f.lead === n && COMP_OF[f.type] === comp).map(f => ({ type: f.type, gkey: f.gkey })),
      })),
    };
  }

  // Whole-tracing groups (no lead) for the first card
  const globalGroups = groups.filter(g => !g.leads.length);

  // Reading-order thought process
  const iv = (k) => (ecg.ivReviewed[k] ? ecg.iv[k] : null);
  const leadFlagList = (type) => flags.filter(f => f.type === type).map(f => f.lead);
  const lead = (n) => (ecg.reviewed[n] ? ecg.leads[n] : null);
  const steps = STEPS.map((s, i) => {
    const n = i + 1;
    const gs = groups.filter(g => g.step === n && g.weight > 0.05);
    let see;
    switch (s.key) {
      case "rate": see = { hr: ecg.meta.hr ?? null }; break;
      case "rhythm": see = { rhythm: ecg.meta.rhythm || null, pEvery: ecg.meta.pEveryQrs || null, pInv: leadFlagList("p_inv") }; break;
      case "axis": see = { deg: result.metrics?.axisDeg ?? null, cat: result.metrics?.axisCat ?? null }; break;
      case "intervals": see = { pr: iv("pr"), qrs: iv("qrs"), qtc: result.metrics?.qtc ?? null, bbb: result.metrics?.bbb || null }; break;
      case "pwave": see = { II: lead("II") ? lead("II").p : null, V1: lead("V1") ? { p: lead("V1").p, pNeg: lead("V1").pNeg } : null }; break;
      case "qrs": see = { q: leadFlagList("q_path"), transition: transition(ecg), tallR: leadFlagList("r_tall"), shape: [...leadFlagList("rsr"), ...leadFlagList("frag")] }; break;
      case "st": see = { ste: leadFlagList("ste"), std: leadFlagList("std") }; break;
      case "t": see = { inv: leadFlagList("t_inv"), peaked: leadFlagList("t_peaked"), flat: leadFlagList("t_flat") }; break;
      default: see = {};
    }
    const own = gs.length ? synthesize(gs, demo).candidates.slice(0, 3).map(c => c.id) : [];
    // An abnormal axis that a fascicular block already explains is shown, not double-counted.
    const note = s.key === "axis" && result.metrics?.axisCat === "lad" && (ctx.lafb || ctx.bifasc) ? "axisByFascicle" : null;
    return {
      n, key: s.key, groups: gs.map(g => g.key), see, note,
      abnormal: gs.length > 0,
      own,                                            // best explanations of this step alone
      differential: runningDifferential(groups, demo, n), // best explanations so far
    };
  });

  const top = synth.candidates.slice(0, 3);
  const normal = synth.activeCount === 0 || synth.candidates.length === 0;
  return {
    demo, groups, byKey, leads, globalGroups, steps,
    synth: { ...synth, top, normal },
    coverage: { leads: reviewed.length },
  };
}

export { FINDINGS, STEPS, LEADS, LAYOUT };
