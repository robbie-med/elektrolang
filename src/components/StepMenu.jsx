import { UI } from "../i18n/ui.js";

export default function StepMenu({ open, onClose, stepIndex, answers, onNavigate, lang, steps }) {
  if (!open) return null;
  const t = UI[lang ?? "en"];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)", zIndex: 200,
        }}
      />
      <div style={{
        position: "fixed", right: 0, top: 0,
        width: 210, height: "100dvh",
        background: "#060d14", borderLeft: "1px solid #0d2a1a",
        zIndex: 201, display: "flex", flexDirection: "column",
        fontFamily: "'Courier New', monospace",
      }}>
        <div style={{
          padding: "10px 14px 9px", borderBottom: "1px solid #0d2a1a",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ color: "#00e676", fontWeight: 800, fontSize: 10.5, letterSpacing: 2.5 }}>
            {t.allSteps}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "#3a5a45",
              cursor: "pointer", fontSize: 15, padding: "0 2px", lineHeight: 1,
            }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {steps.map((step, i) => {
            const answer = answers.find(a => a.step === step.id);
            const answerOk = answer != null ? step.options[answer.optionIndex]?.ok : undefined;
            const isCurrent = i === stepIndex;
            return (
              <button
                key={step.id}
                onClick={() => { onNavigate(i); onClose(); }}
                style={{
                  width: "100%", background: isCurrent ? "rgba(0,230,118,0.07)" : "none",
                  border: "none", borderLeft: `3px solid ${isCurrent ? "#00e676" : "transparent"}`,
                  padding: "9px 12px 9px 11px", textAlign: "left",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 9,
                  borderBottom: "1px solid #07150d",
                }}
              >
                <span style={{
                  color: isCurrent ? "#00e676" : "#2a4a35",
                  fontSize: 9.5, fontWeight: 800, minWidth: 14,
                }}>
                  {i + 1}
                </span>
                <span style={{
                  color: isCurrent ? "#c8f0d8" : (answer ? "#5a8a6a" : "#2a4a35"),
                  fontSize: 11.5, flex: 1,
                  fontWeight: isCurrent ? 700 : 400,
                }}>
                  {step.title}
                </span>
                {answer != null && (
                  <span style={{ fontSize: 12, color: answerOk ? "#00e676" : "#ffd600", flexShrink: 0 }}>
                    {answerOk ? "✓" : "⚠"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
