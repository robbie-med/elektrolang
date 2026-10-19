import { LAYOUT, traceLead } from "../../engine/leads.js";
import { ghostMismatch } from "../../engine/checks.js";
import { C } from "./theme.js";

const GAIN = 0.5;
const TOP = 16, BOTTOM = -12;

export default function LeadGrid({ ecg, selected, onSelect }) {
  const iv = ecg.iv;
  const x0 = (-iv.pr - 40) / 40;
  const x1 = (Math.max(iv.qt, iv.qrs + 100) + 40) / 40;
  const vb = `${x0} ${-TOP * GAIN} ${x1 - x0} ${(TOP - BOTTOM) * GAIN}`;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, padding: "8px 10px" }}>
      {LAYOUT.flat().map(name => {
        const l = ecg.leads[name];
        const reviewed = !!ecg.reviewed[name];
        const bad = ghostMismatch(name, ecg);
        const d = traceLead(l, iv).pts
          .map(([t, a], i) => `${i ? "L" : "M"}${(t / 40).toFixed(2)},${(-a * GAIN).toFixed(2)}`).join(" ");
        const sel = name === selected;
        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            style={{
              position: "relative", padding: 0, background: C.paper, cursor: "pointer",
              border: `1.5px solid ${sel ? C.accent : bad ? C.yellow : C.line}`, borderRadius: 4, overflow: "hidden",
            }}
          >
            <svg viewBox={vb} style={{ width: "100%", height: 62, display: "block" }} preserveAspectRatio="none">
              <path d={d} fill="none" stroke={reviewed ? C.accent : C.template} strokeWidth="1.4"
                vectorEffect="non-scaling-stroke" strokeDasharray={reviewed ? undefined : "3 2"} />
            </svg>
            <span style={{ position: "absolute", left: 4, top: 2, fontSize: 10, fontWeight: 800, color: sel ? C.accent : C.soft }}>{name}</span>
            <span style={{
              position: "absolute", right: 4, top: 4, width: 6, height: 6, borderRadius: 3,
              background: bad ? C.yellow : reviewed ? C.accent : C.faint,
            }} />
          </button>
        );
      })}
    </div>
  );
}
