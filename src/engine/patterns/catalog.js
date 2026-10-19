// The abnormality catalog: every finding type the pattern layer can raise, which
// reading step it belongs to, and the candidate causes (with base weights) that
// produce it. Weights are relative teaching weights (1–10) for an undifferentiated
// adult — "how often is this the explanation when you see this finding" — and are
// multiplied by the demographic prior in causes.js. They are meant to be audited
// and argued with: edit the numbers here, nothing else depends on their scale.
//
// Causes can differ by territory. `scope` keys: inf, lat, ant, avr, diffuse, or
// `default`. Lists are deliberately longer than 5 — the UI shows the top 5 after
// the demographic prior has re-ordered them.

import { L } from "./causes.js";

export const TERR = {
  inf: ["II", "III", "aVF"],
  lat: ["I", "aVL", "V5", "V6"],
  ant: ["V1", "V2", "V3", "V4"],
  avr: ["aVR"],
};
export const terrOf = (n) => Object.keys(TERR).find(k => TERR[k].includes(n));

export const TERR_NAME = {
  inf: L("inferior", "하벽"),
  lat: L("lateral", "측벽"),
  ant: L("anterior / septal", "전벽 / 중격"),
  avr: L("aVR", "aVR"),
  diffuse: L("diffuse", "광범위"),
};

export const STEPS = [
  { key: "rate", title: L("Rate", "맥박수"), q: L("How fast is the ventricle going?", "심실은 얼마나 빠른가?") },
  { key: "rhythm", title: L("Rhythm", "리듬"), q: L("Is it regular, and does a P wave drive every QRS?", "규칙적인가, 모든 QRS 앞에 P파가 있는가?") },
  { key: "axis", title: L("Axis", "축"), q: L("Where is the QRS pointing in the frontal plane?", "전두면에서 QRS는 어느 쪽을 향하는가?") },
  { key: "intervals", title: L("Intervals (PR, QRS, QT)", "간격 (PR, QRS, QT)"), q: L("Is conduction fast enough, narrow enough, and repolarisation short enough?", "전도 속도, QRS 폭, 재분극 시간은 적절한가?") },
  { key: "pwave", title: L("P waves (atria)", "P파 (심방)"), q: L("Are the atria enlarged or the P wave abnormal in shape?", "심방이 커졌거나 P파 모양이 비정상인가?") },
  { key: "qrs", title: L("QRS: Q, R, S, voltage, progression", "QRS: Q, R, S, 전압, 진행"), q: L("Is there scar (Q), hypertrophy (voltage), or abnormal R-wave progression?", "반흔(Q), 비대(전압), R파 진행 이상이 있는가?") },
  { key: "st", title: L("ST segment", "ST 분절"), q: L("Is the ST segment off the baseline, and in what pattern?", "ST 분절이 기저선에서 벗어났는가, 어떤 양상인가?") },
  { key: "t", title: L("T waves", "T파"), q: L("Are the T waves the right size and direction?", "T파의 크기와 방향이 적절한가?") },
];
export const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.key, i + 1]));

// Compact constructor: [causeId, weight] pairs.
const c = (...pairs) => pairs;

