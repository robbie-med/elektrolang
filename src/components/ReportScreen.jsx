import { useState } from "react";
import { UI } from "../i18n/ui.js";
import StepMenu from "./StepMenu.jsx";

export default function ReportScreen({ answers, onReset, onNavigate, stepIndex, lang, setLang, steps }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const t = UI[lang ?? "en"];

  const orderedAnswers = steps
    .map(s => {
      const a = answers.find(ans => ans.step === s.id);
      if (!a) return null;
      const opt = s.options[a.optionIndex];
      return { step: s.id, title: s.title, optionIndex: a.optionIndex, ...opt };
    })
    .filter(Boolean);

  const rate = orderedAnswers.find(a => a.step === "rate");
  const rhythm = orderedAnswers.find(a => a.step === "rhythm");
  const abnormals = orderedAnswers.filter(a => !a.ok);

  const impression = (() => {
    const parts = [];
    if (rhythm?.ok && rate?.ok) {
      parts.push(lang === "ko" ? "정상 동율동, 정상 심박수." : "Normal sinus rhythm at a normal rate.");
    } else {
      if (rate && !rate.ok) parts.push(`${rate.label}.`);
      if (rhythm && !rhythm.ok) parts.push(`${rhythm.label}.`);
    }
    const others = abnormals.filter(a => a.step !== "rate" && a.step !== "rhythm");
    if (others.length === 0) {
      parts.push(lang === "ko" ? "추가 이상 소견 없음." : "No additional significant abnormalities identified.");
    } else {
      others.forEach(a => parts.push(`${a.label}.`));
    }
    return parts.join(" ");
  })();

  return (
    <div style={{ background: "#060d14", minHeight: "100vh", color: "#e0f7e9", fontFamily: "'Courier New', monospace", maxWidth: 680, margin: "0 auto" }}>
      <StepMenu open={menuOpen} onClose={() => setMenuOpen(false)} stepIndex={stepIndex} answers={answers} onNavigate={onNavigate} lang={lang} steps={steps} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px 8px", borderBottom: "1px solid #0d2a1a" }}>
        <span style={{ color: "#00e676", fontWeight: 800, fontSize: 13, letterSpacing: 2.5 }}>{t.appName}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: "#0a3d20", color: "#00e676", padding: "3px 9px", borderRadius: 4, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, flexShrink: 0 }}>{t.finalReport}</span>
          <button
            onClick={() => setLang(lang === "en" ? "ko" : "en")}
            style={{
              background: "none", border: "1px solid #163d28", borderRadius: 4,
              cursor: "pointer", fontSize: 16, padding: "1px 5px", lineHeight: 1.4, flexShrink: 0,
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
      <div style={{ padding: 14 }}>
        <div style={{ background: "#071409", border: "1px solid #00e676", borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <div style={{ color: "#00e676", fontSize: 9.5, fontWeight: 800, letterSpacing: 2.5, marginBottom: 8 }}>{t.impression}</div>
          <p style={{ color: "#c8f0d8", fontSize: 13, lineHeight: 1.68, margin: 0 }}>{impression}</p>
        </div>
        <div style={{ color: "#3a5a45", fontSize: 9.5, fontWeight: 800, letterSpacing: 2, marginBottom: 12 }}>{t.systematicFindings}</div>
        {orderedAnswers.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "11px 0", borderBottom: "1px solid #0a2010", alignItems: "flex-start" }}>
            <div style={{ width: 3, flexShrink: 0, alignSelf: "stretch", minHeight: 38, background: a.ok ? "#00e676" : "#ffd600", borderRadius: 2, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: "#2a5a38", fontSize: 9.5, letterSpacing: 1.5, marginBottom: 2 }}>{a.title.toUpperCase()}</div>
              <div style={{ color: a.ok ? "#c8f0d8" : "#ffd600", fontWeight: 700, fontSize: 13 }}>{a.ok ? "✓" : "⚠"} {a.label}</div>
              <div style={{ color: "#3a6a4a", fontSize: 11, marginTop: 2 }}>{a.sub}</div>
            </div>
          </div>
        ))}
        <button onClick={onReset} style={{
          marginTop: 24, width: "100%", background: "#0a3d20",
          border: "1px solid #00e676", borderRadius: 8, padding: 14,
          color: "#00e676", fontWeight: 800, fontSize: 13, letterSpacing: 2, cursor: "pointer",
        }}>{t.readAnother}</button>
      </div>
    </div>
  );
}
