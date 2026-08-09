# digi-mon 실용 제품 울트라리서치 저널

## 범위

- 기준 커밋: `99641e7`
- 시작 시각: 2026-08-09 13:27 UTC
- 연구 질문: 현재 결정적 학습지 엔진을 교사·학습자가 반복 사용할 수 있는 최소
  제품, offline·저장·생성 자산 경계와 차별화 순서
- 출력 형식: Markdown, PDF, DOCX
- 추가 실행 요구: 연구 뒤 문제 pool 또는 차별화 기능을 선택해 실제 코드에 적용
- 제외: `reference/original/` 열람, runtime 생성형 모델, 근거 없는 mastery 주장

## 연구 축

1. 현재 CLI·HTTP·schema·검증 경계
2. 교사와 학습자의 최소 사용 흐름
3. offline-first 자산 공급망
4. SQLite·PostgreSQL·객체 저장소의 단계 선택
5. 개인정보·접근성·관측·보존
6. 유사 제품의 첫 사용·편집·인쇄·재사용 패턴
7. 비용·복잡성·교사 workload 적대 검토
8. 문제 pool과 차별화 후보

## 멀티모델 실행

| lane | model | 결과 | 사용한 판단 |
|---|---|---|---|
| 자산·DB | GPT-5.6 Sol | 완료 | SQLite/CAS에서 PostgreSQL/object storage로 가는 trigger와 자산 상태 계약 |
| 운영 데이터 | GPT-5.6 Sol | 완료 | 발급 payload 보존, 개인정보·보존·관측 경계 |
| 적대 검토 | GPT-5.6 Sol | 완료, 교차 비평 1회 | DB·generation·sync를 파일럿에서 제거하고 단계 모순 수정 |
| 시장 비교 | Claude Opus 5 | 완료 | 첫 사용·인쇄·재사용이 생성 속도보다 큰 제품 gap이라는 판정 |
| 교사·학습자 UX | Claude Opus 5 | 완료 | 다섯 화면 목표 경험과 고대비 print token 계약 |
| 제품 architect | Claude Fable 5 | 3회 실패 | safeguards 오류. 서로 다른 안전한 DB·offline 질문에도 응답하지 않아 제외 |
| 공식 출처 librarian | GPT-5.6 Luna | 실패 | compaction 오류. 공식 출처는 lead가 직접 수집·검증 |

Fable 실패는 내용을 거부한 연구 결과로 해석하지 않았다. 해당 lane은 SQLite와
PostgreSQL 공식 문서, 동일 모델의 별도 GPT lane 두 개와 적대 검토로 대체했다.
동일 모델의 상관된 실패 가능성은 남아 있어 다중 모델 architect 합의로 과장하지
않는다.

## 저장소 증거

- `README.md`, `REVIEW.md`, `PROVENANCE.md`, `package.json`
- `src/engine/worksheet.mjs`, `src/engine/response-log.mjs`
- `src/server/app.mjs`, `src/server/grade.mjs`
- `schema/worksheet.schema.json`, `schema/item.schema.json`
- `docs/asset-procurement.md`
- 기존 `docs/research/digi-mon-next-improvements.md`

확인한 핵심 사실:

- 같은 worksheet 입력은 deterministic fingerprint를 만든다.
- 채점은 worksheet를 재생성하고 fingerprint가 다르면 409로 거부한다.
- 학습자본은 정답·풀이·params·figure spec을 제거한다.
- 수동 문항은 정확도 분모에서 빠지고 rubric boolean을 받는다.
- 응답 집계는 표본 수가 작을 때 정확도를 `null`로 둔다.
- engine은 production dependency가 없고 기본 bind는 `127.0.0.1`이다.
- client, 인쇄, PDF, DOM은 `src/`·`bin/` 경계 밖이어야 한다.

## 외부 증거

- 최종 보고서에 직접 인용한 외부 source: 26
- unique domain: 19
- 우선순위: 공식 표준·정부·제품 원문
- 시장 페이지는 기능·positioning 근거로만 사용하고 효과 검증으로 사용하지 않음
- 가격·기능 snapshot 접근일: 2026-08-09

주요 domain:

- `sqlite.org`, `postgresql.org`, `developer.mozilla.org`, `web.dev`
- `w3.org`, `1edtech.org`, `rfc-editor.org`, `spdx.dev`
- `privacy.go.kr`, `unesco.org`, `nist.gov`, `doi.org`
- `platform.openai.com`
- `support.google.com`
- `magicschool.ai`, `web.diffit.me`, `khanmigo.ai`, `kahoot.com`,
  `mathflat.com`

## claim gate

