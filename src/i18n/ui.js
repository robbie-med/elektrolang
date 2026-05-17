export const UI = {
  en: {
    appName: "EKG READER",
    allSteps: "ALL STEPS",
    interpretation: "INTERPRETATION",
    diagnosticCriteria: "DIAGNOSTIC CRITERIA & THRESHOLDS",
    finalReport: "FINAL REPORT",
    impression: "IMPRESSION",
    systematicFindings: "SYSTEMATIC FINDINGS",
    readAnother: "↺ READ ANOTHER EKG",
    stepOf: (n, total) => `Step ${n} / ${total}`,
  },
  ko: {
    appName: "EKG 판독기",
    allSteps: "전체 단계",
    interpretation: "판독",
    diagnosticCriteria: "진단 기준 및 임계값",
    finalReport: "최종 보고서",
    impression: "판독 소견",
    systematicFindings: "단계별 소견",
    readAnother: "↺ 새 EKG 판독",
    stepOf: (n, total) => `${n} / ${total} 단계`,
  },
};
