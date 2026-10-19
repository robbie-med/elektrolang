import test from "node:test";
import assert from "node:assert/strict";
import { renderEkg } from "./synth.js";
import { analyzeScan, scanToCase } from "./measure.js";
import { runWorkup } from "../workup.js";
import { demoCase, demoBifascicular, LEADS } from "../leads.js";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, want ${b} ± ${tol}`);

function roundTrip(ecg, o) {
  const s = renderEkg(ecg, o);
  const res = analyzeScan(s.img, { block: s.block, pxPerMm: s.pxPerMm });
  return res;
}

test("scan round-trip: LAFB demo case is recovered closely enough to reach the same conclusions", () => {
  const truth = demoCase();
  const res = roundTrip(truth);
  if (process.env.SCAN_DEBUG) console.log(JSON.stringify({ meta: res.meta, iv: res.iv, notes: res.notes }), Object.entries(res.leads).map(([n, l]) => `${n}: ` + JSON.stringify(l)).join("\n"));
  near(res.meta.hr, 72, 3, "HR");
  assert.equal(res.meta.rhythm, "regular");
  near(res.iv.qrs, truth.iv.qrs, 16, "QRS");
  near(res.iv.pr, truth.iv.pr, 30, "PR");
  near(res.iv.qt, truth.iv.qt, 40, "QT");
  for (const n of LEADS) {
    const a = res.leads[n], b = truth.leads[n];
    assert.ok(a, `${n} extracted`);
    near(a.r, b.r, 1.25, `${n} R`);
    near(a.s, b.s, 1.25, `${n} S`);
    near(a.t, b.t, 1, `${n} T`);
  }
  const c = scanToCase(res, { sex: "m", age: 64 });
  const keys = runWorkup(c, "en").findings.map(f => f.key);
  assert.ok(keys.includes("lafb"), `findings: ${keys}`);
});

test("scan round-trip: RBBB + LAFB + long PR case", () => {
  const truth = demoBifascicular();
  const res = roundTrip(truth);
  near(res.meta.hr, 64, 3, "HR");
  near(res.iv.qrs, truth.iv.qrs, 18, "QRS");
  assert.ok(res.iv.pr > 200, `PR ${res.iv.pr} should be long`);
  assert.ok(res.leads.V1.r2 > 3, `V1 R′ recovered (${res.leads.V1.r2})`);
  const keys = runWorkup(scanToCase(res, { sex: "f", age: 78 }), "en").findings.map(f => f.key);
  ["rbbb", "avb1"].forEach(k => assert.ok(keys.includes(k), `${k} in ${keys}`));
});

test("scan is robust to resolution, grid colour and line jitter", () => {
  const truth = demoCase();
  for (const o of [{ pxPerMm: 4 }, { pxPerMm: 9, thick: 3 }, { pxPerMm: 6, grid: [200, 200, 200], gridMajor: [160, 160, 160] }, { pxPerMm: 6, jitter: 0.6 }]) {
    const res = roundTrip(truth, o);
    near(res.meta.hr, 72, 4, `HR ${JSON.stringify(o)}`);
    near(res.iv.qrs, truth.iv.qrs, 24, `QRS ${JSON.stringify(o)}`);
    near(res.leads.aVL.r, 10, 2, `aVL R ${JSON.stringify(o)}`);
    near(res.leads.III.s, 12, 2, `III S ${JSON.stringify(o)}`);
  }
});

test("a blank page yields notes, not a crash", () => {
  const w = 600, h = 400;
  const img = { data: new Uint8ClampedArray(w * h * 4).fill(255), width: w, height: h };
  const res = analyzeScan(img, { block: { x0: 10, y0: 10, x1: 590, y1: 390 }, pxPerMm: 5 });
  assert.equal(Object.keys(res.leads).length, 0);
  assert.ok(res.notes.some(n => n.code === "noTrace"));
});

test("every scan note code can be worded in both languages", async () => {
  const { PUI } = await import("../../i18n/patterns.js");
  const notes = [
    { code: "noTrace", lead: "V1" }, { code: "noQrs", lead: "II" }, { code: "fewBeats" }, { code: "irregular" },
    { code: "noP" }, { code: "noT" }, { code: "unmeasured", lead: "V4", what: ["p", "t"] },
  ];
  for (const lang of ["en", "ko"]) for (const n of notes) {
    const t = PUI[lang].scan.note(n);
    assert.ok(typeof t === "string" && t.length > 5 && !/undefined/.test(t), `${lang} ${n.code}`);
  }
});
