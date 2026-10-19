// Wording for the SCAN and PATTERNS tabs (EN / KO) and the formatters that turn
// the language-neutral pattern analysis into sentences.

import { FINDINGS, TERR_NAME, STEPS } from "../engine/patterns/catalog.js";
import { CAUSES, tx } from "../engine/patterns/causes.js";

const r1 = (x) => (Math.round(x * 10) / 10).toString().replace("-", "−");
const sg = (x) => (x > 0 ? "+" : "") + r1(x);

export const PUI = {
  en: {
    tabs: { scan: "SCAN", patterns: "PATTERNS" },
    scan: {
      title: "UPLOAD AN EKG",
      hint: "A photo, screenshot or PDF of a standard 12-lead (4 columns × 3 rows). It is read on this device — nothing is uploaded.",
      choose: "Choose image or PDF",
      another: "Choose another file",
      loading: "Reading file…",
      page: (n, t) => `Page ${n} / ${t}`,
      unsupported: "That file type is not supported. Use a PNG, JPG, WebP or PDF.",
      pdfFail: "Could not read that PDF.",
      imgFail: "Could not read that image.",
      step1: "1 · Drag the two GREEN corners onto the 12-lead block: top-left of lead I, bottom-right of lead V6 (or the last lead on the page).",
      step2: "2 · Drag the two YELLOW points onto grid lines a known distance apart, then enter that distance.",
      calDist: "Distance between the yellow points",
      calPresets: [[5, "1 large box (5 mm)"], [25, "5 large boxes (25 mm)"], [50, "10 large boxes (50 mm)"]],
      mm: "mm",
      speed: "Paper speed",
      gain: "Gain",
      sens: "Trace darkness cut-off",
      auto: "auto",
      patient: "Patient (re-ranks the causes)",
      age: "Age",
      sex: "Sex",
      sexOpts: { "": "—", m: "Male", f: "Female" },
      extract: "READ THIS EKG",
      busy: "Reading…",
      resultTitle: "WHAT WAS READ",
      overlayHint: "The red line over the image is the trace the reader followed. If it wanders off the real trace, move the green corners or change the darkness cut-off, then read again.",
      apply: "USE THESE MEASUREMENTS",
      applied: "Loaded — see PATTERNS",
      confirmReplace: "Replace the current case with this scan?",
      leadsRead: (n) => `${n}/12 leads read`,
      summary: (m) => [
        m.hr != null ? `HR ${m.hr} bpm` : null,
        m.pr != null ? `PR ${m.pr} ms` : null,
        m.qrs != null ? `QRS ${m.qrs} ms` : null,
        m.qt != null ? `QT ${m.qt} ms` : null,
      ].filter(Boolean).join(" · "),
      note: (n) => ({
        noTrace: () => `${n.lead}: no trace found in its box — check the green corners.`,
        noQrs: () => `${n.lead}: no complete beat found (clipped or too noisy).`,
        fewBeats: () => "Fewer than 3 beats found, so rate and rhythm were not set — enter them on the MEASURE tab.",
        irregular: () => "R–R intervals vary: rhythm set to irregular. Check for P waves before calling AF vs. sinus arrhythmia or ectopy.",
        noP: () => "No clear P wave measured — PR and P duration were not set.",
        noT: () => "No clear T wave end found — QT was not set.",
        unmeasured: () => `${n.lead}: ${n.what.join(", ")} could not be measured and keep the normal template value.`,
      }[n.code]()),
      caveat: "Reading a scan is approximate: amplitudes ±1 mm, intervals ±15 ms on a clean image. Compare the red overlay with the original and correct anything off on the MEASURE tab.",
      lead: "Lead",
    },
    pat: {
      patient: "Patient",
      age: "Age",
      sex: "Sex",
      sexOpts: { "": "—", m: "Male", f: "Female" },
      demoNote: "Age and sex re-rank the causes (a teaching tilt, not a probability).",
      cards: { global: "TRACING", final: "FINAL" },
      globalTitle: "Whole tracing — rate, rhythm, axis, intervals",
      finalTitle: "FINAL — what ties it together",
      prev: "‹", next: "›",
      measured: "measured", notMeasured: "not measured yet — draw or scan this lead",
      comps: { p: "P", q: "Q", r: "R", s: "S", shape: "QRS shape", st: "ST", t: "T" },
      compLong: { p: "P wave", q: "Q wave", r: "R wave", s: "S wave", shape: "QRS shape", st: "ST segment", t: "T wave" },
      normalRange: {
        p: "Upright 0.5–2.5 mm in I, II, V4–V6; negative in aVR; V1 may be biphasic (terminal ≤1 mm × 40 ms).",
        q: "<1 mm and <30 ms (small septal q in I, aVL, V5–V6 is normal); QS in V1 is normal, in V2–V3 it is not.",
        r: "Grows V1→V4–V5; V5/V6 <25 mm, aVL <11 mm, aVF <20 mm; R in V1 smaller than S.",
        s: "Deepest in V1–V3 (<25 mm), shrinking toward V6.",
        shape: "One clean R/S; no rSR′ in V1–V2, no notching or slurring.",
        st: "At the baseline (±0.5 mm); up to 1 mm in limb leads and 1–2 mm in V2–V3 can be normal.",
        t: "Upright in I, II, V3–V6; inverted in aVR; V1 (± III) may be inverted; <10 mm precordial, <6 mm limb.",
      },
      value: {
        none: "—",
        p: (l) => (l.pNeg > 0 ? `${sg(l.p)} / −${r1(l.pNeg)} mm × ${Math.round(l.pNegDur)} ms` : `${sg(l.p)} mm`),
        q: (l) => (l.q > 0 ? `${r1(l.q)} mm × ${Math.round(l.qDur)} ms` : l.r === 0 && l.s > 0 ? "QS" : "none"),
        r: (l) => (l.r > 0 ? `${r1(l.r)} mm` : "none"),
        s: (l) => (l.s > 0 ? `${r1(l.s)} mm` : "none"),
        shape: (l) => [l.r2 > 0 ? `R′ ${r1(l.r2)} mm` : null, l.frag ? "notched" : null].filter(Boolean).join(", ") || "smooth",
        st: (l) => `${sg(l.st)} mm`,
        t: (l) => `${sg(l.t)} mm`,
      },
      ok: "normal",
      abn: "abnormal",
      couldBe: "COULD BE · most likely first",
      more: (n) => `show ${n} more`,
      less: "show fewer",
      tell: "How to tell",
      lvl: ["leading", "likely", "possible", "less likely"],
      secondary: (w) => ({ lbbb: "Expected secondary change with LBBB — down-weighted.", rbbb: "Expected secondary change with RBBB — down-weighted." }[w]),
      reciprocal: "Reciprocal pattern (ST elevation in one territory, depression opposite) — strongly favours STEMI.",
      sharedWith: (n) => `${n} more finding${n > 1 ? "s" : ""} point${n > 1 ? "" : "s"} at the same causes — see FINAL.`,
      nothingHere: "Nothing abnormal in this lead.",
      process: "THOUGHT PROCESS · in reading order",
      processHint: "Read every ECG in this order, every time. Each step asks one question, notes what you see, and updates the running differential.",
      see: "I see",
      so: "So it could be",
      running: "Running differential",
      nothing: "nothing yet",
      stepNormal: "Normal — nothing to explain.",
      axisByFascicle: "Abnormal, but already accounted for by the fascicular block in step 4 — not counted twice.",
      top3: "TOP 3 THAT TIE IT TOGETHER",
      explains: "Explains",
      notExplains: "Does not explain",
      tellApart: "Tell it apart",
      rel: "relative likelihood",
      normalOut: "Nothing here needs explaining — no abnormal pattern in the leads you measured.",
      scoreNote: (age, sex) => `Ranking = how many of the findings each cause explains × how typical it is for ${age != null ? `age ${age}` : "an adult"}${sex ? `, ${sex === "m" ? "male" : "female"}` : ""}. It is a teaching heuristic, not a probability: symptoms, history and old ECGs outweigh demographics.`,
      partial: (n) => `Only ${n}/12 leads measured — the synthesis is partial.`,
      empty: "Nothing to analyse yet — scan an EKG (SCAN), draw it (DRAW) or load a demo from the CASE menu.",
      disclaimer: "Educational tool, not a medical device. Cause lists and weights are teaching heuristics — verify against guidelines and the clinical picture.",
      goScan: "Scan an EKG",
    },
    see: {
      rate: ({ hr }) => (hr == null ? "Heart rate not measured." : `${hr} bpm — ${hr < 60 ? "slow (<60)" : hr > 100 ? "fast (>100)" : "normal (60–100)"}.`),
      rhythm: (s) => {
        const reg = { regular: "regular", regirreg: "regularly irregular", irregirreg: "irregularly irregular" }[s.rhythm];
        const pe = { yes: "a P wave before every QRS", no: "P waves NOT before every QRS" }[s.pEvery];
        const bits = [reg ? `R–R ${reg}` : "regularity not entered", pe || "P-before-QRS not entered"];
        if (s.pInv.length) bits.push(`inverted P in ${s.pInv.join(", ")}`);
        return bits.join("; ") + ".";
      },
      axis: (s) => (s.deg == null ? "Axis not determined — draw/scan more limb leads." : `${Math.round(s.deg)}° — ${{ normal: "normal (−30° to +90°)", lad: "left axis deviation", rad: "right axis deviation", extreme: "extreme axis" }[s.cat] || "indeterminate"}.`),
      intervals: (s) => [s.pr != null ? `PR ${s.pr} ms${s.pr > 200 ? " (long)" : s.pr < 120 ? " (short)" : ""}` : "PR not measured",
        s.qrs != null ? `QRS ${s.qrs} ms${s.qrs >= 120 ? " (wide)" : s.qrs > 110 ? " (borderline)" : ""}` : "QRS not measured",
        s.qtc != null ? `QTc ${Math.round(s.qtc)} ms` : "QTc not calculated"].join(" · ") + ".",
      pwave: (s) => [s.II != null ? `P in II ${sg(s.II)} mm` : null, s.V1 ? `P in V1 ${sg(s.V1.p)} mm${s.V1.pNeg > 0 ? `, terminal −${r1(s.V1.pNeg)} mm` : ""}` : null].filter(Boolean).join("; ") || "P waves not measured.",
      qrs: (s) => [
        s.q.length ? `pathologic Q in ${s.q.join(", ")}` : "no pathologic Q waves",
        s.transition ? (s.transition === "none" ? "no R/S transition by V6" : `R/S transition at ${s.transition}`) : "transition not assessable",
        s.tallR.length ? `tall R in ${s.tallR.join(", ")}` : null,
        s.shape.length ? `rSR′ / notching in ${[...new Set(s.shape)].join(", ")}` : null,
      ].filter(Boolean).join("; ") + ".",
      st: (s) => `ST elevation: ${s.ste.length ? s.ste.join(", ") : "none"}; ST depression: ${s.std.length ? s.std.join(", ") : "none"}.`,
      t: (s) => `T inversion: ${s.inv.length ? s.inv.join(", ") : "none"}; peaked: ${s.peaked.length ? s.peaked.join(", ") : "none"}; flat: ${s.flat.length ? s.flat.join(", ") : "none"}.`,
    },
    scopeWord: (k) => tx(TERR_NAME[k], "en"),
  },

  ko: {
    tabs: { scan: "스캔", patterns: "패턴" },
    scan: {
      title: "EKG 업로드",
      hint: "표준 12유도 (4열 × 3행)의 사진, 스크린샷 또는 PDF. 이 기기에서만 분석하며 업로드되지 않습니다.",
      choose: "이미지 또는 PDF 선택",
      another: "다른 파일 선택",
      loading: "파일 읽는 중…",
      page: (n, t) => `${n} / ${t} 페이지`,
      unsupported: "지원하지 않는 파일 형식입니다. PNG, JPG, WebP 또는 PDF를 사용하세요.",
      pdfFail: "PDF를 읽을 수 없습니다.",
      imgFail: "이미지를 읽을 수 없습니다.",
      step1: "1 · 초록색 모서리 두 점을 12유도 영역에 맞추세요: I 유도의 왼쪽 위, V6(또는 마지막 유도)의 오른쪽 아래.",
      step2: "2 · 노란색 두 점을 거리를 아는 격자선에 맞추고 그 거리를 입력하세요.",
      calDist: "노란 점 사이 거리",
      calPresets: [[5, "큰 칸 1개 (5 mm)"], [25, "큰 칸 5개 (25 mm)"], [50, "큰 칸 10개 (50 mm)"]],
      mm: "mm",
      speed: "종이 속도",
      gain: "게인",
      sens: "파형 어두움 기준",
      auto: "자동",
      patient: "환자 (원인 순위에 반영)",
      age: "나이",
      sex: "성별",
      sexOpts: { "": "—", m: "남", f: "여" },
      extract: "이 EKG 읽기",
      busy: "읽는 중…",
      resultTitle: "읽은 결과",
      overlayHint: "이미지 위의 빨간 선이 분석기가 따라간 파형입니다. 실제 파형에서 벗어나면 초록 모서리를 옮기거나 어두움 기준을 바꾼 뒤 다시 읽으세요.",
      apply: "이 측정값 사용",
      applied: "불러옴 — 패턴 탭 확인",
      confirmReplace: "현재 케이스를 이 스캔으로 바꿀까요?",
      leadsRead: (n) => `${n}/12 유도 읽음`,
      summary: (m) => [
        m.hr != null ? `HR ${m.hr} bpm` : null,
        m.pr != null ? `PR ${m.pr} ms` : null,
        m.qrs != null ? `QRS ${m.qrs} ms` : null,
        m.qt != null ? `QT ${m.qt} ms` : null,
      ].filter(Boolean).join(" · "),
      note: (n) => ({
        noTrace: () => `${n.lead}: 해당 영역에서 파형을 찾지 못했습니다 — 초록 모서리를 확인하세요.`,
        noQrs: () => `${n.lead}: 완전한 박동을 찾지 못했습니다 (잘렸거나 잡음이 많음).`,
        fewBeats: () => "박동이 3개 미만이라 맥박수와 리듬을 설정하지 못했습니다 — 측정 탭에서 입력하세요.",
        irregular: () => "R–R 간격이 일정하지 않아 불규칙으로 설정했습니다. 심방세동 vs 동성 부정맥·조기수축은 P파를 확인하세요.",
        noP: () => "뚜렷한 P파를 측정하지 못했습니다 — PR과 P 폭은 설정되지 않았습니다.",
        noT: () => "T파 끝을 찾지 못했습니다 — QT는 설정되지 않았습니다.",
        unmeasured: () => `${n.lead}: ${n.what.join(", ")} 측정 불가 — 정상 템플릿 값 유지.`,
      }[n.code]()),
      caveat: "스캔 판독은 근사치입니다: 깨끗한 이미지에서 진폭 ±1 mm, 간격 ±15 ms. 빨간 오버레이를 원본과 비교하고 이상한 값은 측정 탭에서 고치세요.",
      lead: "유도",
    },
    pat: {
      patient: "환자",
      age: "나이",
      sex: "성별",
      sexOpts: { "": "—", m: "남", f: "여" },
      demoNote: "나이와 성별은 원인 순위를 조정합니다 (교육용 가중치이며 확률이 아닙니다).",
      cards: { global: "전체", final: "종합" },
      globalTitle: "전체 파형 — 맥박수, 리듬, 축, 간격",
      finalTitle: "종합 — 모든 것을 묶는 설명",
      prev: "‹", next: "›",
      measured: "측정됨", notMeasured: "아직 측정되지 않음 — 이 유도를 그리거나 스캔하세요",
      comps: { p: "P", q: "Q", r: "R", s: "S", shape: "QRS 모양", st: "ST", t: "T" },
      compLong: { p: "P파", q: "Q파", r: "R파", s: "S파", shape: "QRS 모양", st: "ST 분절", t: "T파" },
      normalRange: {
        p: "I, II, V4–V6에서 0.5–2.5 mm 직립; aVR 음성; V1은 이상성 가능 (종말부 ≤1 mm × 40 ms).",
        q: "<1 mm, <30 ms (I, aVL, V5–V6의 작은 중격 q는 정상); V1 QS는 정상, V2–V3 QS는 비정상.",
        r: "V1→V4–V5로 커짐; V5/V6 <25 mm, aVL <11 mm, aVF <20 mm; V1 R은 S보다 작음.",
        s: "V1–V3에서 가장 깊고(<25 mm) V6로 갈수록 작아짐.",
        shape: "깔끔한 단일 R/S; V1–V2 rSR′ 없음, notch·slur 없음.",
        st: "기저선 (±0.5 mm); 사지 유도 1 mm, V2–V3 1–2 mm까지는 정상일 수 있음.",
        t: "I, II, V3–V6 직립; aVR 역위; V1(± III) 역위 가능; 흉부 <10 mm, 사지 <6 mm.",
      },
      value: {
        none: "—",
        p: (l) => (l.pNeg > 0 ? `${sg(l.p)} / −${r1(l.pNeg)} mm × ${Math.round(l.pNegDur)} ms` : `${sg(l.p)} mm`),
        q: (l) => (l.q > 0 ? `${r1(l.q)} mm × ${Math.round(l.qDur)} ms` : l.r === 0 && l.s > 0 ? "QS" : "없음"),
        r: (l) => (l.r > 0 ? `${r1(l.r)} mm` : "없음"),
        s: (l) => (l.s > 0 ? `${r1(l.s)} mm` : "없음"),
        shape: (l) => [l.r2 > 0 ? `R′ ${r1(l.r2)} mm` : null, l.frag ? "notch" : null].filter(Boolean).join(", ") || "매끈함",
        st: (l) => `${sg(l.st)} mm`,
        t: (l) => `${sg(l.t)} mm`,
      },
      ok: "정상",
      abn: "비정상",
      couldBe: "가능한 원인 · 가능성 높은 순",
      more: (n) => `${n}개 더 보기`,
      less: "접기",
      tell: "감별 포인트",
      lvl: ["가장 유력", "유력", "가능", "가능성 낮음"],
      secondary: (w) => ({ lbbb: "LBBB에 동반되는 이차성 변화 — 가중치 낮춤.", rbbb: "RBBB에 동반되는 이차성 변화 — 가중치 낮춤." }[w]),
      reciprocal: "거울상 양상 (한 영역 ST 상승, 반대편 ST 하강) — STEMI를 강하게 시사.",
      sharedWith: (n) => `다른 ${n}개 소견이 같은 원인을 가리킵니다 — 종합 탭 참고.`,
      nothingHere: "이 유도에는 비정상 소견이 없습니다.",
      process: "사고 과정 · 판독 순서대로",
      processHint: "모든 ECG를 매번 이 순서로 읽으세요. 각 단계는 하나의 질문을 던지고, 본 것을 적고, 감별 진단 목록을 갱신합니다.",
      see: "관찰",
      so: "가능한 원인",
      running: "누적 감별 진단",
      nothing: "아직 없음",
      stepNormal: "정상 — 설명할 것 없음.",
      axisByFascicle: "비정상이지만 4단계의 분지차단으로 이미 설명됨 — 중복 계산하지 않음.",
      top3: "모든 것을 묶는 상위 3개",
      explains: "설명하는 소견",
      notExplains: "설명하지 못하는 소견",
      tellApart: "감별",
      rel: "상대적 가능성",
      normalOut: "설명이 필요한 소견이 없습니다 — 측정한 유도에 비정상 양상이 없습니다.",
      scoreNote: (age, sex) => `순위 = 각 원인이 설명하는 소견 수 × ${age != null ? `${age}세` : "성인"}${sex ? `, ${sex === "m" ? "남성" : "여성"}` : ""}에서의 전형성. 확률이 아닌 교육용 휴리스틱이며, 증상·병력·이전 ECG가 인구통계보다 훨씬 중요합니다.`,
      partial: (n) => `12개 중 ${n}개 유도만 측정됨 — 종합은 부분적입니다.`,
      empty: "아직 분석할 내용이 없습니다 — EKG를 스캔(스캔), 그리기(그리기)하거나 케이스 메뉴에서 데모를 불러오세요.",
      disclaimer: "교육용 도구이며 의료기기가 아닙니다. 원인 목록과 가중치는 교육용 휴리스틱입니다 — 가이드라인과 임상 상황으로 확인하세요.",
      goScan: "EKG 스캔",
    },
    see: {
      rate: ({ hr }) => (hr == null ? "맥박수 미측정." : `${hr} bpm — ${hr < 60 ? "느림 (<60)" : hr > 100 ? "빠름 (>100)" : "정상 (60–100)"}.`),
      rhythm: (s) => {
        const reg = { regular: "규칙적", regirreg: "규칙적으로 불규칙", irregirreg: "완전 불규칙" }[s.rhythm];
        const pe = { yes: "모든 QRS 앞에 P파 있음", no: "모든 QRS 앞에 P파가 없음" }[s.pEvery];
        const bits = [reg ? `R–R ${reg}` : "규칙성 미입력", pe || "P파-QRS 관계 미입력"];
        if (s.pInv.length) bits.push(`${s.pInv.join(", ")}에서 P파 역위`);
        return bits.join("; ") + ".";
      },
      axis: (s) => (s.deg == null ? "축 미결정 — 사지 유도를 더 그리거나 스캔하세요." : `${Math.round(s.deg)}° — ${{ normal: "정상 (−30° ~ +90°)", lad: "좌축편위", rad: "우축편위", extreme: "극단적 축" }[s.cat] || "불확실"}.`),
      intervals: (s) => [s.pr != null ? `PR ${s.pr} ms${s.pr > 200 ? " (연장)" : s.pr < 120 ? " (단축)" : ""}` : "PR 미측정",
        s.qrs != null ? `QRS ${s.qrs} ms${s.qrs >= 120 ? " (넓음)" : s.qrs > 110 ? " (경계)" : ""}` : "QRS 미측정",
        s.qtc != null ? `QTc ${Math.round(s.qtc)} ms` : "QTc 미계산"].join(" · ") + ".",
      pwave: (s) => [s.II != null ? `II P ${sg(s.II)} mm` : null, s.V1 ? `V1 P ${sg(s.V1.p)} mm${s.V1.pNeg > 0 ? `, 종말부 −${r1(s.V1.pNeg)} mm` : ""}` : null].filter(Boolean).join("; ") || "P파 미측정.",
      qrs: (s) => [
        s.q.length ? `${s.q.join(", ")}에 병적 Q파` : "병적 Q파 없음",
        s.transition ? (s.transition === "none" ? "V6까지 R/S 전환 없음" : `R/S 전환 ${s.transition}`) : "전환 평가 불가",
        s.tallR.length ? `${s.tallR.join(", ")} 높은 R파` : null,
        s.shape.length ? `${[...new Set(s.shape)].join(", ")} rSR′ / notch` : null,
      ].filter(Boolean).join("; ") + ".",
      st: (s) => `ST 상승: ${s.ste.length ? s.ste.join(", ") : "없음"}; ST 하강: ${s.std.length ? s.std.join(", ") : "없음"}.`,
      t: (s) => `T 역위: ${s.inv.length ? s.inv.join(", ") : "없음"}; 뾰족: ${s.peaked.length ? s.peaked.join(", ") : "없음"}; 납작: ${s.flat.length ? s.flat.join(", ") : "없음"}.`,
    },
    scopeWord: (k) => tx(TERR_NAME[k], "ko"),
  },
};

