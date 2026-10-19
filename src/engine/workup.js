// Reasoning engine: turns measured leads + intervals into a workup written as
// question → principle → rule → calculation → check → resolution → consequence.
// Each module may add findings, retract earlier ones, and request measurements.

import { LIMB, PRECORDIAL, LEADS, netQRS } from "./leads.js";
import { fitAxis, angularRange, axisCategory, normDeg } from "./axis.js";
import en from "./text/en.js";
import ko from "./text/ko.js";

const PACKS = { en, ko };

const GROUPS = {
  inferior: ["II", "III", "aVF"],
  highLateral: ["I", "aVL"],
  lateral: ["V4", "V5", "V6"],
  anterior: ["V1", "V2", "V3", "V4"],
};

const mod = (id, T) => ({
  id, title: T.title[id], question: T.question[id],
  status: "incomplete", short: "",
  principle: [], rule: [], data: [], checks: [], criteria: [],
  resolution: "", consequences: [], next: [],
});

const crit = (label, value, status, note) => ({ label, value, status, note });
const statusOf = (ok, border = false) => (ok == null ? "unknown" : ok ? "met" : border ? "border" : "not");

export function runWorkup(ecg, lang = "en") {
  const T = PACKS[lang] || en;
  const lead = (n) => (ecg.reviewed[n] ? ecg.leads[n] : null);
  const iv = (k) => (ecg.ivReviewed[k] ? ecg.iv[k] : null);
  const m = ecg.meta;

  const ctx = {
    T, lead, iv, meta: m, ecg, ecgIv: ecg.iv,
    findings: [], retracted: [], recs: [],
    sex: m.sex || null, age: m.age ?? null, hr: m.hr ?? null,
  };
  ctx.add = (key, label, certainty, module, severity = 1) =>
    ctx.findings.push({ key, label, certainty, module, severity });
  ctx.retract = (key, reason, module) => {
    const i = ctx.findings.findIndex(f => f.key === key);
    const label = i >= 0 ? ctx.findings[i].label : T.retractLabel[key];
    if (i >= 0) ctx.findings.splice(i, 1);
    ctx.retracted.push({ key, label, reason, module });
  };
  ctx.rec = (key) => { if (!ctx.recs.includes(key)) ctx.recs.push(key); };

  const mods = {};
  mods.rhythm = rhythm(ctx);
  mods.axis = axis(ctx);
  mods.conduction = conduction(ctx);
  mods.fascicles = fascicles(ctx);
  finalizeConduction(ctx, mods);
  mods.atria = atria(ctx);
  mods.hiddenQrs = hiddenQrs(ctx);
  mods.hypertrophy = hypertrophy(ctx);
  mods.stt = stt(ctx);
  mods.qt = qt(ctx);
  mods.cluster = cluster(ctx, mods);

  // Display order: cluster, then whatever its questions point at, then the rest
  // (abnormal first). Axis always precedes fascicles.
  const order = ["cluster"];
  const push = (id) => { if (!order.includes(id)) order.push(id); };
  for (const q of mods.cluster.questions) {
    if (q.module === "fascicles") push("axis");
    push(q.module);
  }
  const rest = ["rhythm", "axis", "conduction", "fascicles", "atria", "hiddenQrs", "hypertrophy", "stt", "qt"]
    .filter(id => !order.includes(id));
  const rank = { abnormal: 0, borderline: 1, info: 2, normal: 3, incomplete: 4 };
  rest.sort((a, b) => rank[mods[a].status] - rank[mods[b].status]);
  order.push(...rest);

  const stepNo = {};
  order.forEach((id, i) => { stepNo[id] = i + 1; mods[id].n = i + 1; });
  const fill = (x) => {
    if (typeof x === "string") return x.replace(/\{\{step:(\w+)\}\}/g, (_, id) => T.stepRef(stepNo[id]));
    if (Array.isArray(x)) return x.map(fill);
    if (x && typeof x === "object") {
      const o = {};
      for (const k in x) o[k] = fill(x[k]);
      return o;
    }
    return x;
  };
  const modules = order.map(id => fill(mods[id]));

  const findings = ctx.findings
    .map(f => ({ ...fill(f), step: stepNo[f.module] }))
    .sort((a, b) => b.severity - a.severity || a.step - b.step);
  const retracted = ctx.retracted.map(r => ({ ...fill(r), step: stepNo[r.module] }));
  const next = modules.flatMap(md => md.next.map(text => ({ text, step: md.n })));
  const recs = ctx.recs.map(k => T.rec[k]);

  return { modules, findings, retracted, recs, next, coverage: coverage(ecg) };
}

function coverage(ecg) {
  const leads = LEADS.filter(n => ecg.reviewed[n]).length;
  const ivs = ["pDur", "pr", "qrs", "qt"].filter(k => ecg.ivReviewed[k]).length;
  return { leads, ivs };
}

// ── 1. Rate & rhythm ────────────────────────────────────────────────────────
function rhythm(ctx) {
  const { T, lead, iv, meta } = ctx;
  const M = mod("rhythm", T);
  M.principle = T.rhythm.principle;
  M.rule = T.rhythm.rule;
  const hr = meta.hr, I = lead("I"), II = lead("II"), aVR = lead("aVR");
  const pr = iv("pr");

  const pAxis = I && II ? I.p > 0 && II.p > 0 && (!aVR || aVR.p < 0) : null;
  M.criteria.push(crit(T.rhythm.cRate, hr != null ? `${hr} bpm` : "—", statusOf(hr == null ? null : hr >= 60 && hr <= 100)));
  M.criteria.push(crit(T.rhythm.cPAxis, I && II ? T.rhythm.pAxisVal(I.p, II.p) : "—", statusOf(pAxis)));
  M.criteria.push(crit(T.rhythm.c1to1, meta.pEveryQrs ? T.yesNo[meta.pEveryQrs] : "—",
    statusOf(meta.pEveryQrs ? meta.pEveryQrs === "yes" : null)));
  M.criteria.push(crit(T.rhythm.cRegular, meta.rhythm ? T.rhythmVal[meta.rhythm] : "—",
    statusOf(meta.rhythm ? meta.rhythm === "regular" : null)));
  M.criteria.push(crit(T.rhythm.cPR, pr != null ? `${pr} ms` : "—", statusOf(pr == null ? null : pr >= 120 && pr <= 200)));

  const abn = [];
  if (hr != null && hr < 60) { abn.push(T.rhythm.brady(hr)); ctx.add("brady", T.rhythm.brady(hr), "definite", "rhythm", 1); }
  if (hr != null && hr > 100) { abn.push(T.rhythm.tachy(hr)); ctx.add("tachy", T.rhythm.tachy(hr), "definite", "rhythm", 2); }
  ctx.avb1 = pr != null && pr > 200;
  if (ctx.avb1) { abn.push(T.rhythm.avb1(pr)); ctx.add("avb1", T.rhythm.avb1(pr), "definite", "rhythm", 2); }
  ctx.shortPR = pr != null && pr < 120;
  ctx.preexc = !!meta.delta;
  if (ctx.preexc) {
    const cert = ctx.shortPR ? "definite" : "possible";
    abn.push(T.rhythm.preexc);
    ctx.add("preexc", T.rhythm.preexc, cert, "rhythm", 4);
    M.consequences.push(T.rhythm.preexcConseq);
  } else if (ctx.shortPR) {
    abn.push(T.rhythm.shortPR(pr));
    ctx.add("shortPR", T.rhythm.shortPR(pr), "definite", "rhythm", 1);
    M.checks.push({ level: "warn", text: T.rhythm.shortPRcheck });
  }
  if (meta.rhythm === "irregirreg" && meta.pEveryQrs === "no") {
    abn.push(T.rhythm.af);
    ctx.add("af", T.rhythm.af, "probable", "rhythm", 4);
  } else if (meta.rhythm === "regirreg") {
    abn.push(T.rhythm.regirreg);
    M.checks.push({ level: "warn", text: T.rhythm.regirregCheck });
  }
  if (I && I.p < 0) {
    M.checks.push({ level: "bad", text: T.rhythm.pInvertedI });
  }

  ctx.sinus = pAxis && meta.pEveryQrs === "yes" && meta.rhythm !== "irregirreg";
  if (hr == null) M.next.push(T.rhythm.needHR);
  if (!meta.rhythm) M.next.push(T.rhythm.needRhythm);
  if (pr == null) M.next.push(T.rhythm.needPR);

  const base = ctx.sinus ? T.rhythm.sinus(hr) : pAxis === false ? T.rhythm.nonSinus : T.rhythm.undetermined;
  M.resolution = [base, ...abn].join(" · ");
  M.short = M.resolution;
  M.status = hr == null && pr == null && !meta.rhythm ? "incomplete" : abn.length ? "abnormal" : "normal";
  return M;
}

