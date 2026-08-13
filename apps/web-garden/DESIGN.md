# digi-mon garden client

## Why this is a fork

`apps/web-garden` is a sibling of `apps/web`, not a theme switch inside it.
The original teacher/learner client remains a stable, assessment-first surface.
This fork keeps its HTTP behavior but adds a child-facing participation reward loop.

The fork does not import source from `apps/web` or root `src/`. Shared behavior is copied
at the fork point so each application can evolve without hidden runtime coupling.

## Product concept: 오늘의 작은 정원

The child sees a small garden before the worksheet.

- Every distinct answered item adds one `오늘의 걸음`.
- Changing an answer to the same item never adds another step.
- Correctness is not used for progress or rewards.
- Every three steps unlock exactly one decoration in catalog order.
- A decoration can be placed in `왼쪽`, `가운데`, `오른쪽`, or `앞쪽`.
- Placement can be changed at any time and never deletes the item.

The reward catalog is local static product data:

1. 달빛 의자
2. 민들레 화분
3. 작은 연못
4. 구름 풍선
5. 책 읽는 고양이
6. 무지개 깃발

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

## State and privacy boundary

The engine remains stateless and unchanged. Game state uses the versioned browser key:

```text
digi-mon/garden-state@1
```

Stored values are only:

- quota progress from zero to two;
- opaque worksheet/item keys already present in delivered worksheets;
- unlocked catalog IDs;
- placement area IDs;
- the latest reward ID.

No name, account, age, school, roster, answer text, score, or diagnostic aggregate is
stored. Invalid or future-version data resets to an empty garden.

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
