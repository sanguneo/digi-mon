# 개선 지시서 — 코드 전수 점검 (2026-08-10)

2026-08-10 커밋 `ed2b42a` 기준으로 `src/`·`bin/`·`test/`·`tools/`·CI를 전수 점검해 확정한
개선 항목이다. 이 문서만 읽고 작업을 시작할 수 있게 썼다. 각 항목에
**무엇을 · 어디를 · 어떻게 · 완료 판정**을 적었다.

행 번호는 점검 시점에 실물로 확인한 값이다. 이후 커밋으로 밀렸으면 파일 안에서
같은 식별자를 검색해 찾는다 — 행 번호가 안 맞는다고 항목을 건너뛰지 말 것.

우선순위는 세 단계다.

- **P0** — 버그성. 외부에서 관찰되는 잘못된 동작이거나 조용한 정합성 위험.
- **P1** — 안전망. 지금은 안 터졌지만 회귀를 잡을 장치가 없는 곳.
- **P2** — 운영·잔손질. 각각 몇 줄짜리 수정.

---

## 작업 규칙 — 어기면 되돌린다

1. **완료 판정은 `npm test`와 `npm run verify`를 직접 실행해 종료코드 0으로 한다.**
   grep 파이프의 종료코드로 읽지 말 것(`REVIEW.md` §13에 사고 기록이 있다).
2. **fingerprint를 바꾸는 리팩터링은 금지다.** P0-D의 `stableJson` 통합처럼 지문값 계산
   경로를 건드리는 항목은, 수정 전후로 같은 옵션·시드의 fingerprint가 바이트 동일함을
   테스트로 증명한다. 지문값이 바뀌면 발급된 학습지의 채점이 전부 깨진다.
3. **게이트 문턱을 완화해서 통과시키지 말 것.** 옳은 코드를 위반이라 부르는 오탐일 때만
   검사기를 고치고, 고칠 때는 `REVIEW.md` §13에 사례를 남긴다.
4. **게이트를 추가·삭제하면 `REVIEW.md`의 게이트 수·체인 단계 수가 낡는다.**
   `check-review-doc`가 verify를 실패시키니, 실패 메시지가 알려 주는 실제 값으로 §3을 갱신한다.
5. **ajv를 프로덕션 의존성으로 승격하지 말 것.** "런타임 의존성 0개"는 이 저장소의 계약이다
   (`REVIEW.md` §1). 스키마 강제는 테스트와 게이트에서 한다(P1-E 참조).
6. `node -e`로 화살표 함수를 쓰지 말 것(Git Bash가 `>`를 리다이렉트로 먹는다).
   패치·확인 스크립트는 파일로 쓴다.
7. 한 항목 = 한 커밋. 커밋 메시지는 기존 관행(한국어, 무엇을 왜)을 따른다.

---

## 이미 되어 있는 것 — 다시 만들지 말 것

점검에서 확인한 것이다. 아래를 "추가"하는 커밋은 중복이다.

- 타이밍 안전 토큰 비교 — `src/server/app.mjs:217` 부근, `crypto.timingSafeEqual` + 길이 선검사
- 요청 크기 제한 256KB, 413 응답과 조기 청크 폐기 — `app.mjs:42`, 테스트 있음
- 레이트 리밋 자체(120요청/60초/IP, 429 + `Retry-After`) — 있음. P0-B는 **비용 가중**이 없다는 것이지 리밋이 없다는 게 아니다
- 소켓 타임아웃(`headersTimeout`·`requestTimeout`·`keepAliveTimeout`) — `bin/serve.mjs:26-28`
- 500에서 스택 미노출(고정 문구, 스택은 stderr만) — `app.mjs:826`
- 정답·풀이·교사 정보 제거 투영과 `requireTeacher` 게이트 — 철저하고 테스트됨
- `learnerId` 정규식·길이 제한, 응답 기록 필드 allow-list — `app.mjs:558` 부근, `response-log.mjs:94-132`
- 405 + 올바른 `Allow` 헤더, 404에 알려진 경로 목록 — `app.mjs:799-810`
- 부팅 시 스파인 충돌 fail-fast, `verify()` 필수 생성기 계약
- SVG XML 이스케이프와 렌더 well-formedness 검사
- CI: SHA 고정 액션, 산출물 신선도 게이트, `test/ops/ci-contract.test.mjs`
- `src`·`bin`·`test`·`tools`에 TODO/FIXME/HACK 마커 0개

---

## P0-A. 사용자 입력 오류가 HTTP 500으로 나간다 — 재현 확인됨

