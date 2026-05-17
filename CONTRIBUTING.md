# Contributing to EKG Reader

Thanks for your interest! Contributions are welcome — whether that's a bug fix, a new clinical step, improved interpretation text, or a UI improvement.

## Development setup

```bash
git clone https://github.com/robbie-med/elektrolang.git
cd elektrolang
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` with hot module replacement.

## What to work on

- **Clinical content** — the most impactful contributions are improvements to `src/data/steps.js`: better criteria, more nuanced interpretation text, additional differentials, or corrected values
- **New steps** — adding a 10th step (e.g. pacemaker analysis, delta waves) follows the same data shape as existing steps; see the [step schema](#step-schema) below
- **Bugs** — open an issue first if it's non-trivial

## Step schema

Each entry in `STEPS` (`src/data/steps.js`) follows this shape:

```js
{
  id: "string",          // unique, used as answer key
  title: "string",       // short display name
  hl: "string",          // key into HL object in ekgData.js (highlight region)
  lead: "string",        // which lead(s) to look at
  lookAt: "string",      // one-line focus instruction
  prompt: "string",      // paragraph explaining what to measure
  clue: "string",        // mnemonic or quick-reference tip
  criteria: [            // reference table rows
    { find: "string", val: "string", how: "string" }
  ],
  question: "string",    // the multiple-choice question
  options: [
    {
      label: "string",   // option text
      sub: "string",     // sub-label (measurement detail)
      ok: boolean,       // true = normal finding
      interp: "string",  // interpretation text shown after selection
    }
  ]
}
```

If a new step needs a new highlight region on the EKG strip, add an entry to the `HL` object in `src/data/ekgData.js`:

```js
hl: { x: number, w: number, label: "string" }
```

`x` and `w` are pixel coordinates within the `0 0 780 140` SVG viewBox.

## Submitting changes

1. Fork the repo and create a feature branch
2. Make your changes
3. Run `npm run build` to confirm the build passes
4. Open a pull request with a brief description of what changed and why

## Clinical accuracy

This tool is for **educational purposes only** and is not a medical device. That said, accuracy matters — please cite sources (guidelines, textbooks, or peer-reviewed references) in your PR description when changing clinical content.
