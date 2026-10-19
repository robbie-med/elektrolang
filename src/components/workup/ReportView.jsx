import { useState } from "react";
import { C, btn, sectionLabel } from "./theme.js";

const CERT_COLOR = { definite: C.yellow, probable: "#ffab40", possible: C.soft };

export default function ReportView({ result, W, onGoStep }) {
  const [copied, setCopied] = useState(false);
  const { findings, retracted, recs, next, coverage } = result;

  const text = [
    `${W.impression}:`,
    ...(findings.length ? findings.map(f => `- ${f.label}`) : [`- ${W.noFindings}`]),
    ...(retracted.length ? ["", `${W.removed}:`, ...retracted.map(r => `- ${r.label}: ${r.reason}`)] : []),
    ...(recs.length ? ["", `${W.recs}:`, ...recs.map(r => `- ${r}`)] : []),
  ].join("\n");

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };

  const Item = ({ children, color = C.body, step }) => (
    <div style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.line}`, alignItems: "baseline" }}>
      <span style={{ flex: 1, color, fontSize: 13, lineHeight: 1.55 }}>{children}</span>
      {step && <button onClick={() => onGoStep(step)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>{W.goStep(step)}</button>}
    </div>
  );

  return (
    <div style={{ padding: "12px 14px 60px" }}>
      <div style={{ color: C.faint, fontSize: 11, marginBottom: 12 }}>{W.coverage(coverage.leads, coverage.ivs)}</div>

      <div style={{ background: C.panel, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "12px 14px", marginBottom: 18 }}>
        <div style={{ ...sectionLabel, color: C.accent }}>{W.impression}</div>
        {findings.length === 0 && <div style={{ color: C.body, fontSize: 13 }}>{W.noFindings}</div>}
        {findings.map((f, i) => (
          <Item key={i} color={CERT_COLOR[f.certainty]} step={f.step}>{f.label}</Item>
        ))}
      </div>

      {retracted.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={sectionLabel}>{W.removed}</div>
          {retracted.map((r, i) => (
            <Item key={i} step={r.step}>
              <s style={{ color: C.soft }}>{r.label}</s>
              <span style={{ display: "block", color: C.soft, fontSize: 12 }}>{r.reason}</span>
            </Item>
          ))}
        </div>
      )}

      {recs.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={sectionLabel}>{W.recs}</div>
          {recs.map((r, i) => <Item key={i}>{r}</Item>)}
        </div>
      )}

      {next.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={sectionLabel}>{W.stillToMeasure}</div>
          {next.map((n, i) => <Item key={i} color={C.yellow} step={n.step}>{n.text}</Item>)}
        </div>
      )}

      <button style={{ ...btn(true), width: "100%", padding: 12 }} onClick={copy}>{copied ? W.copied : W.copy}</button>
      <p style={{ color: C.faint, fontSize: 10.5, lineHeight: 1.5, marginTop: 16 }}>{W.disclaimer}</p>
    </div>
  );
}
