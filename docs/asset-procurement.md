# 국어·영어·수학 자산 조달 계획

## 목적

생성기 코드만으로 정직하게 측정할 수 없는 성취기준에 필요한 지문·음성·매체·대화·공식 어휘 자산을 합법적이고 재현 가능한 방식으로 조달한다. 자산이 없으면 해당 기준을 `covered`로 만들기 위한 대체 객관식 문항을 작성하지 않는다.

## 현재 미충족 목록

기계가 읽는 상세 목록, 유형별 수량과 성취기준 코드는
`src/curriculum/asset-requirements.mjs`가 유일한 원장이다. 최신 수치는
`node tools/check-asset-requirements.mjs` 또는 `npm run verify`로 확인한다.
이 문서에는 파생 수량을 복제하지 않는다.

## 우선순위

### P0: 공개·정렬 기반

1. ~~2022 영어과 공식 어휘 목록의 이용 조건과 원문 위치 확정~~
   완료: 공개 이용 검토와 `[별표 3]` 800개 기계 판독 원장을
   `data/curriculum/english-official-vocabulary.json`에 고정했다.
2. 모든 자산의 라이선스·출처·원문 해시·접근일 기록 형식 확정
3. 국어 `[2국02-03]` 중심 내용 읽기와 영어 `[4영02-03]` 소리-철자 대응용 기준 표본 제작

영어 단어 자료의 상세 출처와 검토 상태는
[`docs/assets/english-vocabulary-provenance.md`](assets/english-vocabulary-provenance.md)를
따른다. 공식 초등 권장 800개는 학년군 배정이 아니므로, 현재 엔진은 그 안에서
검토한 3~4학년 30개와 5~6학년 신규 24개만 사용한다.

### P1: 선수 기능

1. 국어 읽기 지문: 중심 내용, 구조, 사실 정보, 추론
2. 국어 듣기·말하기 음성 및 대화
3. 영어 이해 음성: 음소-철자, 낱말·문장 듣기, 지시 수행
4. 영어 읽기 지문: 낱말·문장·짧은 글 이해

### P2: 확장 기능

1. 국어·영어 매체 문식성 화면·광고·정보 탐색 자산
2. 문학 감상과 표현 효과를 위한 저작권 정리 지문
3. 교사용 수동 채점 루브릭과 접근성 대체 자산

## 조달 단위와 필수 메타데이터

논리 자산, 불변 revision, 출처, topic mapping과 review를 별도 레코드로
관리한다.

| 레코드 | 필수 내용 |
|---|---|
| asset | `assetId`, type, title, language, gradeBand, standardCodes |
| revision | `revisionId`, assetId, sourceKind, sha256, bytes, MIME, lineage |
| topic mapping | revisionId, topicId, confidence, note, candidate/approved |
| accessibility | revisionId, 대본·자막·대체 텍스트·음질 조건 |
| review | revisionId, domain, reviewerId, decision, evidence, reviewedAt |
| corpus release | releaseId, manifest sha256, ordered revision IDs, issuedAt |

sourceKind별 출처·권리 필드는 아래 생성 provenance 계약을 따른다.
topic mapping 승인은 자산 revision 승인과 분리한다. 파일과 manifest는 같은
변경 단위로 검토하고 원본, 가공본, 대본을 서로 다른 revision과 해시로
기록한다.

## 유형별 인수 기준

### 지문

- 학년군 어휘·문장 길이와 성취기준의 읽기 기능이 일치한다.
- 정답 근거 문장이 식별되며 복수 해석 가능성을 검토한다.
- 저작권 보호 지문은 허락이나 적법한 라이선스 없이 복제하지 않는다.
- 단순 생성형 모델 출력은 사실·문체·편향 검토 전 자산으로 승인하지 않는다.

### 음성·대화

- 무손실 원본과 배포용 파일, 정확한 대본을 함께 보존한다.
- 화자, 속도, 억양, 잡음, 반복 횟수를 기록한다.
- 소리-철자 문항은 의미 번역으로 대체하지 않는다.
- 듣기 기능을 평가하는 문항에는 텍스트가 정답을 선노출하지 않도록 모드를 분리한다.

