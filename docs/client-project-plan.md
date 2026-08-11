# digi-mon 클라이언트 프로젝트 기획서

> 상태: 다음 클라이언트 작업의 결정 원장
>
> 현재 구현 상태: 엔진 library·CLI·HTTP만 존재하며 클라이언트 코드는 없다.
>
> 적용 시점: 사용자가 별도 클라이언트 트랙을 시작할 때

이 문서는 다음 작업자가 기존 엔진을 훼손하지 않고 첫 클라이언트를 시작하도록
범위, 저장소 구조, 의존 계약, 구현 순서와 완료 조건을 고정한다.

화면별 상세 흐름은
[교사·학습자 클라이언트 참고 설계](design/client-experience.md), 시각 기준은
[디자인 시스템](design/design-system.md)과
[`tokens.css`](design/tokens.css)를 따른다. 이 문서는 해당 내용을 복제하지 않고
프로젝트 경계와 실행 결정을 정의한다.

## 1. 목표

첫 클라이언트는 digi-mon 엔진을 사용하는 **로컬 교사 웹 도구**다.

교사는 다음 한 가지 흐름을 완료할 수 있어야 한다.

1. 교과·학년군·범위·문항 수를 고른다.
2. 엔진이 만든 학습자본과 교사용 정답본을 함께 확인한다.
3. A4 학습지와 정답지를 인쇄하거나 발급 JSON을 내보낸다.
4. 같은 `seed`, `options`, `fingerprint`로 발급본을 식별한다.
5. 이름이나 계정을 저장하지 않고 세션 한정 결과를 확인한다.

클라이언트는 새로운 문제 생성기나 채점기를 만들지 않는다. 엔진이 제공하는
결정성, projection, 검산과 채점 계약을 사람이 사용할 수 있는 흐름으로 연결한다.

## 2. 확정 결정

| 항목 | 결정 |
|---|---|
| 저장소 | 현재 저장소를 npm workspace 모노레포로 확장 |
| 엔진 위치 | 첫 전환에서는 현재 루트 구조를 유지 |
| 클라이언트 위치 | `apps/web` 독립 workspace |
| 패키지 관리자 | 현재와 같은 npm |
| 첫 배포 형태 | 한 교사 기기의 로컬 host와 브라우저 |
| 브라우저 연결 | 같은 origin의 host proxy를 통해서만 엔진 호출 |
| 엔진 의존 | HTTP API와 JSON Schema만 사용 |
| 데이터 저장 | 첫 단계는 DB 없이 교사 소유 파일 export |
| 첫 경험 | S1 학습지 짜기, S2 종이 나눠주기, S3 세션 한정 익명 요약 |
| 후속 경험 | S4 기기 연습과 S5 검토 인박스는 관찰된 요구 뒤에 개방 |

현재 엔진을 `packages/engine`으로 옮기지 않는다. 첫 클라이언트 하나 때문에
검증된 파일 경로와 감사 도구를 대량 이동시키는 것은 제품 가치가 없다. 독립
package로 배포하거나 두 번째 비-HTTP 소비자가 생길 때만 engine package 추출을
다시 검토한다.

## 3. 모노레포 목표 구조

```text
digi-mon/
├─ apps/
│  └─ web/
│     ├─ package.json
│     ├─ DESIGN.md
│     ├─ src/
│     ├─ server/
│     └─ test/
├─ bin/
├─ data/
├─ docs/
├─ reference/
├─ schema/
├─ src/
├─ test/
├─ tools/
└─ package.json
```

루트 `package.json`은 엔진 프로젝트이자 workspace root 역할을 함께 맡는다.
`workspaces: ["apps/*"]`만 추가하고 기존 엔진 명령과 경로는 유지한다.

`apps/web`은 자체 의존성, 타입 검사, 단위 테스트, 브라우저 테스트와 build를
가진다. 루트 CI는 엔진 검증과 클라이언트 검증을 별도 단계로 실행해 어느 쪽이
실패했는지 숨기지 않는다.

## 4. 의존 방향

```text
apps/web browser
       ↓ same origin
apps/web host
       ↓ HTTP
digi-mon server
       ↓
digi-mon engine
```

허용하는 의존은 아래 방향뿐이다.

- 클라이언트 host → 엔진 HTTP API
- 클라이언트 계약 검사 → 루트 `schema/*.json`
- 클라이언트 디자인 → `docs/design/`의 참고 계약

금지하는 의존은 다음과 같다.

- `apps/web`에서 `src/engine/`, `src/server/` 또는 `src/generators/` 직접 import
- 엔진에서 `apps/web` import
- 클라이언트가 정답 제거, fingerprint 계산 또는 채점 규칙 재구현
- DOM, 인쇄, 브라우저 저장소와 UI 상태를 엔진으로 이동