export const FINDINGS = {
  // ── 1. rate ─────────────────────────────────────────────────────────────
  rate_low: {
    step: 1, name: L("Bradycardia", "서맥"),
    causes: c(["athlete", 5], ["avdrug", 5], ["vagal", 4], ["degen", 3], ["hypothyroid", 2], ["cns", 1], ["hypothermia", 1], ["inferiorMI", 1.5]),
  },
  rate_high: {
    step: 1, name: L("Tachycardia", "빈맥"),
    causes: c(["symp", 8], ["af", 3], ["pe", 2], ["hyperthyroid", 2], ["svt", 2], ["flutter", 1.5], ["demand", 1]),
  },

  // ── 2. rhythm ───────────────────────────────────────────────────────────
  rhythm_irreg: {
    step: 2, name: L("Irregularly irregular R–R", "불규칙한 R–R (완전 불규칙)"),
    causes: c(["af", 8], ["ectopy", 4], ["sinusarr", 3], ["flutter", 2], ["mat", 1.5]),
  },
  rhythm_regirreg: {
    step: 2, name: L("Regularly irregular R–R (grouped beats)", "규칙적으로 불규칙한 R–R (군집 박동)"),
    causes: c(["ectopy", 5], ["avb", 3], ["sinusarr", 2], ["flutter", 2]),
  },
  p_dissoc: {
    step: 2, name: L("P wave not before every QRS", "모든 QRS 앞에 P파가 없음"),
    causes: c(["af", 5], ["avb", 4], ["ectopicatr", 2], ["flutter", 2], ["vrhythm", 1.5]),
  },
  p_inv: {
    step: 2, name: L("Inverted P wave", "P파 역위"),
    causes: {
      I: c(["limbrev", 7], ["dextro", 3], ["ectopicatr", 2]),
      default: c(["ectopicatr", 7], ["limbrev", 2], ["dextro", 1]),
    },
  },

  // ── 3. axis ─────────────────────────────────────────────────────────────
  axis_lad: {
    step: 3, name: L("Left axis deviation", "좌축편위"),
    causes: c(["lafb", 6], ["lvh_htn", 3], ["inferiorMI", 3], ["lbbb", 3], ["normalvar", 3], ["congenital", 1], ["wpw", 1], ["hyperk", 0.5]),
  },
  axis_rad: {
    step: 3, name: L("Right axis deviation", "우축편위"),
    causes: c(["normalvar", 4], ["rvh", 4], ["pe", 3], ["copd", 3], ["limbrev", 3], ["lpfb", 1.5], ["congenital", 1.5], ["dextro", 1]),
  },
  axis_extreme: {
    step: 3, name: L("Extreme (north-west) axis", "극단적 축 (북서쪽 축)"),
    causes: c(["limbrev", 5], ["vrhythm", 4], ["copd", 2], ["rvh", 2], ["pacing", 2], ["hyperk", 1]),
  },
  axis_reversal: {
    step: 3, name: L("Lead I negative with aVR positive", "I 유도 음성 + aVR 양성"),
    causes: c(["limbrev", 9], ["dextro", 3]),
  },

  // ── 4. intervals ────────────────────────────────────────────────────────
  pr_long: {
    step: 4, name: L("Long PR (first-degree AV block)", "PR 연장 (1도 방실차단)"),
    causes: c(["degen", 5], ["avdrug", 5], ["vagal", 3], ["inferiorMI", 2], ["lyme", 1], ["hyperk", 1], ["cad", 1.5]),
  },
  pr_short: {
    step: 4, name: L("Short PR", "PR 단축"),
    causes: c(["wpw", 6], ["ectopicatr", 3], ["normalvar", 3], ["hcm", 1]),
  },
  pr_short_delta: {
    step: 4, name: L("Short PR with a delta wave", "delta파를 동반한 PR 단축"),
    causes: c(["wpw", 12], ["ectopicatr", 1]),
  },
  qrs_lbbb: {
    step: 4, name: L("Left bundle branch block", "좌각차단"),
    causes: c(["cad", 4], ["lvh_htn", 4], ["cardiomyopathy", 4], ["aorticvalve", 2], ["degen", 3], ["hyperk", 0.5]),
  },
  qrs_rbbb: {
    step: 4, name: L("Right bundle branch block", "우각차단"),
    causes: c(["normalvar", 3], ["degen", 3], ["pe", 2], ["pulmhtn", 2], ["congenital", 2], ["cad", 2], ["cardiomyopathy", 1], ["brugada", 0.5]),
  },
  qrs_irbbb: {
    step: 4, name: L("Incomplete right bundle branch block", "불완전 우각차단"),
    causes: c(["normalvar", 6], ["athlete", 3], ["congenital", 2], ["rvh", 2], ["pe", 1]),
  },
  qrs_ivcd: {
    step: 4, name: L("Wide QRS, no typical bundle pattern", "넓은 QRS, 전형적 각차단 양상 아님"),
    causes: c(["cardiomyopathy", 4], ["hyperk", 3], ["nablock", 3], ["lvh_htn", 3], ["cad", 3], ["pacing", 2], ["wpw", 1.5]),
  },
  qrs_lafb: {
    step: 4, name: L("Left anterior fascicular block", "좌전분지차단"),
    causes: c(["degen", 4], ["cad", 3], ["lvh_htn", 3], ["cardiomyopathy", 2], ["hcm", 1], ["normalvar", 1]),
  },
  qrs_lpfb: {
    step: 4, name: L("Left posterior fascicular block", "좌후분지차단"),
    causes: c(["cad", 4], ["rvh", 2], ["copd", 2], ["degen", 2], ["normalvar", 1]),
  },
  qrs_bifasc: {
    step: 4, name: L("Bifascicular block", "2분지 차단"),
    causes: c(["degen", 5], ["cad", 4], ["cardiomyopathy", 3], ["lvh_htn", 2]),
  },
  qt_long: {
    step: 4, name: L("Long QTc", "QTc 연장"),
    causes: c(["qtdrug", 6], ["hypok", 5], ["longqt", 2], ["hypoca", 2], ["cns", 1.5], ["nstemi", 1.5], ["hypothyroid", 1]),
  },
  qt_short: {
    step: 4, name: L("Short QTc", "QTc 단축"),
    causes: c(["hypercalc", 5], ["digoxin", 3], ["hyperk", 1], ["longqt", 0.5]),
  },

  // ── 5. P wave morphology ────────────────────────────────────────────────
  p_tall: {
    step: 5, name: L("Tall P wave (right atrial abnormality)", "높은 P파 (우심방 이상)"),
    causes: c(["copd", 4], ["pulmhtn", 3], ["congenital", 3], ["normalvar", 2], ["rvh", 2]),
  },
  p_biph: {
    step: 5, name: L("Wide / biphasic P in V1 (left atrial abnormality)", "V1 넓은/이상성 P파 (좌심방 이상)"),
    causes: c(["lvh_htn", 4], ["mitral", 4], ["lvdys", 3], ["af", 3], ["hcm", 2], ["aorticvalve", 2]),
  },

  // ── 6. QRS ──────────────────────────────────────────────────────────────
  q_path: {
    step: 6, name: L("Pathologic Q wave / QS", "병적 Q파 / QS"),
    causes: {
      inf: c(["oldmi", 6], ["hcm", 2], ["wpw", 2], ["cardiomyopathy", 2], ["normalvar", 1]),
      lat: c(["oldmi", 5], ["hcm", 3], ["cardiomyopathy", 2], ["lvh_htn", 1], ["wpw", 1], ["dextro", 1]),
      ant: c(["oldmi", 6], ["lbbb", 3], ["cardiomyopathy", 3], ["lvh_htn", 2], ["copd", 2], ["normalvar", 2], ["lafb", 1], ["leadplace", 1]),
      default: c(["oldmi", 5], ["cardiomyopathy", 2], ["hcm", 2], ["normalvar", 2]),
    },
  },
  r_tall: {
    step: 6, name: L("Tall R wave (high voltage)", "높은 R파 (고전압)"),
    causes: c(["lvh_htn", 6], ["athlete", 3], ["normalvar", 3], ["aorticvalve", 3], ["hcm", 2]),
  },
  r_v1_tall: {
    step: 6, name: L("Dominant R wave in V1", "V1 우세 R파"),
    causes: c(["rvh", 4], ["normalvar", 3], ["posteriorMI", 3], ["rbbb", 3], ["wpw", 2], ["dextro", 1], ["hcm", 1]),
  },
  s_deep: {
    step: 6, name: L("Deep S wave in V1–V3", "V1–V3 깊은 S파"),
    causes: c(["lvh_htn", 5], ["normalvar", 3], ["athlete", 3], ["lbbb", 2], ["aorticvalve", 2]),
  },
  rsr: {
    step: 6, name: L("rSR′ pattern in V1–V2", "V1–V2 rSR′ 양상"),
    causes: c(["rbbb", 6], ["normalvar", 3], ["congenital", 2], ["rvh", 2], ["brugada", 1], ["pe", 1], ["leadplace", 1]),
  },
  frag: {
    step: 6, name: L("Fragmented (notched) QRS", "분절 (notch) QRS"),
    causes: c(["oldmi", 5], ["cardiomyopathy", 3], ["lbbb", 2], ["normalvar", 1]),
  },
  r_poor: {
    step: 6, name: L("Poor R-wave progression (R in V3 < 3 mm)", "R파 진행 불량 (V3 R < 3 mm)"),
    causes: c(["oldmi", 4], ["lvh_htn", 3], ["copd", 3], ["normalvar", 3], ["lafb", 3], ["leadplace", 3], ["cardiomyopathy", 2]),
  },
  low_voltage: {
    step: 6, name: L("Low voltage (limb leads < 5 mm)", "저전압 (사지 유도 < 5 mm)"),
    causes: c(["copd", 4], ["effusion", 3], ["obesity", 3], ["infiltrative", 2], ["hypothyroid", 2], ["cardiomyopathy", 2]),
  },
  volt_lvh: {
    step: 6, name: L("LVH voltage criteria met", "LVH 전압 기준 충족"),
    causes: c(["lvh_htn", 8], ["aorticvalve", 3], ["hcm", 3], ["athlete", 3], ["normalvar", 3]),
  },
  rvh_pattern: {
    step: 6, name: L("RVH pattern (tall R V1 + right axis)", "RVH 양상 (V1 높은 R + 우축편위)"),
    causes: c(["pulmhtn", 5], ["congenital", 4], ["pe", 1.5], ["mitral", 2], ["copd", 3]),
  },
  s1q3t3: {
    step: 6, name: L("S1Q3T3 pattern", "S1Q3T3 양상"),
    causes: c(["pe", 9], ["copd", 1], ["normalvar", 1]),
  },

  // ── 7. ST ──────────────────────────────────────────────────────────────
  ste: {
    step: 7, name: L("ST elevation", "ST 상승"),
    causes: {
      ant: c(["stemi", 6], ["earlyrepol", 5], ["lvh_htn", 3], ["lbbb", 3], ["pericarditis", 2], ["brugada", 2], ["aneurysm", 2], ["takotsubo", 1.5]),
      inf: c(["stemi", 6], ["pericarditis", 3], ["earlyrepol", 3], ["myocarditis", 2], ["prinzmetal", 1.5], ["aneurysm", 1], ["takotsubo", 1]),
      lat: c(["stemi", 4], ["earlyrepol", 4], ["pericarditis", 3], ["myocarditis", 2], ["takotsubo", 1.5], ["aneurysm", 1]),
      avr: c(["lmca", 6], ["demand", 4], ["nstemi", 2], ["pe", 2], ["limbrev", 1]),
      diffuse: c(["pericarditis", 6], ["earlyrepol", 5], ["myocarditis", 3], ["takotsubo", 1], ["stemi", 1.5], ["hypothermia", 0.5]),
      default: c(["stemi", 5], ["earlyrepol", 3], ["pericarditis", 3]),
    },
  },
  std: {
    step: 7, name: L("ST depression", "ST 하강"),
    causes: {
      ant: c(["posteriorMI", 4], ["nstemi", 3], ["rvh", 3], ["rbbb", 2], ["hypok", 2], ["digoxin", 2]),
      inf: c(["nstemi", 4], ["lvh_strain", 3], ["digoxin", 3], ["tachyrate", 3], ["hypok", 2], ["stemi", 1.5]),
      lat: c(["lvh_strain", 5], ["nstemi", 4], ["digoxin", 3], ["lbbb", 2], ["tachyrate", 2], ["hypok", 2]),
      diffuse: c(["nstemi", 5], ["demand", 4], ["digoxin", 3], ["hypok", 3], ["tachyrate", 2], ["lvh_strain", 2]),
      default: c(["nstemi", 4], ["lvh_strain", 3], ["digoxin", 3], ["hypok", 2]),
    },
  },
  std_recip: {
    step: 7, name: L("ST depression opposite an ST elevation (reciprocal)", "ST 상승 반대편의 ST 하강 (거울상)"),
    causes: c(["stemi", 9], ["nstemi", 1.5]),
  },
  avr_diffuse_std: {
    step: 7, name: L("ST elevation in aVR with diffuse ST depression", "aVR ST 상승 + 광범위 ST 하강"),
    causes: c(["lmca", 9], ["demand", 4], ["nstemi", 3]),
  },
  sgarbossa: {
    step: 7, name: L("Sgarbossa-positive ST change in LBBB", "LBBB에서 Sgarbossa 양성 ST 변화"),
    causes: c(["stemi", 9], ["nstemi", 2]),
  },

  // ── 8. T waves ─────────────────────────────────────────────────────────
  t_peaked: {
    step: 8, name: L("Tall / peaked T wave", "높은/뾰족한 T파"),
    causes: c(["hyperk", 5], ["earlyrepol", 4], ["stemi", 3], ["normalvar", 3], ["lvh_htn", 3], ["athlete", 2], ["lbbb", 2]),
  },
  t_inv: {
    step: 8, name: L("T-wave inversion", "T파 역위"),
    causes: {
      ant: c(["wellens", 5], ["mievol", 4], ["pe", 4], ["rvh", 3], ["juvenile", 3], ["myocarditis", 2], ["rbbb", 2], ["cardiomyopathy", 2], ["cns", 1]),
      inf: c(["mievol", 4], ["lvh_strain", 3], ["pericarditis", 2], ["myocarditis", 2], ["normalvar", 2], ["hcm", 1]),
      lat: c(["lvh_strain", 6], ["mievol", 4], ["hcm", 3], ["lbbb", 3], ["myocarditis", 2], ["takotsubo", 2], ["cns", 1.5]),
      diffuse: c(["cns", 4], ["takotsubo", 4], ["pericarditis", 3], ["myocarditis", 3], ["mievol", 2], ["hcm", 2], ["cardiacmemory", 1.5]),
      default: c(["mievol", 3], ["lvh_strain", 2], ["myocarditis", 2], ["nonspecific", 2]),
    },
  },
  t_flat: {
    step: 8, name: L("Flat / low T wave", "납작한/낮은 T파"),
    causes: c(["nonspecific", 6], ["hypok", 4], ["nstemi", 3], ["hypothyroid", 2], ["pericarditis", 1.5], ["cardiomyopathy", 1]),
  },
};

// Causes for a finding in a given scope.
export function causesFor(type, scope) {
  const f = FINDINGS[type];
  if (!f) return [];
  const c = f.causes;
  return Array.isArray(c) ? c : (c[scope] ?? c.default ?? []);
}
