# 데이터 계약과 버전 정책

## 계약 목록

| 계약 | 현재 버전 | 스키마 |
|---|---|---|
| canonical item | `digi-mon/item@2` | `schema/item.schema.json` |
| learning support | `digi-mon/learning-support@1` | `schema/learning-support.schema.json` |
| worksheet | `digi-mon/worksheet@5` | `schema/worksheet.schema.json` |
| worksheet form set | `digi-mon/worksheet-form-set@4` | `schema/worksheet-form-set.schema.json` |
| mode selection | `digi-mon/mode-selection@1` | worksheet schema 내부 |
| grading result | `digi-mon/grading-result@1` | `schema/grading-result.schema.json` |
| learning gate request | `digi-mon/learning-gate-request@1` | `schema/learning-gate-request.schema.json` |
| learning gate recommendation | `digi-mon/learning-gate-recommendation@1` | `schema/learning-gate-recommendation.schema.json` |
| spine | 스키마의 `const` 참조 | `schema/spine.schema.json` |
| coverage | `digi-mon/coverage@2` | `schema/coverage.schema.json` |
| generator-topic alignment | `digi-mon/generator-topic-alignment@1` | `schema/generator-topic-alignment.schema.json` |
| repository corpus pin | `digi-mon/corpus-pin@1` | `schema/corpus-pin.schema.json` |

## 변경 규칙

- 필수 필드 추가·삭제, 필드 의미 변경, enum 축소, fingerprint 입력 변경은 주 버전을 올린다.
- 선택 필드 추가와 설명 보강은 같은 주 버전에서 허용한다.
- 과거 버전을 읽는 호환 shim은 실제 저장된 산출물 소비자가 있을 때만 둔다.
- 스키마 문자열과 JSON Schema를 같은 변경에서 갱신한다.
- 버전 변경 시 README, API 예시, 회귀 테스트, 생성 산출물을 함께 갱신한다.

## 학습지 fingerprint

`digi-mon/worksheet@5` fingerprint는 다음을 결합한다.

- 스키마·엔진 버전
- seed
- 정규화된 생성 옵션
- 이미 노출된 문항을 제외하는 정규화된 `excludeItemIds`
- revision이 포함된 mode selection
- 순서가 포함된 문항 전체 내용과 `learningSupport`
- 내부 코퍼스 스키마와 스파인·공식 별책 파일 해시

채점은 같은 입력으로 재생성한 fingerprint가 발급된 값과 일치할 때만 수행한다.
생성기·코퍼스·옵션이 달라지면 409로 거부한다.

`excludeItemIds`는 learner projection에 이미 포함된 안정적인 `item.id`만 받는다.
내부 생성 parameter를 포함하는 `dedupeKey`는 새로 공개하지 않는다. exclusion
목록도 재생성 계약이므로 발급과 채점에서 같아야 한다.

## 무상태 학습 게이트

`learning-gate-request@1`은 `policyRevision=1`, 대상 성취기준과 명시적 evidence를
받는다. evidence는 단일 `grading-result` 요약 또는 호출자가 보존한
`responseRecords`다. 엔진은 learner history를 읽거나 저장하지 않는다.

`learning-gate-recommendation@1`은 다음을 반환한다.

- `practice`, `remediate`, `advance`, `await-manual-review` 중 한 decision
- 판단을 재현할 수 있는 policy threshold와 `reasonCodes`
- 별도 client가 호출할 worksheet·remediation·수동 검토 next action
- 사용한 evidence의 비식별 집계

누적 response record는 기존 accuracy 계약과 같은 성취기준별 30개 표본 경계를
쓴다. 표본이 부족하면 진단이나 숙달을 만들지 않고 `insufficient-evidence`로
동일 범위 연습을 제안한다.

## 학습지원

`learning-support@1`은 모든 item에 필수다.

- `objective-only`: generator가 선언한 학습 목표만 제공한다.
- `guided-candidate`: 저장소 저작 원리·규칙·전략, 두 단계 hint와 교사용
  관찰·개입 후보를 제공한다.

`candidate`를 전문가 승인으로 해석하지 않는다. learner projection은 `teacher`를
제거하지만 objective, materials와 hints는 유지한다. 학습지원 내용이나 review
revision이 바뀌면 item 내용과 worksheet fingerprint도 바뀐다.

## 내부 코퍼스 핀 변경 절차

1. 공식 별책 또는 내부 스파인을 바꾸는 근거를 기록한다.
2. 성취기준 코드·교과·학년군·자료 구조 검증을 통과시킨다.
3. 공식 별책에서 추출한 248개 코드와 내부 스파인이 정확히 같은지 확인한다.
4. `src/ontology/corpus-pin.mjs`의 개정과 네 파일 해시를 의도적으로 변경한다.
5. 의미 정렬·선수 관계·커버리지 변화와 역사적 데이터 계보를 사람이 검토한다.
6. 관련 스키마, 시험과 문서를 함께 갱신한다.
7. `npm test`, `npm run verify`, 산출물 최신성 검사를 통과시킨다.

파일이 함께 바뀌었다는 이유만으로 새 해시를 자동 승인하지 않는다.

## 의미 커버리지

표준 코드에 생성기가 있다는 사실과 세부 학습 주제를 평가한다는 사실을 분리한다.

- `coverageRatio`: 자동 채점 가능 표준 중 생성기가 연결된 비율
- `semanticCoverage`: `assessmentMappings`로 명시된 `assesses` topic 비율

명시 정렬이 없으면 0으로 보고하며 표준 아래 모든 topic을 자동 상속하지 않는다. 새 정렬은 topic ID, confidence, note와 검토 근거를 포함해야 한다.

검토 완료 생성기 집합은 `src/curriculum/generator-reviews.mjs`의 개수와 생성기
계약·전체 수학 소스 파일 지문을 모두 만족할 때만 승인된다. 집합이나 구현이
달라지면 새 생성기를 묵시적으로 승인하지 않고 전체 집합이 후보 상태로 되돌아간다.

## 수동 수행평가

`grading-result@1`의 기존 필드 의미는 유지한다. 선택 필드 `manualEvaluation`과
수동 문항별 `evaluation`은 교사 제출 루브릭의 기준 충족 수와 충족 비율을 제공한다.
자동 문항의 `graded`, `correct`, `accuracy`에는 합치지 않는다.

요청의 `manualEvaluations`는 기존 루브릭과 같은 길이의 불리언 배열만 받는다.
자유 서술·학습자 식별자·증거 본문은 저장하지 않으며 교사 인증과 worksheet
fingerprint 검증을 모두 통과해야 한다.

## 폐기

삭제된 generator ID, topic 정렬, 자산 ID가 외부 산출물에 사용됐다면 tombstone과 마지막 지원 버전을 기록한다. 이미 발급된 학습지의 fingerprint와 원본 코퍼스 정보는 삭제하지 않는다.