### 매체

- 이미지·화면·광고의 이용 권한과 수정 권한을 확인한다.
- 화면 낭독기용 동등 과제를 제공하고, 대체 텍스트가 정답을 말하지 않는지 검사한다.
- 실존 상표·개인정보·외부 추적 URL을 제거한다.

### 공식 어휘 목록

- 2022 영어과 원문 별표와 개정·정오표를 확인한다.
- 낱말, 표제어, 굴절형, 학년군, 출처 위치를 분리한다.
- 현재 비공식 seed 목록과 자동 병합하지 않고 차이를 사람이 검토한다.

## LLM 생성 자산의 캐시·DB 운영

LLM은 자산 부족을 즉석에서 숨기는 출제자가 아니라 **검토 가능한 자산
후보 공급자**로 사용한다. 학습자 요청 경로는 승인된 불변 코퍼스
릴리스만 읽는다. 캐시 미스가 나도 모델 응답을 기다리거나 미검토
결과를 바로 문항에 넣지 않는다.

### 생성 적합도

| 자산 유형 | 적합도 | 허용 범위 |
|---|---|---|
| `passage` | 높음 | 짧은 설명문·생활문·정보문 후보와 정답 근거 구간 |
| `dialogue` | 높음 | 학년군·상황·화자 수가 제한된 대화 후보 |
| `audio` | 높음 | 승인된 대본의 TTS 변환. 모델이 만든 대본은 별도 검토 |
| `media` | 높음 | 표·그래프·안내문·가상 화면을 JSON/SVG/HTML 규격으로 생성 |
| `wordlist` | 생성 대상 아님 | 공식 교육과정 원문과 정오표를 확보해야 함 |
| 성취기준·topic 정렬 | 생성 대상 아님 | LLM은 후보를 제안할 수 있지만 전문가 승인 전 운영 금지 |

문학적 지문처럼 적합도가 중간 이하인 자산은 이 경로에서 만들지 않는다.
이미지 모델의 자유 형식 픽셀 출력보다 좌표와 텍스트를 검증할 수 있는
SVG 또는 구조화 spec을 우선한다. Codex는 관리자용 일괄 후보 제작과
검증 도구 작성에 사용한다. 운영 중 부족분 생성은 구조화 출력을
지원하는 LLM API와 TTS API로 분리한다.

HTML과 SVG는 능동 콘텐츠로 취급한다. script, 이벤트 핸들러,
`foreignObject`, 외부 URL, 외부 글꼴과 임의 CSS를 금지한 안전 부분집합만
허용한다. 결정적 sanitizer를 통과시킨 뒤 별도 cookieless origin과 제한적
CSP로 제공하거나, 가능하면 검증된 SVG·래스터로 변환한다. 엔진에는
DOM·브라우저 렌더링을 넣지 않는다.

### 제어면과 런타임 경계

시스템은 두 경계로 나눈다.

- **조달 제어면:** 생성 작업, 후보 blob, 검증, 역할별 검토와 코퍼스
  릴리스 발행을 담당한다.
- **학습지 런타임:** 발행된 불변 manifest와 blob만 읽는다. 생성·승인
  상태 DB를 조회하거나 수정하지 않는다.

조달 제어면은 승인된 revision을 모아 정렬된 manifest를 만들고
`assetCorpusReleaseId`와 전체 manifest `sha256`을 부여한다. 발행한
릴리스 manifest와 revision은 덮어쓰지 않는다. 문제가 있는 revision은
다음 릴리스에서 제외하고, 권리가 허용하는 동안에만 과거 학습지
재생성을 위해 접근이 제한된 상태로 보존한다.

이 기능을 실제로 활성화하기 전 다음 계약 변경이 선행되어야 한다.

1. asset, asset revision, 역할별 review, corpus release JSON Schema 추가
2. worksheet 새 주 버전에 `assetCorpusReleaseId`와 manifest `sha256` 추가
3. item에 사용한 `assetId`, `revisionId`, blob `sha256` 참조 추가
4. corpus release와 item 자산 참조를 fingerprint 입력에 포함
5. 채점 요청과 재생성이 발급 당시 corpus release를 사용하도록 변경

