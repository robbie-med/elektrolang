import { useRef, useState } from "react";
import { traceLead, ghostFor, newCase, LIMB } from "../../engine/leads.js";
import { ghostMismatch, snapToNet } from "../../engine/checks.js";
import { C, chip, btn } from "./theme.js";

const snapA = (a) => Math.round(a * 4) / 4;
const snapT = (t) => Math.round(t / 2) * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const P_NEG_LEADS = ["V1", "II", "III", "aVF"];
const GLOBAL_KEYS = { pOn: ["pr", "pDur"], pEnd: ["pDur"], j: ["qrs"], tEnd: ["qt"] };

const toPath = (pts, gain) =>
  pts.map(([t, a], i) => `${i ? "L" : "M"}${(t / 40).toFixed(3)},${(-a * gain).toFixed(3)}`).join(" ");

function viewFor(l, iv, ghost) {
  const vals = [l.p, -l.pNeg, -l.q, l.r, -l.s, l.r2, l.st, l.t + l.st];
  if (ghost) ghost.forEach(([, a]) => vals.push(a));
  const top = Math.ceil(Math.max(8, Math.max(...vals) + 2) / 5) * 5;
  const bottom = Math.floor(Math.min(-5, Math.min(...vals) - 2) / 5) * 5;
  const gain = top - bottom > 26 ? 0.5 : 1;
  const x0 = (-iv.pr - 60) / 40;
  const x1 = (Math.max(iv.qt, iv.qrs + 100) + 60) / 40;
  return { top, bottom, gain, x0, x1 };
}

// Apply a drag at time t (ms) / amplitude a (mm) to handle `key`.
function applyDrag(ecg, name, key, t, a, uPk) {
  const l = ecg.leads[name], iv = ecg.iv;
  switch (key) {
    case "pOn": {
      const pEnd = -iv.pr + iv.pDur;
      const pr = clamp(snapT(-t), Math.max(60, iv.pDur + 20), 400);
      iv.pr = pr;
      iv.pDur = clamp(pEnd + pr, 40, Math.min(200, pr - 20));
      break;
    }
    case "pEnd": iv.pDur = clamp(snapT(t + iv.pr), 40, Math.min(200, iv.pr - 20)); break;
    case "pPeak": l.p = clamp(snapA(a), -5, 8); break;
    case "pNeg": {
      l.pNeg = clamp(snapA(-a), 0, 5);
      const pEnd = -iv.pr + iv.pDur;
      l.pNegDur = clamp(snapT(2 * (pEnd - t)), 0, iv.pDur - 10);
      if (l.pNeg < 0.25) l.pNeg = 0;
      break;
    }
    case "q":
      l.q = clamp(snapA(-a), 0, 25);
      l.qDur = clamp(snapT(2 * t), 8, 80);
      break;
    case "r":
      l.r = clamp(snapA(a), 0, 40);
      l.rpt = clamp(snapT(t), 10, iv.qrs - 10);
      break;
    case "s": l.s = clamp(snapA(-a), 0, 40); break;
    case "r2": l.r2 = clamp(snapA(a), 0, 30); break;
    case "j":
      l.st = clamp(snapA(a), -8, 10);
      iv.qrs = clamp(snapT(t), 60, 220);
      if (iv.qt < iv.qrs + 100) iv.qt = iv.qrs + 100;
      break;
    case "tPeak": l.t = clamp(snapA(a - l.st * (1 - uPk)), -12, 15); break;
    case "tEnd": iv.qt = clamp(snapT(t), iv.qrs + 100, 700); break;
    default:
  }
}

