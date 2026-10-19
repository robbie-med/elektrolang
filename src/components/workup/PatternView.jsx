import { useMemo, useRef, useState } from "react";
import { analyzePatterns, LEAD_ORDER, COMPS } from "../../engine/patterns/index.js";
import { PUI, groupLabel, causeName, causeTell, stepTitle, stepQuestion, levelIndex } from "../../i18n/patterns.js";
import { C, FONT, btn, chip, sectionLabel } from "./theme.js";

const numStyle = { width: 56, background: "#030a07", border: `1px solid ${C.border}`, borderRadius: 4, color: C.body, fontFamily: FONT, fontSize: 12, padding: "4px 5px" };

// ── one ranked list of causes ──────────────────────────────────────────────
function CauseList({ ranked, lang, P, limit = 3 }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(null);
  const shown = ranked.slice(0, all ? 5 : limit);
  const top = ranked[0]?.score || 1;
  return (
    <div style={{ margin: "2px 0 8px" }}>
      <div style={{ ...sectionLabel, marginBottom: 4 }}>{P.couldBe}</div>
      {shown.map((r, i) => {
        const rel = r.score / top;
        const lvl = P.lvl[levelIndex(i, rel)];
        return (
          <div key={r.id} style={{ marginBottom: 5 }}>
            <button onClick={() => setOpen(open === r.id ? null : r.id)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FONT }}>
              <span style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
                <span style={{ color: i === 0 ? C.accent : C.soft, fontWeight: 800, fontSize: 12, minWidth: 14 }}>{i + 1}.</span>
                <span style={{ flex: 1, color: i === 0 ? C.text : C.body, fontSize: 12.5, lineHeight: 1.4 }}>{causeName(r.id, lang)}</span>
                <span style={{ color: C.dim, fontSize: 10, whiteSpace: "nowrap" }}>{lvl}</span>
              </span>
              <span style={{ display: "block", height: 3, margin: "3px 0 0 21px", background: C.line, borderRadius: 2 }}>
                <span style={{ display: "block", height: 3, width: `${Math.max(4, rel * 100)}%`, background: i === 0 ? C.accent : C.accentDim, opacity: i === 0 ? 1 : 0.55, borderRadius: 2 }} />
              </span>
            </button>
            {open === r.id && (
              <div style={{ margin: "4px 0 0 21px", color: C.soft, fontSize: 11.5, lineHeight: 1.5 }}>
                <b style={{ color: C.dim }}>{P.tell}: </b>{causeTell(r.id, lang)}
              </div>
            )}
          </div>
        );
      })}
      {ranked.length > limit && (
        <button onClick={() => setAll(a => !a)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontFamily: FONT, padding: "0 0 0 21px" }}>
          {all ? P.less : P.more(Math.min(5, ranked.length) - limit)}
        </button>
      )}
    </div>
  );
}

// ── one finding group: label, notes, causes ────────────────────────────────
function GroupBlock({ g, lang, P }) {
  return (
    <div style={{ borderLeft: `3px solid ${C.yellow}`, paddingLeft: 9, margin: "6px 0 10px" }}>
      <div style={{ color: C.yellow, fontWeight: 800, fontSize: 12.5, lineHeight: 1.45 }}>{groupLabel(g, lang)}</div>
      {g.secondary && <div style={{ color: C.soft, fontSize: 11.5, margin: "2px 0" }}>{P.secondary(g.secondary)}</div>}
      {g.reciprocal && <div style={{ color: C.blue, fontSize: 11.5, margin: "2px 0" }}>{P.reciprocal}</div>}
      <CauseList ranked={g.ranked} lang={lang} P={P} />
    </div>
  );
}