**무엇을:** 엔진의 "조건에 맞는 대상 없음" 오류를 타입화하고 서버에서 4xx로 매핑한다.

**재현 (둘 다 현재 500 "내부 처리 실패"):**

```text
POST /v1/worksheets {"subject":"math","codes":["[6수01-99]"],"count":5}
POST /v1/worksheets {"subject":"english","grade":"1-2","count":5}
```

첫째는 존재하지 않는 성취기준 코드, 둘째는 해당 학년군에 영어 성취기준이 없는 경우다.
둘 다 클라이언트 잘못이지 서버 고장이 아니다. `app.mjs:825`의 주석은 500을 검산 실패
전용으로 약속하는데, 지금은 사용자 오류가 그 신호를 오염시킨다.

**어디를:**

- `src/engine/worksheet.mjs:159` — `조건과 mode에 맞는 성취기준이 없다`를 일반 `Error`로 던진다.
- 같은 파일의 일반 `Error` 던짐 전수(점검 시점 78·131·134·139·144·147·159·167·225행)를
  검토해, HTTP 요청으로 도달 가능한 것을 골라낸다. `count`·`difficulty` 등은
  `parseWorksheetOptions`가 경계에서 먼저 잡으므로 도달하지 않을 수 있다 — 실제로 요청을
  만들어 도달 여부를 확인하고 도달하는 것만 타입화한다.
- `src/server/app.mjs:391`·`:418` 부근 — `buildWorksheet`/`buildWorksheetFormSet` 호출부.

**어떻게:** 기존 패턴을 그대로 따른다. `WorksheetOptionsError`(`src/engine/options.mjs:9`)와
`WorksheetFormPoolError`(`src/engine/worksheet-forms.mjs:19`)가 이미 있고, 서버가
`app.mjs:106`·`:120`·`:424`에서 `instanceof`로 매핑한다.

1. `worksheet.mjs`에 `export class WorksheetTargetError extends Error {}`를 추가한다.
2. "조건에 맞는 성취기준 없음"(159행)과 도달 가능한 대상 선택 오류를 이 타입으로 바꾼다.
3. 서버에서 `WorksheetTargetError instanceof` → **404**로 매핑한다(대상이 없다는 뜻이므로).
   옵션 형식 오류는 기존대로 400.
4. `/v1/worksheet-forms`·`/v1/items`·`/v1/grade`(재생성 경로)도 같은 매핑을 타는지 확인한다.

**완료 판정:** 위 재현 두 건이 404 + 한국어 오류 문구로 응답. `test/server/app.test.mjs`에
두 케이스 추가. 검산 실패가 여전히 500인 것 확인(기존 테스트 유지). `npm test`·verify exit 0.

---

## P0-B. 레이트 리밋이 요청 수만 세고 작업량을 안 센다 — 단일 IP CPU 소진 가능

**무엇을:** 요청당 비용 상한 또는 비용 가중 리밋을 추가한다.

**측정된 근거:** `{subject:'math', count:100, formCount:8}` 한 건이 동기 CPU를 약 0.67초
점유한 뒤 409로 끝난다(형별 최대 재시도 200회 × 8형 × 100슬롯 —
`src/engine/worksheet-forms.mjs:13-14`·`:215`). 분당 120요청 허용이면 단일 IP가
단일 스레드 서버에서 분당 약 80초의 CPU를 태울 수 있다.

**어디를:** `src/server/app.mjs:44-45`(리밋 상수)·`:290-306`(리미터),
`src/engine/worksheet-forms.mjs:13-14`(시도 상한).

**어떻게 (셋 다 한다):**

1. **비용 가중:** 요청 비용을 `count × max(1, formCount)`로 정의하고, 윈도당 요청 수 대신
   비용 합계에 상한을 둔다. 상한값은 "정상 교사 사용(20문항 × 3형 여러 번)"이 걸리지 않는
   수준으로 잡고 상수에 주석으로 근거를 남긴다.
2. **form-set 총 시도 상한:** 한 요청이 소비할 수 있는 생성 시도 총량(형×슬롯×재시도)에
   상한을 두고, 초과 시 기존 `WorksheetFormPoolError` 경로로 409를 낸다.
3. **리미터 맵 무한 성장 수리:** `app.mjs:296-301`의 청소가 윈도 리셋 경로에서만 돌아,
   한 윈도 안에 유니크 IP가 대량 유입되면 맵이 무한히 큰다. 항목 수 상한 또는 주기 청소를
   추가한다.

