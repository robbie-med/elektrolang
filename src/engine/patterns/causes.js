// Causes ("what could produce this ECG change"), shared by the per-lead lists
// and the final synthesis. Each cause carries:
//   n  – name (en/ko)
//   t  – one-line "how to tell it apart" (en/ko)
//   p  – demographic prior multiplier p(age, sex)
//
// PRIORS ARE A TEACHING HEURISTIC, not epidemiology. They encode the textbook
// age/sex tilt of each cause for an undifferentiated adult and nothing else —
// symptoms, history and labs change the odds far more than demographics do.
// Bands: young < 35, middle 35–64, older ≥ 65. Unknown age → middle, unknown sex → 1.

export const L = (en, ko) => ({ en, ko });
export const tx = (o, lang) => (o && (o[lang] ?? o.en)) ?? "";

const band = (age) => (age == null ? 1 : age < 35 ? 0 : age < 65 ? 1 : 2);
const P = (young, mid, old, male = 1, female = 1) => (age, sex) =>
  [young, mid, old][band(age)] * (sex === "m" ? male : sex === "f" ? female : 1);
const flat = () => 1;

export const CAUSES = {
  // ── ischaemia / infarction ──────────────────────────────────────────────
  stemi: {
    n: L("Acute STEMI (coronary occlusion)", "급성 ST분절 상승 심근경색 (관상동맥 폐색)"),
    t: L("Convex / tombstone ST, mirror-image depression in opposite leads, changes over minutes; chest pain + troponin.",
      "볼록한 '묘비' 모양 ST, 반대쪽 유도의 거울상 ST 하강, 수분 내 변화; 흉통·트로포닌과 함께 판단."),
    p: P(0.15, 1, 1.6, 1.4, 0.7),
  },
  nstemi: {
    n: L("Ischaemia / NSTE-ACS (subendocardial)", "허혈 / 비ST상승 급성관상동맥증후군 (심내막하)"),
    t: L("Horizontal or downsloping ST depression in ≥2 contiguous leads, often dynamic with symptoms.",
      "인접한 2개 이상 유도의 수평·하향 ST 하강, 증상에 따라 변동."),
    p: P(0.15, 1, 1.8, 1.2, 0.9),
  },
  oldmi: {
    n: L("Old (healed) MI / scar", "과거 심근경색 / 반흔"),
    t: L("Q waves (± fragmented QRS, T inversion) in one coronary territory, no acute ST shift, no symptoms.",
      "한 관상동맥 영역에 Q파(± 분절 QRS, T 역위), 급성 ST 변화·증상 없음."),
    p: P(0.05, 1, 1.8, 1.4, 0.6),
  },
  aneurysm: {
    n: L("LV aneurysm (persistent ST elevation after MI)", "좌심실 류 (심근경색 후 지속 ST 상승)"),
    t: L("ST elevation stuck for weeks with Q waves and T that stays small relative to the QRS.",
      "수주간 지속되는 ST 상승 + Q파, QRS에 비해 T파가 작음."),
    p: P(0.05, 1, 1.3, 1.2, 0.8),
  },
  posteriorMI: {
    n: L("Posterior MI", "후벽 심근경색"),
    t: L("ST depression V1–V3 with tall R in V1–V2 and upright T; confirm with posterior leads V7–V9.",
      "V1–V3 ST 하강 + V1–V2 높은 R파 + 직립 T; 후벽 유도 V7–V9로 확인."),
    p: P(0.15, 1, 1.5, 1.3, 0.7),
  },
  wellens: {
    n: L("Wellens pattern (critical proximal LAD stenosis)", "Wellens 양상 (LAD 근위부 임계 협착)"),
    t: L("Biphasic or deep symmetric T inversion V2–V3 in a pain-free period, preserved R waves, little ST shift.",
      "무통 시기의 V2–V3 이상성·깊은 대칭 T 역위, R파 보존, ST 변화 거의 없음."),
    p: P(0.1, 1, 1.2, 1.1, 0.9),
  },
  mievol: {
    n: L("Recent / evolving MI (post-reperfusion T inversion)", "최근/진행 중인 심근경색 (재관류 후 T 역위)"),
    t: L("T inversion that follows ST elevation and Q-wave development in the same territory over hours–days.",
      "같은 영역에서 ST 상승·Q파 발생 후 수시간~수일에 걸쳐 나타나는 T 역위."),
    p: P(0.15, 1, 1.6, 1.3, 0.7),
  },
  prinzmetal: {
    n: L("Coronary vasospasm (Prinzmetal)", "관상동맥 연축 (Prinzmetal)"),
    t: L("Transient ST elevation that resolves with nitrates or spontaneously; younger, smokers, stimulant use.",
      "질산염 또는 자연적으로 소실되는 일과성 ST 상승; 젊은 연령, 흡연, 각성제 사용."),
    p: P(1.5, 1, 0.5),
  },
  takotsubo: {
    n: L("Takotsubo (stress) cardiomyopathy", "다코쓰보 (스트레스) 심근증"),
    t: L("Mimics anterior STEMI then deep diffuse T inversion with long QT; emotional/physical trigger, post-menopausal women.",
      "전벽 STEMI처럼 보이다가 깊은 광범위 T 역위와 QT 연장; 정서적·신체적 유발 요인, 폐경 후 여성."),
    p: P(0.2, 1, 1.5, 0.5, 2.2),
  },
  lmca: {
    n: L("Left main / multivessel ischaemia", "좌주간부 / 다혈관 허혈"),
    t: L("ST elevation in aVR (± V1) with diffuse ST depression, especially I, II, V4–V6.",
      "aVR(± V1) ST 상승과 광범위 ST 하강 (특히 I, II, V4–V6)."),
    p: P(0.1, 1, 1.7, 1.2, 0.9),
  },
  demand: {
    n: L("Demand ischaemia (tachyarrhythmia, anaemia, hypotension, sepsis)", "수요 허혈 (빈맥, 빈혈, 저혈압, 패혈증)"),
    t: L("Diffuse ST depression that tracks the trigger and resolves when it is corrected.",
      "유발 요인에 따라 변하고 교정하면 호전되는 광범위 ST 하강."),
    p: P(0.5, 1, 1.5),
  },
  inferiorMI: {
    n: L("Inferior MI (AV-nodal ischaemia)", "하벽 심근경색 (방실결절 허혈)"),
    t: L("Inferior ST elevation or Q waves; PR prolongation or block that is often transient.",
      "하벽 ST 상승 또는 Q파; 일과성인 경우가 많은 PR 연장·방실차단."),
    p: P(0.15, 1, 1.5, 1.4, 0.7),
  },
  cad: {
    n: L("Coronary artery disease / ischaemic cardiomyopathy", "관상동맥질환 / 허혈성 심근병증"),
    t: L("Risk factors, prior MI or angina; look for Q waves or ST-T change in a coronary territory.",
      "위험인자, 과거 MI·협심증; 관상동맥 영역의 Q파 또는 ST-T 변화 확인."),
    p: P(0.1, 1, 1.8, 1.4, 0.7),
  },

  // ── pericardium / myocardium ────────────────────────────────────────────
  pericarditis: {
    n: L("Acute pericarditis", "급성 심낭염"),
    t: L("Diffuse concave ST elevation + PR depression (PR elevation in aVR), no reciprocal depression except aVR/V1.",
      "광범위한 오목형 ST 상승 + PR 하강 (aVR은 PR 상승), aVR/V1 외에는 거울상 하강 없음."),
    p: P(1.6, 1, 0.8, 1.3, 0.9),
  },
  myocarditis: {
    n: L("Myocarditis", "심근염"),
    t: L("Recent viral illness, troponin ↑, ST elevation or T inversion that does not fit one coronary territory.",
      "최근 바이러스 감염, 트로포닌 상승, 단일 관상동맥 영역에 맞지 않는 ST 상승·T 역위."),
    p: P(2, 0.8, 0.4, 1.3, 0.8),
  },
  earlyrepol: {
    n: L("Early repolarisation (benign variant)", "조기 재분극 (양성 변이)"),
    t: L("Concave ST elevation ≤2 mm with J-point notch, upright T, no reciprocal depression, stable over time; young men.",
      "J점 notch를 동반한 2 mm 이하 오목형 ST 상승, 직립 T, 거울상 하강 없음, 장기간 안정; 젊은 남성."),
    p: P(3, 0.8, 0.2, 1.6, 0.6),
  },
  lvh_htn: {
    n: L("Left ventricular hypertrophy (hypertension, aortic valve disease)", "좌심실 비대 (고혈압, 대동맥판 질환)"),
    t: L("Voltage criteria with a lateral strain pattern; check blood pressure history and echo.",
      "전압 기준 충족 + 측벽 strain 양상; 고혈압력 및 심초음파 확인."),
    p: P(0.2, 1.2, 1.6, 1.1, 1),
  },
  lvh_strain: {
    n: L("LVH with strain (secondary repolarisation change)", "좌심실 비대 + strain (이차성 재분극 이상)"),
    t: L("Asymmetric ST depression and T inversion in leads with tall R waves (I, aVL, V5–V6).",
      "R파가 큰 유도(I, aVL, V5–V6)의 비대칭 ST 하강·T 역위."),
    p: P(0.15, 1.2, 1.6),
  },
  hcm: {
    n: L("Hypertrophic cardiomyopathy", "비후성 심근병증"),
    t: L("LVH voltage + deep narrow Q waves (inferior/lateral) ± giant T inversion (apical); family history.",
      "LVH 전압 + 하벽/측벽의 깊고 좁은 Q파 ± 거대 T 역위(심첨부); 가족력."),
    p: P(1.8, 1, 0.6, 1.3, 0.8),
  },
  cardiomyopathy: {
    n: L("Cardiomyopathy (dilated, infiltrative, ARVC, sarcoid)", "심근병증 (확장성, 침윤성, ARVC, 사코이드)"),
    t: L("Fragmented QRS, low voltage or conduction disease out of proportion to age; confirm with echo/CMR.",
      "분절 QRS, 저전압 또는 연령에 비해 과도한 전도 장애; 심초음파/CMR로 확인."),
    p: P(0.6, 1, 1.2),
  },

  // ── conduction ─────────────────────────────────────────────────────────
  lbbb: {
    n: L("Left bundle branch block", "좌각차단"),
    t: L("QRS ≥120 ms, broad notched R in I/V6, QS or rS in V1; ST-T is discordant to the QRS.",
      "QRS ≥120 ms, I/V6의 넓은 notch R, V1의 QS 또는 rS; ST-T는 QRS와 반대 방향."),
    p: P(0.1, 0.8, 1.6),
  },
  rbbb: {
    n: L("Right bundle branch block", "우각차단"),
    t: L("rSR′ in V1–V2 with wide terminal S in I/V6; ST-T discordant in V1–V3.",
      "V1–V2 rSR′ + I/V6의 넓은 종말 S파; V1–V3 ST-T는 반대 방향."),
    p: P(0.8, 1, 1.4),
  },
  lafb: {
    n: L("Left anterior fascicular block", "좌전분지차단"),
    t: L("Axis −45° or beyond with qR in aVL and rS in II/III/aVF, QRS <120 ms.",
      "축 −45° 이상 좌편위, aVL qR + II/III/aVF rS, QRS <120 ms."),
    p: P(0.2, 1, 1.5),
  },
  lpfb: {
    n: L("Left posterior fascicular block", "좌후분지차단"),
    t: L("Rare: right axis with rS in I/aVL and qR in III/aVF after excluding RVH, lateral MI and lung disease.",
      "드묾: RVH, 측벽 MI, 폐질환 배제 후 우축편위 + I/aVL rS, III/aVF qR."),
    p: P(0.2, 1, 1.4),
  },
  ivcd: {
    n: L("Non-specific intraventricular conduction delay", "비특이적 심실내 전도지연"),
    t: L("QRS ≥110 ms that fits neither bundle branch pattern; look for drugs, potassium, scar.",
      "어느 각차단 양상에도 맞지 않는 QRS ≥110 ms; 약물, 칼륨, 반흔 확인."),
    p: P(0.3, 1, 1.4),
  },
  pacing: {
    n: L("Ventricular pacing", "심실 박동 조율"),
    t: L("Pacing spikes (may be tiny on scans) before wide LBBB-like QRS; ask about a device.",
      "넓은 LBBB 양상 QRS 앞의 pacing spike (스캔에서는 작을 수 있음); 기기 삽입 여부 확인."),
    p: P(0.2, 0.8, 1.6),
  },
  wpw: {
    n: L("Pre-excitation (WPW)", "전조흥분 (WPW)"),
    t: L("Short PR + delta wave (slurred QRS upstroke) + wide QRS; secondary ST-T change.",
      "짧은 PR + delta파(QRS 시작부 완만한 상승) + 넓은 QRS; 이차성 ST-T 변화."),
    p: P(3, 0.7, 0.1),
  },
  degen: {
    n: L("Degenerative conduction-system disease", "퇴행성 전도계 질환"),
    t: L("Age-related fibrosis of sinus node, AV node and fascicles; slowly progressive, often multiple conduction findings.",
      "동결절·방실결절·분지의 연령 관련 섬유화; 서서히 진행하며 여러 전도 이상이 동반."),
    p: P(0.02, 0.6, 3),
  },
  avdrug: {
    n: L("AV-nodal / rate-slowing drugs (β-blocker, diltiazem/verapamil, digoxin, amiodarone)", "방실결절·맥박 억제 약물 (베타차단제, 딜티아젬/베라파밀, 디곡신, 아미오다론)"),
    t: L("Check the medication list; effect resolves with dose reduction.",
      "복용 약물 확인; 감량 시 호전."),
    p: P(0.3, 1, 1.5),
  },
  avb: {
    n: L("Higher-degree AV block", "고도 방실차단"),
    t: L("P waves march through with some or all failing to conduct; wide escape rhythm if complete.",
      "P파는 규칙적으로 나오나 일부/전부 전도되지 않음; 완전차단이면 넓은 탈출 리듬."),
    p: P(0.05, 0.6, 3),
  },
  lyme: {
    n: L("Lyme carditis / endocarditis (aortic root abscess)", "라임 심장염 / 심내막염 (대동맥근부 농양)"),
    t: L("Rapidly fluctuating PR/AV block with fever, tick exposure or valve infection.",
      "발열, 진드기 노출 또는 판막 감염과 동반된 빠르게 변하는 PR/방실차단."),
    p: P(1.3, 1, 0.6),
  },

  // ── right heart / lung ─────────────────────────────────────────────────
  rvh: {
    n: L("Right ventricular hypertrophy / pressure overload", "우심실 비대 / 압력 부하"),
    t: L("Tall R (R ≥ S) in V1, right axis, deep S in V5–V6, T inversion V1–V3.",
      "V1 높은 R(R ≥ S), 우축편위, V5–V6 깊은 S, V1–V3 T 역위."),
    p: P(1, 1, 1),
  },
  pe: {
    n: L("Acute pulmonary embolism (RV strain)", "급성 폐색전증 (우심실 부하)"),
    t: L("Sinus tachycardia, S1Q3T3, new RBBB or right axis, T inversion V1–V4; dyspnoea, risk factors.",
      "동성빈맥, S1Q3T3, 새로운 RBBB 또는 우축편위, V1–V4 T 역위; 호흡곤란·위험인자."),
    p: P(0.8, 1, 1.2, 1, 1.1),
  },
  copd: {
    n: L("Chronic lung disease / emphysema", "만성 폐질환 / 폐기종"),
    t: L("Right axis or low limb voltage, tall P in II/III/aVF, poor R progression, clockwise rotation.",
      "우축편위 또는 사지 저전압, II/III/aVF 높은 P, R파 진행 불량, 시계방향 회전."),
    p: P(0.05, 1, 2, 1.1),
  },
  pulmhtn: {
    n: L("Pulmonary hypertension", "폐동맥 고혈압"),
    t: L("RAE + RVH + right axis with strain; confirm with echo.", "RAE + RVH + 우축편위 + strain; 심초음파로 확인."),
    p: P(0.6, 1, 1.2, 1, 1.3),
  },
  congenital: {
    n: L("Congenital heart disease (ASD, pulmonic stenosis)", "선천성 심질환 (심방중격결손, 폐동맥판 협착)"),
    t: L("rSR′ in V1 with right axis suggests secundum ASD; left axis suggests primum ASD.",
      "V1 rSR′ + 우축편위는 이차공 ASD, 좌축편위는 일차공 ASD를 시사."),
    p: P(2, 0.8, 0.5, 1, 1.5),
  },
  mitral: {
    n: L("Mitral valve disease", "승모판 질환"),
    t: L("Left atrial enlargement ± AF; murmur and echo clarify.", "좌심방 확대 ± 심방세동; 잡음과 심초음파로 확인."),
    p: P(0.6, 1, 1.4, 1, 1.2),
  },
  aorticvalve: {
    n: L("Aortic valve disease (stenosis / regurgitation)", "대동맥판 질환 (협착 / 역류)"),
    t: L("Tall voltage ± strain; murmur on exam, echo confirms.", "높은 전압 ± strain; 청진상 잡음, 심초음파로 확인."),
    p: P(0.1, 0.8, 2),
  },
  lvdys: {
    n: L("LV systolic or diastolic dysfunction", "좌심실 수축기/이완기 기능부전"),
    t: L("Left atrial abnormality with LVH or poor R progression; BNP and echo.",
      "LVH 또는 R파 진행 불량을 동반한 좌심방 이상; BNP·심초음파."),
    p: P(0.2, 1, 1.6),
  },

  // ── variants & syndromes ───────────────────────────────────────────────
  brugada: {
    n: L("Brugada pattern", "Brugada 양상"),
    t: L("Coved ST elevation ≥2 mm with negative T (type 1) or saddle-back (type 2) in V1–V2; men, fever trigger, syncope history.",
      "V1–V2의 ≥2 mm 코브드형 ST 상승 + 음성 T(1형) 또는 안장형(2형); 남성, 발열 유발, 실신력."),
    p: P(0.8, 1.2, 0.3, 6, 0.3),
  },
  athlete: {
    n: L("Athletic heart (normal variant)", "운동선수 심장 (정상 변이)"),
    t: L("Sinus bradycardia, high voltage, early repolarisation, incomplete RBBB in a trained, asymptomatic person.",
      "훈련된 무증상자의 동서맥, 높은 전압, 조기 재분극, 불완전 RBBB."),
    p: P(3, 0.5, 0.05, 1.5, 0.7),
  },
  juvenile: {
    n: L("Persistent juvenile T-wave pattern", "지속성 소아형 T파 양상"),
    t: L("T inversion V1–V3 only, upright in V5–V6, no ST shift, normal echo; adolescents and young women.",
      "V1–V3에만 T 역위, V5–V6 직립, ST 변화 없음, 정상 심초음파; 청소년·젊은 여성."),
    p: P(3, 0.15, 0.01, 0.7, 1.3),
  },
  normalvar: {
    n: L("Normal variant (body habitus, age, lead placement)", "정상 변이 (체형, 연령, 전극 위치)"),
    t: L("Isolated, stable, asymptomatic, and matches a known variant (e.g. T inversion in III/aVR/V1, young thin chest).",
      "단독·안정적·무증상이며 알려진 변이와 일치 (예: III/aVR/V1 T 역위, 젊고 마른 흉곽)."),
    p: P(1.5, 1, 0.7),
  },
  leadplace: {
    n: L("Precordial lead misplacement", "흉부 전극 위치 오류"),
    t: L("Abnormal R progression that normalises when V1–V3 are moved down an interspace; check the prior ECG.",
      "V1–V3를 한 늑간 내리면 정상화되는 R파 진행 이상; 이전 ECG와 비교."),
    p: flat,
  },
  limbrev: {
    n: L("Limb-lead electrode reversal (LA/RA)", "사지 전극 바뀜 (좌/우 팔)"),
    t: L("Inverted P, QRS and T in lead I with normal precordial progression; aVR and aVL swap.",
      "I 유도의 P·QRS·T 모두 역위 + 정상 흉부 R 진행; aVR과 aVL이 서로 바뀐 모양."),
    p: flat,
  },
  dextro: {
    n: L("Dextrocardia", "우심증"),
    t: L("Inverted lead I with R waves that get smaller, not larger, across V1–V6; confirm with chest X-ray.",
      "I 유도 역위 + V1–V6로 갈수록 R파가 작아짐; 흉부 X선으로 확인."),
    p: P(1, 1, 1),
  },
  nonspecific: {
    n: L("Non-specific T-wave change (age, drugs, anxiety, GI, electrolytes)", "비특이적 T파 변화 (연령, 약물, 불안, 소화기, 전해질)"),
    t: L("Low-amplitude T without ST shift or symptoms; diagnosis of exclusion — compare with an old ECG.",
      "ST 변화·증상 없는 낮은 진폭 T파; 배제 진단 — 이전 ECG와 비교."),
    p: flat,
  },
  cardiacmemory: {
    n: L("Cardiac memory (after pacing, LBBB or tachycardia)", "심장 기억 (조율, LBBB, 빈맥 이후)"),
    t: L("T inversion that points the same way as the earlier abnormal QRS; resolves over days–weeks.",
      "이전 비정상 QRS와 같은 방향의 T 역위; 수일~수주에 걸쳐 소실."),
    p: P(0.5, 1, 1.2),
  },
  tachyrate: {
    n: L("Rate-related J-point depression", "빈맥 관련 J점 하강"),
    t: L("Upsloping ST depression that deepens with heart rate and resolves when rate slows.",
      "맥박에 따라 깊어지는 상향 ST 하강, 맥박이 느려지면 소실."),
    p: flat,
  },

  // ── metabolic / drugs / systemic ───────────────────────────────────────
  hyperk: {
    n: L("Hyperkalaemia", "고칼륨혈증"),
    t: L("Peaked narrow-based T, then flat P, long PR, wide QRS → sine wave; check potassium, renal function, ACE-i/ARB.",
      "뾰족한 T → 납작한 P, PR 연장, QRS 확장 → 사인파; 칼륨·신기능·ACE-i/ARB 확인."),
    p: P(0.5, 1, 1.5),
  },
  hypok: {
    n: L("Hypokalaemia / hypomagnesaemia", "저칼륨혈증 / 저마그네슘혈증"),
    t: L("Flat T, ST depression, prominent U wave (T–U fusion lengthens the 'QT'); diuretics, GI loss.",
      "납작한 T, ST 하강, 두드러진 U파 (T–U 융합으로 QT가 길어 보임); 이뇨제, 소화기 손실."),
    p: P(1, 1, 1.2, 1, 1.2),
  },
  hypoca: {
    n: L("Hypocalcaemia", "저칼슘혈증"),
    t: L("Long ST segment (QT prolonged by the ST, T itself normal).", "ST 분절이 길어져 QT가 연장 (T파 자체는 정상)."),
    p: flat,
  },
  hypercalc: {
    n: L("Hypercalcaemia", "고칼슘혈증"),
    t: L("Short ST segment, QT short; confirm calcium.", "짧은 ST 분절, QT 단축; 칼슘 확인."),
    p: P(0.3, 1, 1.4),
  },
  digoxin: {
    n: L("Digoxin effect / toxicity", "디곡신 효과 / 독성"),
    t: L("Scooped ('reverse tick') ST depression, short QT; arrhythmia and AV block suggest toxicity.",
      "스쿠프형('역 체크표시') ST 하강, QT 단축; 부정맥·방실차단이면 독성 시사."),
    p: P(0.1, 0.6, 2),
  },
  qtdrug: {
    n: L("QT-prolonging drugs (class IA/III, macrolides, antipsychotics, ondansetron)", "QT 연장 약물 (클래스 IA/III, 마크로라이드, 항정신병약, 온단세트론)"),
    t: L("Check the medication list; stop or reduce the offender and correct K/Mg.",
      "복용 약물 확인; 원인 약물 중단·감량, K/Mg 교정."),
    p: P(1, 1, 1.2, 1, 1.3),
  },
  longqt: {
    n: L("Congenital long-QT syndrome", "선천성 QT 연장 증후군"),
    t: L("Persistent long QT in a young patient with syncope, seizures or family history of sudden death.",
      "실신·경련·돌연사 가족력이 있는 젊은 환자의 지속적 QT 연장."),
    p: P(2.5, 0.6, 0.2, 0.8, 1.4),
  },
  nablock: {
    n: L("Sodium-channel blockade (TCA, class I drugs, flecainide)", "나트륨 채널 차단 (삼환계, 클래스 I 약물, 플레카이니드)"),
    t: L("Wide QRS with terminal R in aVR; history of overdose or class I antiarrhythmic.",
      "aVR 종말 R파를 동반한 넓은 QRS; 과량복용·클래스 I 항부정맥제 병력."),
    p: P(1.2, 1, 0.8),
  },
  cns: {
    n: L("CNS event (subarachnoid haemorrhage, stroke)", "중추신경계 사건 (지주막하출혈, 뇌졸중)"),
    t: L("Deep, wide 'cerebral' T inversions with long QT and bradycardia after a neurological event.",
      "신경학적 사건 후 깊고 넓은 '뇌성' T 역위 + QT 연장 + 서맥."),
    p: P(0.8, 1, 1.1),
  },
  hypothyroid: {
    n: L("Hypothyroidism", "갑상선기능저하증"),
    t: L("Bradycardia, low voltage and flat T; check TSH.", "서맥, 저전압, 납작한 T; TSH 확인."),
    p: P(0.5, 1, 1.4, 0.7, 1.8),
  },
  hyperthyroid: {
    n: L("Hyperthyroidism", "갑상선기능항진증"),
    t: L("Sinus tachycardia or AF with normal axis; check TSH.", "정상 축의 동성빈맥 또는 심방세동; TSH 확인."),
    p: P(0.8, 1, 1.2, 0.7, 1.6),
  },
  hypothermia: {
    n: L("Hypothermia (Osborn J waves)", "저체온증 (Osborn J파)"),
    t: L("Bradycardia, long intervals and a hump at the J point; shivering artifact.",
      "서맥, 간격 연장, J점의 혹 모양 파; 떨림 인공물."),
    p: flat,
  },
  effusion: {
    n: L("Pericardial effusion / tamponade", "심낭삼출 / 심장눌림증"),
    t: L("Low voltage with sinus tachycardia and electrical alternans; echo.", "저전압 + 동성빈맥 + 전기적 교대현상; 심초음파."),
    p: flat,
  },
  obesity: {
    n: L("Obesity / oedema / large body habitus", "비만 / 부종 / 큰 체격"),
    t: L("Low voltage with normal intervals; clinical context decides.", "정상 간격의 저전압; 임상 상황으로 판단."),
    p: P(0.7, 1, 1),
  },
  infiltrative: {
    n: L("Infiltrative disease (amyloid)", "침윤성 질환 (아밀로이드)"),
    t: L("Low limb voltage with pseudo-infarct Q waves despite thick walls on echo.",
      "심초음파상 벽이 두꺼운데도 사지 저전압 + 가성 경색 Q파."),
    p: P(0, 0.5, 2.2, 1.3, 0.8),
  },

  // ── rate / rhythm ──────────────────────────────────────────────────────
  af: {
    n: L("Atrial fibrillation", "심방세동"),
    t: L("Irregularly irregular R–R with no organised P waves, fibrillatory baseline.",
      "규칙성 없는 R–R, 조직화된 P파 없음, 세동 기저선."),
    p: P(0.1, 1, 2.5, 1.3, 0.9),
  },
  flutter: {
    n: L("Atrial flutter (variable block)", "심방조동 (가변 전도)"),
    t: L("Sawtooth flutter waves at ~300/min (best in II, III, aVF) with a fixed or variable ratio.",
      "분당 약 300회 톱니 모양 조동파 (II, III, aVF에서 뚜렷), 고정 또는 가변 전도비."),
    p: P(0.1, 1, 2, 1.4, 0.8),
  },
  ectopy: {
    n: L("Atrial / ventricular ectopy", "심방·심실 조기수축"),
    t: L("Premature beats followed by a pause; wide and unpreceded by P if ventricular.",
      "조기 박동 후 휴지기; 심실성이면 P파 없이 넓음."),
    p: flat,
  },
  sinusarr: {
    n: L("Sinus arrhythmia (normal, rate varies with breathing)", "동성 부정맥 (정상, 호흡에 따라 맥박 변동)"),
    t: L("P before every QRS with a normal axis; R–R shortens on inspiration; common in the young.",
      "모든 QRS 앞에 정상 축의 P파; 흡기 시 R–R 단축; 젊은 층에서 흔함."),
    p: P(3, 1, 0.4),
  },
  mat: {
    n: L("Multifocal atrial rhythm (lung disease)", "다소성 심방 리듬 (폐질환)"),
    t: L("≥3 P-wave morphologies with varying PR, usually in severe lung disease.",
      "PR이 변하는 3가지 이상의 P파 모양, 주로 중증 폐질환."),
    p: P(0.1, 1, 1.8),
  },
  svt: {
    n: L("Supraventricular tachycardia (AVNRT / AVRT)", "상심실성 빈맥 (AVNRT / AVRT)"),
    t: L("Regular narrow tachycardia ~150–220/min with abrupt onset and offset.",
      "갑작스러운 시작·종료, 분당 150–220회의 규칙적 narrow 빈맥."),
    p: P(1.5, 1, 0.6, 0.8, 1.2),
  },
  vagal: {
    n: L("High vagal tone (sleep, fitness)", "미주신경 긴장 (수면, 체력)"),
    t: L("Sinus bradycardia or PR prolongation in a well person that normalises with activity.",
      "건강한 사람의 동서맥·PR 연장이 활동 시 정상화."),
    p: P(2.5, 0.8, 0.3, 1.2, 0.9),
  },
  symp: {
    n: L("Physiologic sinus tachycardia (pain, fever, anxiety, volume loss, anaemia, sepsis)", "생리적 동성빈맥 (통증, 발열, 불안, 체액 소실, 빈혈, 패혈증)"),
    t: L("Normal P axis with 1:1 conduction and a rate that follows the trigger.",
      "정상 P축, 1:1 전도, 유발 요인에 따라 변하는 맥박."),
    p: P(1.2, 1, 0.9),
  },
  ectopicatr: {
    n: L("Ectopic atrial / junctional rhythm", "이소성 심방 / 접합부 리듬"),
    t: L("Inverted P in II/III/aVF with short PR, or no visible P; normal in some young people.",
      "II/III/aVF 역위 P + 짧은 PR 또는 P파 안 보임; 일부 젊은 사람에서는 정상."),
    p: P(1.2, 1, 1),
  },
  vrhythm: {
    n: L("Ventricular origin (VT / paced / escape)", "심실 기원 (심실빈맥 / 조율 / 탈출 리듬)"),
    t: L("Extreme axis with wide QRS, AV dissociation or capture/fusion beats.",
      "넓은 QRS + 극단적 축 + 방실 해리 또는 포획/융합 박동."),
    p: P(0.3, 1, 1.4),
  },

  // ── synthesis-only ─────────────────────────────────────────────────────
  normal: {
    n: L("No pattern — normal ECG / normal variant", "특이 양상 없음 — 정상 ECG / 정상 변이"),
    t: L("Every component sits inside its normal range for the leads you measured.",
      "측정한 유도의 모든 요소가 정상 범위 안에 있음."),
    p: flat,
  },
};

// Relative prior for a cause in this patient.
// Demographics tilt the ranking; they must never override how common a cause is
// to begin with, so the combined age × sex multiplier is clamped.
export const PRIOR_MIN = 0.1, PRIOR_MAX = 3.5;
export const prior = (id, demo) => {
  const c = CAUSES[id];
  if (!c) return 1;
  return Math.min(PRIOR_MAX, Math.max(PRIOR_MIN, c.p(demo.age, demo.sex)));
};
