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
- **Offline-capable PWA** — installable on iOS, Android, and desktop; works without a network connection after first load
- **Dark terminal UI** — optimized for low-light clinical environments

---

## Tech stack

| Layer | Technology |
|---|---|
| UI | React 18 |
| Build | Vite 5 |
| PWA | vite-plugin-pwa + Workbox |
| Deployment | GitHub Pages |

No backend. No database. No tracking.

---

## Getting started

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

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