// ── 2. Axis ────────────────────────────────────────────────────────────────
function axis(ctx) {
  const { T, lead } = ctx;
  const M = mod("axis", T);
  M.principle = T.axis.principle;
  M.rule = T.axis.rule;

  const nets = {};
  for (const n of LIMB) {
    const l = lead(n);
    if (!l) continue;
    nets[n] = netQRS(l);
    M.data.push(T.axis.netLine(n, l, nets[n]));
  }
  if (Object.keys(nets).length < 2 || !("I" in nets || "II" in nets)) {
    M.next.push(T.axis.needLeads);
    M.short = T.axis.incompleteShort;
    M.resolution = T.axis.incompleteShort;
    return M;
  }

  // Quadrant reasoning
  if ("I" in nets) M.data.push(T.axis.leadI(nets.I));
  if ("aVF" in nets) M.data.push(T.axis.leadAVF(nets.aVF));
  if ("II" in nets) M.data.push(T.axis.leadII(nets.II));

  // Pair estimates from the bipolar leads (and the classic I + aVF)
  const pairs = [["I", "II"], ["I", "III"], ["II", "III"], ["I", "aVF"]]
    .filter(([a, b]) => a in nets && b in nets);
  const pairDegs = [];
  for (const [a, b] of pairs) {
    const f = fitAxis({ [a]: nets[a], [b]: nets[b] });
    if (f && f.mag > 0.5) { pairDegs.push(f.deg); M.data.push(T.axis.pairLine(a, b, f.deg)); }
  }
  const fit = fitAxis(nets);
  if (!fit || fit.mag < 1) {
    M.resolution = T.axis.indeterminate;
    M.short = T.axis.indeterminate;
    M.status = "borderline";
    ctx.add("axisIndet", T.axis.indeterminate, "probable", "axis", 1);
    return M;
  }
  M.data.push(T.axis.fitLine(Object.keys(nets), fit.deg));
  const range = pairDegs.length ? angularRange(pairDegs) : { lo: fit.deg, hi: fit.deg, width: 0 };

  // Isoelectric lead method
  const iso = Object.entries(nets).sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0];
  if (Math.abs(iso[1]) <= 2.5) {
    const ang = { I: 0, II: 60, III: 120, aVR: -150, aVL: -30, aVF: 90 }[iso[0]];
    const c1 = normDeg(ang + 90), c2 = normDeg(ang - 90);
    const pick = Math.abs(normDeg(c1 - fit.deg)) < Math.abs(normDeg(c2 - fit.deg)) ? c1 : c2;
    M.data.push(T.axis.isoLine(iso[0], iso[1], c1, c2, pick));
  }

  // Consistency checks
  let consistent = true;
  if (["I", "II", "III"].every(n => n in nets)) {
    const e = nets.II - (nets.I + nets.III);
    const tol = Math.max(1, 0.15 * Math.max(Math.abs(nets.I), Math.abs(nets.II), Math.abs(nets.III)));
    const ok = Math.abs(e) <= tol;
    consistent = consistent && ok;
    M.checks.push({ level: ok ? "ok" : "bad", text: T.axis.einthoven(nets.I, nets.II, nets.III, e, ok) });
  } else {
    M.next.push(T.axis.needEinthoven);
  }
  if (["aVR", "aVL", "aVF"].every(n => n in nets)) {
    const sum = nets.aVR + nets.aVL + nets.aVF;
    const tol = Math.max(1, 0.15 * Math.max(Math.abs(nets.aVR), Math.abs(nets.aVL), Math.abs(nets.aVF)));
    const ok = Math.abs(sum) <= tol;
    consistent = consistent && ok;
    M.checks.push({ level: ok ? "ok" : "bad", text: T.axis.goldberger(nets.aVR, nets.aVL, nets.aVF, sum, ok) });
  }
  const worst = Object.entries(fit.residuals).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  if (Object.keys(nets).length >= 3 && Math.abs(worst[1]) > 1.5) {
    M.checks.push({ level: "warn", text: T.axis.residual(worst[0], worst[1]) });
  }
  if (!consistent) {
    const single = LIMB.filter(n => lead(n) && (lead(n).s === 0 || lead(n).r === 0) && Math.abs(nets[n]) > 2);
    M.checks.push({ level: "warn", text: T.axis.whyInconsistent(single) });
  }
  if ("I" in nets && "aVR" in nets && nets.I < 0 && nets.aVR > 0) {
    const pI = lead("I").p;
    M.checks.push({ level: "bad", text: T.axis.reversal(pI < 0) });
    ctx.add("reversal", T.axis.reversalFinding, pI < 0 ? "probable" : "possible", "axis", 5);
  }

  const cat = axisCategory(fit.deg);
  ctx.axis = { deg: fit.deg, lo: range.lo, hi: range.hi, cat, consistent };
  M.viz = { deg: fit.deg, lo: range.lo, hi: range.hi, pairs: pairDegs, nets };
  M.resolution = T.axis.resolution(fit.deg, range, cat, consistent, pairDegs.length);
  M.short = T.axis.short(fit.deg, cat);
  M.status = cat === "normal" ? "normal" : "abnormal";
  if (!consistent) M.status = cat === "normal" ? "borderline" : "abnormal";
  const cert = consistent ? "definite" : "probable";
  if (cat === "lad") ctx.add("lad", T.axis.finding.lad(fit.deg), cert, "axis", 2);
  if (cat === "rad") ctx.add("rad", T.axis.finding.rad(fit.deg), cert, "axis", 2);
  if (cat === "extreme") ctx.add("extreme", T.axis.finding.extreme(fit.deg), cert, "axis", 3);
  if (!consistent) M.next.push(T.axis.remeasure);
  return M;
}

