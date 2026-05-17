import { useState } from "react";
import { HL } from "../data/ekgData.js";
import { UI } from "../i18n/ui.js";
import EKGStrip from "./EKGStrip.jsx";
import CriteriaTable from "./CriteriaTable.jsx";
import StepMenu from "./StepMenu.jsx";

export default function StepView({ step, stepIndex, total, onSelect, selected, toast, answers, onNavigate, lang, setLang, steps }) {
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hl = HL[step.hl];
  const t = UI[lang];

  return (
    <div style={{ background: "#060d14", minHeight: "100vh", color: "#e0f7e9", fontFamily: "'Courier New', monospace", maxWidth: 680, margin: "0 auto" }}>
      <StepMenu open={menuOpen} onClose={() => setMenuOpen(false)} stepIndex={stepIndex} answers={answers} onNavigate={onNavigate} lang={lang} steps={steps} />
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px 8px", borderBottom: "1px solid #0d2a1a" }}>
        <span style={{ color: "#00e676", fontWeight: 800, fontSize: 13, letterSpacing: 2.5 }}>{t.appName}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#3a5a45", fontSize: 11 }}>{t.stepOf(stepIndex + 1, total)}</span>
          <span style={{ background: "#0a3d20", color: "#00e676", padding: "3px 9px", borderRadius: 4, fontSize: 11, fontWeight: 800, letterSpacing: 1.5 }}>
            {step.title.toUpperCase()}
          </span>
          <button
            onClick={() => setLang(lang === "en" ? "ko" : "en")}
            style={{
              background: "none", border: "1px solid #163d28", borderRadius: 4,
              cursor: "pointer", fontSize: 16, padding: "1px 5px", lineHeight: 1.4,
            }}
            title={lang === "en" ? "한국어로 전환" : "Switch to English"}
          >{lang === "en" ? "🇰🇷" : "🇺🇸"}</button>
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              background: "none", border: "1px solid #163d28", borderRadius: 4,
              color: "#00e676", cursor: "pointer", fontSize: 14,
              padding: "2px 7px", lineHeight: 1.4, letterSpacing: 1,
            }}
            title={t.allSteps}
          >☰</button>
        </div>
      </div>
      {/* Progress */}
      <div style={{ height: 2, background: "#0a2010" }}>
        <div style={{ height: "100%", background: "#00e676", width: `${((stepIndex + 1) / total) * 100}%`, transition: "width 0.4s ease" }} />
      </div>

      {/* EKG Strip */}
      <div style={{ background: "#040c09" }}>
        <EKGStrip hl={hl} />
      </div>

      {/* Lead + LookAt */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 14px 7px", background: "#07130d", borderBottom: "1px solid #0a2010" }}>
        <span style={{ background: "#0e3520", color: "#00e676", padding: "3px 9px", borderRadius: 3, fontSize: 11, fontWeight: 800, letterSpacing: 0.8, flexShrink: 0 }}>
          📍 {step.lead}
        </span>
        <span style={{ color: "#2a6a3a", fontSize: 11.5, fontStyle: "italic" }}>{step.lookAt}</span>
      </div>

      {/* Content */}
      <div style={{ padding: "13px 14px 100px" }}>
        <p style={{ color: "#c8f0d8", fontSize: 13.5, lineHeight: 1.62, margin: "0 0 11px" }}>{step.prompt}</p>

        {/* Clue */}
        <div style={{ background: "#071409", border: "1px solid #0e2a18", borderRadius: 6, padding: "9px 12px", marginBottom: 12, display: "flex", gap: 8 }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
          <span style={{ color: "#3a7a50", fontSize: 12, lineHeight: 1.58, fontStyle: "italic" }}>{step.clue}</span>
        </div>

        {/* Criteria toggle */}
        <div style={{ marginBottom: 15 }}>
          <button
            onClick={() => setCriteriaOpen(o => !o)}
            style={{
              background: "none", border: "1px solid #163d28",
              borderRadius: criteriaOpen ? "6px 6px 0 0" : "6px",
              padding: "7px 12px", color: "#00b050", fontSize: 11, fontWeight: 800,
              letterSpacing: 1.2, cursor: "pointer", display: "flex", alignItems: "center",
              width: "100%", textAlign: "left",
            }}
          >
            <span>📊 {t.diagnosticCriteria}</span>
            <span style={{ marginLeft: "auto", fontSize: 10 }}>{criteriaOpen ? "▲" : "▼"}</span>
          </button>
          {criteriaOpen && <CriteriaTable criteria={step.criteria} />}
        </div>

        {/* Question */}
        <div style={{ color: "#3a5a45", fontSize: 10.5, fontWeight: 800, letterSpacing: 1.8, marginBottom: 10, textTransform: "uppercase" }}>
          {step.question}
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {step.options.map((opt, i) => {
            const isSel = selected === i;
            const isOther = selected !== null && !isSel;
            return (
              <button
                key={i}
                onClick={() => onSelect(opt, i)}
                style={{
                  background: isSel ? (opt.ok ? "rgba(0,230,118,0.1)" : "rgba(255,214,0,0.09)") : "rgba(10,32,20,0.5)",
                  border: `1.5px solid ${isSel ? (opt.ok ? "#00e676" : "#ffd600") : "#163d28"}`,
                  borderRadius: 8, padding: "11px 13px", textAlign: "left",
                  cursor: selected !== null ? "default" : "pointer",
                  opacity: isOther ? 0.28 : 1, transition: "all 0.2s",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: isSel ? (opt.ok ? "#00e676" : "#ffd600") : "#d4eedd", fontWeight: 700, fontSize: 13 }}>{opt.label}</div>
                  <div style={{ color: "#3a6a4a", fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>{opt.sub}</div>
                </div>
                {isSel && <span style={{ fontSize: 20, marginLeft: 10 }}>{opt.ok ? "✓" : "⚠"}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 680, background: "#07180d",
          borderTop: "2px solid #00b050", padding: "12px 14px", zIndex: 100,
        }}>
          <div style={{ color: "#3a7a50", fontSize: 9.5, fontWeight: 800, letterSpacing: 1.5, marginBottom: 5 }}>📝 {t.interpretation}</div>
          <div style={{ color: "#b8e8cc", fontSize: 12, lineHeight: 1.58 }}>{toast}</div>
        </div>
      )}
    </div>
  );
}
