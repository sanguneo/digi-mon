# 출처와 파생 관계 (PROVENANCE)

이 문서는 digi-mon 데이터가 어디서 왔고, 무엇이 파생이며, 권리 상태가 어떤지 기록한다.
게이트가 재생성하는 수치·목록은 옮겨 적지 않는다. 같은 정보를 두 곳에 두면 한쪽이 낡는다.

## 1. 업스트림: Korean Elementary Learning Map

- 저장소: [github.com/DECK6/korean-elementary-learning-map](https://github.com/DECK6/korean-elementary-learning-map)
  (저작자 DECK, github.com/DECK6)
- 사용 버전: taxonomy `kr-full-depth-v0.4`, 데이터 생성 시각 2026-07-09T00:00:00+09:00
- 확인한 체크아웃: 커밋 `3ef0563084aa2a9baaa47da2c1ec0ebf5d7edc5c` (main, 2026-07-17,
  원격 HEAD와 일치함을 2026-08-05에 확인)
- 소비 파일: 업스트림 `data/kr/`의 `curriculum-standards.json` · `topics.json` ·
  `dependencies.json` · `clusters.json`
- 위치 해석: `KELM_DIR` 환경변수, 없으면 형제 디렉터리
  `../korean-elementary-learning-map` (`src/ontology/source.mjs`)
- 무결성: 업스트림 `data/kr/manifest.json`의 SHA-256과 대조한다. Windows 체크아웃이
  CRLF라서 LF 정규화 후 해시한다. 대조 결과는 `data/spine/standards.json`의
  `upstream.integrity`에 기록되고, 어긋나면 `loadOntology`가 즉시 실패한다.
- 사용 방식: 읽기 전용. 업스트림 원본 파일을 이 저장소에 담거나(vendoring) 재배포하지 않는다.

## 2. 파생 산출물 (업스트림에서 재생성됨)

`npm run verify`가 아래를 업스트림 데이터에서 다시 만든다. 손으로 고치면 안 되고,
고쳐도 다음 실행이 덮어쓴다.

- `data/spine/standards.json` : 3교과(국어·수학·영어) 성취기준 스파인
- `data/coverage/coverage.json` : 자동채점 커버리지
- `data/curriculum/prerequisites.json` : 선수 관계 검증 결과 (간선 자체는
  `src/curriculum/prerequisites.mjs`에 이 저장소가 저작했고, 성취기준 정보는 업스트림에서 온다)
- `data/audit/*.json` : 게이트 실행 결과
- `docs/review/*.md` : 검토표 (export 도구가 재생성)

## 3. 저장소 저작 산출물 (업스트림에서 오지 않음)

- `src/`·`bin/`·`tools/`의 코드 전부. 문항 생성기, 채점·검산 로직, 게이트
- 사실 표의 문장·낱말. `docs/review/assets.md`에 명시된 대로 전부 이 저장소가 지었다
- 문장·어휘 시드 목록. 공식 자료가 아니며 2022 개정 별표로 교체할 자리다
- 문서 (`REVIEW.md`, `docs/`의 계획·규칙 문서)

## 4. 릴리스 차단 검증 항목: 업스트림 라이선스 메타데이터 충돌 (미해결)

업스트림 저장소 안에서 라이선스 선언이 서로 다르다. 2026-08-05, 로컬 체크아웃
커밋 `3ef0563`에서 실측한 내용이다.

| 파일 | 선언 |
|---|---|
| `package.json` | `"license": "(ODbL-1.0 AND CC-BY-SA-4.0)"` |
| `LICENSE` | MIT 전문 (Copyright (c) 2026 DECK) |
| `NOTICE.md` | "distributed under the MIT License" |
| `CITATION.cff` | `license: MIT`. 다만 참고문헌 노트에 재사용·개작된 업스트림 구조 요소는 ODbL 1.0, 업스트림 저작 콘텐츠는 CC BY-SA 4.0을 따른다는 단서가 있다 |

### 왜 릴리스를 막는가

업스트림 데이터가 실제로 ODbL-1.0·CC-BY-SA-4.0이라면, 그 데이터에서 파생된 이 저장소의
산출물(§2)에 동일조건변경허락과 저작자 표시 의무가 붙을 수 있다. 그 경우 파생 데이터를
MIT로 배포하는 것은 오표시가 된다. 코드(§3)는 영향이 없지만, 데이터 산출물의 배포
조건이 달라진다.

### 해소 절차

1. 업스트림(DECK6)에 이슈를 열어 `package.json`과 법률 파일(`LICENSE`·`NOTICE.md`·
   `CITATION.cff`) 중 어느 선언이 맞는지 서면 확인을 받는다.
2. MIT가 맞으면: 업스트림 정정 커밋을 근거로 이 절을 해소 처리하고 확인 이력에 남긴다.
3. ODbL·CC-BY-SA가 맞으면: §2 산출물에 해당 라이선스를 표시하고, README와 NOTICE의
   배포 조건을 다시 쓴다.
4. 해소 전까지: 공개 릴리스, 파생 데이터 재배포, 파생 데이터를 포함한 패키징을 하지 않는다.

이 문서는 충돌을 기록할 뿐 해소하지 않는다. 어딘가에 "해결됨"이라고 적혀 있다면 그쪽이 틀렸다.

### 확인 이력

| 날짜 | 확인 주체 | 대상 | 결과 |
|---|---|---|---|
| 2026-08-05 | 문서화 작업(자동화 에이전트) | 로컬 체크아웃 `3ef0563` (원격 HEAD 일치 확인) | 충돌 존재. 미해결 |

## 5. 보존해야 할 표시

이 저장소나 파생 산출물을 이용할 때 다음을 보존한다.

- 업스트림 저작자 표시: Korean Elementary Learning Map, DECK (github.com/DECK6), 사용 버전
- 업스트림이 밝힌 영감 표시: Marble Skill Taxonomy (Generative Spark, Inc.)
- 공식 교육과정 자료 표시: 교육부 고시·별책 식별, NCIC 명칭, 직접 출처 URL과 접근일
  (업스트림 `PROVENANCE.md`의 요구)
- 비보증: 교육부·국가교육위원회·NCIC 공식 간행물이 아니며, DECK6은 digi-mon을 보증하지 않는다

## 6. 직접 검토한 교육과정과 영어 어휘

2026-08-06에 교육부 고시 제2022-33호의 국어·수학·영어 Markdown을 직접
검토했다. 원본 파일이 있는 `reference/original/`은 자동 검토에서 열지 않았다.

- 공식 고시:
  [NCIC 2022 개정 초·중등학교 교육과정 고시 안내](https://ncic.go.kr/board/B0033.cs?act=read&bwrId=2105&pageIndex=2&pageUnit=15)
- 검토 파일: `reference/[별책5] 국어과 교육과정.md`,
  `reference/[별책8] 수학과 교육과정.md`,
  `reference/[별책14] 영어과 교육과정.md`
- 접근일: 2026-08-06

영어 `[별표 3]`의 공식 초등 권장 대표 표제어 800개와 병합 후보 1,252개의
파일 해시는 `data/curriculum/english-official-vocabulary.json`에 기록한다.
제공된 두 보조 PDF는 공개 이용 가능하다는 프로젝트 소유자의 확인을 근거로
표제어 후보만 사용하며 PDF 자체와 편집 레이아웃은 재배포하지 않는다. 자세한
판정 경계는 `docs/assets/english-vocabulary-provenance.md`에 있다.