// ── 3. QRS duration & bundle branches ───────────────────────────────────────
function conduction(ctx) {
  const { T, lead, iv } = ctx;
  const M = mod("conduction", T);
  M.principle = T.conduction.principle;
  M.rule = T.conduction.rule;
  const qrs = iv("qrs");
  const V1 = lead("V1"), V2 = lead("V2"), I = lead("I"), V5 = lead("V5"), V6 = lead("V6"), aVL = lead("aVL");
  ctx.bbb = null;
  if (qrs == null) {
    M.next.push(T.conduction.needQRS);
    M.short = T.conduction.incompleteShort;
    M.resolution = M.short;
    return M;
  }
  M.data.push(T.conduction.qrsLine(qrs));

  const rsr = V1 || V2 ? !!((V1 && V1.r2 > 0) || (V2 && V2.r2 > 0)) : null;
  const wideS = I && V6 ? I.s > 0 && V6.s > 0 : null;
  const noLatQ = [I, V5, V6].some(Boolean) ? [I, V5, V6].filter(Boolean).every(l => l.q === 0) : null;
  const latRPT = V5 || V6 ? Math.max(V5?.rpt ?? 0, V6?.rpt ?? 0) : null;
  const v1QS = V1 ? V1.r2 === 0 && V1.s > V1.r * 2 && V1.r <= 3 : null;
  const latBroadR = I && V6 ? I.s <= I.r * 0.2 && V6.s <= V6.r * 0.2 : null;

  if (qrs >= 120) {
    const rb = [
      crit(T.conduction.cQRS120, `${qrs} ms`, "met"),
      crit(T.conduction.cRsr, V1 ? T.conduction.rsrVal(V1) : "—", statusOf(rsr)),
      crit(T.conduction.cWideS, I && V6 ? T.conduction.sVal(I.s, V6.s) : "—", statusOf(wideS)),
    ];
    const lb = [
      crit(T.conduction.cQRS120, `${qrs} ms`, "met"),
      crit(T.conduction.cV1QS, V1 ? T.conduction.v1Val(V1) : "—", statusOf(v1QS)),
      crit(T.conduction.cLatR, I && V6 ? T.conduction.latRVal(I, V6) : "—", statusOf(latBroadR)),
      crit(T.conduction.cNoQ, noLatQ == null ? "—" : noLatQ ? T.conduction.none : T.conduction.present, statusOf(noLatQ)),
      crit(T.conduction.cRPT60, latRPT != null ? `${latRPT} ms` : "—", statusOf(latRPT == null ? null : latRPT > 60)),
    ];
    if (rsr && wideS !== false) {
      ctx.bbb = "rbbb";
      M.criteria = rb;
      M.resolution = T.conduction.rbbb(qrs);
      ctx.add("rbbb", T.conduction.rbbbFinding, wideS ? "definite" : "probable", "conduction", 3);
      M.consequences.push(T.conduction.rbbbConseq);
      if (wideS == null) M.next.push(T.conduction.needWideS);
    } else if (v1QS && latBroadR && noLatQ !== false) {
      ctx.bbb = "lbbb";
      M.criteria = lb;
      M.resolution = T.conduction.lbbb(qrs);
      ctx.add("lbbb", T.conduction.lbbbFinding, latRPT > 60 ? "definite" : "probable", "conduction", 4);
      M.consequences.push(T.conduction.lbbbConseq);
      if (latRPT == null || latRPT <= 60) M.next.push(T.conduction.needRPT);
    } else {
      M.criteria = [...rb, ...lb.slice(1)];
      ctx.ivcdCandidate = "wide";
      M.resolution = T.conduction.ivcdWide(qrs);
      if (!V1 || !V6) M.next.push(T.conduction.needMorph);
    }
    M.status = "abnormal";
  } else if (qrs > 110) {
    if (rsr) {
      ctx.bbb = "irbbb";
      M.resolution = T.conduction.irbbb(qrs);
      ctx.add("irbbb", T.conduction.irbbbFinding, "probable", "conduction", 1);
      M.criteria = [crit(T.conduction.cQRS110, `${qrs} ms`, "met"), crit(T.conduction.cRsr, T.conduction.rsrVal(V1 || V2), "met")];
    } else if (noLatQ && latRPT != null && latRPT > 60) {
      ctx.bbb = "ilbbb";
      M.resolution = T.conduction.ilbbb(qrs);
      ctx.add("ilbbb", T.conduction.ilbbbFinding, "possible", "conduction", 1);
      M.criteria = [crit(T.conduction.cQRS110, `${qrs} ms`, "met"), crit(T.conduction.cNoQ, T.conduction.none, "met"),
        crit(T.conduction.cRPT60, `${latRPT} ms`, "met")];
    } else {
      ctx.ivcdCandidate = "border";
      M.resolution = T.conduction.ivcdBorder(qrs);
      M.criteria = [crit(T.conduction.cQRS110, `${qrs} ms`, "met"),
        crit(T.conduction.cRsr, V1 ? T.conduction.rsrVal(V1) : "—", statusOf(rsr)),
        crit(T.conduction.cRPT60, latRPT != null ? `${latRPT} ms` : "—", statusOf(latRPT == null ? null : latRPT > 60))];
    }
    M.status = "borderline";
  } else {
    M.resolution = T.conduction.normal(qrs);
    M.status = "normal";
  }
  if (aVL && ctx.bbb === "lbbb") M.checks.push({ level: "ok", text: T.conduction.lbbbAxisNote });
  M.short = M.resolution;
  return M;
}

// Runs after fascicles: decide whether a widened QRS has a name.
function finalizeConduction(ctx, mods) {
  const { T } = ctx;
  const M = mods.conduction;
  const fasc = ctx.lafb || ctx.lpfb;
  if (ctx.ivcdCandidate === "border") {
    if (fasc && fasc.certainty !== "possible") {
      ctx.retract("ivcd", T.conduction.ivcdRetracted(fasc.name), "fascicles");
      M.consequences.push(T.conduction.explainedBy(fasc.name));
      M.short = T.conduction.explainedShort(ctx.iv("qrs"), fasc.name);
      M.resolution = M.short;
      M.status = "info";
      mods.fascicles.consequences.push(T.fascicles.ivcdRemoved(ctx.iv("qrs")));
    } else {
      ctx.add("ivcd", T.conduction.ivcdFinding, "possible", "conduction", 1);
      if (fasc) M.consequences.push(T.conduction.maybeExplained(fasc.name));
    }
  } else if (ctx.ivcdCandidate === "wide") {
    ctx.add("ivcd", T.conduction.ivcdWideFinding, "definite", "conduction", 2);
  }
  if (ctx.bbb === "rbbb" && fasc) {
    const label = T.fascicles.bifascicular(fasc.name, ctx.avb1);
    ctx.add("bifasc", label, fasc.certainty === "definite" ? "definite" : "probable", "fascicles", 4);
    mods.fascicles.consequences.push(T.fascicles.bifascConseq(ctx.avb1));
    ctx.rec("conductionDisease");
  }
}