현재 worksheet 계약과 API에는 이 필드가 없으므로 이 문서는 설계
결정이며 아직 런타임 동작을 주장하지 않는다.

### 조회와 생성 흐름

```text
학습지 요청
  -> worksheet가 고정한 assetCorpusReleaseId의 로컬 캐시 조회
  -> 캐시 미스면 불변 release DB/blob 저장소에서 읽어 캐시 복구
  -> release manifest의 정렬된 eligible revision 중 seed로 결정적 선택
  -> assetId·revisionId·sha256을 문항과 fingerprint에 기록

조달 스케줄러
  -> 다음 release의 요구사항별 승인 자산 부족을 계산
  -> 동일 assetSpecKey의 작업을 멱등하게 하나만 등록

비동기 생성 작업자
  -> LLM 구조화 생성
  -> 스키마·어휘·사실·정답·접근성·권리 위험 자동 검사
  -> candidate revision 저장
  -> 역할별 독립 검토
  -> 승인된 revision을 다음 불변 corpus release에 포함
```

`assetSpecKey`는 적어도 `standardCodes`, 후보 `topicIds`, `type`,
`language`, `gradeBand`, 평가 기능, 난이도 정책, 자산 스키마 버전의
정규화된 해시다. 후보 topic mapping은 승인과 분리하며 승인 전 의미
커버리지로 세지 않는다.

릴리스 manifest는 `assetSpecKey`, `assetId`, `revisionId` 순으로
정렬한다. 선택 알고리즘 버전과 domain-separated seed로 eligible
revision의 인덱스를 결정한다. 따라서 같은 온톨로지·자산 코퍼스
릴리스·옵션·seed는 승인 DB의 이후 변경과 무관하게 같은 문항을 만든다.

### 저장 경계

- `assetId`는 논리적 자산 계열 ID이고 `revisionId`는 불변 내용 버전이다.
- `(assetId, revisionId)`와 blob `sha256`은 고유하며 기존 revision을
  덮어쓰지 않는다.
- 관계형 DB에는 생성 작업, 자산·revision 메타데이터, 검증 결과,
  역할별 검토 기록과 release manifest를 저장한다.
- 긴 본문, JSON, SVG, 음성은 SHA-256 내용 주소화 객체 키로 저장한다.
- 후보·격리 객체와 승인 객체는 별도 private bucket 또는 강제된 prefix와
  IAM 경계로 분리한다.
- 객체 쓰기, 승인 승격, 캐시 적재와 매 읽기에서 크기와 digest를 검증한다.
- 승인 포인터와 blob 승격은 조건부 쓰기와 트랜잭션으로 원자화한다.
- 후보와 격리 객체는 학습자 경로에서 직접 접근할 수 없다. 승인 객체도
  짧은 signed URL 또는 권한 있는 애플리케이션 경로로만 제공한다.

`retired`는 특정 revision의 신규 릴리스 편입을 막는다. `tombstoned`는
논리적 `assetId` 전체의 신규 revision 생성도 막는다. 둘 다 과거
릴리스 ID, manifest 해시, tombstone, 발급 이력과 감사 메타데이터는
보존하지만 실제 콘텐츠 blob의 영구 보존 권한을 뜻하지 않는다.

권리 철회, 개인정보 발견, 법원 명령, provider 약관 또는 삭제 요청이
콘텐츠 보존을 금지하면 해당 revision을 즉시 서빙 차단하고 blob을
격리하거나 삭제한다. 허용되는 법적 보존이 필요하면 별도 암호화 저장소와
legal-hold 접근 정책을 적용하며 학습자 런타임에서는 읽을 수 없다. 삭제
후에도 원문을 복원할 수 없는 해시와 최소 감사 메타데이터만 남긴다.

법적으로 삭제된 blob이 필요한 과거 worksheet는 같은 문항을 재생성하거나
자동채점할 수 있다고 주장하지 않는다. 향후 API 계약은 이 경우
`ASSET_REVISION_UNAVAILABLE`과 HTTP 410을 반환하고 수동 처리 경로를
제공해야 한다. 이 예외도 worksheet 새 주 버전과 운영 문서에 포함한 뒤
기능을 활성화한다.

