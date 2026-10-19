// Shared palette and small style helpers for the workup mode (matches the trainer's terminal look).
export const C = {
  bg: "#060d14",
  panel: "#071409",
  paper: "#040c09",
  line: "#0d2a1a",
  border: "#163d28",
  accent: "#00e676",
  accentDim: "#00b050",
  text: "#e0f7e9",
  body: "#c8f0d8",
  soft: "#5a8a6a",
  dim: "#3a6a4a",
  faint: "#2a4a35",
  yellow: "#ffd600",
  red: "#ff6b6b",
  blue: "#64b5f6",
  template: "#2f6a48",
  gridSm: "#0a2a18",
  gridLg: "#18402a",
};

export const FONT = "'Courier New', monospace";

export const chip = (color, bg = "transparent") => ({
  color, background: bg, border: `1px solid ${color}`, borderRadius: 4,
  padding: "2px 7px", fontSize: 10, fontWeight: 800, letterSpacing: 1.2, whiteSpace: "nowrap",
});

export const btn = (active = false) => ({
  background: active ? "rgba(0,230,118,0.12)" : "none",
  border: `1px solid ${active ? C.accent : C.border}`,
  borderRadius: 5, color: active ? C.accent : C.soft,
  cursor: "pointer", fontSize: 11.5, fontWeight: 700, padding: "5px 9px",
  fontFamily: FONT, lineHeight: 1.3,
});

export const sectionLabel = {
  color: C.dim, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.8, margin: "0 0 6px",
};

export const STATUS_COLOR = {
  abnormal: C.yellow, borderline: "#ffab40", normal: C.accent, incomplete: C.faint, info: C.blue,
};