| claim | 증거 | 판정 |
|---|---|---|
| 생성 속도가 제품 병목이다 | CLI는 20문항 약 0.43초, teacher surface 없음 | 기각 |
| 첫 파일럿에 DB가 필요하다 | 무상태 생성·채점과 file export 가능 | 기각 |
| SQLite가 영구 architecture다 | 동시 writer·multi-host·기관 운영 요구가 migration trigger | 조건부 |
| runtime AI가 차별화다 | determinism·offline·review 경계를 깨고 시장 breadth 경쟁이 심함 | 기각 |
| 자산 공급망이 필요하다 | 지문·음성·매체 gap은 실제이나 첫 pilot의 선행조건은 아님 | 단계 승인 |
| 학생 history가 유용하다 | 교사 행동 변화 증거와 governance 없음 | 보류 |
| print-first가 실용적이다 | 시장 artifact 흐름과 현재 엔진 경계가 일치 | 승인 |
| 병렬 form이 차별화다 | 기존 seed·generator·dedupe 기반을 활용하고 DB·AI 불필요 | 구현 후보 승인 |

## 적대 검토로 바뀐 것

초기 자산·운영 문서는 기술적으로 완결된 durable platform을 먼저 설계했다. 적대
검토가 다음 모순을 확인했다.

- 단일 운영자 pilot인데 여러 review 역할을 필수화했다.
- PostgreSQL을 마지막 단계로 미루면서 Phase 0에 adapter 동등성을 요구했다.
- “summary-only”가 learner·item·standard·시간을 장기 연결해 profile이 될 수 있었다.
- 한 기기 local과 여러 학습자 기기 offline을 같은 말로 사용했다.
- 첫 persistence increment에 roster, assignment, submission, retention, backup,
  CAS, audit를 함께 넣었다.

수정:

- 파일럿을 DB 없는 정적 manifest·교사 export로 축소
- SQLite를 “작업 재열기 실패” 뒤의 로컬 내구성 단계로 이동
- roster·learner history를 기관 단계로 이동
- PostgreSQL adapter를 Phase 0 완료 조건에서 제거
- offline 주장을 “인터넷 없는 한 교사 기기”로 한정
- UX의 S4 기기 연습과 S5 review inbox를 별도 gate로 이동

## EXPAND log

| lead | ENTER trigger | 조사 | EXIT와 반영 |
|---|---|---|---|
| 중앙 DB 필요성 | 최종 architecture를 바꿀 수 있음 | SQLite·WAL·PostgreSQL 공식 문서와 두 설계 lane | multi-host·writer·기관 요구 전까지 SQLite도 보류 |
| 생성 이미지 | 사용자가 명시한 제품 축 | provider 문서, NIST·UNESCO, asset lane | licensed static asset 우선, 별도 evidence gate |
| 상호운용 | adoption blocker 가능성 | CASE·QTI·OneRoster·Classroom | export 우선, 여러 확약 adopter 뒤 한 adapter |
| 교사 workload | 제품 value를 바꿀 수 있음 | 시장 product flow와 RAND 제한적 참고 | door-to-door teacher minutes를 pilot gate로 추가 |
| 문제 pool | 사용자 후속 steering | 현재 generator·capacity·dedupe와 시장 breadth 비교 | 병렬 form·provenance를 구현 우선으로 선택 |

추가 lead는 최종 권고를 바꾸지 않거나 이미 한 축이 소유해 종료했다. 한국 공교육
전반의 현재 가격·조달 데이터와 독립 classroom outcome 연구는 이번 범위에서
충분히 확보하지 못했다. 따라서 가격과 학습 효과를 결론으로 제시하지 않는다.

## 산출물

- `docs/research/digi-mon-practical-product.md`
- `docs/research/digi-mon-practical-product.pdf`
- `docs/research/digi-mon-practical-product.docx`
- `docs/design/client-experience.md`
- `docs/design/design-system.md`
- `docs/design/tokens.css`
- `docs/offline-asset-platform.md`
- `docs/operational-data-model.md`

## 검증 결과

- changed Markdown 8개: `markdownlint-cli2` 0 issue
- 최종 보고서 외부 link: 26/26 통과
- `npm run verify`: exit 0
- PDF: 13 page, EOF 확인, 433,170 bytes
- DOCX: ZIP entry 16개, `word/document.xml` 확인
- CSS language-server diagnostics: 0
- PDF 대표 5 page raster: Korean glyph·contrast 독립 QA 통과
- 첫 layout QA에서 Hangul 낱자 분리와 footer 여백을 발견해 renderer에
  `word-break: keep-all`, `overflow-wrap: break-word`, footer +4mm를 적용했다.
- 최종 layout regression 재검토: PASS. 중간 Hangul 분리 0건, table 고립 음절
  0건, footer-to-trim 9.9mm, clipping·overflow 0건

## 최종 artifact SHA-256

| 파일 | SHA-256 |
|---|---|
| `digi-mon-practical-product.md` | `9e851236be5a33c063eef7d111c07b7b2d92b7f58109ac3166217c53d3b40137` |
| `digi-mon-practical-product.pdf` | `890c261f7877663b9c2f0d4d87a0c02498c1ccfbcb1d9d45c8d7b260c526a708` |
| `digi-mon-practical-product.docx` | `96eb27f276eb864d69b79c40a582819358ad051778e77f4993e117b93f6304e8` |

## 남은 실행

- 연구 산출물 commit·push
- 후속 차별화 기능 test-first 구현과 real CLI/API QA
