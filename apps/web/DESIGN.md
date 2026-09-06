# digi-mon web client design

## Drawing and reading refinements

Manual math construction uses a local SVG drawing surface in interactive mode, with
an explicit draw/scroll toggle, undo, clear and a keyboard-accessible paper confirmation.
Ruler tasks explicitly recommend paper; no drawing is automatically graded or uploaded.
Print retains the drawing or a blank drawing area. Controls retain 48px targets.
Korean words stay together with emergency wrapping for overlong tokens.
Language print cards reduce metadata and choice padding, not reading font size.

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

## Subject-specific practice

The default is an easy 12-question mathematics sheet for grades 1-2. The engine still
owns content, balancing, order, numbering, and fingerprint; visual groups never alter
the issued worksheet or grading request. Every question stays mounted and printable.

| Subject / grade | Quick presets | Screen groups and response space |
|---|---|---|
| Mathematics 1-2 | 12 mixed (easy), 30 or 50 number/operations (easy), 12 mixed application (basic) | Four items; calculation/drawing grid |
| Mathematics 3-4 | 12 mixed (basic), 30 or 50 number/operations (easy), 12 mixed application (challenge) | Four items; grade-filtered multiplication/division and number practice |
| Mathematics 5-6 | 12 mixed (basic), 30 or 50 number/operations (easy), 12 mixed application (challenge) | Four items; grade-filtered fraction/decimal and number practice |
| Korean 1-2 / 3-4 / 5-6 | 6 or 10; easy in lower/middle bands, basic in upper band | Two items; full-width reading and multiline writing |
| English 3-4 / 5-6 | 6 or 9; easy in middle band, basic in upper band | Three items; short full-width reading and word/sentence space |

Counts remain freely editable from 1 through 100. Presets configure rather than
silently generate a sheet. The number/operations domain can include number concepts,
not just symbolic calculations. Application presets use the engine's higher difficulty,
not a client-authored curriculum. English starts at the supported 3-4 band; the client
explains the grade-three curriculum floor and does not offer unsupported grade 1-2 English.

Subject identity follows the delivered worksheet even while the builder changes. Written
subject marks accompany the existing green/red/blue accents. Every engine choice appears
in worksheet and diagnostic modes. Korean free responses use textareas; answer collection
preserves line breaks and excludes whitespace-only responses. No numeric keyboard is
forced on answers that may contain fractions, units, words, or construction descriptions.

Chunk links are 48px touch targets and move focus without unmounting responses. Inputs
are at least 18px to avoid mobile browser zoom. Nothing fixes an answer bar over the
software keyboard. Print includes all chunks and choices, replaces editable fields with
subject-shaped writing space, and includes adaptive sheets without result-dashboard chrome.
Figure-free symbolic arithmetic gets a compact two-column print layout and a short answer
line. Number reading, sequence instructions, word problems, geometry, and language items
retain their roomy layout; mixed groups give those items the full row. The real-engine
50-calculation A4 fixture prints in six pages in both clients, preserving all item numbers.

## Learning help

Each item can render the server-provided `learningSupport` through `LearningHelp` after
the stem and canonical figure. Native details initially conceal the objective/principle;
a child can reveal the two supplied hints one at a time. The client neither invents hints
nor requests teacher answers. Help is hidden in print to preserve worksheet writing room.
Support remains candidate-authored guidance, not a mastery judgment.

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
- English text carries `lang="en"`; Hangul prompts and translation choices carry `lang="ko"`, even in English worksheets.
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
