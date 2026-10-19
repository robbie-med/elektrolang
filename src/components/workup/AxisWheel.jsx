import { C } from "./theme.js";

const R = 80;
const P = (deg, r = R) => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];
const arc = (a0, a1, r) => {
  const [x0, y0] = P(a0, r), [x1, y1] = P(a1, r);
  return `M0,0 L${x0},${y0} A${r},${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1},${y1} Z`;
};
const LEADS = [["I", 0], ["II", 60], ["III", 120], ["aVF", 90], ["aVL", -30], ["aVR", -150]];

export default function AxisWheel({ viz, caption }) {
  const [ax, ay] = P(viz.deg, R - 6);
  return (
    <figure style={{ margin: "8px 0 10px", textAlign: "center" }}>
      <svg viewBox="-112 -112 224 246" style={{ width: "100%", maxWidth: 260 }}>
        <circle r={R} fill="none" stroke={C.border} />
        <path d={arc(-30, 90, R)} fill={C.accent} fillOpacity="0.06" />
        <path d={arc(-90, -45, R)} fill={C.yellow} fillOpacity="0.14" />
        {LEADS.map(([n, d]) => {
          const [x1, y1] = P(d), [x2, y2] = P(d + 180);
          const [lx, ly] = P(d, R + 16);
          return (
            <g key={n}>
              <line x1={x2} y1={y2} x2={x1} y2={y1} stroke={C.line} strokeWidth="1" />
              <text x={lx} y={ly + 4} fontSize="11" textAnchor="middle" fill={C.soft} style={{ fontFamily: "monospace", fontWeight: 700 }}>{n}</text>
            </g>
          );
        })}
        {viz.pairs.map((d, i) => {
          const [x1, y1] = P(d, R - 4), [x2, y2] = P(d, R + 4);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.yellow} strokeWidth="2" />;
        })}
        <line x1="0" y1="0" x2={ax} y2={ay} stroke={C.accent} strokeWidth="3" strokeLinecap="round" />
        <circle cx={ax} cy={ay} r="4" fill={C.accent} />
        <text x="0" y="128" fontSize="13" textAnchor="middle" fill={C.accent} style={{ fontFamily: "monospace", fontWeight: 800 }}>
          {(Math.round(viz.deg) > 0 ? "+" : "") + Math.round(viz.deg).toString().replace("-", "−")}°
        </text>
      </svg>
      <figcaption style={{ color: C.dim, fontSize: 10.5, lineHeight: 1.4 }}>{caption}</figcaption>
    </figure>
  );
}