**완료 판정:** 429 응답 테스트가 최초로 생긴다(현재 `test/`에 429가 한 건도 없다).
최악 요청의 CPU 점유가 측정으로 유의미하게 줄었음을 커밋 메시지에 수치로 남긴다.
`npm test`·verify exit 0.

---

## P0-C. `difficultyMix`가 HTTP 경계에서 조용히 버려진다

**무엇을:** 엔진은 지원하는데(`src/engine/worksheet.mjs:122`·`:163-167`, provenance에도 포함
`:243`) `parseWorksheetOptions`(`src/engine/options.mjs`)가 통과시키지 않아, HTTP로
`difficultyMix`를 보낸 클라이언트는 200을 받고도 무시당한다. 조용한 무시는 이 저장소의
원칙(꾸며내지 않고 명시적으로 실패)과 정면으로 어긋난다.

**어떻게:** 배선을 권장한다.

1. `parseWorksheetOptions`에 `difficultyMix`를 추가한다 — 난이도 1..3 키, 양수 가중치만
   허용, 위반 시 `WorksheetOptionsError`(엔진의 167행 검증과 같은 규칙).
2. `/v1/worksheets`·`/v1/worksheet-forms`·`/v1/grade` 세 경로 모두에 배선한다.
   **`/v1/grade`가 핵심이다** — provenance에 이미 포함되므로 발급 때와 다른 값으로
   채점을 요청하면 fingerprint 불일치 409가 나야 정상이다.
3. 배선이 어려운 사정이 발견되면 차선책으로 **모르는 최상위 키를 400으로 거부**한다.
   조용한 무시만은 없앤다.

**완료 판정:** HTTP로 `difficultyMix`를 보내면 실제 문항 구성이 바뀌고, 같은 값으로 채점
왕복이 성공하며, 다른 값이면 409가 나는 테스트 3건. `npm test`·verify exit 0.

---

## P0-D. 중복 정의 통합 — fingerprint 원시 함수가 두 벌이다

**무엇을:** 드리프트 시 조용히 깨지는 중복 정의를 한 곳으로 모은다.
`REVIEW.md` §16이 "같은 정보를 두 곳에 두면 한쪽이 낡는다"를 세 번 겪었다고 기록한
바로 그 부류다.

| 중복 | 위치 | 위험 |
|---|---|---|
| `stableJson` | `src/engine/worksheet.mjs:19` · `src/engine/worksheet-forms.mjs:21` (바이트 동일) | fingerprint 원시 함수. 한쪽만 수정되면 지문값이 조용히 어긋난다 |
| `CHOICE_LABELS` | `src/engine/item.mjs:49` · `src/server/grade.mjs:8` | 선택지 라벨과 채점 라벨 해석이 갈릴 수 있다 |
| 성취기준 코드 정규식 | `src/engine/options.mjs:5` · `src/curriculum/learning-gate-evidence.mjs:8` · `src/engine/response-log.mjs:112` (엄격형) vs `src/engine/registry.mjs:51` (느슨형 `/^\[\d[가-힣]+\d{2}-\d{2}\]$/`) | 네 곳 두 패턴. 등록은 통과하는데 옵션 파서가 거부하는 코드가 생길 수 있다 |

**어떻게:**

1. `stableJson`을 공용 모듈(예: `src/engine/stable-json.mjs`)로 추출하고 두 파일이 import한다.
   **작업 규칙 2를 지켜라** — 통합 전후 같은 옵션·시드의 fingerprint 바이트 동일성을
   테스트로 증명한다. 두 사본이 바이트 동일함을 먼저 diff로 확인하고 시작할 것.
2. `CHOICE_LABELS`를 `item.mjs`에서 export하고 `grade.mjs`가 import한다.
3. 코드 정규식을 공용 상수(예: `src/curriculum/standard-code.mjs`)로 모으고 **엄격형으로
   통일**한다. `registry.mjs`를 엄격형으로 좁히기 전에 등록된 193개 생성기의
   `standardCode`가 전부 엄격형에 맞는지 확인한다(스파인이 248개 `[246][국수영]` 코드이므로
   맞아야 정상이고, 안 맞는 게 나오면 그게 버그다).

**선택(같은 커밋에 넣지 말 것):** 9개 수학 생성기 파일마다 재선언된
`const num = (n) => String(n)`, 약 205곳의 `answer: { value, display, accepts }` 손글씨
리터럴을 접는 `numericAnswer()`/`textAnswer()` 헬퍼. 가치는 있지만 대량 기계 수정이라
별도 커밋 + verify로 분리한다.

