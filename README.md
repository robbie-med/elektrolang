# EKG Reader

A systematic, step-by-step 12-lead ECG interpretation trainer — installable as a Progressive Web App.

**Live demo → [elektrolang.robbiemed.org](https://elektrolang.robbiemed.org)**

---

## Features

- **9-step workflow** covering every component of a systematic ECG read: heart rate, rhythm, P waves, PR interval, QRS complex, ST segment, T waves, QTc, and electrical axis
- **Step navigation menu** — jump to any step at any time to review or re-answer; previous answers are preserved and shown in the menu
- **Diagnostic criteria panel** — expandable reference table with normal ranges and measurement techniques for each step
- **Clinical interpretation** — each answer triggers a detailed interpretation note with differentials and next steps
- **Final report** — auto-generated impression with color-coded systematic findings
- **Scan an EKG (image or PDF)** — upload a photo, screenshot or PDF of a standard 12-lead; the trace is read **on the device** (nothing is uploaded), measured, and fed into the same workup engine as the drawn/entered cases. See [Scanning](#scanning-an-ekg) below.
- **PATTERNS tab** — every lead, every component (P, Q, R, S, QRS shape, ST, T) is checked against a catalog of common abnormalities; each abnormality lists its top 3–5 causes, re-ranked by the patient's age and sex. The last card, **FINAL**, walks through the read in the order you should always read an ECG (rate → rhythm → axis → intervals → P → QRS → ST → T) with a running differential, then names the **top 3 causes that tie all the findings together**.
- **Offline-capable PWA** — installable on iOS, Android, and desktop; works without a network connection after first load
- **Dark terminal UI** — optimized for low-light clinical environments

---

## Scanning an EKG

1. **SCAN** tab → choose an image or PDF (multi-page PDFs get a page picker).
2. Drag the two **green** corners onto the 12-lead block (4 columns × 3 rows, excluding any rhythm strip) and the two **yellow** points onto grid lines a known distance apart, then type that distance. Paper speed and gain are selectable.
3. **Read this EKG** — the red line drawn over the image is the trace the reader followed; check it against the original.
4. **Use these measurements** → the MEASURE / WORKUP / PATTERNS / REPORT tabs now run on the scan. Anything the reader got wrong can be corrected on MEASURE.

Limits to know about: it expects an upright, flat scan with a dark trace on a lighter (grid) background; a deep complex that overlaps the lead below it can be misread; fragmented-QRS and P-wave measurements are the least reliable. On synthetic scans it recovers amplitudes within ~1 mm and intervals within ~15 ms; **it has not been validated on a library of real scans**, so treat its output as a first draft to confirm.

## How the PATTERNS ranking works

- `src/engine/patterns/catalog.js` lists every finding type, its reading step, and its candidate causes with a base weight (1–10) — territory-specific where it matters (e.g. ST elevation inferior vs anterior vs aVR vs diffuse).
- `src/engine/patterns/causes.js` holds each cause's name, a one-line "how to tell it apart", and an age/sex prior (young <35, middle 35–64, older ≥65; clamped to 0.1–3.5× so demographics tilt the order but never override how common a cause is).
- Each finding hands out one unit of "vote" across its causes in proportion to weight × prior; the FINAL ranking sums votes across **all** findings, so a cause that explains several findings beats the single commonest explanation of one. Reciprocal changes, secondary changes from bundle-branch block, and conduction patterns that aren't actually on the tracing are handled explicitly.
- The weights are **teaching heuristics, not epidemiology or calibrated probabilities**, and demographics are a weak signal next to symptoms, history and old ECGs. They are meant to be audited — edit the numbers in `catalog.js` / `causes.js` and run `npm test`.

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 18 |
| Build | Vite 5 |
| PWA | vite-plugin-pwa + Workbox |
| PDF input | pdf.js (lazy-loaded; worker cached on first use) |
| Deployment | GitHub Pages |

No backend. No database. No tracking. Scans are processed in the browser and never leave the device.

---

## Getting started

```bash
# Install dependencies
npm install

# Start dev server (http://127.0.0.1:3944)
npm run dev

# Engine tests (workup, scan round-trips, patterns)
npm test

# Production build → dist/
npm run build

# Preview production build locally
npm run preview
```

> **Node requirement:** 18+ (the build uses a `serialize-javascript` override to fix a crypto compatibility issue in Node 18 worker threads; Node 20+ works without the override)

---

## Project structure

```
src/
  App.jsx               # State management and step flow
  main.jsx              # Entry point + PWA service worker registration
  components/
    StepView.jsx        # Per-step UI (EKG strip, question, options, toast)
    EKGStrip.jsx        # SVG EKG waveform with animated highlight region
    CriteriaTable.jsx   # Expandable diagnostic criteria panel
    StepMenu.jsx        # Collapsible side navigation drawer
    ReportScreen.jsx    # Final report with impression + findings
  data/
    steps.js            # All 9 step definitions (prompts, options, criteria)
    ekgData.js          # SVG waveform path + highlight region coordinates
  engine/
    workup.js           # Reasoning engine (rate → axis → conduction → … → QT)
    scan/               # Image → traces → measurements (image.js, measure.js; synth.js = test renderer)
    patterns/           # Abnormality catalog, causes + priors, detectors, synthesis
  components/workup/    # SCAN (ScanPanel), PATTERNS (PatternView), DRAW, MEASURE, WORKUP, REPORT
  i18n/                 # EN / KO wording (patterns.js covers SCAN + PATTERNS)
public/
  icons/                # PWA icons (192 × 192, 512 × 512, maskable, Apple touch)
scripts/
  gen-icons.mjs         # Icon generation helper
```

---

## Deployment

The repo uses a two-track deployment:

1. **Committed build output** — `index.html`, `assets/`, `sw.js`, and related files are committed to the root of `main`, which GitHub Pages serves directly.
2. **CI workflow** (`.github/workflows/deploy.yml`) — on every push that touches source files, the workflow rebuilds and commits updated assets automatically.

To deploy a change manually:

```bash
npm run build
cp -r dist/. .
git add index.html assets/ sw.js workbox-*.js manifest.webmanifest registerSW.js
git commit -m "build: update deployment assets"
git push
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE) © robbie-med
