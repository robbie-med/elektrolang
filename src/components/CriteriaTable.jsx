export default function CriteriaTable({ criteria }) {
  return (
    <div style={{ border: "1px solid #163d28", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
      {criteria.map((c, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "3px 1fr 1fr",
          gap: 0, borderTop: i > 0 ? "1px solid #0a2010" : "none",
          background: i % 2 === 0 ? "#071409" : "#060d14",
          alignItems: "stretch",
        }}>
          <div style={{ background: "#00e676", opacity: 0.5 }} />
          <div style={{ padding: "8px 10px" }}>
            <div style={{ color: "#c8f0d8", fontSize: 11.5, fontWeight: 700 }}>{c.find}</div>
            <div style={{ color: "#ffd600", fontSize: 10.5, marginTop: 1 }}>{c.val}</div>
          </div>
          <div style={{ padding: "8px 10px", borderLeft: "1px solid #0a2010", color: "#3a6a4a", fontSize: 10.5, alignSelf: "center" }}>{c.how}</div>
        </div>
      ))}
    </div>
  );
}
