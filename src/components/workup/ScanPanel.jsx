import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeScan } from "../../engine/scan/measure.js";
import { LAYOUT } from "../../engine/leads.js";
import { PUI } from "../../i18n/patterns.js";
import { C, FONT, btn, chip, sectionLabel } from "./theme.js";

const MAX_SIDE = 3200;

const inputStyle = (w = 64) => ({ width: w, background: "#030a07", border: `1px solid ${C.border}`, borderRadius: 4, color: C.body, fontFamily: FONT, fontSize: 12.5, padding: "5px 6px" });

// Draw a File (image) into the canvas, downscaling very large photos.
async function drawImage(file, canvas) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * k); canvas.height = Math.round(img.naturalHeight * k);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally { URL.revokeObjectURL(url); }
}

// pdf.js is large: load it only when someone actually opens a PDF.
async function loadPdf(file) {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}
async function drawPdfPage(doc, n, canvas) {
  const page = await doc.getPage(n);
  const v1 = page.getViewport({ scale: 1 });
  const scale = Math.min(2600 / v1.width, MAX_SIDE / v1.height);
  const vp = page.getViewport({ scale });
  canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
}

export default function ScanPanel({ ecg, update, lang, onApply }) {
  const P = PUI[lang].scan;
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const pdfRef = useRef(null);
  const drag = useRef(null);
  const [size, setSize] = useState(null);        // { w, h } of the loaded raster
  const [name, setName] = useState("");
  const [pages, setPages] = useState({ n: 1, total: 1 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pts, setPts] = useState(null);          // { a, b, c1, c2 } in image px
  const [calMm, setCalMm] = useState(25);
  const [speed, setSpeed] = useState(25);
  const [gain, setGain] = useState(10);
  const [autoThr, setAutoThr] = useState(true);
  const [thr, setThr] = useState(110);
  const [zoom, setZoom] = useState(1);
  const [result, setResult] = useState(null);

  const placeDefaults = (w, h) => setPts({
    a: { x: w * 0.06, y: h * 0.1 }, b: { x: w * 0.94, y: h * 0.72 },
    c1: { x: w * 0.1, y: h * 0.9 }, c2: { x: w * 0.1 + w * 0.25, y: h * 0.9 },
  });

  const loaded = (canvas) => { setSize({ w: canvas.width, h: canvas.height }); placeDefaults(canvas.width, canvas.height); setResult(null); };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(""); setBusy(true); setResult(null); pdfRef.current = null;
    try {
      const canvas = canvasRef.current;
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        let doc;
        try { doc = await loadPdf(f); } catch { throw new Error(P.pdfFail); }
        pdfRef.current = doc;
        setPages({ n: 1, total: doc.numPages });
        await drawPdfPage(doc, 1, canvas);
      } else if (/^image\//.test(f.type)) {
        try { await drawImage(f, canvas); } catch { throw new Error(P.imgFail); }
        setPages({ n: 1, total: 1 });
      } else throw new Error(P.unsupported);
      setName(f.name);
      loaded(canvas);
    } catch (ex) { setErr(ex.message || String(ex)); }
    setBusy(false);
  };

  const gotoPage = async (n) => {
    if (!pdfRef.current || n < 1 || n > pages.total) return;
    setBusy(true);
    try { await drawPdfPage(pdfRef.current, n, canvasRef.current); setPages(p => ({ ...p, n })); loaded(canvasRef.current); }
    catch { setErr(P.pdfFail); }
    setBusy(false);
  };

  // ── draggable handles ───────────────────────────────────────────────────
  const toImg = useCallback((ev) => {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: Math.min(size.w, Math.max(0, ((ev.clientX - r.left) / r.width) * size.w)),
      y: Math.min(size.h, Math.max(0, ((ev.clientY - r.top) / r.height) * size.h)),
    };
  }, [size]);
  const down = (k) => (ev) => { drag.current = k; ev.currentTarget.setPointerCapture(ev.pointerId); ev.preventDefault(); };
  const move = (ev) => { if (drag.current) setPts(p => ({ ...p, [drag.current]: toImg(ev) })); };
  const up = () => { drag.current = null; };

  const pxPerMm = pts ? Math.hypot(pts.c2.x - pts.c1.x, pts.c2.y - pts.c1.y) / (calMm || 1) : 0;
  const block = pts ? { x0: Math.min(pts.a.x, pts.b.x), y0: Math.min(pts.a.y, pts.b.y), x1: Math.max(pts.a.x, pts.b.x), y1: Math.max(pts.a.y, pts.b.y) } : null;
  const ready = size && pts && pxPerMm > 1 && block.x1 - block.x0 > 50 && block.y1 - block.y0 > 50;

  const extract = () => {
    setBusy(true); setResult(null);
    setTimeout(() => {
      try {
        const c = canvasRef.current;
        const img = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
        setResult(analyzeScan(img, { block, pxPerMm, speed, gain, threshold: autoThr ? undefined : thr }));
      } catch (ex) { setErr(String(ex.message || ex)); }
      setBusy(false);
    }, 30);
  };

  useEffect(() => { setResult(null); }, [pts, calMm, speed, gain, autoThr, thr]);

  const R = size ? size.w * 0.011 : 10;
  const cw = block ? (block.x1 - block.x0) / 4 : 0, ch = block ? (block.y1 - block.y0) / 3 : 0;
  const leadsRead = result ? Object.keys(result.leads).length : 0;
  const sum = result ? P.summary({ hr: result.meta.hr, pr: result.iv.pr, qrs: result.iv.qrs, qt: result.iv.qt }) : "";

  const Handle = ({ k, color, label }) => pts && (
    <g onPointerDown={down(k)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ cursor: "grab", touchAction: "none" }}>
      <circle cx={pts[k].x} cy={pts[k].y} r={R * 2.2} fill="transparent" />
      <circle cx={pts[k].x} cy={pts[k].y} r={R} fill={color} fillOpacity="0.35" stroke={color} strokeWidth={R * 0.25} />
      <circle cx={pts[k].x} cy={pts[k].y} r={R * 0.18} fill={color} />
      {label && <text x={pts[k].x + R * 1.3} y={pts[k].y - R * 1.1} fill={color} fontSize={R * 1.6} fontWeight="800" fontFamily={FONT}>{label}</text>}
    </g>
  );

  return (
    <div style={{ padding: "12px 14px 60px" }}>
      <div style={sectionLabel}>{P.title}</div>
      <p style={{ color: C.soft, fontSize: 12, lineHeight: 1.55, margin: "0 0 10px" }}>{P.hint}</p>

      <label style={{ ...btn(true), display: "inline-block", cursor: "pointer", padding: "9px 14px" }}>
        {size ? P.another : P.choose}
        <input type="file" accept="image/*,application/pdf,.pdf" onChange={onFile} style={{ display: "none" }} data-testid="scan-file" />
      </label>
      {name && <span style={{ color: C.dim, fontSize: 11, marginLeft: 10 }}>{name}</span>}
      {busy && <span style={{ color: C.yellow, fontSize: 11.5, marginLeft: 10 }}>{P.loading}</span>}
      {err && <p style={{ color: C.red, fontSize: 12.5 }}>{err}</p>}

      {pages.total > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0 0" }}>
          <button style={btn()} onClick={() => gotoPage(pages.n - 1)}>‹</button>
          <span style={{ color: C.body, fontSize: 12 }}>{P.page(pages.n, pages.total)}</span>
          <button style={btn()} onClick={() => gotoPage(pages.n + 1)}>›</button>
        </div>
      )}

      {size && (
        <>
          <p style={{ color: C.accent, fontSize: 12, lineHeight: 1.5, margin: "14px 0 2px" }}>{P.step1}</p>
          <p style={{ color: C.yellow, fontSize: 12, lineHeight: 1.5, margin: "0 0 8px" }}>{P.step2}</p>
          <div style={{ display: "flex", gap: 6, margin: "0 0 6px" }}>
            {[1, 2, 3].map(z => <button key={z} style={btn(zoom === z)} onClick={() => setZoom(z)}>{z}×</button>)}
          </div>
        </>
      )}

          <div style={{ overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 6, background: "#fff", maxHeight: "70vh", display: size ? "block" : "none", marginTop: 8 }}>
            <div style={{ width: `${zoom * 100}%`, position: "relative", lineHeight: 0 }}>
              <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
              {size && (
              <svg ref={svgRef} viewBox={`0 0 ${size.w} ${size.h}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" }}>
                {block && (
                  <g stroke="#00c853" strokeWidth={R * 0.12} fill="none" opacity="0.85">
                    <rect x={block.x0} y={block.y0} width={block.x1 - block.x0} height={block.y1 - block.y0} />
                    {[1, 2, 3].map(i => <line key={"v" + i} x1={block.x0 + i * cw} y1={block.y0} x2={block.x0 + i * cw} y2={block.y1} strokeDasharray={`${R * 0.5} ${R * 0.5}`} />)}
                    {[1, 2].map(i => <line key={"h" + i} x1={block.x0} y1={block.y0 + i * ch} x2={block.x1} y2={block.y0 + i * ch} strokeDasharray={`${R * 0.5} ${R * 0.5}`} />)}
                  </g>
                )}
                {block && LAYOUT.map((row, r) => row.map((n, c) => (
                  <text key={n} x={block.x0 + c * cw + R * 0.4} y={block.y0 + r * ch + R * 1.5} fill="#00a844" fontSize={R * 1.5} fontWeight="800" fontFamily={FONT}>{n}</text>
                )))}
                {pts && <line x1={pts.c1.x} y1={pts.c1.y} x2={pts.c2.x} y2={pts.c2.y} stroke="#ffb300" strokeWidth={R * 0.15} />}
                {result && Object.values(result.overlay).map((o, i) => (
                  <polyline key={i} points={o.map(p => p.join(",")).join(" ")} fill="none" stroke="#ff1744" strokeWidth={R * 0.2} strokeLinejoin="round" />
                ))}
                <Handle k="a" color="#00c853" />
                <Handle k="b" color="#00c853" />
                <Handle k="c1" color="#ffb300" />
                <Handle k="c2" color="#ffb300" />
              </svg>
              )}
            </div>
          </div>



      {size && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "12px 0 6px" }}>
            <label style={{ color: C.soft, fontSize: 12 }}>{P.calDist}{" "}
              <input type="number" step="any" min="1" value={calMm} onChange={e => setCalMm(Number(e.target.value))} style={inputStyle(58)} data-testid="cal-mm" /> {P.mm}
            </label>
            {P.calPresets.map(([mm, lab]) => <button key={mm} style={{ ...btn(calMm === mm), fontSize: 10.5 }} onClick={() => setCalMm(mm)}>{lab}</button>)}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", margin: "0 0 8px" }}>
            <label style={{ color: C.soft, fontSize: 12 }}>{P.speed}{" "}
              <select value={speed} onChange={e => setSpeed(Number(e.target.value))} style={inputStyle(84)}><option value={25}>25 mm/s</option><option value={50}>50 mm/s</option></select>
            </label>
            <label style={{ color: C.soft, fontSize: 12 }}>{P.gain}{" "}
              <select value={gain} onChange={e => setGain(Number(e.target.value))} style={inputStyle(96)}><option value={10}>10 mm/mV</option><option value={20}>20 mm/mV</option><option value={5}>5 mm/mV</option></select>
            </label>
            <label style={{ color: C.soft, fontSize: 12 }}>{P.sens}{" "}
              <input type="checkbox" checked={autoThr} onChange={e => setAutoThr(e.target.checked)} style={{ accentColor: C.accent }} /> {P.auto}{" "}
              {!autoThr && <input type="range" min="50" max="200" value={thr} onChange={e => setThr(Number(e.target.value))} />}
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "0 0 12px" }}>
            <span style={{ ...sectionLabel, margin: 0 }}>{P.patient}</span>
            <label style={{ color: C.soft, fontSize: 12 }}>{P.age}{" "}
              <input type="number" inputMode="numeric" value={ecg.meta.age ?? ""} style={inputStyle(52)} onChange={e => update(c => { c.meta.age = e.target.value === "" ? null : Number(e.target.value); })} />
            </label>
            <label style={{ color: C.soft, fontSize: 12 }}>{P.sex}{" "}
              <select value={ecg.meta.sex || ""} style={inputStyle(70)} onChange={e => update(c => { c.meta.sex = e.target.value; })}>
                {Object.entries(P.sexOpts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>

          <button style={{ ...btn(true), width: "100%", padding: 12, opacity: ready && !busy ? 1 : 0.5 }} disabled={!ready || busy} onClick={extract} data-testid="scan-extract">
            {busy ? P.busy : P.extract}
          </button>

          {result && (
            <div style={{ marginTop: 16, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }} data-testid="scan-result">
              <div style={sectionLabel}>{P.resultTitle}</div>
              <div style={{ color: C.text, fontSize: 13, marginBottom: 6 }}>{P.leadsRead(leadsRead)}{sum ? ` · ${sum}` : ""}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                {Object.entries(result.quality).map(([n, q]) => (
                  <span key={n} style={chip(q.beats > 0 ? C.accent : C.red)}>{n}{q.beats > 0 ? ` ·${q.beats}` : " ✗"}</span>
                ))}
              </div>
              <p style={{ color: C.soft, fontSize: 11.5, lineHeight: 1.5, margin: "0 0 8px" }}>{P.overlayHint}</p>
              {result.notes.map((n, i) => <div key={i} style={{ color: C.yellow, fontSize: 12, lineHeight: 1.5, marginBottom: 3 }}>⚠ {P.note(n)}</div>)}
              <p style={{ color: C.faint, fontSize: 10.5, lineHeight: 1.5 }}>{P.caveat}</p>
              <button style={{ ...btn(true), width: "100%", padding: 11, opacity: leadsRead ? 1 : 0.5 }} disabled={!leadsRead} onClick={() => onApply(result)} data-testid="scan-apply">{P.apply}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
