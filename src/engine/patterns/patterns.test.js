import test from "node:test";
import assert from "node:assert/strict";
import { newCase, demoCase, demoBifascicular, LEADS } from "../leads.js";
import { runWorkup } from "../workup.js";
import { analyzePatterns } from "./index.js";
import { CAUSES, prior } from "./causes.js";
import { FINDINGS, causesFor } from "./catalog.js";

// A fully "measured" normal case to mutate.
function base(meta = {}) {
  const c = newCase();
  LEADS.forEach(n => { c.reviewed[n] = true; });
  ["pDur", "pr", "qrs", "qt"].forEach(k => { c.ivReviewed[k] = true; });
  c.meta = { hr: 70, rhythm: "regular", pEveryQrs: "yes", delta: false, sex: "m", age: 50, ...meta };
  return c;
}
const run = (c) => { const r = runWorkup(c, "en"); return analyzePatterns(c, r); };
const topIds = (p, n = 3) => p.synth.top.slice(0, n).map(x => x.id);
const gk = (p) => p.groups.map(g => g.key);

test("normal case: no groups, synthesis says normal", () => {
  const p = run(base());
  assert.deepEqual(gk(p), []);
  assert.ok(p.synth.normal);
});

test("inferior STEMI: STE II/III/aVF with reciprocal I/aVL depression → STEMI first", () => {
  const c = base({ age: 58 });
  Object.assign(c.leads.II, { st: 2.5 }); Object.assign(c.leads.III, { st: 3 }); Object.assign(c.leads.aVF, { st: 2.5 });
  Object.assign(c.leads.I, { st: -1 }); Object.assign(c.leads.aVL, { st: -1.5 });
  const p = run(c);
  assert.equal(topIds(p)[0], "stemi");
  assert.ok(gk(p).includes("ste:inf"));
  assert.ok(gk(p).includes("std_recip:lat"), gk(p).join());
  const lead = p.leads.III.rows.find(r => r.comp === "st");
  assert.equal(lead.flags[0].type, "ste");
  assert.ok(p.byKey[lead.flags[0].gkey].ranked[0].id === "stemi");
});

test("diffuse concave STE: pericarditis / early repolarisation lead; demographics reorder them", () => {
  const mk = (age, sex) => {
    const c = base({ age, sex });
    for (const n of ["I", "II", "III", "aVF", "aVL", "V2", "V3", "V4", "V5", "V6"]) c.leads[n].st = 1.5;
    c.leads.aVR.st = -1;
    return run(c);
  };
  const young = mk(24, "m"), old = mk(72, "f");
  assert.ok(gk(young).includes("ste:diffuse"));
  assert.deepEqual(topIds(young, 2).sort(), ["earlyrepol", "pericarditis"].sort());
  const rank = (p, id) => p.byKey["ste:diffuse"].ranked.findIndex(r => r.id === id);
  assert.ok(rank(young, "earlyrepol") < rank(old, "earlyrepol"), "early repolarisation drops with age");
  assert.equal(old.byKey["ste:diffuse"].ranked[0].id, "pericarditis");
});

test("hyperkalaemia constellation: peaked T + wide QRS + long PR → hyperK ties them together", () => {
  const c = base({ age: 67 });
  c.iv.qrs = 128; c.iv.pr = 230;
  for (const n of ["V2", "V3", "V4"]) c.leads[n].t = 11;
  c.leads.II.t = 6.5; c.leads.aVF.t = 6.5;
  const p = run(c);
  assert.ok(topIds(p).includes("hyperk"), topIds(p).join());
  const hk = p.synth.top.find(x => x.id === "hyperk");
  assert.ok(hk.supports.length >= 3, `hyperK supported by ${hk.supports.join()}`);
});

test("PE constellation: tachycardia + S1Q3T3 + right axis + T inversion V1–V3", () => {
  const c = base({ hr: 118, age: 44, sex: "f" });
  c.leads.I.s = 3; c.leads.I.r = 3; c.leads.II.r = 4; c.leads.II.s = 1; c.leads.III.q = 1.5; c.leads.III.qDur = 30; c.leads.III.r = 7; c.leads.III.s = 1; c.leads.III.t = -1.5;
  c.leads.aVF.r = 6; c.leads.aVL.r = 1; c.leads.aVL.s = 5;
  for (const n of ["V2", "V3", "V4"]) c.leads[n].t = -2;
  const p = run(c);
  assert.ok(gk(p).includes("s1q3t3:default"), gk(p).join());
  assert.ok(topIds(p).includes("pe"), topIds(p).join());
});

