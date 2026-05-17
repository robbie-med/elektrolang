import { EKG_D } from "../data/ekgData.js";

export default function EKGStrip({ hlKey, hl }) {
  return (
    <svg viewBox="0 0 780 140" style={{ width: "100%", display: "block" }}>
      <defs>
        <filter id="ekgglow">
          <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="ekgsg" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#0a2a18" strokeWidth="0.4" />
        </pattern>
        <pattern id="ekglg" width="50" height="50" patternUnits="userSpaceOnUse">
          <rect width="50" height="50" fill="url(#ekgsg)" />
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#143824" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="780" height="140" fill="url(#ekglg)" />
      <rect
        key={hlKey}
        x={hl.x} y={0} width={hl.w} height={140}
        fill="rgba(255,210,0,0.08)" stroke="#ffd600" strokeWidth="1.5"
        style={{ transition: "all 0.35s ease" }}
      />
      <path d={EKG_D} fill="none" stroke="#00e676" strokeWidth="2.2" filter="url(#ekgglow)" />
      <foreignObject
        x={Math.min(Math.max(hl.x + hl.w / 2 - 55, 2), 668)}
        y={5} width={110} height={22}
      >
        <div xmlns="http://www.w3.org/1999/xhtml" style={{
          background: "#ffd600", color: "#000", fontSize: 10, fontWeight: 800,
          padding: "2px 6px", borderRadius: 3, textAlign: "center",
          whiteSpace: "nowrap", letterSpacing: 0.5,
        }}>{hl.label}</div>
      </foreignObject>
    </svg>
  );
}
