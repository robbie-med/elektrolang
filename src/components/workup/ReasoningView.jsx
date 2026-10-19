import { useEffect, useState } from "react";
import AxisWheel from "./AxisWheel.jsx";
import { C, chip, btn, sectionLabel, STATUS_COLOR } from "./theme.js";

const CRIT_MARK = { met: ["✓", C.accent], not: ["✗", C.red], border: ["≈", "#ffab40"], unknown: ["?", C.faint] };
const CHECK_MARK = { ok: ["✓", C.accent], warn: ["⚠", C.yellow], bad: ["✗", C.red] };

const Bullets = ({ items, color = C.body, mono = false }) => (
  <ul style={{ margin: "0 0 10px", paddingLeft: 16 }}>
    {items.map((x, i) => (
      <li key={i} style={{ color, fontSize: mono ? 11.5 : 12.5, lineHeight: 1.6, marginBottom: 3 }}>{x}</li>
    ))}
  </ul>
);

function Module({ m, W, open, onToggle, teaching, onGo }) {
  const sc = STATUS_COLOR[m.status];
  return (
    <section id={`step-${m.n}`} style={{ borderBottom: `1px solid ${C.line}`, padding: "12px 0" }}>
      <button onClick={onToggle} style={{ display: "flex", width: "100%", gap: 10, alignItems: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
        <span style={{ color: sc, fontWeight: 800, fontSize: 15, minWidth: 22 }}>{m.n}.</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", color: C.text, fontWeight: 800, fontSize: 13.5, lineHeight: 1.4 }}>{m.title}</span>
          {!open && <span style={{ display: "block", color: C.soft, fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{m.short}</span>}
        </span>
        <span style={chip(sc)}>{W.status[m.status]}</span>
      </button>

      {open && (
        <div style={{ padding: "8px 0 0 32px" }}>
          <p style={{ color: C.soft, fontStyle: "italic", fontSize: 12.5, margin: "0 0 10px" }}>{m.question}</p>

          {teaching && m.principle.length > 0 && (<><div style={sectionLabel}>{W.sections.principle}</div><Bullets items={m.principle} /></>)}
          {teaching && m.rule.length > 0 && (<><div style={sectionLabel}>{W.sections.rule}</div><Bullets items={m.rule} color={C.soft} /></>)}

          {m.questions && m.questions.length > 0 && (
            <>
              <div style={sectionLabel}>{W.sections.questions}</div>
              <ol style={{ margin: "0 0 10px", paddingLeft: 18 }}>
                {m.questions.map((q, i) => (
                  <li key={i} style={{ color: C.body, fontSize: 12.5, lineHeight: 1.55, marginBottom: 6 }}>
                    {q.text}{" "}
                    <button onClick={() => onGo(q.step)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, padding: 0, fontFamily: "inherit" }}>{W.goStep(q.step)}</button>
                    <div style={{ color: C.soft, fontSize: 11.5 }}>{q.answer}</div>
                  </li>
                ))}
              </ol>
            </>
          )}

          {m.viz && <AxisWheel viz={m.viz} caption={W.axisWheel} />}

          {m.data.length > 0 && (<><div style={sectionLabel}>{W.sections.data}</div><Bullets items={m.data} color={C.body} mono /></>)}

          {m.criteria.length > 0 && (
            <>
              <div style={sectionLabel}>{W.sections.criteria}</div>
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 10 }}>
                {m.criteria.map((c, i) => {
                  const [mk, col] = CRIT_MARK[c.status];
                  return (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "6px 9px", borderTop: i ? `1px solid ${C.line}` : "none", alignItems: "baseline" }}>
                      <span style={{ color: col, fontWeight: 800, width: 12 }} title={W.crit[c.status]}>{mk}</span>
                      <span style={{ flex: 1, color: C.body, fontSize: 12 }}>
                        {c.label}{c.note && <span style={{ color: C.faint }}> · {c.note}</span>}
                      </span>
                      <span style={{ color: col, fontSize: 11.5, textAlign: "right" }}>{c.value}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {m.checks.length > 0 && (
            <>
              <div style={sectionLabel}>{W.sections.checks}</div>
              {m.checks.map((c, i) => {
                const [mk, col] = CHECK_MARK[c.level];
                return (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: col, fontWeight: 800 }}>{mk}</span>
                    <span style={{ color: c.level === "ok" ? C.soft : col, fontSize: 12, lineHeight: 1.55 }}>{c.text}</span>
                  </div>
                );
              })}
            </>
          )}

          <div style={{ ...sectionLabel, marginTop: 8 }}>{W.sections.resolution}</div>
          <p style={{ color: sc === C.faint ? C.soft : C.text, fontWeight: 700, fontSize: 13, lineHeight: 1.6, margin: "0 0 10px", borderLeft: `3px solid ${sc}`, paddingLeft: 9 }}>{m.resolution}</p>

          {m.consequences.length > 0 && (<><div style={sectionLabel}>{W.sections.consequences}</div><Bullets items={m.consequences} color={C.body} /></>)}
          {m.next.length > 0 && (<><div style={sectionLabel}>{W.sections.next}</div><Bullets items={m.next} color={C.yellow} /></>)}
        </div>
      )}
    </section>
  );
}

export default function ReasoningView({ result, W, focus }) {
  const [teaching, setTeaching] = useState(true);
  const [openSet, setOpenSet] = useState(null); // null = default (non-normal open)
  const isOpen = (m) => openSet ? openSet.has(m.n) : !["normal", "incomplete"].includes(m.status);
  const toggle = (m) => {
    const s = new Set(result.modules.filter(isOpen).map(x => x.n));
    s.has(m.n) ? s.delete(m.n) : s.add(m.n);
    setOpenSet(s);
  };
  const go = (n) => {
    const s = new Set(result.modules.filter(isOpen).map(x => x.n));
    s.add(n);
    setOpenSet(s);
    setTimeout(() => document.getElementById(`step-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };
  useEffect(() => { if (focus) go(focus.n); }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  // Cluster questions carry the module id; map it to the displayed step number.
  const stepOf = Object.fromEntries(result.modules.map(m => [m.id, m.n]));
  const modules = result.modules.map(m => m.questions ? { ...m, questions: m.questions.map(q => ({ ...q, step: stepOf[q.module] })) } : m);

  return (
    <div style={{ padding: "6px 14px 60px" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "6px 0 4px" }}>
        <button style={btn(teaching)} onClick={() => setTeaching(t => !t)}>{W.showTeaching}</button>
        <button style={btn()} onClick={() => setOpenSet(new Set(result.modules.map(m => m.n)))}>{W.expandAll}</button>
        <button style={btn()} onClick={() => setOpenSet(new Set())}>{W.collapseAll}</button>
      </div>
      {modules.map(m => (
        <Module key={m.id} m={m} W={W} open={isOpen(m)} onToggle={() => toggle(m)} teaching={teaching} onGo={go} />
      ))}
      <p style={{ color: C.faint, fontSize: 10.5, lineHeight: 1.5, marginTop: 16 }}>{W.disclaimer}</p>
    </div>
  );
}