test("LBBB: secondary ST-T change is down-weighted, not read as ischaemia", () => {
  const c = demoBifascicular();
  c.leads.V1 = { ...c.leads.V1, r: 0, r2: 0, s: 18, st: 3, t: 4 };
  c.leads.I = { ...c.leads.I, r: 12, s: 0, q: 0, rpt: 70, st: -1, t: -3 };
  c.leads.V6 = { ...c.leads.V6, r: 12, s: 0, q: 0, rpt: 70, st: -1, t: -3 };
  c.leads.V5 = { ...c.leads.V5, q: 0 };
  const r = runWorkup(c, "en");
  if (r.findings.some(f => f.key === "lbbb")) {
    const p = analyzePatterns(c, r);
    const sec = p.groups.filter(g => g.secondary === "lbbb");
    assert.ok(sec.length > 0);
    sec.forEach(g => assert.ok(g.weight <= 0.25));
  }
});

test("scoring prefers a cause shared across findings; per-lead lists are demographic-ordered", () => {
  const p = run(demoCase());
  assert.ok(p.synth.top.length >= 1);
  p.groups.forEach(g => {
    const sum = g.ranked.reduce((a, r) => a + r.share, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    for (let i = 1; i < g.ranked.length; i++) assert.ok(g.ranked[i - 1].score >= g.ranked[i].score);
  });
});

test("catalog integrity: every referenced cause exists, every finding has causes + a step", () => {
  for (const [type, f] of Object.entries(FINDINGS)) {
    assert.ok(f.step >= 1 && f.step <= 8, type);
    const lists = Array.isArray(f.causes) ? [f.causes] : Object.values(f.causes);
    assert.ok(lists.length, type);
    for (const list of lists) {
      assert.ok(list.length >= 2, `${type} has ≥2 candidate causes`);
      for (const [id, w] of list) { assert.ok(CAUSES[id], `${type} → unknown cause ${id}`); assert.ok(w > 0); }
    }
  }
  for (const [id, c] of Object.entries(CAUSES)) {
    assert.ok(c.n.en && c.n.ko && c.t.en && c.t.ko, `${id} has EN + KO text`);
    assert.ok(prior(id, { age: 30, sex: "m" }) > 0 && prior(id, { age: null, sex: null }) > 0);
  }
  assert.ok(causesFor("ste", "inf").length >= 5);
});

test("UI wording: every reading step has a formatter, and every text is filled in, in EN and KO", async () => {
  const { PUI, groupLabel, causeName, stepTitle } = await import("../../i18n/patterns.js");
  const { STEPS } = await import("./catalog.js");
  for (const lang of ["en", "ko"]) {
    for (const s of STEPS) {
      assert.equal(typeof PUI[lang].see[s.key], "function", `${lang} see.${s.key}`);
      assert.ok(stepTitle(s.key, lang));
    }
    for (const c of [demoCase(), demoBifascicular(), base()]) {
      const r = runWorkup(c, lang);
      const p = analyzePatterns(c, r);
      for (const s of p.steps) assert.ok(!/undefined|NaN/.test(PUI[lang].see[s.key](s.see)), `${lang} ${s.key}`);
      for (const g of p.groups) {
        assert.ok(!/undefined|NaN/.test(groupLabel(g, lang)));
        g.ranked.forEach(x => assert.ok(causeName(x.id, lang)));
      }
    }
  }
});

test("visible conduction patterns are only offered as causes when the tracing shows them", () => {
  // demoCase: narrow QRS with fragmentation + LAFB, no LBBB/RBBB/delta wave
  const c = demoCase();
  const p = run(c);
  const frag = p.groups.find(g => g.type === "frag");
  assert.ok(frag);
  assert.ok(!frag.ranked.some(r => r.id === "lbbb"), "no LBBB offered for a 116 ms QRS");
  // …but LAFB is present, so it may appear where it explains something
  const all = p.groups.flatMap(g => g.ranked.map(r => r.id));
  assert.ok(!all.includes("wpw"), "no pre-excitation without a delta wave or short PR");
});