`tools/check-boundaries.mjs`의 현재 엔진 경계는 그대로 통과해야 한다.

## 5. 계약 source of truth

충돌할 때 다음 순서로 판단한다.

1. `schema/`와 실제 HTTP 구현
2. 루트 `README.md`와 `docs/product-brief.md`
3. 이 기획서
4. `docs/design/client-experience.md`와 `docs/design/design-system.md`
5. `docs/research/`의 과거 조사

현재 클라이언트가 인식해야 하는 주요 자료 버전은 다음과 같다.

| 자료 | 계약 |
|---|---|
| 문항 | `digi-mon/item@2` |
| 학습지원 | `digi-mon/learning-support@1` |
| 학습지 | `digi-mon/worksheet@5` |
| 병렬 문제지 묶음 | `digi-mon/worksheet-form-set@4` |
| 학습 게이트 요청 | `digi-mon/learning-gate-request@1` |
| 학습 게이트 추천 | `digi-mon/learning-gate-recommendation@1` |

클라이언트 host는 엔진 응답을 해당 JSON Schema로 검사한다. TypeScript 타입은
schema에서 생성하며 같은 필드를 별도 수기 interface로 관리하지 않는다. 알 수 없는
자료 버전을 받으면 일부 화면만 계속 그리지 않고 명시적인 계약 오류로 중단한다.

## 6. 사용할 HTTP 표면

첫 클라이언트는 다음 경로만 사용한다.

| 목적 | 엔진 경로 |
|---|---|
| 상태 확인 | `GET /health` |
| 교과·범위 선택 | `GET /v1/subjects` |
| 성취기준 선택 | `GET /v1/standards` |
| 생성 가능 여부 | `GET /v1/coverage` |
| 학습지 발급 | `POST /v1/worksheets` |
| A/B/C형 발급 | `POST /v1/worksheet-forms` |
| 답안 채점 | `POST /v1/grade` |
| 다음 행동 제안 | `POST /v1/learning-gate` |
| 수학 보충 발급 | `POST /v1/remediation` |

`GET /v1/generators`, `GET /v1/prerequisites`, `POST /v1/items`와
`POST /v1/accuracy`는 엔진 진단·고급 기능으로 남긴다. 첫 교사 흐름에서 필요가
확인되기 전에는 화면에 노출하지 않는다.

발급 티켓은 최소한 다음 값을 함께 보존한다.

```text
seed + options + fingerprint + worksheet payload + corpus identity
```

채점이나 동일본 확인 때 하나라도 잃으면 클라이언트가 추측해서 복구하지 않고
사용자에게 발급본이 불완전하다고 알린다.

## 7. same-origin host

브라우저는 엔진의 `127.0.0.1:8787`을 직접 호출하지 않는다.

1. 엔진은 CORS와 `OPTIONS` 경로를 제공하지 않는다.
2. `TEACHER_TOKEN`은 브라우저 JavaScript, 번들, storage와 HTML에 들어가면 안 된다.

루트 workspace 실행기가 엔진 서버와 client host를 독립 프로세스로 시작한다.
client host는 엔진 process를 import하거나 생명주기를 소유하지 않고, 설정된 내부
주소가 응답하지 않으면 엔진 연결 실패를 명시한다.

클라이언트 host는 정적 파일을 서빙하고 요청 경로를 둘로 분리한다.

| 클라이언트 경로 | token | 역할 |
|---|---|---|
| `/teacher/api/*` | host가 Bearer token 주입 | 정답본, 상세 피드백, 수동 채점 |
| `/learner/api/*` | 주입하지 않음 | 정답이 제거된 학습자 요청 |

학습자 proxy는 `includeAnswers`, `includeFeedback`, `manualEvaluations`를 전달하지
않는다. 엔진이 다시 거부하더라도 host 경계에서 먼저 제거한다.

host는 business rule을 소유하지 않는다. 인증 정보 보관, same-origin proxy,
정적 파일 제공과 schema 경계 검사만 담당한다.

## 8. 첫 클라이언트 범위

### S1. 학습지 짜기

- 교과, 학년군, 영역·성취기준, 문항 수와 난이도 선택
- 기본 난이도는 엔진에 맡기고 사용자가 명시할 때만 옵션 전달
- 생성 가능한 성취기준과 `blockedBy` 표시
- 자동·수동 채점, 시각 자료 요구와 shortfall 표시
- seed와 fingerprint의 의미 설명

### S2. 종이 나눠주기

