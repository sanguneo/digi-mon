# digi-mon 제품 브리프

> 상태: engine·CLI·HTTP 구현, 교사 client 미구현
>
> 현재 계약: worksheet `@3`, form set `@2`, mode selection `@1`

## 한 문장

digi-mon은 2022 개정 초등 국어·영어·수학 성취기준을 바탕으로, 인터넷이나
runtime 모델 호출 없이 재발급 가능한 학습지와 정답·채점 계약을 만드는 결정적
engine이다.

## 해결할 문제

교사는 학습지를 빠르게 만드는 것뿐 아니라 다음을 확인할 수 있어야 한다.

- 같은 발급본을 다시 인쇄할 수 있는가
- 학생용 자료에 정답과 생성 parameter가 없는가
- 어떤 성취기준과 생성기가 쓰였는가
- 문항·corpus·option 변경을 fingerprint가 탐지하는가
- 객관식으로 바꾸면 안 되는 수행 문항을 정직하게 남기는가
- 표본이 없는데 숙달도나 진단을 꾸며내지 않는가

## 현재 가치 loop

1. 교과·학년군·영역·성취기준·문항 수를 고른다.
2. 하나의 worksheet 또는 동일 blueprint의 A/B/C form을 생성한다.
3. 학생용 text와 교사용 answer key를 인쇄하거나 JSON으로 내보낸다.
4. seed, options, corpus, fingerprint와 form provenance를 보존한다.
5. 같은 계약으로 제출을 채점한다. 불일치하면 409로 거부한다.

현재 loop는 CLI와 HTTP engine에서 동작한다. 교사가 설치 지식 없이 사용하는
print-first web client는 다음 제품 surface이며 아직 구현되지 않았다.

## 지원 기능

### 결정적 발급

- 같은 corpus·option·seed는 같은 worksheet fingerprint를 만든다.
- 병렬 form은 같은 standard·generator·difficulty blueprint를 공유한다.
- form 전체에서 `dedupeKey`가 겹치지 않는다.
- 고유 pool이 부족하면 낮은 품질 문항이나 중복으로 채우지 않고 실패한다.
- 각 form의 provenance로 B형 이후도 `/v1/grade`에서 재생성·검증할 수 있다.

### 검토된 연습 mode

`--modes`는 comma로 조합하며 모든 mode를 동시에 만족하는 생성기만 남긴다.

| mode | observable contract | 말하지 않는 것 |
|---|---|---|
| `advanced` | generator가 선언한 difficulty 3을 정확히 생성 | 영재, 상위권, 숙달, 배치 |
| `thinking-skills-v1` | 검토된 규칙·순서·근거 과제 6종 | 일반 사고력, 창의성, 전이 |
| `literacy-foundations` | 검토된 국어·영어 문자·문장 부호 기초 12종 | 읽기 수준, 결손, 독해 진단 |

각 mode는 revision과 claim boundary를 `modeSelection`에 기록한다. 조건의 교집합이
비면 일반 문항으로 fallback하지 않는다.

### 채점

- 자동 문항은 정답을 비교한다.
- construction·수행 문항은 rubric boolean을 교사가 입력하며 자동 정확도에서 뺀다.
- learner 응답은 제출 원문과 정답 feedback을 기본적으로 돌려주지 않는다.
- response record는 pseudonymous token만 허용하고 engine은 저장하지 않는다.
- 표본이 부족하면 accuracy aggregate를 `null`로 둔다.

## 현재 surface

| surface | 상태 | 계약 |
|---|---|---|
| CLI | 구현 | 단일 worksheet, 2~8 form, 세 mode, text·JSON·answer key |
| HTTP worksheet·grade | 구현 | learner projection, teacher token, fingerprint replay |
| form 발급 HTTP | 미구현 | CLI manifest를 HTTP grading이 재생할 수는 있음 |
| 교사 web client | 미구현 | `design/client-experience.md`가 목표 계약 |
| 학생 기기 session | 보류 | 종이 흐름으로 해결되지 않는 요구와 privacy 승인 뒤 |

## 개인정보와 offline 경계

- 이름, 이메일, 음성, 그림, 자유 서술, 안정 learner ID를 첫 제품 범위에서 받지 않는다.
- 기본 server bind는 `127.0.0.1`이다.
- production dependency와 outbound model call이 없다.
- “offline”은 인터넷 없이 한 교사 기기에서 생성·인쇄·채점 가능하다는 뜻이다.
- 여러 학생 기기 sync, 충돌 해결, 중앙 계정이나 roster를 뜻하지 않는다.

## 하지 않을 것

- learner 요청 시 LLM·이미지·TTS 생성
- mastery·reading level·사고력 점수·진단·예측
- 실명 roster와 장기 learner history
- 검토되지 않은 passage·media의 자동 배포
- marketplace, live game mode, tool-count breadth 경쟁
- adopter evidence 없는 LMS·SIS·SSO 선행 구현
- graph DB, vector DB, event sourcing, microservice 선행 도입

## 다음 제품 gate

다음 큰 구현은 새 engine mode가 아니라 로컬 print-first 교사 client다.

| gate | 목표 |
|---|---|
| 첫 인쇄 | 교사 5명 관찰 중앙값 3분 이하 |
| 동일본 | 같은 입력의 fingerprint 일치 100% |
| print | 잘림·정답 노출·미해결 visual item 0건 |
| workload | 준비·채점의 교사 순시간 감소 |
| repeat use | 5명 중 3명 이상이 4주 안에 자발적 두 번째 사용 |
| privacy | 이름·원시 답안의 engine 지속 저장 0건 |

gate를 통과하기 전에는 DB, 생성 media, analytics, integration을 추가하지 않는다.

## Source of truth

| 질문 | 정본 |
|---|---|
| 설치·실행 방법 | `README.md`, `bin/worksheet.mjs --help` |
| JSON 계약 | `schema/`, `docs/schema-versioning.md` |
| 생성 동작 | `src/engine/`, `src/curriculum/practice-modes.mjs` |
| corpus 출처 | `PROVENANCE.md`, `NOTICE.md` |
| coverage·검산 | `data/coverage/`, `data/audit/`, `npm run verify` |
| 제품 순서의 근거 | `docs/research/digi-mon-practical-product.md` |
| 목표 client 경험 | `docs/design/client-experience.md` |
| 운영·자산 migration | `docs/operational-data-model.md`, `docs/offline-asset-platform.md` |

문서와 code가 다르면 현재 실행되는 code와 machine schema가 우선이다. 계약 변경은
schema version, test, README를 같은 commit에서 갱신한다.