// "ST elevation — II, III, aVF (inferior)" / "Bradycardia — 48 bpm"
export function groupLabel(g, lang) {
  const f = FINDINGS[g.type];
  let s = tx(f.name, lang);
  if (g.leads.length) s += ` — ${g.leads.join(", ")}`;
  if (TERR_NAME[g.scope] && g.scope !== "avr") s += ` (${tx(TERR_NAME[g.scope], lang)})`;
  const v = g.value;
  if (v) {
    if (v.hr != null) s += ` — ${v.hr} bpm`;
    else if (v.deg != null) s += ` — ${Math.round(v.deg)}°`;
    else if (v.pr != null) s += ` — ${v.pr} ms`;
    else if (v.qtc != null) s += ` — QTc ${Math.round(v.qtc)} ms`;
  }
  return s;
}

export const causeName = (id, lang) => tx(CAUSES[id]?.n, lang);
export const causeTell = (id, lang) => tx(CAUSES[id]?.t, lang);
export const stepTitle = (key, lang) => tx(STEPS.find(s => s.key === key).title, lang);
export const stepQuestion = (key, lang) => tx(STEPS.find(s => s.key === key).q, lang);

// Likelihood word from a share relative to the leader.
export const levelIndex = (rank, rel) => (rank === 0 ? 0 : rel >= 0.6 ? 1 : rel >= 0.3 ? 2 : 3);