- 학습자본과 교사용 정답·풀이 별도 인쇄
- A4 portrait 기본, 긴 문항의 page break와 overflow 검사
- 발급 JSON을 교사 소유 파일로 export
- 인쇄 footer에 seed, fingerprint 앞부분과 corpus identity 표시
- 같은 조건의 병렬 form 발급

### S3. 세션 한정 익명 요약

- 이름·이메일·학번을 저장하지 않음
- 자동 채점 결과와 수동 rubric boolean을 구분
- 표본이 부족한 경우 정확도나 숙달도처럼 표현하지 않음
- 브라우저를 닫으면 세션 상태 폐기
- 사용자가 명시적으로 export한 익명 결과만 파일로 남김

화면과 상호작용의 상세 조건은
[`client-experience.md`의 S1~S3](design/client-experience.md)를 따른다.

## 9. 후속 범위의 개방 조건

### S4. 학습자 기기 연습

다음이 모두 확인된 뒤에만 연다.

- 종이 흐름으로 해결되지 않는 반복 요구가 있다.
- 학교 또는 운영자가 개인정보와 LAN 경계를 승인한다.
- offline queue, 재전송과 중복 제출 정책을 검증할 수 있다.
- teacher token이 학습자 기기로 가지 않는 구조가 완성됐다.

### S5. 검토 인박스

여러 기여자의 검토량이 source control과 현재 review 문서로 감당되지 않을 때만
연다. 단순히 미래에 콘텐츠가 늘 수 있다는 이유로 만들지 않는다.

### 내구 저장

교사가 발급 파일을 다시 열지 못해 실제 작업이 반복해서 중단될 때만 SQLite를
추가한다. 중앙 PostgreSQL, 계정과 tenant는 기관의 확약된 요구가 있을 때 별도
기획으로 다룬다.

세부 trigger와 보존 범위는
[운영 데이터 모델](operational-data-model.md)을 따른다.

## 10. 엔진과 클라이언트 책임

| 엔진 | 클라이언트 |
|---|---|
| 성취기준과 생성 가능 범위 | 선택 화면과 설명 |
| 결정적 문항·학습지 생성 | seed 입력과 발급 흐름 |
| 정답 제거 learner projection | 학습자 화면 렌더 |
| 정답·rubric 기반 채점 | 답안 입력과 수동 판정 UI |
| fingerprint와 corpus identity | 발급 티켓 보존·export |
| 학습 게이트 정책과 이유 코드 | 추천 표시와 실행 여부 |
| shortfall과 오류 코드 | 회복 행동과 사용자 문구 |
| 승인된 선수 관계 | 보충 학습 시작 여부 |

클라이언트는 엔진 결과를 보기 좋게 바꿀 수 있지만 의미를 강화해서는 안 된다.
`candidate`를 승인으로, 연습 결과를 숙달도로, 한 문항 오답을 학습 결손으로
표현하지 않는다.

## 11. 오류와 회복

| 상태 | 클라이언트 동작 |
|---|---|
| `400` | 잘못된 필드와 허용값을 선택 위치에 표시 |
| `404` | 해당 조건에 생성 가능한 대상이 없음을 설명 |
| `409` shortfall | 가능한 문항 수와 수량 줄이기 동작 제공 |
| `409` fingerprint | 발급 조건이 달라 채점할 수 없다고 중단 |
| `429` | `Retry-After`를 존중하고 중복 요청을 만들지 않음 |
| `500` | 검산·내부 오류로 취급하고 결과를 사용하지 않음 |
| network failure | 입력과 발급 티켓을 보존하고 명시적 재시도 제공 |

오류를 빈 화면, 일반적인 “문제가 발생했습니다” 또는 자동 fallback으로 숨기지
않는다.

## 12. 개인정보와 보안

- `TEACHER_TOKEN`은 host 환경 변수에만 둔다.
- 토큰, 정답본과 상세 피드백을 브라우저 storage에 저장하지 않는다.
- 첫 단계에는 계정, roster, 실명, 이메일과 안정된 학습자 ID가 없다.
- 자유 서술 note와 원시 응답을 장기 저장하지 않는다.
- 로그는 route template, 상태 class, duration과 안정된 오류 코드만 남긴다.
- export 파일에는 포함 필드를 사용자가 저장 전에 확인할 수 있게 한다.
- 학습자본은 엔진에서 받은 projection을 그대로 사용하며 클라이언트가 정답본을
  잘라 만들지 않는다.

## 13. 기술 기준

첫 구현의 기본 선택은 다음과 같다.

- npm workspaces
- React와 strict TypeScript
- Vite 기반 browser build
- Node.js 기반 local host
- JSON Schema runtime validation
- 단위·통합 테스트와 실제 Chromium E2E