// ── 4. Fascicles ────────────────────────────────────────────────────────────
function fascicles(ctx) {
  const { T, lead, iv } = ctx;
  const M = mod("fascicles", T);
  const ax = ctx.axis;
  const qrs = iv("qrs");
  if (!ax) {
    M.short = T.fascicles.needAxis;
    M.resolution = M.short;
    return M;
  }
  if (ctx.bbb === "lbbb") {
    M.resolution = T.fascicles.lbbbNA;
    M.short = M.resolution;
    M.status = "info";
    return M;
  }
  if (ctx.preexc) M.checks.push({ level: "bad", text: T.fascicles.preexcNA });
  const qrsOk = qrs == null ? null : qrs < 120 || ctx.bbb === "rbbb";
  const qrsVal = qrs == null ? "—" : ctx.bbb === "rbbb" && qrs >= 120 ? T.fascicles.qrsWithRbbb(qrs) : `${qrs} ms`;

  if (ax.deg < -30) {
    M.question = T.fascicles.qLAFB;
    M.principle = T.fascicles.lafbPrinciple;
    M.rule = T.fascicles.lafbRule;
    const aVL = lead("aVL");
    const axisBorder = ax.deg > -45 && ax.deg <= -40 || (ax.lo <= -45 && ax.hi > -45);
    const c1 = ax.deg <= -45 && ax.deg >= -90;
    const c2 = aVL ? aVL.q > 0 && aVL.r > aVL.s : null;
    const c3 = aVL ? aVL.rpt >= 45 : null;
    M.criteria.push(crit(T.fascicles.cAxis45, T.fascicles.axisVal(ax), c1 ? (axisBorder ? "border" : "met") : axisBorder ? "border" : "not"));
    M.criteria.push(crit(T.fascicles.cQRaVL, aVL ? T.fascicles.qrVal(aVL) : "—", statusOf(c2)));
    M.criteria.push(crit(T.fascicles.cRPTaVL, aVL ? `${aVL.rpt} ms` : "—", statusOf(c3)));
    M.criteria.push(crit(T.fascicles.cQRS120, qrsVal, statusOf(qrsOk)));
    const inf = ["II", "III", "aVF"].map(n => [n, lead(n)]).filter(([, l]) => l);
    const rS = inf.length ? inf.every(([, l]) => l.r > 0 && l.s > l.r) : null;
    M.criteria.push(crit(T.fascicles.cRSinf, inf.length ? inf.map(([n, l]) => `${n} r${l.r}/S${l.s}`).join(" · ") : "—",
      statusOf(rS), T.fascicles.supporting));
    const qs = inf.filter(([, l]) => l.r === 0 && l.s > 0).map(([n]) => n);
    if (qs.length) M.checks.push({ level: "bad", text: T.fascicles.inferiorQS(qs) });
    if (aVL && aVL.q === 0) M.checks.push({ level: "warn", text: T.fascicles.noQaVL });
    if (!aVL) M.next.push(T.fascicles.needAVL);
    if (qrs == null) M.next.push(T.fascicles.needQRS);

    const core = [c2, c3, qrsOk];
    const met = core.filter(x => x === true).length, notMet = core.filter(x => x === false).length;
    let cert = null;
    if (c1 && !axisBorder && met === 3) cert = "definite";
    else if ((c1 || axisBorder) && notMet === 0 && met >= 2) cert = axisBorder ? "possible" : "probable";
    else if (c1 && notMet === 0) cert = "possible";
    if (qs.length && cert) cert = cert === "definite" ? "probable" : cert;

    if (cert) {
      ctx.lafb = { name: T.fascicles.lafbName, certainty: cert };
      const label = T.fascicles.lafbFinding(cert);
      ctx.add("lafb", label, cert, "fascicles", 2);
      M.resolution = T.fascicles.lafbResolution(cert, aVL?.rpt, axisBorder);
      M.status = cert === "possible" ? "borderline" : "abnormal";
      M.consequences.push(T.fascicles.lvhCaveat, T.fascicles.qCaveat);
    } else {
      M.resolution = T.fascicles.ladNotLafb(ax.deg, notMet > 0);
      M.status = "borderline";
      M.consequences.push(T.fascicles.ladCauses);
    }
  } else if (ax.deg > 90) {
    M.question = T.fascicles.qLPFB;
    M.principle = T.fascicles.lpfbPrinciple;
    M.rule = T.fascicles.lpfbRule;
    const I = lead("I"), aVL = lead("aVL"), III = lead("III"), aVF = lead("aVF"), V1 = lead("V1");
    const c1 = ax.deg <= 180;
    const c2 = I && aVL ? [I, aVL].every(l => l.r > 0 && l.s > l.r) : null;
    const c3 = III && aVF ? [III, aVF].every(l => l.q > 0 && l.r > l.s) : null;
    const rvh = V1 ? V1.r >= 7 || V1.r > V1.s : null;
    M.criteria.push(crit(T.fascicles.cAxis90, T.fascicles.axisVal(ax), statusOf(c1)));
    M.criteria.push(crit(T.fascicles.cRSlat, I && aVL ? `I r${I.r}/S${I.s} · aVL r${aVL.r}/S${aVL.s}` : "—", statusOf(c2)));
    M.criteria.push(crit(T.fascicles.cQRinf, III && aVF ? `III q${III.q}R${III.r} · aVF q${aVF.q}R${aVF.r}` : "—", statusOf(c3)));
    M.criteria.push(crit(T.fascicles.cQRS120, qrsVal, statusOf(qrsOk)));
    M.criteria.push(crit(T.fascicles.cNoRVH, V1 ? `V1 R${V1.r}/S${V1.s}` : "—", statusOf(rvh == null ? null : !rvh), T.fascicles.exclusion));
    if (c1 && c2 && c3 && qrsOk && rvh === false) {
      ctx.lpfb = { name: T.fascicles.lpfbName, certainty: "probable" };
      ctx.add("lpfb", T.fascicles.lpfbFinding, "probable", "fascicles", 2);
      M.resolution = T.fascicles.lpfbResolution;
      M.status = "abnormal";
    } else {
      M.resolution = T.fascicles.radNotLpfb(rvh);
      M.status = "borderline";
      if (rvh) M.consequences.push(T.fascicles.seeHypertrophy);
    }
  } else {
    M.resolution = T.fascicles.normal(ax.deg);
    M.principle = T.fascicles.normalPrinciple;
    M.status = "normal";
  }
  M.short = M.resolution;
  return M;
}

