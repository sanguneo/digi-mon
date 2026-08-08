# 데이터 계약과 버전 정책

## 계약 목록

| 계약 | 현재 버전 | 스키마 |
|---|---|---|
| canonical item | `digi-mon/item@1` | `schema/item.schema.json` |
| worksheet | `digi-mon/worksheet@2` | `schema/worksheet.schema.json` |
| grading result | `digi-mon/grading-result@1` | `schema/grading-result.schema.json` |
| spine | 스키마의 `const` 참조 | `schema/spine.schema.json` |
| coverage | `digi-mon/coverage@2` | `schema/coverage.schema.json` |
| generator-topic alignment | `digi-mon/generator-topic-alignment@1` | `schema/generator-topic-alignment.schema.json` |
| ontology pin | 핀 객체 계약 | `schema/ontology-pin.schema.json` |

## 변경 규칙

- 필수 필드 추가·삭제, 필드 의미 변경, enum 축소, fingerprint 입력 변경은 주 버전을 올린다.
- 선택 필드 추가와 설명 보강은 같은 주 버전에서 허용한다.
- 과거 버전을 읽는 호환 shim은 실제 저장된 산출물 소비자가 있을 때만 둔다.
- 스키마 문자열과 JSON Schema를 같은 변경에서 갱신한다.
- 버전 변경 시 README, API 예시, 회귀 테스트, 생성 산출물을 함께 갱신한다.

## 학습지 fingerprint

`digi-mon/worksheet@2` fingerprint는 다음을 결합한다.

- 스키마·엔진 버전
- seed
- 정규화된 생성 옵션
- 순서가 포함된 문항 ID 목록
- 온톨로지 taxonomy 버전과 입력 파일 해시

채점은 같은 입력으로 재생성한 fingerprint가 발급된 값과 일치할 때만 수행한다. 생성기·온톨로지·옵션이 달라지면 409로 거부한다.

## 업스트림 핀 변경 절차

1. 참고 프로젝트의 manifest, taxonomy 버전, 네 파일 해시를 확인한다.
2. JSON shape·count·교차 참조 검증을 통과시킨다.
3. `src/ontology/pin.mjs`를 의도적으로 변경한다.
4. 스파인·커버리지·감사·리뷰 산출물을 재생성한다.
5. 의미 정렬·선수 관계·coverage gap 변화를 사람이 검토한다.
6. `npm test`, `npm run verify`, 아티팩트 freshness 검사를 통과시킨다.

manifest와 데이터가 함께 바뀌었다는 이유만으로 자동 승인하지 않는다.

## 의미 커버리지

표준 코드에 생성기가 있다는 사실과 세부 학습 주제를 평가한다는 사실을 분리한다.

- `coverageRatio`: 자동 채점 가능 표준 중 생성기가 연결된 비율
- `semanticCoverage`: `assessmentMappings`로 명시된 `assesses` topic 비율

명시 정렬이 없으면 0으로 보고하며 표준 아래 모든 topic을 자동 상속하지 않는다. 새 정렬은 topic ID, confidence, note와 검토 근거를 포함해야 한다.

검토 완료 생성기 집합은 `src/curriculum/generator-reviews.mjs`의 개수와 ID 지문을
모두 만족할 때만 승인된다. 집합이 달라지면 새 생성기를 묵시적으로 승인하지 않고
전체 집합이 후보 상태로 되돌아간다.

## 수동 수행평가

`grading-result@1`의 기존 필드 의미는 유지한다. 선택 필드 `manualEvaluation`과
수동 문항별 `evaluation`은 교사 제출 루브릭의 기준 충족 수와 충족 비율을 제공한다.
자동 문항의 `graded`, `correct`, `accuracy`에는 합치지 않는다.

요청의 `manualEvaluations`는 기존 루브릭과 같은 길이의 불리언 배열만 받는다.
자유 서술·학습자 식별자·증거 본문은 저장하지 않으며 교사 인증과 worksheet
fingerprint 검증을 모두 통과해야 한다.

## 폐기

삭제된 generator ID, topic 정렬, 자산 ID가 외부 산출물에 사용됐다면 tombstone과 마지막 지원 버전을 기록한다. 이미 발급된 학습지의 fingerprint와 원본 코퍼스 정보는 삭제하지 않는다.