export default function LeadEditor({ name, ecg, update, W, onPrev, onNext }) {
  const svgRef = useRef(null);
  const frozen = useRef(null);
  const [drag, setDrag] = useState(null);
  const l = ecg.leads[name], iv = ecg.iv;
  const reviewed = !!ecg.reviewed[name];
  const { pts, anchors, tPeakU } = traceLead(l, iv);
  const ghost = ghostFor(name, ecg);
  const view = drag && frozen.current ? frozen.current : viewFor(l, iv, ghost);
  const { top, bottom, gain, x0, x1 } = view;
  const mismatch = ghostMismatch(name, ecg);

  const handles = [
    { key: "pOn", at: anchors.pOn, time: true },
    { key: "pEnd", at: anchors.pEnd, time: true },
    { key: "pPeak", at: anchors.pPeak },
    P_NEG_LEADS.includes(name) && { key: "pNeg", at: anchors.pNeg },
    { key: "q", at: anchors.q },
    { key: "r", at: anchors.r },
    { key: "s", at: anchors.s },
    (l.r2 > 0 || drag === "r2") && { key: "r2", at: anchors.r2 },
    { key: "j", at: anchors.j, time: true },
    { key: "tPeak", at: anchors.tPeak },
    { key: "tEnd", at: anchors.tEnd, time: true },
  ].filter(Boolean);

  const toLocal = (e) => {
    const svg = svgRef.current;
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return { t: q.x * 40, a: -q.y / gain };
  };

  const onDown = (key) => (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    frozen.current = view;
    setDrag(key);
  };
  const onMove = (key) => (e) => {
    if (drag !== key) return;
    const { t, a } = toLocal(e);
    update(c => {
      applyDrag(c, name, key, t, a, tPeakU);
      if (GLOBAL_KEYS[key]) GLOBAL_KEYS[key].forEach(k => { c.ivReviewed[k] = true; });
      else c.reviewed[name] = true;
    });
  };
  const onUp = () => { setDrag(null); frozen.current = null; };

  const readout = drag ? W.readout[drag](l, iv) : null;
  const H = (top - bottom) * gain;
  const fs = 0.62;

  return (
    <div>
      {/* Lead header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${C.line}` }}>
        <button onClick={onPrev} style={{ ...btn(), fontSize: 16, padding: "1px 10px" }}>{W.prevLead}</button>
        <span style={{ color: C.accent, fontWeight: 800, fontSize: 16, minWidth: 38, textAlign: "center" }}>{name}</span>
        <button onClick={onNext} style={{ ...btn(), fontSize: 16, padding: "1px 10px" }}>{W.nextLead}</button>
        <span style={chip(reviewed ? C.accent : C.dim, reviewed ? "rgba(0,230,118,0.1)" : "transparent")}>{reviewed ? W.shaped : W.template}</span>
        <span style={{ marginLeft: "auto", color: C.dim, fontSize: 10.5 }}>{W.gain(gain)}</span>
      </div>

      <div style={{ minHeight: 22, padding: "3px 14px", lineHeight: 1.4, color: drag ? C.yellow : C.dim, fontSize: 11.5, fontWeight: drag ? 700 : 400 }}>
        {readout || (LIMB.includes(name) && ghost ? W.ghostHelp : "")}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${x0} ${-top * gain} ${x1 - x0} ${H}`}
        style={{ width: "100%", maxHeight: "58vh", display: "block", background: C.paper, userSelect: "none" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="ed-sm" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke={C.gridSm} strokeWidth="0.04" />
          </pattern>
          <pattern id="ed-lg" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="url(#ed-sm)" />
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke={C.gridLg} strokeWidth="0.09" />
          </pattern>
        </defs>
        <rect x={x0} y={-top * gain} width={x1 - x0} height={H} fill="url(#ed-lg)" />
        <line x1={x0} x2={x1} y1={0} y2={0} stroke={C.gridLg} strokeWidth="0.06" />

        {/* Shared interval guides */}
        {[["pOn", anchors.pOn[0]], ["qrs0", 0], ["j", iv.qrs], ["tEnd", iv.qt]].map(([k, t]) => (
          <line key={k} x1={t / 40} x2={t / 40} y1={-top * gain} y2={-bottom * gain}
            stroke={C.yellow} strokeOpacity="0.25" strokeWidth="0.05" strokeDasharray="0.3 0.3" />
        ))}

        {ghost && (
          <path d={toPath(ghost, gain)} fill="none" stroke={C.yellow} strokeOpacity="0.75"
            strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="5 4" />
        )}
        <path d={toPath(pts, gain)} fill="none" stroke={reviewed ? C.accent : C.template}
          strokeWidth="2.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round"
          strokeDasharray={reviewed ? undefined : "6 4"} />

        {handles.map(h => {
          const cx = h.at[0] / 40, cy = -h.at[1] * gain;
          const col = h.time ? C.yellow : C.accent;
          const above = h.at[1] >= 0 && h.key !== "pOn" && h.key !== "pEnd" && h.key !== "tEnd";
          return (
            <g key={h.key}>
              <circle cx={cx} cy={cy} r={drag === h.key ? 0.45 : 0.32} fill={col} stroke={C.bg} strokeWidth="0.08" />
              <text x={cx} y={above ? cy - 0.6 : cy + 1.0} fontSize={fs} fill={col} textAnchor="middle"
                style={{ fontFamily: "monospace", fontWeight: 700, pointerEvents: "none" }}>{W.labels[h.key]}</text>
              <circle
                cx={cx} cy={cy} r={1.05} fill="transparent"
                style={{ cursor: h.time ? "ew-resize" : "move", touchAction: "none" }}
                onPointerDown={onDown(h.key)} onPointerMove={onMove(h.key)}
                onPointerUp={onUp} onPointerCancel={onUp}
              />
            </g>
          );
        })}
      </svg>

      {/* Lead tools */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 14px" }}>
        {!reviewed && (
          <button style={btn(true)} onClick={() => update(c => { c.reviewed[name] = true; })}>{W.confirmLead}</button>
        )}
        <button style={btn(l.r2 > 0)} onClick={() => update(c => {
          const L = c.leads[name];
          L.r2 = L.r2 > 0 ? 0 : Math.max(2, Math.round(L.r / 2));
          c.reviewed[name] = true;
        })}>{l.r2 > 0 ? W.removeR2 : W.addR2}</button>
        <button style={btn(l.frag)} onClick={() => update(c => { c.leads[name].frag = !c.leads[name].frag; c.reviewed[name] = true; })}>{W.frag}</button>
        <button style={btn(iv.pNotch)} onClick={() => update(c => { c.iv.pNotch = !c.iv.pNotch; c.ivReviewed.pDur = true; })}>{W.pNotch}</button>
        <button style={btn()} onClick={() => update(c => { c.leads[name] = newCase().leads[name]; delete c.reviewed[name]; })}>{W.resetLead}</button>
      </div>

      {mismatch && (
        <div style={{ margin: "0 14px 8px", padding: "8px 10px", border: `1px solid ${C.yellow}`, borderRadius: 6, background: "rgba(255,214,0,0.06)" }}>
          <div style={{ color: C.yellow, fontSize: 12, lineHeight: 1.5 }}>
            ⚠ {W.ghostMismatch(name, fmt(mismatch.drawn), fmt(mismatch.expected))}
          </div>
          <button style={{ ...btn(), marginTop: 6 }} onClick={() => update(c => {
            c.leads[name] = snapToNet(c.leads[name], mismatch.expected);
          })}>{W.snapGhost}</button>
        </div>
      )}
    </div>
  );
}

const fmt = (x) => (Math.round(x * 10) / 10).toString().replace("-", "−");