// ── 5. Atria (P wave) ───────────────────────────────────────────────────────
function atria(ctx) {
  const { T, lead, iv } = ctx;
  const M = mod("atria", T);
  M.principle = T.atria.principle;
  M.rule = T.atria.rule;
  const pDur = iv("pDur");
  const II = lead("II"), V1 = lead("V1");
  if (pDur == null && !II && !V1) {
    M.next.push(T.atria.needP);
    M.short = T.atria.incompleteShort;
    M.resolution = M.short;
    return M;
  }
  // Duration, honouring an onset-uncertainty range (pDur … pDurHi).
  const [a, b] = pDurRange(ctx);
  let durStatus = null;
  if (a != null) {
    durStatus = a >= 120 ? "met" : b >= 120 ? "border" : "not";
    M.data.push(a === b ? T.atria.durLine(a) : T.atria.durRange(a, b));
  }
  const notch = pDur != null ? !!ctx.ecgIv.pNotch : null;
  const v1Known = !!V1;
  const ptf = V1 ? (V1.pNeg * (V1.pNegDur || 0)) / 1000 : null;
  const v1Met = V1 ? V1.pNeg >= 1 && V1.pNegDur >= 40 : null;
  const v1Border = V1 ? !v1Met && ptf >= 0.03 : false;
  if (V1) M.data.push(T.atria.v1Line(V1.pNeg, V1.pNegDur, ptf));

  M.criteria.push(crit(T.atria.cDur, a == null ? "—" : a === b ? `${a} ms` : `${a}–${b} ms`, durStatus || "unknown"));
  M.criteria.push(crit(T.atria.cNotch, notch == null ? "—" : notch ? T.yes : T.no, statusOf(notch), T.atria.supporting));
  M.criteria.push(crit(T.atria.cV1, V1 ? T.atria.v1Val(V1.pNeg, V1.pNegDur) : "—", v1Met == null ? "unknown" : v1Met ? "met" : v1Border ? "border" : "not"));

  let cert = null, how = "";
  if (durStatus === "met") {
    cert = v1Met === false ? "probable" : v1Met ? "definite" : "probable";
    how = v1Met ? T.atria.howBoth : v1Met === false ? T.atria.howDurOnly : T.atria.howDurNoV1;
  } else if (durStatus === "border") {
    if (v1Met) { cert = "probable"; how = T.atria.howTiePos; }
    else if (v1Met === false) { cert = "possible"; how = T.atria.howTieNeg(v1Border); }
    else { cert = "possible"; how = T.atria.howTieUnknown; }
  } else if (v1Met) {
    cert = "possible"; how = T.atria.howV1Only;
  } else if (notch && durStatus === "not") {
    how = T.atria.howNotchOnly;
  }
  if (durStatus === "border") M.checks.push({ level: "warn", text: T.atria.onsetCheck(a, b) });
  if (!v1Known && (durStatus === "border" || durStatus === "met")) M.next.push(T.atria.needV1);
  if (a == null) M.next.push(T.atria.needDur);

  // RA abnormality
  const raa = (II && II.p > 2.5) || (V1 && V1.p > 1.5);
  if (II || V1) M.criteria.push(crit(T.atria.cRAA, `II ${II ? II.p : "—"} mm · V1 ${V1 ? V1.p : "—"} mm`, statusOf(raa)));
  if (raa) ctx.add("raa", T.atria.raaFinding, "probable", "atria", 2);

  // Interatrial block
  const infBiphasic = ["II", "III", "aVF"].map(lead).filter(Boolean);
  const advIAB = a != null && a >= 120 && infBiphasic.length >= 2 && infBiphasic.every(l => l.p > 0 && l.pNeg > 0);
  if (advIAB) {
    ctx.add("aiab", T.atria.aiabFinding, "definite", "atria", 3);
    M.consequences.push(T.atria.aiabConseq);
    ctx.rec("afRisk");
  } else if (a != null && a >= 120) {
    M.consequences.push(T.atria.partialIAB);
  }

  ctx.laa = cert;
  if (cert) {
    ctx.add("laa", T.atria.laaFinding(cert), cert, "atria", 2);
    M.resolution = T.atria.laaResolution(cert, how);
    M.status = cert === "possible" ? "borderline" : "abnormal";
    ctx.rec("echo");
  } else {
    M.resolution = how || T.atria.normal;
    M.status = raa ? "abnormal" : "normal";
  }
  if (raa) M.resolution += " " + T.atria.raaResolution;
  M.short = M.resolution;
  return M;
}

function pDurRange(ctx) {
  const lo = ctx.iv("pDur");
  if (lo == null) return [null, null];
  const hi = ctx.ecgIv.pDurHi;
  if (hi == null || hi === "" || Number.isNaN(hi)) return [lo, lo];
  return [Math.min(lo, hi), Math.max(lo, hi)];
}

// ── 6. Hidden in the QRS: Q waves and fragmentation ─────────────────────────
function hiddenQrs(ctx) {
  const { T, lead, iv } = ctx;
  const M = mod("hiddenQrs", T);
  M.principle = T.hidden.principle;
  M.rule = T.hidden.rule;
  const qrs = iv("qrs");
  const reviewed = LEADS.filter(n => lead(n));
  if (reviewed.length < 4) {
    M.next.push(T.hidden.needLeads);
    M.short = T.hidden.incompleteShort;
    M.resolution = M.short;
    return M;
  }
  const qUnreliable = ctx.bbb === "lbbb" || ctx.preexc;
  if (qUnreliable) M.checks.push({ level: "warn", text: T.hidden.qUnreliable(ctx.bbb === "lbbb") });

  const pathQ = (n) => {
    const l = lead(n);
    if (!l || n === "aVR" || n === "V1") return false;
    if (l.r === 0 && l.s > 0) return true; // QS
    if (n === "V2" || n === "V3") return l.q > 0 && l.qDur >= 20;
    return l.q >= 1 && l.qDur >= 30;
  };
  const fragLead = (n) => {
    const l = lead(n);
    if (!l) return false;
    if (l.frag) return true;
    const bbbR = (ctx.bbb === "rbbb" || ctx.bbb === "irbbb") && (n === "V1" || n === "V2");
    return l.r2 > 0 && !bbbR && n !== "aVR";
  };
  const qTerr = [], fTerr = [];
  for (const [g, ls] of Object.entries(GROUPS)) {
    const qs = ls.filter(pathQ), fs = ls.filter(fragLead);
    if (g === "inferior" && qs.length === 1 && qs[0] === "III") qs.length = 0;
    const qOk = qs.length >= 2, fOk = fs.length >= 2;
    M.criteria.push(crit(T.hidden.cQ(g), qs.length ? qs.join(", ") : T.hidden.none, qOk ? "met" : qs.length ? "border" : "not"));
    M.criteria.push(crit(T.hidden.cFrag(g), fs.length ? fs.join(", ") : T.hidden.none, fOk ? "met" : fs.length ? "border" : "not"));
    if (qOk) qTerr.push(g);
    if (fOk) fTerr.push(g);
  }
  if (qrs != null && qrs >= 120) M.checks.push({ level: "warn", text: T.hidden.wideFragRule });

  ctx.scar = { q: qTerr, frag: fTerr };
  const parts = [];
  if (qTerr.length && !qUnreliable) {
    qTerr.forEach(g => ctx.add("q_" + g, T.hidden.qFinding(g), "probable", "hiddenQrs", 3));
    parts.push(T.hidden.qResolution(qTerr));
  }
  if (fTerr.length) {
    fTerr.forEach(g => ctx.add("frag_" + g, T.hidden.fragFinding(g), "probable", "hiddenQrs", 2));
    parts.push(T.hidden.fragResolution(fTerr));
    const fNoQ = fTerr.filter(g => !qTerr.includes(g));
    if (fNoQ.length) { M.consequences.push(T.hidden.fragNoQ(fNoQ)); ctx.rec("cmr"); }
    const fQ = fTerr.filter(g => qTerr.includes(g));
    if (fQ.length) M.consequences.push(T.hidden.fragWithQ(fQ));
    if (ctx.lafb && fTerr.includes("inferior")) M.consequences.push(T.hidden.lafbFrag);
  }
  if (ctx.lafb && qTerr.includes("highLateral")) M.checks.push({ level: "warn", text: T.hidden.lafbLateralQ });
  M.resolution = parts.length ? parts.join(" ") : T.hidden.normal;
  M.status = parts.length ? "abnormal" : "normal";
  M.short = M.resolution;
  const missing = ["II", "III", "aVF", "V1", "V2", "V3", "V4", "V5", "V6", "I", "aVL"].filter(n => !lead(n));
  if (missing.length) M.next.push(T.hidden.needMore(missing));
  return M;
}

