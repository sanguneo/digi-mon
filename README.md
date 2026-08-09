# digi-mon

2022 개정 초등 교육과정의 **국어·영어·수학** 성취기준을 바탕으로 결정적 학습지를 생성하고 채점하는 엔진이다. 같은 온톨로지 릴리스, 옵션, seed에서는 같은 문항과 같은 `fingerprint`를 만든다.

이 저장소는 교육부·국가교육위원회·NCIC의 공식 제품이 아니며 학습자를 진단하는 의료·심리 도구가 아니다.

## 현재 범위

- 기준 온톨로지: `DECK6/korean-elementary-learning-map`, `kr-full-depth-v0.4`
- 대상: 초등 국어·영어·수학
- 표준 코드 커버리지와 명시적 주제 평가 커버리지를 분리해 보고한다.
- 자동 채점이 부적절한 작도·태도·수행 기준은 별도 목록으로 남긴다.
- 지문·음성·매체 등 미조달 자산은 `docs/asset-procurement.md`에서 관리한다.

최신 수치는 `data/coverage/coverage.json`과 `npm run verify` 결과가 기준이다. `coveredStandards`는 생성기 연결 여부이고, `semanticCoverage`는 생성기가 명시적으로 `assesses` 주제에 연결된 경우만 센다.
성취기준 코드에서 유도한 정렬은 `candidate`로 별도 보고하며 전문가 승인 전에는 의미 커버리지로 세지 않는다.

## 요구 사항

- Node.js 24 권장, 최소 Node.js 20
- 참고 온톨로지 프로젝트

기본적으로 두 프로젝트가 같은 상위 디렉터리에 있다고 가정한다.

```text
WebstormProjects/
  digi-mon/
  korean-elementary-learning-map/
```

다른 위치라면 `KELM_DIR`에 참고 프로젝트 경로를 지정한다. 로더는 taxonomy 버전과 네 입력 파일의 고정 SHA-256을 검증하며, 임의로 다시 만든 manifest는 신뢰하지 않는다.

## 설치와 검증

```bash
npm ci
npm test
npm run verify
```

`npm test`는 `test/**/*.test.mjs`만 실행한다. `npm run verify`는 생성기 검산, 뮤테이션, 어휘, 난이도, 용량, 선수 그래프, 자산 요구와 리뷰 산출물을 검사한다.

## CLI

```bash
node bin/worksheet.mjs --help
node bin/worksheet.mjs --subject math --count 10 --seed class-a
node bin/worksheet.mjs --subject math --count 10 --seed class-a --forms 3
node bin/worksheet.mjs --subject math --grade 1-2 --modes thinking-skills-v1 --count 6 --seed think-a
node bin/worksheet.mjs --subject korean --grade 1-2 --modes literacy-foundations --count 6 --seed literacy-a
node bin/worksheet.mjs --subject math --grade 3-4 --modes advanced --count 10 --seed advanced-a
node bin/worksheet.mjs --subject korean --grade 3-4 --count 8 --seed reading-1
node bin/worksheet.mjs --subject english --difficulty 1 --count 8 --seed english-1
```

출력 파일명에는 학습지 fingerprint 일부가 포함되므로 같은 과목·seed라도 옵션이 다르면 서로 덮어쓰지 않는다. 잘못된 count, difficulty, subject, grade 또는 알 수 없는 옵션은 파일을 쓰지 않고 실패한다.

`--forms 2..8`은 같은 성취기준·생성기·난이도 blueprint를 공유하면서 문항은 겹치지
않는 A/B/C 병렬 form을 만든다. 각 form의 JSON·학습자본·정답지와 전체
`worksheet-form-set@1` manifest를 함께 쓰며, 고유 문항 pool이 부족하면 중복으로
채우지 않고 실패한다.

`--modes`는 comma로 조합하며 모든 조건을 동시에 만족하는 생성기만 사용한다.
`advanced`는 생성기가 선언한 난이도 3 변형, `thinking-skills-v1`은 검토된
규칙·순서·근거 과제 6종, `literacy-foundations`는 검토된 국어·영어 문자·문장
부호 기초 과제 12종만 허용한다. 일반 사고력·읽기 수준·숙달·진단을 뜻하지 않으며
조건을 만족하는 pool이 없으면 일반 문항으로 대체하지 않고 실패한다.

## HTTP API

```bash
TEACHER_TOKEN='replace-with-a-secret' npm run serve
```

기본 주소는 `127.0.0.1:8787`이다. 외부 공개가 필요할 때만 `HOST`를 명시한다. 요청 크기·요청률·헤더·본문 시간 제한이 적용된다.

주요 흐름:

1. `POST /v1/worksheets`로 학습자용 학습지를 받는다.
2. 응답의 `fingerprint`, `seed`, `options`를 보존한다.
3. `POST /v1/grade`에 같은 옵션과 fingerprint, `responses`를 보낸다.
4. 옵션·코퍼스·문항이 달라 fingerprint가 바뀌면 409로 거부된다.

학습자 API는 정답, 풀이, 생성 파라미터, 그림 재생성 spec을 제거한다. 정답 포함 학습지나 상세 채점 피드백은 `Authorization: Bearer <TEACHER_TOKEN>`과 `includeAnswers=true` 또는 `includeFeedback=true`가 필요하다.

부분 제출도 전체 자동채점 문항을 분모로 사용하며 `answered`, `accuracy`, `completionRate`를 별도로 반환한다. 문항별 시간은 `elapsedMs: {"1": 1234}` 형태로 보낸다.
`learnerId`는 이름·이메일이 아니라 128자 이하의 가명 토큰만 사용한다.
복습 API는 `reviewStatus=approved`인 선수 간선만 운영한다. 현재 후보 간선은 응답의 `excludedCandidateStandards`로 공개하되 학습 순서에는 사용하지 않는다.

## 데이터와 버전

- 출처·무결성: `PROVENANCE.md`
- 제3자 고지와 공개 전 확인 사항: `NOTICE.md`
- 실용 제품 울트라리서치: `docs/research/digi-mon-practical-product.md`
- 교사·학습자 최소 흐름: `docs/design/client-experience.md`
- 클라이언트 디자인 시스템: `docs/design/design-system.md`
- 스키마 변경 정책: `docs/schema-versioning.md`
- 운영 데이터·보존·관측 설계: `docs/operational-data-model.md`
- JSON Schemas: `schema/`
- 자산 조달: `docs/asset-procurement.md`
- 오프라인 자산 플랫폼 설계: `docs/offline-asset-platform.md`
- 상세 품질 현황: `REVIEW.md`

향후 LLM 활용도가 높은 지문·대화·대본/TTS·구조화 매체는 자산 조달
문서의 캐시·DB 설계에 따라 비동기로 후보를 만들 수 있다. 현재 API에는
연결하지 않았으며, 활성화하려면 자산 코퍼스 릴리스를 worksheet 계약과
fingerprint에 포함해야 한다. 활성화 후에도 학습자 요청은 승인된 불변
릴리스만 읽고 캐시 미스에서 모델 출력을 직접 제공하지 않는다.

업스트림 핀이나 생성기 로직을 변경하면 기존 seed의 문항이 달라질 수 있다. 발급된 학습지는 fingerprint와 코퍼스 해시를 함께 보존해야 한다.

## 라이선스

저장소 자체 저작물은 `LICENSE`의 MIT 조건을 따른다. 업스트림 파생 데이터 공개는 `NOTICE.md`에 기록된 참고 프로젝트의 라이선스 메타데이터 충돌을 먼저 해소해야 한다.