**완료 판정:** fingerprint 회귀 테스트 통과(기존 지문값 불변). `npm test`·verify exit 0.

---

## P1-E. 스키마를 종이 계약에서 강제 계약으로

**무엇을:** `schema/` 11개 중 ajv로 실제 컴파일되는 곳이 3곳뿐이다
(`test/curriculum/learning-gate.test.mjs`, `test/engine/worksheet-forms.test.mjs`,
`tools/check-coverage-schema.mjs`). `schema/spine.schema.json`은 **참조 0인 죽은 계약**이다.
서버 테스트는 실제 `/v1/*` 응답을 스키마로 검증하지 않는다.

**어떻게 (작업 규칙 5 — ajv는 devDep에 머문다):**

1. `test/server/app.test.mjs`(또는 새 파일)에서 실제 응답 페이로드를 ajv로 검증한다 —
   `/v1/worksheets` ↔ `worksheet.schema.json` + `item.schema.json`,
   `/v1/worksheet-forms` ↔ `worksheet-form-set.schema.json`,
   `/v1/grade` ↔ `grading-result.schema.json`,
   `/v1/learning-gate` ↔ `learning-gate-recommendation.schema.json`.
2. `spine.schema.json`을 `bin/build-spine.mjs` 또는 `bin/audit-ontology.mjs`의 검증에
   배선한다. 배선할 수 없는 이유가 발견되면 삭제하되 사유를 커밋 메시지에 남긴다 —
   죽은 계약을 두는 것이 최악이다.
3. 새 게이트 `tools/check-schema-usage.mjs`: `schema/*.json` 각각에 대해 src·test·tools·bin
   어디서든 컴파일·참조되는지 검사하고, 참조 0이면 실패한다. verify 체인에 등록하고
   **작업 규칙 4에 따라 `REVIEW.md` §3의 게이트 수를 갱신한다.**
4. `worksheetForGrading`(`app.mjs:149-158`)의 9절 수동 boolean 체인은 런타임이므로 ajv로
   바꾸지 않는다. 대신 이 수동 검사와 `worksheet-form-set.schema.json`이 같은 제약을
   말하는지 대조하는 테스트를 넣는다(스키마가 허용하는데 수동 검사가 거부하는 형태,
   또는 그 반대를 잡는다).

**완료 판정:** 게이트 등록 후 `check-review-doc` 포함 verify exit 0. 스키마 파일을
하나 지워 보면 새 게이트가 exit 1을 내는 것 확인(확인 후 되돌린다).

---

## P1-F. 서버 테스트 공백

**무엇을:** `test/server/app.test.mjs`는 좋은 테스트다(실 `http.createServer`, 실 fetch,
교사 토큰, 405·413·409). 그러나 다음이 빠져 있다.

1. **미테스트 라우트 5개:** `GET /v1/subjects`·`/v1/standards`·`/v1/generators`·
   `/v1/coverage`·`/v1/prerequisites`. 각각 정상 1건 + 잘못된 쿼리 1건.
2. **429 테스트 0건** — P0-B에서 함께 처리했으면 여기서는 확인만.
3. **실코퍼스 스모크 부재:** 현재 서버 테스트는 1기준·1생성기 가짜 스파인만 사용해
   (`app.test.mjs:75-91` 부근), 실제 248기준·193생성기 코퍼스가 HTTP 경로를 한 번도
   지나지 않는다. 실코퍼스로 부팅해 교과별 발급→채점 왕복 한 번씩 도는 스모크 테스트를
   추가한다. 느리면 `test/server/smoke.test.mjs`로 분리해도 된다.
4. **커버리지 신호 부재:** `tools/run-tests.mjs:22`의 `node --test`에
   `--experimental-test-coverage`를 추가해 최소한 수치가 보이게 한다. 문턱 게이트는
   이번에 만들지 않는다(수치 없이 문턱부터 정하는 것은 순서가 거꾸로다).

**완료 판정:** 13개 라우트 전부에 최소 1개 테스트. `npm test` exit 0.

---

## P1-G. 정밀도 핵심 모듈에 직접 단위 테스트가 없다

**무엇을:** `src/engine/rational.mjs`(고정소수 연산)·`src/engine/hangul.mjs`·
`src/engine/korean-number.mjs`(조사 선택)·`src/render/*.mjs` 4종은
`bin/verify-generators.mjs`를 통해 간접으로만 검증된다. 회귀가 생기면 "생성기 실패"라는
엉뚱한 얼굴로 나타난다.