// ── 7. Hypertrophy ─────────────────────────────────────────────────────────
function hypertrophy(ctx) {
  const { T, lead } = ctx;
  const M = mod("hypertrophy", T);
  M.principle = T.hyper.principle;
  M.rule = T.hyper.rule;
  const V1 = lead("V1"), V3 = lead("V3"), V4 = lead("V4"), V5 = lead("V5"), V6 = lead("V6"), aVL = lead("aVL");
  const sex = ctx.sex;
  if (!V1 && !aVL && !V5) {
    M.next.push(T.hyper.needLeads);
    M.short = T.hyper.incompleteShort;
    M.resolution = M.short;
    return M;
  }
  const res = [];
  // Sokolow-Lyon
  if (V1 && (V5 || V6)) {
    const v = V1.s + Math.max(V5?.r ?? 0, V6?.r ?? 0);
    res.push({ k: "sokolow", ok: v >= 35, aVL: false });
    M.criteria.push(crit(T.hyper.cSokolow, `${v} mm`, v >= 35 ? "met" : v >= 30 ? "border" : "not"));
  }
  // Cornell
  if (aVL && V3) {
    const v = aVL.r + V3.s;
    const thr = sex === "f" ? 20 : 28;
    const ok = sex ? v > thr : v > 28;
    const border = !sex && v > 20 && v <= 28;
    res.push({ k: "cornell", ok, aVL: true });
    M.criteria.push(crit(T.hyper.cCornell(sex), `${v} mm`, ok ? "met" : border ? "border" : "not"));
  }
  // R aVL
  if (aVL) {
    res.push({ k: "raVL", ok: aVL.r >= 11, aVL: true });
    M.criteria.push(crit(T.hyper.cRaVL, `${aVL.r} mm`, aVL.r >= 11 ? "met" : aVL.r >= 9 ? "border" : "not"));
  }
  // Peguero–Lo Presti
  if (V4) {
    const ss = LEADS.filter(n => lead(n)).map(n => [n, lead(n).s]).sort((a, b) => b[1] - a[1]);
    const [dn, ds] = ss[0];
    const v = ds + V4.s;
    const thr = sex === "f" ? 23 : 28;
    const ok = v >= thr;
    res.push({ k: "peguero", ok, aVL: false });
    M.criteria.push(crit(T.hyper.cPeguero(sex), T.hyper.pegueroVal(dn, ds, V4.s, v), ok ? "met" : !sex && v >= 23 ? "border" : "not"));
  }
  // Strain
  const lat = ["I", "aVL", "V5", "V6"].map(n => [n, lead(n)]).filter(([, l]) => l && l.r > l.s);
  const strainLeads = lat.filter(([, l]) => l.st <= -0.5 && l.t < 0).map(([n]) => n);
  const strain = strainLeads.length >= 2;

  // Caveats
  if (ctx.bbb === "lbbb") M.checks.push({ level: "warn", text: T.hyper.lbbbCaveat });
  if (ctx.bbb === "rbbb") M.checks.push({ level: "warn", text: T.hyper.rbbbCaveat });
  if (ctx.lafb) M.checks.push({ level: "warn", text: T.hyper.lafbCaveat });
  if (ctx.age != null && ctx.age < 35) M.checks.push({ level: "warn", text: T.hyper.youngCaveat });
  if (!sex) M.next.push(T.hyper.needSex);

  const metAll = res.filter(r => r.ok);
  const metRobust = metAll.filter(r => !(ctx.lafb && r.aVL));
  let cert = null;
  if (ctx.bbb === "lbbb") cert = null;
  else if (metRobust.length && strain) cert = "definite";
  else if (metRobust.length) cert = "probable";
  else if (metAll.length) cert = "possible";
  ctx.lvhAny = metAll.length > 0;

  if (cert) {
    const label = T.hyper.lvhFinding(cert, strain);
    ctx.add("lvh", label, cert, "hypertrophy", 2);
    ctx.lvh = cert;
    ctx.rec("echo");
    M.resolution = T.hyper.lvhResolution(cert, metAll.map(r => T.hyper.critName[r.k]), metRobust.length < metAll.length, strain, strainLeads);
    M.status = cert === "possible" ? "borderline" : "abnormal";
    if (strain) M.consequences.push(T.hyper.strainConseq);
  } else {
    M.resolution = ctx.bbb === "lbbb" ? T.hyper.lbbbNA : T.hyper.noLVH;
    M.status = "normal";
  }

  // RV
  if (V1) {
    const tallR = V1.r >= 7 || (V1.r > V1.s && V1.r > 0);
    if (tallR && ctx.bbb !== "rbbb" && ctx.bbb !== "irbbb") {
      const rad = ctx.axis?.cat === "rad";
      if (rad) {
        ctx.add("rvh", T.hyper.rvhFinding, "probable", "hypertrophy", 3);
        M.resolution += " " + T.hyper.rvhResolution;
        M.status = "abnormal";
        ctx.rec("echo");
      } else {
        M.checks.push({ level: "warn", text: T.hyper.tallRV1Ddx });
        M.status = M.status === "normal" ? "borderline" : M.status;
      }
    }
  }
  M.short = M.resolution;
  return M;
}