구체적인 dependency와 버전은 클라이언트 작업을 시작하는 날 공식 문서와 Node 24
호환성을 확인해 고정한다. 현재 저장소에는 존재하지 않는 `dev`, `build` 또는
클라이언트 명령을 미리 약속하지 않는다.

UI 구현 전 `apps/web/DESIGN.md`를 먼저 작성한다. 기존
`docs/design/design-system.md`와 `tokens.css`를 출발점으로 삼되, 실제 reference
조사, typography, spacing, component state, motion, responsive, A4 print,
접근성 제약과 허용된 debt를 client package의 계약으로 옮긴다.

## 14. 다음 세션 작업 순서

1. 루트 package를 npm workspace root로 확장하고 기존 엔진 명령이 그대로
   동작하는지 확인한다.
2. `apps/web`의 독립 package, 타입 검사, 테스트와 build 경계를 만든다.
3. 디자인 조사 후 `apps/web/DESIGN.md`와 primitive showcase를 먼저 확정한다.
4. local host의 정적 서빙과 teacher·learner proxy 경계를 구현한다.
5. schema validation과 계약 버전 거부를 구현한다.
6. S1 학습지 짜기를 실제 엔진 조회·발급 경로에 연결한다.
7. S2 학습자본·정답본 인쇄와 JSON export를 구현한다.
8. S3 세션 한정 익명 요약과 수동 rubric 흐름을 구현한다.
9. 오류·shortfall·fingerprint mismatch·rate limit 회복을 검증한다.
10. 실제 Chromium과 인쇄 미리보기로 완료 조건을 확인한다.

각 단계는 엔진의 `npm test`, `npm run verify`, `npm run check:artifacts`를 계속
통과해야 한다. 클라이언트 실패를 해결하기 위해 엔진 계약을 조용히 바꾸지 않는다.

## 15. 완료 조건

첫 클라이언트 트랙은 다음을 모두 만족해야 완료다.

1. 루트 엔진과 `apps/web`의 package·테스트 경계가 분리되어 있다.
2. 클라이언트 코드가 엔진 `src/`를 직접 import하지 않는다.
3. 브라우저 bundle, storage와 network payload에 `TEACHER_TOKEN`이 없다.
4. 같은 요청의 교사용·학습자용 학습지 fingerprint가 일치한다.
5. 학습자용 결과에 정답, 풀이, params, `dedupeKey`와 교사용 note가 없다.
6. 수학·국어·영어 학습지를 생성하고 JSON으로 export할 수 있다.
7. 학습지와 정답지를 A4에서 잘림 없이 인쇄할 수 있다.
8. 병렬 form을 발급하고 각 form의 provenance를 보존한다.
9. `400`, `404`, `409`, `429`, `500`과 network failure가 구분된다.
10. 새로고침·재시도 후에도 발급 티켓을 잘못된 조건으로 채점하지 않는다.
11. 이름·계정·장기 이력 없이 S1~S3 흐름이 끝난다.
12. 엔진 전체 검증과 client unit·integration·E2E가 한 번에 통과한다.
13. 375px, 768px, 1280px와 A4 print에서 실제 브라우저 QA를 통과한다.
14. keyboard, focus, reduced motion과 명도 대비 요구를 충족한다.
15. 구현 사실과 남은 debt가 README와 `apps/web/DESIGN.md`에 반영된다.

## 16. 하지 않는 것

- 엔진 생성기나 교육과정 자료를 client 편의를 위해 복제
- 브라우저에서 teacher API 직접 호출
- 첫 단계의 DB, 계정, roster, LMS·SIS·SSO 연동
- 중앙 SaaS, tenant, billing과 기관 운영
- 런타임 LLM·이미지·음성 생성
- 순위, 숙달도, 진단과 장기 추이 dashboard
- 실시간 대전·게임
- S4·S5를 첫 교사 흐름과 동시에 구현
- 관찰 근거 없이 `packages/engine` 또는 `packages/contracts`로 대규모 이동

## 17. 작업 시작 체크리스트

다음 세션은 아래 문서를 순서대로 읽고 시작한다.

1. [`README.md`](../README.md)
2. [`product-brief.md`](product-brief.md)
3. 이 기획서
4. [`client-experience.md`](design/client-experience.md)
5. [`design-system.md`](design/design-system.md)
6. [`operational-data-model.md`](operational-data-model.md)
7. [`schema-versioning.md`](schema-versioning.md)
8. [`schema/`](../schema/)

그리고 현재 엔진 기준선을 먼저 확인한다.

```bash
npm ci
npm test
npm run verify
npm run check:artifacts
```

이 네 명령이 clean 상태에서 통과하지 않으면 모노레포 이동이나 클라이언트 구현을
시작하지 않는다.
