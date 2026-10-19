import { useCallback, useEffect, useMemo, useState } from "react";
import { LEADS, LAYOUT, newCase, demoCase, demoBifascicular } from "../../engine/leads.js";
import { scanToCase } from "../../engine/scan/measure.js";
import { runWorkup } from "../../engine/workup.js";
import { rProgression } from "../../engine/checks.js";
import { WUI } from "../../i18n/workup.js";
import { PUI } from "../../i18n/patterns.js";
import LeadGrid from "./LeadGrid.jsx";
import LeadEditor from "./LeadEditor.jsx";
import MeasureForm from "./MeasureForm.jsx";
import ReasoningView from "./ReasoningView.jsx";
import ReportView from "./ReportView.jsx";
import ScanPanel from "./ScanPanel.jsx";
import PatternView from "./PatternView.jsx";
import { C, FONT, btn, sectionLabel } from "./theme.js";

const STORE = "elektrolang.workup.v1";
const ORDER = LAYOUT[0].map((_, col) => LAYOUT.map(row => row[col])).flat(); // I, II, III, aVR, aVL, aVF, V1…V6

function load() {
  try {
    const c = JSON.parse(localStorage.getItem(STORE));
    if (c && c.leads && LEADS.every(n => c.leads[n]) && c.iv && c.meta) return c;
  } catch { /* storage unavailable */ }
  return newCase();
}

export default function WorkupApp({ lang, setLang, onMode }) {
  const W = WUI[lang];
  const [ecg, setEcg] = useState(load);
  const [tab, setTab] = useState("draw");
  const [sel, setSel] = useState("I");
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(ecg)); } catch { /* storage unavailable */ }
  }, [ecg]);

  const update = useCallback((fn) => setEcg(prev => {
    const next = structuredClone(prev);
    fn(next);
    return next;
  }), []);

  const result = useMemo(() => runWorkup(ecg, lang), [ecg, lang]);

  const checks = useMemo(() => [
    ...rProgression(ecg, W),
    ...result.modules.flatMap(m => m.checks.filter(c => c.level !== "ok").map(c => ({ ...c, step: m.n }))),
  ], [ecg, result, W]);

  const step = (d) => setSel(ORDER[(ORDER.indexOf(sel) + d + ORDER.length) % ORDER.length]);
  const goStep = (n) => { setTab("workup"); setFocus({ n, t: Date.now() }); };

  const loadCase = (k) => {
    if (!k) return;
    if (!window.confirm(W.confirmNew)) return;
    setEcg(k === "demo" ? demoCase() : k === "bif" ? demoBifascicular() : newCase());
    setSel("I");
  };

  const applyScan = (res) => {
    if (!window.confirm(PUI[lang].scan.confirmReplace)) return;
    setEcg(scanToCase(res, { sex: ecg.meta.sex, age: ecg.meta.age }));
    setSel("I");
    setTab("patterns");
  };

  const tabs = ["scan", "draw", "measure", "workup", "patterns", "report"];
  const tabLabel = (k) => W.tabs[k] ?? PUI[lang].tabs[k];
  const abnormalCount = result.findings.length;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: FONT, maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 8px", borderBottom: `1px solid ${C.line}` }}>
        <span style={{ color: C.accent, fontWeight: 800, fontSize: 13, letterSpacing: 2.5, whiteSpace: "nowrap" }}>EKG</span>
        <button onClick={onMode} style={{ ...btn(), fontSize: 10, letterSpacing: 1.2, padding: "3px 7px" }} title={W.modeTrainer}>{W.modeTrainer}</button>
        <select value="" onChange={e => loadCase(e.target.value)}
          style={{ marginLeft: "auto", background: "none", border: `1px solid ${C.border}`, borderRadius: 4, color: C.accent, fontFamily: FONT, fontSize: 11, padding: "3px 4px", maxWidth: 110 }}>
          <option value="">{W.caseMenu} ▾</option>
          <option value="new">{W.newCase}</option>
          <option value="demo">{W.demoLafb}</option>
          <option value="bif">{W.demoBif}</option>
        </select>
        <button
          onClick={() => setLang(lang === "en" ? "ko" : "en")}
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", fontSize: 16, padding: "1px 5px", lineHeight: 1.4, flexShrink: 0 }}
          title={lang === "en" ? "한국어로 전환" : "Switch to English"}
        >{lang === "en" ? "🇰🇷" : "🇺🇸"}</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", overflowX: "auto", borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, background: C.bg, zIndex: 10 }}>
        {tabs.map(k => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: "1 0 auto", background: "none", border: "none", cursor: "pointer", fontFamily: FONT,
            borderBottom: `2px solid ${tab === k ? C.accent : "transparent"}`,
            color: tab === k ? C.accent : C.dim, fontWeight: 800, fontSize: 11, letterSpacing: 1.3, padding: "10px 9px 8px",
          }}>
            {tabLabel(k)}{k === "report" && abnormalCount > 0 ? ` · ${abnormalCount}` : ""}
          </button>
        ))}
      </div>

      {tab === "scan" && <ScanPanel ecg={ecg} update={update} lang={lang} onApply={applyScan} />}
      {tab === "draw" && (
        <>
          <p style={{ color: C.dim, fontSize: 11.5, lineHeight: 1.5, margin: 0, padding: "8px 14px 0" }}>{W.drawHint}</p>
          <LeadGrid ecg={ecg} selected={sel} onSelect={setSel} />
          <LeadEditor name={sel} ecg={ecg} update={update} W={W} onPrev={() => step(-1)} onNext={() => step(1)} />
          <div style={{ padding: "6px 14px 40px" }}>
            <div style={{ ...sectionLabel, marginTop: 6 }}>{W.doubleCheck} · <span style={{ color: C.faint }}>{W.coverage(result.coverage.leads, result.coverage.ivs)}</span></div>
            {checks.length === 0 && <div style={{ color: C.soft, fontSize: 12 }}>{W.nothingToCheck}</div>}
            {checks.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "baseline" }}>
                <span style={{ color: c.level === "bad" ? C.red : C.yellow, fontWeight: 800 }}>{c.level === "bad" ? "✗" : "⚠"}</span>
                <span style={{ flex: 1, color: C.body, fontSize: 12, lineHeight: 1.5 }}>{c.text}</span>
                {c.step && <button onClick={() => goStep(c.step)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: FONT, whiteSpace: "nowrap" }}>{W.goStep(c.step)}</button>}
              </div>
            ))}
            {result.next.length > 0 && (
              <>
                <div style={{ ...sectionLabel, marginTop: 14 }}>{W.measureNext}</div>
                {result.next.slice(0, 6).map((n, i) => (
                  <div key={i} style={{ color: C.yellow, fontSize: 12, lineHeight: 1.5, marginBottom: 5 }}>• {n.text}</div>
                ))}
              </>
            )}
          </div>
        </>
      )}
      {tab === "measure" && <MeasureForm ecg={ecg} update={update} W={W} />}
      {tab === "workup" && <ReasoningView result={result} W={W} focus={focus} />}
      {tab === "patterns" && <PatternView ecg={ecg} result={result} lang={lang} update={update} onScan={() => setTab("scan")} />}
      {tab === "report" && <ReportView result={result} W={W} onGoStep={goStep} />}
    </div>
  );
}