// ── 8. ST segment & T wave ─────────────────────────────────────────────────
function stt(ctx) {
  const { T, lead } = ctx;
  const M = mod("stt", T);
  M.principle = T.stt.principle;
  M.rule = T.stt.rule;
  const rev = LEADS.filter(n => lead(n));
  if (rev.length < 4) {
    M.next.push(T.stt.needLeads);
    M.short = T.stt.incompleteShort;
    M.resolution = M.short;
    return M;
  }
  const sex = ctx.sex, age = ctx.age;
  const steThr = (n) => {
    if (n === "V2" || n === "V3") {
      if (sex === "f") return 1.5;
      if (sex === "m") return age != null && age < 40 ? 2.5 : 2;
      return 2;
    }
    return 1;
  };
  const ste = rev.filter(n => n !== "aVR" && lead(n).st >= steThr(n));
  const std = rev.filter(n => n !== "aVR" && lead(n).st <= -0.5);
  const twi = rev.filter(n => !["aVR", "V1"].includes(n) && lead(n).t <= -1);
  const steGroups = Object.entries(GROUPS).filter(([, ls]) => ls.filter(n => ste.includes(n)).length >= 2).map(([g]) => g);
  const twiGroups = Object.entries(GROUPS).filter(([, ls]) => ls.filter(n => twi.includes(n)).length >= 2).map(([g]) => g);
  M.data.push(T.stt.steLine(ste.map(n => `${n} ${n1s(lead(n).st)}`)));
  M.data.push(T.stt.stdLine(std.map(n => `${n} ${n1s(lead(n).st)}`)));
  M.data.push(T.stt.twiLine(twi));
  M.criteria.push(crit(T.stt.cSTE, steGroups.length ? steGroups.map(g => T.group[g]).join(", ") : T.stt.none, steGroups.length ? "met" : ste.length ? "border" : "not"));
  M.criteria.push(crit(T.stt.cTWI, twiGroups.length ? twiGroups.map(g => T.group[g]).join(", ") : T.stt.none, twiGroups.length ? "met" : twi.length ? "border" : "not"));
  if (!sex) M.next.push(T.stt.needSex);

  const parts = [];
  const secondary = ctx.bbb === "lbbb" || ctx.bbb === "rbbb" || ctx.lvh || ctx.preexc;

  if (ctx.bbb === "lbbb") {
    const conc = rev.filter(n => netQRS(lead(n)) > 0 && lead(n).st >= 1);
    const concDep = ["V1", "V2", "V3"].filter(n => lead(n) && netQRS(lead(n)) < 0 && lead(n).st <= -1);
    const disc = rev.filter(n => { const l = lead(n); return netQRS(l) < 0 && l.st >= 1 && l.s > 0 && l.st / l.s >= 0.25; });
    M.criteria.push(crit(T.stt.cSgConc, conc.join(", ") || T.stt.none, conc.length ? "met" : "not"));
    M.criteria.push(crit(T.stt.cSgDep, concDep.join(", ") || T.stt.none, concDep.length ? "met" : "not"));
    M.criteria.push(crit(T.stt.cSgRatio, disc.join(", ") || T.stt.none, disc.length ? "met" : "not"));
    if (conc.length || concDep.length || disc.length) {
      ctx.add("sgarbossa", T.stt.sgarbossaFinding, "probable", "stt", 5);
      parts.push(T.stt.sgarbossaPos);
      ctx.rec("acs");
    } else {
      parts.push(T.stt.lbbbSecondary);
    }
  } else {
    if (steGroups.length) {
      const recip = std.length > 0;
      const label = T.stt.steFinding(steGroups);
      ctx.add("ste", label, recip ? "definite" : "probable", "stt", 5);
      parts.push(T.stt.steResolution(steGroups, recip));
      ctx.rec("acs");
    }
    const aVR = lead("aVR");
    if (aVR && aVR.st >= 1 && std.length >= 6) {
      ctx.add("diffuseSTD", T.stt.avrFinding, "probable", "stt", 5);
      parts.push(T.stt.avrResolution);
      ctx.rec("acs");
    }
    if (twiGroups.length) {
      const sec = (ctx.bbb === "rbbb" && twiGroups.every(g => g === "anterior")) || (ctx.lvh && twiGroups.every(g => g === "lateral" || g === "highLateral"));
      if (sec) parts.push(T.stt.twiSecondary(twiGroups));
      else {
        ctx.add("twi", T.stt.twiFinding(twiGroups), "probable", "stt", 2);
        parts.push(T.stt.twiResolution(twiGroups));
      }
    }
    if (!steGroups.length && std.length >= 2 && !secondary) {
      ctx.add("std", T.stt.stdFinding(std), "probable", "stt", 3);
      parts.push(T.stt.stdResolution);
    }
  }
  if (secondary) M.checks.push({ level: "warn", text: T.stt.secondaryNote });
  M.resolution = parts.length ? parts.join(" ") : T.stt.normal;
  M.status = parts.length ? (ctx.findings.some(f => f.module === "stt") ? "abnormal" : "info") : "normal";
  M.short = M.resolution;
  return M;
}

const n1s = (x) => (x > 0 ? "+" : "") + (Math.round(x * 10) / 10);

// ── 9. QT ──────────────────────────────────────────────────────────────────
function qt(ctx) {
  const { T, iv } = ctx;
  const M = mod("qt", T);
  M.principle = T.qt.principle;
  M.rule = T.qt.rule;
  const q = iv("qt"), hr = ctx.hr, qrs = iv("qrs");
  if (q == null || hr == null) {
    if (q == null) M.next.push(T.qt.needQT);
    if (hr == null) M.next.push(T.qt.needHR);
    M.short = T.qt.incompleteShort;
    M.resolution = M.short;
    return M;
  }
  const rr = 60 / hr; // s
  const baz = q / Math.sqrt(rr);
  const fri = q / Math.cbrt(rr);
  const fra = q + 154 * (1 - rr);
  const hod = q + 1.75 * (hr - 60);
  M.data.push(T.qt.rrLine(hr, rr));
  M.data.push(T.qt.formula("Bazett", "QT / √RR", baz));
  M.data.push(T.qt.formula("Fridericia", "QT / ∛RR", fri));
  M.data.push(T.qt.formula("Framingham", "QT + 154 × (1 − RR)", fra));
  M.data.push(T.qt.formula("Hodges", "QT + 1.75 × (HR − 60)", hod));
  const useFri = hr < 60 || hr > 90;
  let qtc = useFri ? fri : baz;
  const which = useFri ? "Fridericia" : "Bazett";
  M.checks.push({ level: "ok", text: T.qt.choice(which, hr) });
  if (qrs != null && qrs >= 120) {
    const mod = q - 0.5 * qrs;
    const modc = useFri ? mod / Math.cbrt(rr) : mod / Math.sqrt(rr);
    M.data.push(T.qt.bogossian(q, qrs, mod, modc));
    M.checks.push({ level: "warn", text: T.qt.wideNote });
    qtc = modc;
  }
  const sex = ctx.sex;
  const thr = sex === "m" ? 450 : 460;
  if (!sex) M.next.push(T.qt.needSex);
  M.criteria.push(crit(T.qt.cLong(sex), `${Math.round(qtc)} ms`, qtc >= 500 ? "not" : qtc > thr ? "not" : qtc > thr - 10 ? "border" : "met"));
  M.criteria.push(crit(T.qt.cShort, `${Math.round(qtc)} ms`, qtc <= 340 ? "not" : qtc <= 390 ? "border" : "met"));
  if (qtc >= 500) {
    ctx.add("qtLong", T.qt.veryLong(qtc), "definite", "qt", 4);
    ctx.rec("qt");
    M.status = "abnormal";
  } else if (qtc > thr) {
    ctx.add("qtLong", T.qt.long(qtc), "definite", "qt", 2);
    ctx.rec("qt");
    M.status = "abnormal";
  } else if (qtc <= 340) {
    ctx.add("qtShort", T.qt.short(qtc), "probable", "qt", 3);
    M.status = "abnormal";
  } else {
    M.status = qtc > thr - 10 || qtc <= 390 ? "borderline" : "normal";
  }
  ctx.longQT = qtc > thr;
  M.resolution = T.qt.resolution(qtc, which, M.status);
  M.short = M.resolution;
  return M;
}

