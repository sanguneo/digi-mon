# digi-mon 제품 브리프

> 상태: engine library·CLI·HTTP 구현, client·persistence는 별도 범위
>
> 현재 계약: item `@2`, learning support `@1`, worksheet `@4`, form set `@3`

## 한 문장

digi-mon은 2022 개정 초등 국어·영어·수학 성취기준을 바탕으로 문제, 학습 목표,
단계별 학습지원 metadata와 채점 evidence를 결정적으로 생성하는 자기주도 학습
engine이다.

## 해결할 문제

학습자와 이를 사용하는 client는 다음을 확인할 수 있어야 한다.

- 같은 입력에서 같은 문제를 다시 만들 수 있는가
- 학습자 응답에 정답·생성 parameter·교사용 notes가 없는가
- 무엇을 학습하며 어떤 원리나 전략을 참고할 수 있는가
- 어떤 성취기준과 생성기가 쓰였는가
- 문항·corpus·option 변경을 fingerprint가 탐지하는가
- 객관식으로 바꾸면 안 되는 수행 문항을 정직하게 남기는가
- 표본이 없는데 숙달도나 진단을 꾸며내지 않는가

## 현재 가치 loop

1. client가 교과·학년군·영역·성취기준·mode와 문항 수를 명시한다.
2. engine이 문제와 학습 목표를 생성한다. 지원되는 생성기는 원리·규칙과
   두 단계 hint도 함께 반환한다.
3. client가 hint 공개 시점, session과 학습 이력을 관리한다.
4. seed, options, corpus, fingerprint와 form provenance를 보존한다.
5. 같은 계약으로 제출을 채점하고 response evidence를 받는다.
6. client가 evidence를 다음 게이트 요청에 명시적으로 사용한다.

engine은 화면, 인쇄, 배정, 장기 학습 이력이나 게이트 client를 구현하지 않는다.

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

### 학습지원

- 모든 item은 generator `skill`에서 유도한 학습 목표를 갖는다.
- 지원이 없는 generator는 `objective-only`로 표시하고 hint를 꾸며내지 않는다.
- 사고력 6종과 문해력 12종은 `guided-candidate`로 원리·규칙·전략 자료,
  두 단계 hint, 교사용 관찰점과 개입 제안을 제공한다.
- `guided-candidate`는 저장소 저작 후보라는 뜻이며 외부 교과 승인을 뜻하지 않는다.
- learner projection은 teacher notes를 제거한다.
- 학습지원 내용도 item과 worksheet fingerprint에 결합된다.

### 채점

- 자동 문항은 정답을 비교한다.
- construction·수행 문항은 rubric boolean을 교사가 입력하며 자동 정확도에서 뺀다.
- learner 응답은 제출 원문과 정답 feedback을 기본적으로 돌려주지 않는다.
- response record는 pseudonymous token만 허용하고 engine은 저장하지 않는다.
- 표본이 부족하면 accuracy aggregate를 `null`로 둔다.

## 현재 surface

| surface | 상태 | 계약 |
|---|---|---|
| engine module | 구현 | item 생성, batch 조립, 채점, prerequisite·response evidence |
| CLI | 구현 | 단일 worksheet, 2~8 form, 세 mode, text·JSON·answer key |
| HTTP item·worksheet·grade | 구현 | learner projection, teacher token, fingerprint replay |
| form 발급 HTTP | 미구현 | CLI manifest를 HTTP grading이 재생할 수는 있음 |
| 자기주도 학습 게이트 client | 별도 구현 | engine 계약을 소비하며 session·history·UI를 소유 |
| 교사용 client | 선택적 별도 구현 | 배정·override·수동 평가·개입 근거를 소비 |

## 개인정보와 offline 경계

- 이름, 이메일, 음성, 그림, 자유 서술, 안정 learner ID를 첫 제품 범위에서 받지 않는다.
- 기본 server bind는 `127.0.0.1`이다.
- production dependency와 outbound model call이 없다.
- “offline”은 문제 생성과 채점이 외부 모델·network 호출 없이 가능하다는 뜻이다.
- 기기 sync, 충돌 해결, 중앙 계정, roster나 session 저장을 뜻하지 않는다.

## 하지 않을 것

- learner 요청 시 LLM·이미지·TTS 생성
- mastery·reading level·사고력 점수·진단·예측
- 실명 roster와 장기 learner history
- 검토되지 않은 passage·media의 자동 배포
- client UI, 인쇄 layout, session persistence와 배정 workflow
- marketplace, live game mode, tool-count breadth 경쟁
- adopter evidence 없는 LMS·SIS·SSO 선행 구현
- graph DB, vector DB, event sourcing, microservice 선행 도입

## 다음 engine gate

1. 현재 18개 `guided-candidate`의 교과 검토와 승인 상태를 계약으로 분리한다.
2. 검토된 원리·공식·hint를 다른 generator에 점진적으로 확장한다.
3. 학습 gate 추천은 입력 evidence, policy revision, reason code와 next action을
   반환하는 별도 무상태 계약으로 추가한다.
4. client가 없는 상태에서도 module과 HTTP driver로 모든 계약을 실행·검증할 수 있어야 한다.

실제 학습 history, 화면, DB와 자동 hint 공개 정책은 engine에 넣지 않는다.

## Source of truth

| 질문 | 정본 |
|---|---|
| 설치·실행 방법 | `README.md`, `bin/worksheet.mjs --help` |
| JSON 계약 | `schema/`, `docs/schema-versioning.md` |
| 생성 동작 | `src/engine/`, `src/curriculum/practice-modes.mjs` |
| 학습지원 동작 | `src/curriculum/learning-support.mjs`, `src/curriculum/learning-guides.mjs` |
| corpus 출처 | `PROVENANCE.md`, `NOTICE.md` |
| coverage·검산 | `data/coverage/`, `data/audit/`, `npm run verify` |
| 과거 client 연구 | `docs/research/digi-mon-practical-product.md` |
| 별도 client 참고 설계 | `docs/design/client-experience.md` |
| 운영·자산 migration | `docs/operational-data-model.md`, `docs/offline-asset-platform.md` |

문서와 code가 다르면 현재 실행되는 code와 machine schema가 우선이다. 계약 변경은
schema version, test, README를 같은 commit에서 갱신한다.