### 검증·검토 상태

revision 상태는 다음 한 방향 상태 기계로 관리한다.

```text
candidate -> validation-passed -> review-pending -> approved
    |              |                 |
    +--------------+-----------------+-> quarantined
                                   \----> rejected
approved -> retired
```

자동 검증기는 `validation-passed`까지만 전환할 수 있다. review 레코드는
revision과 검토 영역(`legal`, `curriculum`, `language`, `answer`,
`accessibility`, `security`)별로 reviewer, decision, evidence, timestamp를
불변 기록한다. curriculum 승인은 서로 다른 두 reviewer가 필요하고,
나머지 필수 영역은 각 한 명 이상이 승인해야 한다.

생성 작업자·검증기·reviewer·release 발행자는 서로 다른 최소 권한
서비스 identity와 역할을 사용한다. 자기 생성물 승인과 생성 작업자의
`approved` 전환을 금지한다. 전환 권한과 모든 시도는 tamper-evident
감사 로그에 남기며, 시스템은 필수 review 레코드가 모두 있을 때만
`approved`로 원자 전환한다.

`quarantined`와 `rejected`는 해당 revision의 종결 상태다. 보안·권리·내용
위험은 승인 전 어느 상태에서도 `quarantined`로 보낼 수 있고, 정상적인
review 부결은 `review-pending`에서 `rejected`로 보낸다. 수정이나 재검증은
불변 revision을 되살리지 않고 `supersedesRevisionId`를 가진 새 candidate
revision으로 시작한다.

### 생성 provenance

manifest는 `sourceKind`를 `sourced`, `repository-authored`,
`llm-generated`, `tts-derived` 중 하나로 구분한다. 공통으로 배포
라이선스, 권리 보유자, 권리 증빙과 입력 lineage를 요구하되 출처 필드는
종류별로 해석한다.

- `sourced`: 원문 URL·문서·locator·접근일·원문 해시
- `repository-authored`: 작성 revision과 내부 review evidence
- `llm-generated`: provider 약관 버전, 출력 소유·재배포 권리, 모델과
  prompt provenance, 입력 자산 lineage
- `tts-derived`: 승인 대본 revision, 음성 provider·voice 사용 권리,
  재배포 조건과 음성 blob 해시

생성 자산은 NOTICE와 PROVENANCE에서 별도 자산 클래스로 집계한다.
provider 출력 권리나 음성 재배포 조건을 증명하지 못하면 승인할 수 없다.
업스트림 파생 입력을 사용한 출력은 기존 공개 차단 조건을 상속한다.

LLM/TTS 생성에는 다음 정보를 추가한다.

| 필드 | 의미 |
|---|---|
| `generationProvider`, `generationModel` | 공급자와 모델 식별자 |
| `modelRevision` | 가능한 경우 고정된 모델 revision |
| `promptTemplateId`, `promptTemplateSha256` | 검토된 프롬프트 템플릿과 해시 |
| `generationParameters` | temperature, seed, 구조화 출력 설정 |
| `generationInputSha256`, `generationOutputSha256` | 재현·감사 가능한 입출력 해시 |
| `generatedAt`, `generationJobId` | 생성 시점과 작업 추적 ID |
| `validationReportId` | 자동 검증 결과 참조 |

프롬프트에는 학습자 개인정보, 미공개 응답, 권한 없는 원문을 넣지 않는다.
provider·모델·TTS는 승인 목록으로 제한한다. 계약과 API 설정에서
학습 미사용, 허용된 region·subprocessor, bounded 또는 zero retention과
삭제 절차를 확인한다. credential은 secret manager에서 공급자와
작업별 최소 scope로 발급·회전하며 로그에 기록하지 않는다. 작업자는
승인된 provider endpoint로만 egress할 수 있다.

### 자동 게이트

승인 검토에 올리기 전에 다음을 모두 통과해야 한다.