// ── 0. Cluster: treat the read as a pattern, not a list ─────────────────────
function cluster(ctx, mods) {
  const { T, lead, iv } = ctx;
  const M = mod("cluster", T);
  M.principle = T.cluster.principle;
  M.questions = [];
  const qrs = iv("qrs"), pr = iv("pr");
  const [pa] = pDurRange(ctx);
  const V1 = lead("V1"), II = lead("II");
  const f = {
    superior: ctx.axis && ctx.axis.deg < -30,
    rightAxis: ctx.axis && ctx.axis.cat === "rad",
    qrsBorder: qrs != null && qrs >= 100 && qrs < 120,
    qrsWide: qrs != null && qrs >= 120,
    pLeft: (pa != null && pa >= 110) || (pa != null && ctx.ecgIv.pNotch) || (V1 && V1.pNeg >= 1 && V1.pNegDur >= 40),
    pRight: II && II.p > 2.5,
    lvhV: !!ctx.lvhAny,
    tallRV1: V1 && (V1.r >= 7 || (V1.r > V1.s && V1.r > 0)) && ctx.bbb !== "rbbb",
    longPR: pr != null && pr > 200,
    shortPR: pr != null && pr < 120,
    delta: !!ctx.preexc,
    scar: ctx.scar && (ctx.scar.q.length > 0 || ctx.scar.frag.length > 0),
    tachy: ctx.hr != null && ctx.hr > 100,
    lowV: lowVoltage(ctx),
    longQT: !!ctx.longQT,
  };
  const feat = (k) => T.cluster.feature[k]({ qrs, pr, pa, axis: ctx.axis?.deg, hr: ctx.hr });
  const present = Object.keys(f).filter(k => f[k]);
  M.data.push(T.cluster.observed(present.map(feat)));

  const patterns = [];
  const leftCount = [f.superior, f.qrsBorder || f.qrsWide, f.pLeft, f.lvhV].filter(Boolean).length;
  if (leftCount >= 2 && (f.pLeft || f.lvhV)) {
    const qs = [];
    if (f.superior) qs.push({ text: T.cluster.qFascicular, module: "fascicles" });
    if (f.pLeft) qs.push({ text: T.cluster.qLAA, module: "atria" });
    qs.push({ text: T.cluster.qHidden, module: "hiddenQrs" });
    qs.push({ text: T.cluster.qLVH, module: "hypertrophy" });
    if (f.qrsBorder || f.qrsWide) qs.push({ text: T.cluster.qWidth, module: "conduction" });
    patterns.push({ key: "leftHeart", why: T.cluster.leftHeart(present.filter(k => ["superior", "qrsBorder", "qrsWide", "pLeft", "lvhV"].includes(k)).map(feat)), qs });
    ctx.rec("echo");
  }
  if (f.rightAxis && (f.pRight || f.tallRV1)) {
    patterns.push({ key: "rightHeart", why: T.cluster.rightHeart, qs: [
      { text: T.cluster.qRVHvsLPFB, module: "hypertrophy" },
      { text: T.cluster.qLPFB, module: "fascicles" },
      { text: T.cluster.qRAA, module: "atria" },
    ] });
    ctx.rec("echo");
  }
  if ((f.qrsWide && (f.superior || f.rightAxis)) || ((f.qrsWide || f.superior || f.rightAxis) && f.longPR)) {
    patterns.push({ key: "conduction", why: T.cluster.conductionDisease, qs: [
      { text: T.cluster.qWhichFascicles, module: "fascicles" },
      { text: T.cluster.qMorph, module: "conduction" },
      { text: T.cluster.qPR, module: "rhythm" },
    ] });
  }
  if (f.shortPR && (f.delta || f.qrsWide || f.qrsBorder)) {
    patterns.push({ key: "preexc", why: T.cluster.preexc, qs: [
      { text: T.cluster.qPreexc, module: "rhythm" },
      { text: T.cluster.qPreexcInvalid, module: "hiddenQrs" },
    ] });
  }
  if (f.lowV && f.tachy) {
    patterns.push({ key: "effusion", why: T.cluster.effusion, qs: [{ text: T.cluster.qAlternans, module: "rhythm" }] });
    ctx.rec("echoUrgent");
  }
  if (f.scar && (f.superior || f.qrsBorder || f.qrsWide)) {
    patterns.push({ key: "scar", why: T.cluster.scarConduction, qs: [
      { text: T.cluster.qScar, module: "hiddenQrs" },
      { text: T.cluster.qWidth, module: "conduction" },
    ] });
  }

  const seen = new Set();
  for (const p of patterns) {
    M.data.push(p.why);
    for (const q of p.qs) {
      const k = q.module + q.text;
      if (seen.has(k)) continue;
      seen.add(k);
      M.questions.push({ ...q, answer: mods[q.module].short });
    }
  }
  if (lowVoltageKnown(ctx) && f.lowV && !f.tachy) M.checks.push({ level: "warn", text: T.cluster.lowVoltage });

  if (patterns.length) {
    M.resolution = T.cluster.resolution(patterns.length, M.questions.length);
    M.status = "abnormal";
  } else if (present.length) {
    M.resolution = T.cluster.independent;
    M.status = "info";
  } else {
    M.resolution = T.cluster.nothing;
    M.status = coverage(ctx.ecg).leads ? "normal" : "incomplete";
  }
  M.short = M.resolution;
  return M;
}

function lowVoltageKnown(ctx) {
  return LIMB.filter(n => ctx.lead(n)).length >= 4;
}
function lowVoltage(ctx) {
  if (!lowVoltageKnown(ctx)) return false;
  const pp = (l) => Math.max(l.r, l.r2) + Math.max(l.q, l.s);
  const limbLow = LIMB.filter(n => ctx.lead(n)).every(n => pp(ctx.lead(n)) < 5);
  const prec = PRECORDIAL.filter(n => ctx.lead(n));
  const precLow = prec.length >= 4 && prec.every(n => pp(ctx.lead(n)) < 10);
  return limbLow || precLow;
}