**확인된 실 버그 1건:** `rational.mjs:18`의 `lcm(0, 0)`이 `NaN`을 반환한다. 이웃한
`divideFractions`/`makeFraction`은 던지는데 `lcm`만 무방비다. 0 입력에 명시적으로 던지게
고치고 테스트로 고정한다.

**어떻게:** 모듈당 테스트 파일 하나씩(`test/engine/rational.test.mjs` 등). 우선순위는
rational → korean-number(조사) → hangul → render. 조사 선택은 `check-korean`이 잡은
과거 사례(§13의 로/으로 222건)를 회귀 케이스로 박아 둔다.

**완료 판정:** `lcm(0,0)`이 던진다. 4개 모듈 테스트 존재. `npm test`·verify exit 0.

---

## P1-H. 타입 안전망 — 빌드 없는 `// @ts-check`

**무엇을:** 약 24k 줄의 src에 JSDoc `@param` 0개, lint·formatter·tsconfig 없음.
Generator와 Item 계약은 `src/engine/registry.mjs:46-89`·`src/engine/item.mjs:184-273`의
명령형 검사로만 존재한다.

**어떻게 (빌드 단계를 만들지 않는다):**

1. 루트에 `tsconfig.json` — `checkJs: true`, `noEmit: true`, `allowJs: true`,
   `target/module`은 Node 20 ESM에 맞춘다. 대상은 우선 `src/engine`만 include.
2. Generator·Item·Worksheet 계약의 JSDoc `@typedef`를 계약이 사는 파일에 적는다.
3. `package.json`에 `"check:types": "tsc -p tsconfig.json"` 추가, typescript는 devDep.
4. CI에 한 단계 추가. `test/ops/ci-contract.test.mjs`가 CI 구조를 검사하므로 함께 갱신.
5. `src/engine`이 깨끗해지면 이후 커밋에서 curriculum → server → generators 순으로 넓힌다.
   이번 지시서의 범위는 engine까지다.

**완료 판정:** `npm run check:types` exit 0, CI 통과.

---

## P2-I. 운영 편의 — 각각 몇 줄짜리

모두 `bin/serve.mjs`·`src/server/app.mjs` 범위. 한 커밋으로 묶어도 된다.

1. **요청 로그:** 현재 `src/` 전체에서 `console.*`은 `app.mjs:826` 한 곳뿐이다.
   stderr 한 줄 액세스 로그(메서드·경로·상태·소요 ms)를 추가한다. **`learnerId`·요청
   본문은 절대 남기지 않는다** — PII 규율은 이 저장소의 계약이다. 환경변수
   `LOG_REQUESTS=1`일 때만 켜는 opt-in도 허용.
2. **`HEAD /health` 405 수리:** LB·k8s 프로브가 HEAD를 쓴다. HEAD에 200 빈 몸통.
3. **종료 수리:** `serve.mjs:53-55`의 `server.close()`에 `closeIdleConnections()` 선행 +
   5초 force-exit 타이머. keep-alive 연결 하나가 종료를 물고 늘어질 수 있다.
4. **`process.on('unhandledRejection'|'uncaughtException')`** — stderr 기록 후 exit 1.
5. **`TEACHER_TOKEN` 강도:** 16자 미만이면 부팅 거부(명시적 실패가 이 저장소 방식이다).
   미설정 시 "교사 경로 비활성" 한 줄을 시작 로그에 남긴다.
6. **시작 배너에 `POST /v1/accuracy` 누락** — `serve.mjs:39-50`에 추가.

**완료 판정:** HEAD /health 200 테스트, 약한 토큰 부팅 거부 테스트. `npm test` exit 0.

---

## P2-J. CI·문서 잔손질

1. **Node 버전 약속 불일치:** `package.json`은 `node >= 20`을 선언하는데
   `.github/workflows/ci.yml:23`은 24만 검증한다. 매트릭스 `[20, 24]`로 바꾸거나,
   20 지원을 접을 거면 `engines`·README 요구 사항을 함께 24로 올린다. 하나를 골라
   약속과 검증을 일치시킨다.
2. **`npm audit --omit=dev`는 no-op다** — 런타임 의존성이 0개다. 유일한 의존성(ajv,
   devDep)을 감사하려면 `npm audit`(기본이 dev 포함)으로 바꾼다.
3. **README 경로표 누락:** `README.md`의 API 표에 `/v1/coverage`·`/v1/generators`·
   `/v1/accuracy`가 없다. 실제 라우트 전수와 대조해 표를 갱신한다.
