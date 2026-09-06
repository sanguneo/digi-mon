# digi-mon garden client

## Drawing and reading refinements

Manual math construction uses a local SVG drawing surface, with an explicit draw/scroll
toggle, undo, clear and keyboard-accessible paper confirmation. Ruler tasks recommend
paper; no drawing is automatically graded or uploaded. Only a participation marker is
collected, while the local strokes survive mounted room visits and remain visible in print.
Korean words stay together with emergency wrapping for overlong tokens.
Language print cards reduce metadata and choice padding, not reading font size.

## Why this is a fork

`apps/web-garden` is a sibling of `apps/web`, not a theme switch inside it.
The original teacher/learner client remains a stable, assessment-first surface.
This fork keeps its HTTP behavior but adds a child-facing participation reward loop.

The fork does not import source from `apps/web` or root `src/`. Shared behavior is copied
at the fork point so each application can evolve without hidden runtime coupling.

## Learner help contract

`LearningHelp` is a reusable native `details` disclosure, collapsed by default. It
shows the principle and objective from learner `learningSupport`, followed by two
hints revealed sequentially. Revealing help never awards participation or decoration
rewards. Only the learner-safe support payload is consumed: no teacher metadata,
answer keys or evaluations. Use existing `dm` text, spacing and focus tokens, and hide
the disclosure in print. The lead owns `learning-help*` and the corresponding `api.ts`
types in both web apps.

## Three-dimensional nurturing worlds (2026-09)

The garden component seam now hosts three real Three.js mesh dioramas, not an
emoji/CSS projection. The existing `dm-btn`, typography, garden room and collection
components remain the surrounding design system. The diorama is the expressive
center; controls stay quiet, explicit and outside the canvas.

- Korean: a rounded, leafy tree and growing plants on a moss-green island.
- English: a glass-edged aquarium with sand, aquatic plants and friendly swimming fish.
- Math: a floppy-eared puppy in a soft grassy play yard.
- Palette: leaf `#78a85b`, deep leaf `#315344`, water `#9edce4`, sand `#f3d9a4`,
  puppy caramel `#bd8053`, coral `#ed997e`. Keep the existing rounded Korean sans type.
- Mobile first: compact title and subject controls, canvas, immediately reachable care
  buttons, collapsed camera disclosure, growth goal and collection in one column.
  Desktop adds a growth panel beside the canvas; the component system stays shared.
- Lighting, real geometry, perspective camera, shadows and OrbitControls make each
  scene genuinely three-dimensional. Models are local procedural meshes: no remote
  assets, trackers or external model licenses.

### Participation and care

Each subject has its own answered keys, three-answer quota, catalog, placements,
care counters and growth. Answer submission must call
`answerItem(worksheetId, itemId, subject)` with the actual delivered item subject,
not the visible tab. Correctness never enters this API. Every three distinct answered
items unlock one decoration; replaying an item cannot farm progress. Care is always
available and never consumes rewards: water/sunlight, feed/bubbles, feed/brush. Puppy
ball play unlocks at the first growth milestone. Each action adds a persisted care
count and a visible response. Growth requires BOTH learning and care, never unlimited
care clicking alone. `GROWTH_MILESTONES` is the sole threshold source:

| Reached stage | Distinct subject answers | Care actions |
| --- | --- | --- |
| 1 | 3 | 1 |
| 2 | 12 | 3 |
| 3 | 36 | 6 |

Only six care actions contribute to the finite growth goal; additional care remains
available and counted without replacing learning. Reached stage IDs are persisted as
`growthMilestones`; parser recomputes them from learning/care counts so earlier draft
threshold records cannot discard the collection. Each stage changes substantial mesh
geometry: sprout to leafy tree to blossom/fruit; baby fish to larger patterned fish,
a companion fish and more aquatic plants; baby puppy to larger collar/bandana puppy
with ball play and a flower hoop. A polite celebration and growth history make the
changes explicit. The next goal shows remaining answers/care and one primary action.
`onLearn(subject)` requests that world's actual subject; `onLearn()` preserves the
current worksheet. No hunger, decay, clock, scarcity, daily requirement or penalty.
Named placement buttons provide a drag-free keyboard/touch alternative.

### Persistence and migration

Keep browser key `digi-mon/garden-state@1`, write schema version 3 with `worlds`
(`korean`, `english`, `math`) and `activeSubject`. Valid version-1/2 gardens migrate
all twelve existing rewards, answered keys, quota and placements into Korean only;
new worlds start empty. Legacy area IDs retain their deterministic migration.
Only opaque item keys and local game choices/counters are saved. No learner answers,
identity or accuracy are stored. React callbacks update a synchronous state ref before
publishing so multiple answers in one render cannot overwrite one another. A storage
failure is surfaced while keeping the current session usable. Reset affects only the
selected world and requires confirmation.

### Rendering accessibility and resilience