1. JSON Schema 및 자산 크기·MIME 검사
2. 학년군 어휘, 문장 길이, 금칙 표현 검사
3. 성취기준과 `assesses` topic의 허용 목록 검사
4. 정답 근거 구간 존재, 복수 정답과 오답 선택지 타당성 검사
5. 이름·연락처·실존 상표·추적 URL 등 개인정보와 외부 식별자 검사
6. 기존 자산 및 공개 코퍼스와의 과도한 문구 중복 검사
7. 대체 텍스트·대본·자막의 정답 누출 검사
8. TTS 대본과 실제 음성 길이·언어·읽기 속도 일치 검사
9. SVG·HTML 안전 부분집합과 sanitizer 결과 검사
10. blob 크기·MIME·digest와 provider·권리 정책 검사

자동 게이트는 승인 권한이 없다. 특히 사실성, 문화적 편향, 교육과정
정렬, 권리 위험과 정답 유일성은 독립 검토 대상이다.

### 운영 원칙

- 학습자 HTTP 요청 안에서 LLM이나 TTS API를 동기 호출하지 않는다.
- 학습자 요청의 캐시 미스는 불변 corpus release를 원장에서 다시 읽는
  동작일 뿐 생성 신호가 아니다.
- API 장애·rate limit·비용 한도 초과는 기존 승인 자산의 사용을 방해하지 않는다.
- 생성 작업은 제한된 재시도와 지수 backoff를 사용하고 영구 실패를 관리자 대기열에 남긴다.
- 공급자·모델·프롬프트가 바뀌면 별도 생성 프로필과 revision으로 취급한다.
- 만료는 시간만으로 결정하지 않고 교육과정 개정, 권리 변경, 검증기 변경을 재검토 신호로 사용한다.
- 승인 자산 수, 캐시 적중률, 생성 비용, 검증 탈락률, 승인률, 회수율을 유형·학년군별로 관찰한다.

이 구조에서 “실시간 사용”은 **미리 승인되어 불변 corpus release와
캐시에 저장된 다양한 자산을 요청 시 즉시 선택하는 것**을 뜻한다.
LLM 생성은 별도 제어면의 비동기 공급 과정이다.

## 검토 흐름

1. **제안:** assetSpec과 candidate topic mapping을 먼저 지정한다.
2. **후보:** sourced·authored·LLM·TTS 경로로 불변 candidate revision을 만든다.
3. **기술 검증:** 해시, 포맷, 길이, 링크, 중복, 결정적 로딩과 안전 게이트를 검사한다.
4. **역할별 검토:** 법적·교육과정·언어·정답·접근성·보안 review 레코드를 남긴다.
5. **승인:** 필수 review가 모두 승인된 revision만 시스템이 `approved`로 전환한다.
6. **발행:** release 발행자가 승인 revision을 불변 corpus manifest에 포함한다.
7. **회수:** 일반 문제는 revision을 retire하고, 자산 계열 전체가 무효일 때만
   assetId를 tombstone 처리한다. 발급 메타데이터는 보존하되 콘텐츠 blob은
   권리·개인정보·법적 삭제 정책을 우선한다.

## 완료 정의

자산 요구는 파일이 존재하는 것만으로 닫히지 않는다. 다음을 모두 만족해야 한다.

- sourceKind에 맞는 승인된 권리·출처·해시가 있다.
- 성취기준과 별도 승인된 `assesses` topic 연결이 명시돼 있다.
- 정답 유일성 또는 수동 루브릭이 독립 검토됐다.
- 접근성 대체가 원래 평가 구인을 훼손하지 않는다.
- 생성기 회귀 테스트와 전체 `npm run verify`가 통과한다.

## 비목표

- 국어·영어 자산 부족을 번역형·상식형 객관식으로 우회하지 않는다.
- 저작권 검토 전 웹 지문을 저장소에 복사하지 않는다.
- 수학 생성기 수를 늘려 전체 교과 커버리지가 높아 보이게 만들지 않는다.
- 검토되지 않은 선수 관계나 생성형 모델 평가를 학습자 진단으로 사용하지 않는다.
- 캐시 미스 때 미검토 LLM 출력을 학습자에게 바로 제공하지 않는다.
- 공식 어휘 목록이나 교육과정 근거를 LLM이 생성한 내용으로 대체하지 않는다.
