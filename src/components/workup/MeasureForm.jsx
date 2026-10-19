import { LEADS, netQRS } from "../../engine/leads.js";
import { C, FONT, sectionLabel } from "./theme.js";

const inputStyle = (w = 64) => ({
  width: w, background: "#030a07", border: `1px solid ${C.border}`, borderRadius: 4,
  color: C.body, fontFamily: FONT, fontSize: 12.5, padding: "5px 6px",
});

function Num({ value, onChange, w, placeholder }) {
  return (
    <input
      type="number" inputMode="decimal" step="any" placeholder={placeholder}
      value={value ?? ""} style={inputStyle(w)}
      onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );
}

function Sel({ value, options, onChange }) {
  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value)} style={{ ...inputStyle(150), padding: "5px 4px" }}>
      {Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

const Row = ({ label, children, help }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.line}` }}>
    <span style={{ flex: 1, color: C.soft, fontSize: 12 }}>
      {label}
      {help && <span style={{ display: "block", color: C.faint, fontSize: 10.5, marginTop: 2 }}>{help}</span>}
    </span>
    {children}
  </label>
);

const COLS = ["p", "q", "qDur", "r", "rpt", "s", "r2", "st", "t"];

export default function MeasureForm({ ecg, update, W }) {
  const m = ecg.meta, iv = ecg.iv;
  const setMeta = (k) => (v) => update(c => { c.meta[k] = v; });
  const setIv = (k) => (v) => update(c => {
    c.iv[k] = v;
    if (k === "pDurHi") return;
    if (v == null) delete c.ivReviewed[k]; else c.ivReviewed[k] = true;
  });
  const setLead = (n, k) => (v) => update(c => { c.leads[n][k] = v ?? 0; c.reviewed[n] = true; });

  return (
    <div style={{ padding: "12px 14px 40px" }}>
      <div style={sectionLabel}>{W.patient}</div>
      <Row label={W.hr}><Num value={m.hr} onChange={setMeta("hr")} /></Row>
      <Row label={W.rhythm}><Sel value={m.rhythm} options={W.rhythmOpts} onChange={setMeta("rhythm")} /></Row>
      <Row label={W.pEvery}><Sel value={m.pEveryQrs} options={W.yesNoOpts} onChange={setMeta("pEveryQrs")} /></Row>
      <Row label={W.delta}>
        <input type="checkbox" checked={!!m.delta} onChange={e => setMeta("delta")(e.target.checked)} style={{ width: 18, height: 18, accentColor: C.accent }} />
      </Row>
      <Row label={W.sex}><Sel value={m.sex} options={W.sexOpts} onChange={setMeta("sex")} /></Row>
      <Row label={W.age}><Num value={m.age} onChange={setMeta("age")} /></Row>

      <div style={{ ...sectionLabel, marginTop: 20 }}>{W.intervals}</div>
      {[["pDur", W.pDur], ["pr", W.pr], ["qrs", W.qrs], ["qt", W.qt]].map(([k, label]) => (
        <Row key={k} label={label}>
          <Num value={ecg.ivReviewed[k] ? iv[k] : null} placeholder={String(iv[k])} onChange={setIv(k)} />
        </Row>
      ))}
      <Row label={W.pDurHi} help={W.pDurHiHelp}><Num value={iv.pDurHi} onChange={setIv("pDurHi")} /></Row>
      <Row label={W.pNotch}>
        <input type="checkbox" checked={!!iv.pNotch} onChange={e => update(c => { c.iv.pNotch = e.target.checked; })} style={{ width: 18, height: 18, accentColor: C.accent }} />
      </Row>

      <div style={{ ...sectionLabel, marginTop: 20 }}>{W.leadTable}</div>
      <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 6 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: 640 }}>
          <thead>
            <tr>
              {["lead", ...COLS, "pNeg", "frag"].map(k => (
                <th key={k} style={{ color: C.dim, fontWeight: 800, padding: "6px 4px", textAlign: "left", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{W.cols[k]}</th>
              ))}
              <th style={{ color: C.dim, padding: "6px 4px", borderBottom: `1px solid ${C.line}` }}>{W.net}</th>
            </tr>
          </thead>
          <tbody>
            {LEADS.map(n => {
              const l = ecg.leads[n];
              const rev = !!ecg.reviewed[n];
              return (
                <tr key={n} style={{ opacity: rev ? 1 : 0.55 }}>
                  <td style={{ color: rev ? C.accent : C.soft, fontWeight: 800, padding: "3px 6px" }}>{n}</td>
                  {COLS.map(k => (
                    <td key={k} style={{ padding: 2 }}><Num w={50} value={l[k]} onChange={setLead(n, k)} /></td>
                  ))}
                  <td style={{ padding: 2, whiteSpace: "nowrap" }}>
                    {n === "V1" ? (
                      <>
                        <Num w={42} value={l.pNeg} onChange={setLead(n, "pNeg")} />
                        <span style={{ color: C.faint }}>×</span>
                        <Num w={42} value={l.pNegDur} onChange={setLead(n, "pNegDur")} />
                      </>
                    ) : null}
                  </td>
                  <td style={{ padding: 2, textAlign: "center" }}>
                    <input type="checkbox" checked={!!l.frag} onChange={e => update(c => { c.leads[n].frag = e.target.checked; c.reviewed[n] = true; })} style={{ accentColor: C.accent }} />
                  </td>
                  <td style={{ color: C.body, padding: "3px 6px", textAlign: "right" }}>{(Math.round(netQRS(l) * 10) / 10)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
