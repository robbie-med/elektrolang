import test from "node:test";
import assert from "node:assert/strict";
import { runWorkup } from "./workup.js";
import { fitAxis } from "./axis.js";
import { newCase, demoCase, demoBifascicular, LEADS } from "./leads.js";
import { expectedNet, snapToNet } from "./checks.js";

const keys = (r) => r.findings.map(f => f.key);
const mod = (r, id) => r.modules.find(m => m.id === id);

test("axis fit honours augmented-lead gain and pair estimates", () => {
  // Perfectly consistent normal set → +49°, zero residual everywhere.
  const f = fitAxis({ I: 7, II: 10.5, III: 3.5, aVR: -8.75, aVL: 1.75, aVF: 7 });
  assert.equal(Math.round(f.deg), 49);
  Object.values(f.residuals).forEach(r => assert.ok(Math.abs(r) < 1e-9));
  assert.equal(Math.round(fitAxis({ I: 7, II: -3, III: -10.5 }).deg), -47);
});

test("demo: cluster → LAFB confirmed → IVCD removed → borderline P stays 'possible' → inferior fQRS", () => {
  const r = runWorkup(demoCase(), "en");
  assert.equal(r.modules[0].id, "cluster");
  assert.ok(mod(r, "cluster").questions.some(q => q.module === "fascicles"));
  const lafb = r.findings.find(f => f.key === "lafb");
  assert.equal(lafb.certainty, "definite");
  assert.ok(!keys(r).includes("ivcd"));
  assert.ok(r.retracted.some(x => x.key === "ivcd"));
  assert.equal(r.findings.find(f => f.key === "laa").certainty, "possible");
  assert.ok(keys(r).includes("frag_inferior"));
  assert.ok(mod(r, "axis").checks.some(c => c.level === "ok" && /Einthoven/.test(c.text)));
  // Axis is shown before fascicles, which it feeds.
  assert.ok(mod(r, "axis").n < mod(r, "fascicles").n);
});

test("bifascicular case: RBBB + LAFB + long PR", () => {
  const r = runWorkup(demoBifascicular(), "en");
  ["rbbb", "lafb", "bifasc", "avb1"].forEach(k => assert.ok(keys(r).includes(k), k));
  // QT corrected for QRS width (Bogossian) → not called long.
  assert.ok(!keys(r).includes("qtLong"));
});

test("fully confirmed normal template has no abnormal findings", () => {
  const c = newCase();
  LEADS.forEach(n => { c.reviewed[n] = true; });
  ["pDur", "pr", "qrs", "qt"].forEach(k => { c.ivReviewed[k] = true; });
  c.meta = { hr: 70, rhythm: "regular", pEveryQrs: "yes", delta: false, sex: "f", age: 50 };
  const r = runWorkup(c, "en");
  assert.deepEqual(keys(r), []);
});

test("Einthoven violation is flagged when peaks are entered instead of net", () => {
  const c = demoCase();
  c.leads.II.s = 0; // II recorded as its R peak only
  const r = runWorkup(c, "en");
  assert.ok(mod(r, "axis").checks.some(c => c.level === "bad" && /Einthoven/.test(c.text)));
  assert.ok(expectedNet("II", c) < 0);
  const fixed = snapToNet(c.leads.II, expectedNet("II", c));
  assert.ok(Math.abs((fixed.r - fixed.q - fixed.s) - expectedNet("II", c)) < 0.3);
});

test("unshaped (template) leads are treated as unknown, not normal", () => {
  const r = runWorkup(newCase(), "en");
  assert.equal(mod(r, "axis").status, "incomplete");
  assert.ok(r.next.length > 0);
});

test("Korean pack runs end to end without placeholders", () => {
  for (const c of [demoCase(), demoBifascicular(), newCase()]) {
    const s = JSON.stringify(runWorkup(c, "ko"));
    assert.ok(!/undefined|NaN|\{\{step:/.test(s));
  }
});