4. `.markdownlint-cli2.jsonc`가 있는데 어떤 npm script·CI 단계에도 배선되어 있지 않다.
   배선하거나 지운다 — 죽은 설정을 두지 않는다.

**완료 판정:** CI green. README 표와 `app.mjs` 라우트 목록이 일치.

---

## 이 지시서에서 하지 않는 것

- **학습지원 guided-candidate 확대**(현재 193개 중 18개, 수학은 152개 중 3개) —
  가장 큰 제품 공백이지만 내용 저작과 사람 검토가 필요하다. 코드 지시서로 처리하면
  "검토 없는 승인"이 되어 이 저장소의 원칙을 어긴다. 별도 트랙.
- **로드맵 P0 두 건**(후보 의미 정렬 리뷰 큐, asset manifest MVP —
  `docs/research/digi-mon-next-improvements.md` §4.1·§4.2) — 설계 판단이 필요한 신규
  기능이라 이 지시서와 성격이 다르다. 별도 트랙.
- **어휘 목록의 공식 별표 교체** — `REVIEW.md` §14가 이미 자리를 잡아 뒀다. 별도 트랙.
- `REVIEW.md` §15의 금지 목록 전부 — PDF·렌더 재진입, LLM 윤문, 게이트 문턱 완화.
- ajv의 프로덕션 의존성 승격(작업 규칙 5).

---

## 권장 작업 순서

P0-A → P0-C → P0-D → P0-B → P1-G → P1-F → P1-E → P1-H → P2-I → P2-J.

P0-A·C가 먼저인 이유: 서버 오류 매핑과 옵션 파서를 고친 뒤에 테스트 공백(P1-F)을 메워야
같은 파일을 두 번 열지 않는다. P0-D의 fingerprint 통합은 회귀 테스트(작업 규칙 2)를
먼저 쓰고 시작한다.

---

## 후속 작업 방향 — 출력 품질 검증으로 전환 (2026-08-11)

이 지시서의 인프라·계약 보강을 반복해서 늘리지 않는다. 다음 단계의 목표는
“엔진이 좋은 학습지를 실제로 만드는가”를 대표 출력으로 증명하는 것이다.

### 프로젝트 범위 원칙 — 엔진 중심

- 이 저장소의 제품은 학습지 생성·검산·재현·채점 엔진과 그 계약이다.
- 웹·앱·인쇄 UI 같은 클라이언트는 엔진 소비자이며 이 저장소의 완료 조건이 아니다.
- 특정 클라이언트에 맞춘 DOM·화면 상태·표현 계층을 엔진에 넣지 않는다.
- 엔진은 라이브러리와 HTTP 경계에서 결정적이고 검증 가능한 결과를 제공한다.
- 클라이언트 작업은 사용자가 명시적으로 요청한 별도 트랙에서만 연다.

### 1. 핵심 정확성 결함 마감

- [x] 기준 form의 내부 재시도를 요청당 생성 시도 예산에 실제 호출 기준으로 포함한다.
- [x] `/v1/grade` 재생성의 form pool 부족을 내부 오류 500이 아니라 충돌 409로 응답한다.

서비스를 외부에 공개하지 않는 동안 동시 요청 rate limit의 원자성·IP/NAT 정책은
후순위로 둔다. 배포 준비를 시작할 때 별도 운영 안전성 작업으로 다시 연다.

### 2. 대표 학습지 품질 평가

고정 seed로 학년·과목·난이도를 섞은 대표 학습지 20~30개를 생성해 사람이 검토한다.
교육과정 정렬, 정답 정확성, 문장 자연스러움, 오답 매력도, 체감 난이도, 유형 반복을
같은 rubric으로 기록한다.

### 3. 관찰된 품질 문제만 개선

평가에서 확인된 실패를 빈도와 심각도로 정렬한다. 특정 생성기 오류, 반복, 난이도
drift, 성취기준별 편차처럼 실제 출력에서 드러난 문제만 수정한다. 새 범용 gate나
추상 구조는 관찰된 실패를 막는 데 필요할 때만 추가한다.

### 전환 판정

대표 학습지 품질이 충분하면 근거 없는 인프라 보강을 멈추고 엔진의 다음 실제 공백을
고른다. 현재 우선 후보는 국어·영어의 지문·어휘·음성 자산 기반 생성 범위와 교과별
난이도 보정의 실제 출력 효과다. 클라이언트 surface는 이 판정과 분리한다.
