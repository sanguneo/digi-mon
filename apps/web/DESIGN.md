# digi-mon web client design

## Product promise

The client turns the deterministic digi-mon engine into one connected loop:

1. choose a subject, grade band, optional domain, item count, and difficulty;
2. render the exact worksheet returned by the engine, including canonical SVG figures;
3. collect an anonymous diagnostic attempt;
4. show honest exercise signals, not a permanent learner label;
5. execute the engine's next-action recommendation as a follow-up worksheet.

The app does not generate, grade, estimate mastery, or reconstruct figures by itself.
All educational decisions come through the existing HTTP contracts.

## Visual direction

The interface follows the repository's ink-and-paper design language without becoming
a generic school dashboard.

- Warm paper is the only application background.
- White cards behave like physical sheets, with black rules and one subject accent.
- Georgia supplies the editorial display voice; the Korean system stack remains the
  reading face.
- Subject color is always accompanied by the written subject and a one-character mark.
- Metrics appear only when they support the current learning decision.
- The responsive surface collapses to one column rather than compressing controls.

The CSS preserves the established `dm-` component naming, 48px control baseline,
56px primary actions, visible focus, reduced motion, and A4 page rules.

## Application boundary

```text
browser
  -> /learner/api/* or /teacher/api/*
  -> local web host
  -> digi-mon HTTP server
  -> existing engine
```

Browser code imports no file from root `src/`. It consumes JSON only.

The host has one security responsibility:

- teacher requests receive the server-held bearer token;
- learner query strings and JSON bodies lose `includeAnswers`, `includeFeedback`, and
  `manualEvaluations`;
- learner requests never receive the teacher bearer token.

Development uses Vite's same-origin proxy with an isolated test token. Production uses
`server/index.ts` with the configured engine origin and environment-held credential.

## Figures

The engine emits canonical inline SVG after generating the worksheet. The client parses
that trusted local SVG into DOM and preserves its `role="img"` and `aria-label`.
It does not interpret `figure.spec`.

When a figure exists without SVG, the client renders the engine's alternative text and
the explicit state `그림 없음 · 종이 학습지로`. A visually dependent item also displays
its accommodation instead of silently treating it as accessible.

## Diagnostic semantics

The client submits the complete session once to `/v1/grade`.

- Accuracy and completion remain separate.
- Manual construction items remain outside automatic accuracy.
- Every standard row includes `correct / attempted`.
- Fewer than three attempts are labelled `표본 부족`.
- Result copy calls the output an exercise signal, not a diagnosis or learner profile.

The complete grading aggregate is sent to `/v1/learning-gate`. The reason-coded response
is rendered directly. A worksheet action requests those codes; a mathematics remediation
action calls the approved-prerequisite endpoint.

## Accessibility and responsive contract

- All selection controls use native radio, input, select, and button semantics.
- Focus uses a 3px subject-accent outline with offset.
- English stems carry `lang="en"` while surrounding guidance remains Korean.
- Primary actions are at least 56px high.
- At 900px the worksheet and control grids collapse to one column.
- At 640px navigation, result rows, and document headers stack.
- `prefers-reduced-motion: reduce` resolves all motion tokens to `0ms`.
- Print removes interactive controls and keeps each item and figure together.

## Commands

```bash
npm run web:dev
npm run web:test
npm run web:build
npm run test:e2e -w @digi-mon/web
```

The browser development proxy expects the engine at `http://127.0.0.1:8787`.

## Known boundary

The client holds no account, roster, long-term learner history, IRT estimate, or trend
dashboard. A page refresh clears session results. Durable personalization requires a
separately approved privacy and persistence design.
