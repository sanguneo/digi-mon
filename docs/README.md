# digi-mon 문서 안내

이 디렉터리는 현재 제품 계약, 설계 결정, 운영 경계와 연구 근거를 분리한다.
구현 사실은 코드·schema·생성 audit가 우선하며, 연구 문서는 미래 기능의 현재
구현을 뜻하지 않는다.

## 먼저 읽기

1. [제품 브리프](product-brief.md) - 현재 가치 loop, 지원 surface, mode와 non-goal
2. [루트 README](../README.md) - 설치, CLI, HTTP 빠른 시작
3. [실용 제품 울트라리서치](research/digi-mon-practical-product.md) - 왜 이 순서인지에 대한 근거
4. [상세 품질 현황](../REVIEW.md) - 생성기·커버리지·검증의 현재 수치

## 제품과 경험

| 문서 | 역할 | 구현 상태 |
|---|---|---|
| [제품 브리프](product-brief.md) | 현재 scope와 결정 원장 | 현재 |
| [교사·학습자 경험](design/client-experience.md) | 목표 화면과 접근성 계약 | 설계, client 미구현 |
| [디자인 시스템](design/design-system.md) | 색·글꼴·component 원칙 | 설계 |
| [디자인 token](design/tokens.css) | client용 CSS 변수 | 설계 |

## 데이터 계약

| 문서 | source of truth |
|---|---|
| [Schema versioning](schema-versioning.md) | 계약 버전과 fingerprint 정책 |
| [`schema/`](../schema/) | machine-readable JSON Schema |
| [Provenance](../PROVENANCE.md) | 온톨로지·corpus pin과 출처 |
| [Notice](../NOTICE.md) | 제3자 고지와 공개 전 확인 |

현재 worksheet는 `digi-mon/worksheet@3`, 병렬 form set은
`digi-mon/worksheet-form-set@2`다. 발급 당시 JSON, seed, options, fingerprint와
corpus identity를 함께 보존한다.

## 운영과 자산

| 문서 | 현재 결정 |
|---|---|
| [자산 조달](asset-procurement.md) | 승인된 immutable asset만 learner runtime에 제공 |
| [오프라인 자산 플랫폼](offline-asset-platform.md) | 미래 asset 공급망과 migration trigger |
| [운영 데이터 모델](operational-data-model.md) | persistence·retention·observability 단계 |

첫 파일럿은 DB·roster·runtime 생성 모델 없이 교사 소유 export와 한 기기 local
흐름을 우선한다. 위 두 architecture 문서는 단계별 trigger를 정의하며 첫 파일럿의
필수 구현 목록이 아니다.

## 품질과 감사

- [`data/audit/`](../data/audit/) - 생성기 검산, mutation, 난이도, vocabulary,
  capacity와 자산 요구의 machine output
- [`data/coverage/coverage.json`](../data/coverage/coverage.json) - 현재 coverage 원장
- [`docs/review/`](review/) - 교과·자산·선수 관계 사람이 읽는 요약
- [`npm run verify`](../package.json) - 위 산출물 freshness와 전체 검증

`coveredStandards`는 생성기 연결 여부다. `semanticCoverage`와
`assessmentMappings.reviewStatus`는 별도 계약이며 candidate를 approved로
간주하지 않는다.

## 연구와 의사결정 기록

- [다음 개선 연구](research/digi-mon-next-improvements.md)
- [실용 제품 연구](research/digi-mon-practical-product.md)
- [실용 제품 연구 저널](research/digi-mon-practical-product-journal.md)

PDF와 DOCX는 같은 이름의 Markdown 보고서를 배포용으로 렌더한 산출물이다.
내용을 고칠 때는 Markdown을 먼저 변경하고 다시 렌더·시각 검수한다.

## 문서 변경 규칙

1. 현재 동작을 바꾸면 README, schema와 관련 test를 같은 변경에서 갱신한다.
2. 수치 주장은 생성 audit 또는 실행한 command를 가리킨다.
3. 미래 설계는 “현재”, “trigger 뒤”, “하지 않음”을 구분한다.
4. learner 수준·숙달·진단·예측은 타당화된 근거 없이 문서나 UI에 쓰지 않는다.
5. 새 문서는 이 index에 한 번만 연결하고 중복된 roadmap을 만들지 않는다.