Canvas size follows its container; pixel ratio is capped at 2. Camera orbit, zoom and
home buttons duplicate pointer/touch controls inside a native camera `details`.
Touch gestures are OFF by default (`touch-action: pan-y`); ordinary swipes over the
canvas scroll the page. The explicit gesture toggle temporarily enables one-finger
orbit/two-finger zoom, and closing the disclosure disables it again. Every control
has a 48px minimum target. Reduced motion disables ambient animation; an additional
pause button is available when the OS allows motion. Camera buttons still work on
demand. Rendering pauses in background tabs and while the canvas is offscreen.
Responsive checks target 375x812, 768x1024 and 1024x768; renderer resize fits the whole
island/tank and caps DPR at 2 rather than allocating full high-density tablet pixels.
All meaningful content also exists as text outside the canvas. If WebGL initialization
fails or the context is lost, present a descriptive fallback and retry action without
blocking care, placement or persistence. Dispose meshes/materials, controls, animation
frames and renderer on unmount and subject changes.

The earlier two-dimensional design below documents the preserved reward catalog and
legacy behavior. Version-3 world behavior above supersedes its scene/state details.

## Product concept: 오늘의 작은 정원

Learning and decorating are separate views.

- The learning view keeps a compact `오늘의 걸음` card and `정원 보기` CTA.
- `#garden` opens the dedicated `나만의 정원` room.
- A new reward exposes `정원에 놓으러 가기`, which opens the room with that item selected.
- Browser back and a reloadable hash preserve the visible view without adding a router dependency.

- Every distinct answered item adds one `오늘의 걸음`.
- Changing an answer to the same item never adds another step.
- Correctness is not used for progress or rewards.
- Every three steps unlock exactly one decoration in catalog order.
- A decoration can be placed at one of eight named points in a continuous landscape.
- Placement can be changed at any time and never deletes the item.

The reward catalog is local static product data. Existing rewards keep their order so
saved gardens and the first unlock experience remain stable. The full collection has
four small themes with three decorations each:

- `쉴 곳`: 달빛 의자, 책 읽는 고양이, 소풍 바구니
- `꽃과 열매`: 민들레 화분, 딸기 텃밭, 버섯 오두막
- `물가 풍경`: 작은 연못, 새들의 물그릇, 조약돌 분수
- `하늘과 빛`: 구름 풍선, 무지개 깃발, 반딧불 등불

The inventory groups these themes as four softly tinted collection panels. Each panel
shows its own `0/3` collection count while the inventory heading shows the overall
count. Locked items remain intentionally secret; the category gives children variety
without spoiling the next reward.

After the catalog is complete, children can keep learning and rearranging without
scarcity messaging or losing anything.

## Child-safety rules

The interface has no streak, timer, countdown, leaderboard, public score, loss,
demotion, or failure state. It never says a child is smart, weak, perfect, behind,
or ahead.

The core message is `맞혔는지보다, 해 본 것이 소중해요.`

Progress acknowledges participation. The engine's accuracy and recommendation remain
visible only inside the honest diagnostic explanation and never control decoration.
Learning is never blocked on placing or claiming a reward.

## Decoration scene

The room is a single coordinate canvas with trees, hills, a path, a pond, flowers,
a small gate, a stream, and a bridge. It has eight stable placement IDs:

```text
big-tree, pond-side, flower-path, hill-top,
picnic-lawn, little-gate, stream-bridge, front-garden
```

The point buttons are the primary interaction for touch and keyboard. Drag-and-drop is
not required. A placed item has a textual accessible name such as
`달빛 의자, 연못 옆에 놓임`; its coordinates never carry meaning alone.

## State and privacy boundary

The engine remains stateless and unchanged. Game state uses the versioned browser key:

```text
digi-mon/garden-state@1
```

Stored values are only:

- quota progress from zero to two;
- opaque worksheet/item keys already present in delivered worksheets;
- unlocked catalog IDs;
- version-2 placement point IDs;
- the latest reward ID.

No name, account, age, school, roster, answer text, score, or diagnostic aggregate is
stored. Valid version-1 four-area placements migrate deterministically to version-2
points. Invalid or future-version data resets to an empty garden.

`정원 새로 시작하기` removes progress and decorations without affecting worksheets
or engine data.

## Engine and host boundary

The fork preserves the original same-origin routes:

```text
browser -> /learner/api/* -> web-garden host -> digi-mon engine
browser -> /teacher/api/* -> web-garden host + server token -> engine
```

Learner query/body fields `includeAnswers`, `includeFeedback`, and
`manualEvaluations` are stripped. The teacher token exists only in the host process.
Figures remain engine-created canonical inline SVG.

## Accessibility

- Every interaction is a native button, radio, input, or select.
- Progress and reward messages use `aria-live="polite"`.
- Decoration placement has named areas and a descriptive placed-item accessible name.
- Locked catalog entries remain visible and disabled.
- Controls keep at least 48px targets; primary actions are 56px.
- A 4px visible focus outline works with keyboard navigation.
- At 640px, the garden, inventory, controls, results, and worksheet become one column.
- `prefers-reduced-motion` resolves `--garden-motion` to `0ms`.
- English worksheet stems retain `lang="en"`.

## Commands

```bash
npm run garden:dev
npm run garden:test
npm run garden:build
npm run test:e2e -w @digi-mon/web-garden
npm run host -w @digi-mon/web-garden
```

Development runs at `http://127.0.0.1:4273` and expects the engine at port 8787.