// ── cards ──────────────────────────────────────────────────────────────────
function GlobalCard({ pat, lang, P, S }) {
  const rows = pat.steps.slice(0, 4);
  const extra = pat.groups.filter(g => !g.leads.length && g.step > 4 && g.weight > 0.05);
  return (
    <div>
      <p style={{ color: C.soft, fontSize: 12, margin: "0 0 4px" }}>{P.globalTitle}</p>
      {rows.map(s => (
        <div key={s.key} style={{ borderBottom: `1px solid ${C.line}`, padding: "9px 0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ color: s.abnormal || s.note ? C.yellow : C.accent, fontWeight: 800 }}>{s.n}.</span>
            <span style={{ flex: 1, color: C.text, fontWeight: 800, fontSize: 13 }}>{stepTitle(s.key, lang)}</span>
            <span style={chip(s.abnormal || s.note ? C.yellow : C.accent)}>{s.abnormal || s.note ? P.abn : P.ok}</span>
          </div>
          <div style={{ color: C.body, fontSize: 12.5, lineHeight: 1.55, margin: "4px 0 2px 22px" }}>{S[s.key](s.see)}</div>
          {s.note && <div style={{ color: C.yellow, fontSize: 12, lineHeight: 1.5, margin: "2px 0 0 22px" }}>▸ {P[s.note]}</div>}
          <div style={{ marginLeft: 22 }}>
            {s.groups.map(k => pat.byKey[k]).filter(g => g && !g.leads.length).map(g => <GroupBlock key={g.key} g={g} lang={lang} P={P} />)}
          </div>
        </div>
      ))}
      {extra.length > 0 && (
        <div style={{ paddingTop: 10 }}>
          {extra.map(g => <GroupBlock key={g.key} g={g} lang={lang} P={P} />)}
        </div>
      )}
    </div>
  );
}

function LeadCard({ name, pat, ecg, lang, P, onFinal }) {
  const L = pat.leads[name];
  const l = ecg.leads[name];
  if (!L.measured) return <p style={{ color: C.soft, fontSize: 12.5 }}>{name}: {P.notMeasured}</p>;
  const any = L.rows.some(r => r.flags.length);
  return (
    <div>
      {L.rows.map(row => {
        const keys = [...new Set(row.flags.map(f => f.gkey).filter(Boolean))];
        const abn = row.flags.length > 0;
        return (
          <div key={row.comp} style={{ borderBottom: `1px solid ${C.line}`, padding: "8px 0" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ color: abn ? C.yellow : C.accent, fontWeight: 800, width: 70, fontSize: 12.5 }}>{P.compLong[row.comp]}</span>
              <span style={{ flex: 1, color: C.text, fontSize: 13 }}>{P.value[row.comp](l)}</span>
              <span style={chip(abn ? C.yellow : C.accent)}>{abn ? P.abn : P.ok}</span>
            </div>
            <div style={{ color: C.faint, fontSize: 10.5, lineHeight: 1.45, margin: "3px 0 0 78px" }}>{P.normalRange[row.comp]}</div>
            {keys.map(k => <div key={k} style={{ marginTop: 8 }}><GroupBlock g={pat.byKey[k]} lang={lang} P={P} /></div>)}
          </div>
        );
      })}
      {!any && <p style={{ color: C.soft, fontSize: 12.5, marginTop: 12 }}>{P.nothingHere}</p>}
      {any && <button onClick={onFinal} style={{ ...btn(), marginTop: 12 }}>{P.cards.final} ›</button>}
    </div>
  );
}

function FinalCard({ pat, lang, P, S, topRef }) {
  const { synth, steps, byKey, demo } = pat;
  const label = (k) => groupLabel(byKey[k], lang);
  return (
    <div>
      <div style={sectionLabel}>{P.process}</div>
      <p style={{ color: C.soft, fontSize: 11.5, lineHeight: 1.5, margin: "0 0 8px" }}>{P.processHint}</p>
      {steps.map(s => (
        <div key={s.key} style={{ borderLeft: `3px solid ${s.abnormal || s.note ? C.yellow : C.border}`, paddingLeft: 10, margin: "0 0 12px" }}>
          <div style={{ color: s.abnormal || s.note ? C.yellow : C.accent, fontWeight: 800, fontSize: 13 }}>{s.n}. {stepTitle(s.key, lang)}</div>
          <div style={{ color: C.soft, fontStyle: "italic", fontSize: 11.5, margin: "1px 0 3px" }}>{stepQuestion(s.key, lang)}</div>
          <div style={{ fontSize: 12, lineHeight: 1.55 }}><b style={{ color: C.dim }}>{P.see}: </b><span style={{ color: C.body }}>{S[s.key](s.see)}</span></div>
          {s.note ? (
            <div style={{ color: C.yellow, fontSize: 12, lineHeight: 1.5 }}>▸ {P[s.note]}</div>
          ) : s.abnormal ? (
            <>
              {s.groups.map(k => <div key={k} style={{ color: C.yellow, fontSize: 12, lineHeight: 1.5 }}>▸ {label(k)}</div>)}
              <div style={{ fontSize: 12, lineHeight: 1.55 }}><b style={{ color: C.dim }}>{P.so}: </b><span style={{ color: C.text }}>{s.own.map(id => causeName(id, lang)).join(" · ")}</span></div>
            </>
          ) : (
            <div style={{ color: C.soft, fontSize: 12 }}>{P.stepNormal}</div>
          )}
          <div style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 3 }}>
            <b style={{ color: C.dim }}>{P.running}: </b>
            <span style={{ color: C.blue }}>{s.differential.length ? s.differential.map(id => causeName(id, lang)).join(" › ") : P.nothing}</span>
          </div>
        </div>
      ))}

      <div ref={topRef} style={{ background: C.panel, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "12px 14px", margin: "18px 0 10px" }}>
        <div style={{ ...sectionLabel, color: C.accent }}>{P.top3}</div>
        {synth.normal ? (
          <p style={{ color: C.body, fontSize: 13, margin: 0 }}>{P.normalOut}</p>
        ) : synth.top.map((t, i) => (
          <div key={t.id} style={{ padding: "9px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ color: C.accent, fontWeight: 800, fontSize: 15 }}>{i + 1}.</span>
              <span style={{ flex: 1, color: C.text, fontWeight: 800, fontSize: 13.5, lineHeight: 1.4 }}>{causeName(t.id, lang)}</span>
              <span style={chip(i === 0 ? C.accent : C.soft)}>{P.lvl[levelIndex(i, t.rel)]}</span>
            </div>
            <div style={{ height: 4, margin: "4px 0 6px 22px", background: C.line, borderRadius: 2 }}>
              <div style={{ height: 4, width: `${Math.max(5, t.rel * 100)}%`, background: C.accent, opacity: i === 0 ? 1 : 0.55, borderRadius: 2 }} />
            </div>
            <div style={{ marginLeft: 22, fontSize: 12, lineHeight: 1.55 }}>
              {t.supports.length > 0 && (
                <div><b style={{ color: C.dim }}>{P.explains} ({t.supports.length}/{synth.activeCount}): </b>
                  <span style={{ color: C.body }}>{t.supports.map(label).join(" · ")}</span></div>
              )}
              {t.unexplained.length > 0 && (
                <div style={{ marginTop: 3 }}><b style={{ color: C.dim }}>{P.notExplains}: </b>
                  <span style={{ color: C.yellow }}>{t.unexplained.map(label).join(" · ")}</span></div>
              )}
              <div style={{ marginTop: 3, color: C.soft }}><b style={{ color: C.dim }}>{P.tellApart}: </b>{causeTell(t.id, lang)}</div>
            </div>
          </div>
        ))}
      </div>
      {pat.coverage.leads < 12 && <p style={{ color: C.yellow, fontSize: 11.5 }}>{P.partial(pat.coverage.leads)}</p>}
      <p style={{ color: C.faint, fontSize: 10.5, lineHeight: 1.5 }}>{P.scoreNote(demo.age, demo.sex)}</p>
      <p style={{ color: C.faint, fontSize: 10.5, lineHeight: 1.5 }}>{P.disclaimer}</p>
    </div>
  );
}

// ── tab ────────────────────────────────────────────────────────────────────
export default function PatternView({ ecg, result, lang, update, onScan }) {
  const P = PUI[lang].pat, S = PUI[lang].see;
  const pat = useMemo(() => analyzePatterns(ecg, result), [ecg, result]);
  const [card, setCard] = useState("global");
  const topRef = useRef(null);
  const cards = ["global", ...LEAD_ORDER, "final"];
  const idx = cards.indexOf(card);
  const go = (d) => setCard(cards[(idx + d + cards.length) % cards.length]);
  const flagged = (n) => pat.leads[n].rows.some(r => r.flags.length);
  const empty = pat.coverage.leads === 0 && ecg.meta.hr == null;
  const title = card === "global" ? P.cards.global : card === "final" ? P.cards.final : card;

  return (
    <div style={{ padding: "10px 14px 60px" }}>
      {/* patient */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...sectionLabel, margin: 0 }}>{P.patient}</span>
        <label style={{ color: C.soft, fontSize: 11.5 }}>{P.age}{" "}
          <input type="number" inputMode="numeric" min="0" max="120" value={ecg.meta.age ?? ""} style={numStyle}
            onChange={e => update(c => { c.meta.age = e.target.value === "" ? null : Number(e.target.value); })} />
        </label>
        <label style={{ color: C.soft, fontSize: 11.5 }}>{P.sex}{" "}
          <select value={ecg.meta.sex || ""} style={{ ...numStyle, width: 70 }} onChange={e => update(c => { c.meta.sex = e.target.value; })}>
            {Object.entries(P.sexOpts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <p style={{ color: C.faint, fontSize: 10.5, margin: "4px 0 8px" }}>{P.demoNote}</p>

      {empty ? (
        <div style={{ padding: "24px 0" }}>
          <p style={{ color: C.soft, fontSize: 13, lineHeight: 1.55 }}>{P.empty}</p>
          <button style={btn(true)} onClick={onScan}>{P.goScan}</button>
        </div>
      ) : (
        <>
          {/* card chips */}
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 6 }}>
            {cards.map(k => {
              const abn = k === "global" ? pat.steps.slice(0, 4).some(s => s.abnormal || s.note) || pat.groups.some(g => !g.leads.length && g.step > 4)
                : k === "final" ? !pat.synth.normal : flagged(k);
              const measured = k === "global" || k === "final" || pat.leads[k].measured;
              return (
                <button key={k} onClick={() => setCard(k)} style={{
                  ...btn(card === k), flex: "0 0 auto", padding: "4px 7px", fontSize: 11,
                  opacity: measured ? 1 : 0.45, borderColor: card === k ? C.accent : abn ? C.yellow : C.border,
                  color: card === k ? C.accent : abn ? C.yellow : C.soft,
                }}>
                  {k === "global" ? P.cards.global : k === "final" ? P.cards.final : k}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 4px" }}>
            <button style={btn()} onClick={() => go(-1)}>{P.prev}</button>
            <span style={{ flex: 1, textAlign: "center", color: C.accent, fontWeight: 800, fontSize: 15, letterSpacing: 1 }}>{title}</span>
            {card !== "final" && <button style={btn()} onClick={() => { setCard("final"); setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); }}>{P.cards.final} ⤓</button>}
            <button style={btn()} onClick={() => go(1)}>{P.next}</button>
          </div>

          {card === "global" && <GlobalCard pat={pat} lang={lang} P={P} S={S} />}
          {LEAD_ORDER.includes(card) && <LeadCard name={card} pat={pat} ecg={ecg} lang={lang} P={P} onFinal={() => setCard("final")} />}
          {card === "final" && <FinalCard pat={pat} lang={lang} P={P} S={S} topRef={topRef} />}
        </>
      )}
    </div>
  );
}

export { COMPS };
