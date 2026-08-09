# digi-mon 실용 제품 울트라리서치

> 기준 커밋: `99641e7`
>
> 연구일: 2026-08-09
>
> 질문: 현재 결정적 학습지 엔진을 교사가 실제로 반복 사용하고 학생이 안전하게
> 사용할 수 있는 제품으로 바꾸려면 무엇을 먼저 만들고 무엇을 미뤄야 하는가?
>
> 산출물: Markdown 원본, PDF, DOCX, 구현 보조 설계

## 1. 결론

digi-mon의 가장 큰 문제는 문항 생성 속도나 데이터베이스가 아니다. 이미 같은
온톨로지·옵션·seed에서 같은 문항과 fingerprint를 만드는 엔진, 정답을 숨긴
학습자본, 무상태 채점, 수동 채점 rubric, 승인된 선수 관계만 쓰는 복습 API가 있다.
그러나 교사는 이 기능을 쓰려면 Node.js, 형제 온톨로지 저장소, CLI 옵션과 HTTP
계약을 이해해야 한다.

따라서 첫 제품은 **하나의 로컬 교사 활동**이어야 한다.

1. 조건을 고른다.
2. 학습지를 미리 본다.
3. A4로 인쇄한다.
4. 같은 학습지를 동일본으로 재발급(reissue)한다.
5. 이름 없이 수업 전체의 정답·오답 합계만 세션 안에서 확인한다.

첫 파일럿에는 DB, 실명 roster, 학습자 계정, 생성 queue, 이미지 생성, TTS,
다기기 offline sync, LMS/SIS 연동을 넣지 않는다. 이 기능들은 각자 별도의 제품
가설이며, 단순한 로컬 학습지 흐름이 반복 사용된 뒤 관찰된 실패를 해결할 때만
추가한다.

권장 아키텍처는 **현재 엔진 + 같은 origin의 얇은 로컬 웹 클라이언트**다. 화면과
인쇄는 엔진 밖에 두어 기존 결정성·무상태·경계 검사를 보존한다. 파일럿은 발급된
worksheet JSON을 교사 소유 파일로 내보낸다. 다시 열기 요구가 반복해서 확인될 때만
SQLite를 추가하고, 여러 운영자·호스트의 동시 작업이 실제 병목일 때만 PostgreSQL과
객체 저장소로 옮긴다.

제품 차별화는 “AI가 더 많이 만든다”가 아니다.

- 발급한 학습지를 동일본으로 재발급(reissue)하고 byte 수준으로 확인할 수 있다.
- 같은 조건으로 A/B/C 연습 form을 결정적으로 만들 수 있다.
- 승인된 정렬과 후보 정렬을 숨기지 않는다.
- 표본이 부족하면 정확도나 숙달도를 꾸며내지 않는다.
- 인터넷과 모델 호출 없이 승인된 콘텐츠로 동작한다.

## 2. 현재 엔진에서 이미 제품 자산인 것

| 자산 | 저장소 근거 | 제품 가치 |
|---|---|---|
| 결정적 worksheet와 SHA-256 fingerprint | `src/engine/worksheet.mjs` | 동일본 재발급(reissue), 변조·옵션 불일치 탐지 |
| 정답 제거 학습자본 | `src/server/app.mjs` | 클라이언트가 정답 제거 로직을 복제하지 않음 |
| 무상태 채점과 fingerprint 409 | `src/server/grade.mjs` | DB 없이도 발급본과 제출을 대조 |
| 수동 rubric과 `correct: null` | `src/server/grade.mjs` | 작도·수행을 억지 자동채점하지 않음 |
| 표본 수 gate와 난이도 역전 탐지 | `src/engine/response-log.mjs` | 모르는 것을 숫자로 포장하지 않음 |
| 승인된 선수 관계만 쓰는 복습 | `src/server/app.mjs` | 후보 관계를 학습 경로로 자동 승격하지 않음 |
| worksheet·item JSON Schema | `schema/worksheet.schema.json`, `schema/item.schema.json` | 클라이언트·외부 adapter 경계 검증 |
| 0개 production dependency | `package.json` | 로컬·폐쇄망 배포의 작은 운영면 |

시장 비교에서 digi-mon은 생성 시간보다 첫 사용 경로가 약했다. 저장소 내부
benchmark에서 기준 커밋 `99641e7`, 현재 `PROVENANCE.md` corpus pin, Windows
i5-10400 환경으로
`node bin/worksheet.mjs --subject math --count 20 --seed bench-1`을 실행했을 때
20문항 생성은 약 0.43초였지만 교사는 설치와 데이터 pin을 직접 처리해야 했다.
MagicSchool·Diffit·Khanmigo·Kahoot은 생성 자체보다 “몇 분 안에 초안”, 편집, 재사용,
인쇄·배정과 교사 시간 절감을 전면에 둔다. MathFlat도 문제 품질만이 아니라 학생·
오답 관리 흐름을 제품 중심에 둔다(§16 외부 근거 22–26).

즉 엔진을 다시 만드는 대신 **엔진 앞의 마지막 1미터**를 만들어야 한다.

## 3. 제품 선택: 로컬 교사 도구와 중앙 SaaS

### 선택지 A - 로컬 교사 도구

```text
교사 브라우저
  -> 같은 origin의 얇은 host
      -> 기존 digi-mon HTTP app
          -> 결정적 engine
```

- 교사 계정과 클라우드가 필요 없다.
- 기존 `127.0.0.1` 기본값과 무상태 채점을 유지한다.
- 정적 client shell과 현재 corpus를 함께 패키징할 수 있다.
- 인쇄·PDF·DOM은 client에만 있어 `src/`·`bin/` 경계를 깨지 않는다.
- 개인정보와 운영비가 가장 작다.

단점은 한 기기 사용과 수동 배포다. 그러나 이는 첫 파일럿의 의도적인 범위다.

### 선택지 B - 중앙 SaaS

- 여러 교사·기기에서 접근하고 중앙 백업·업데이트가 쉽다.
- 대신 인증, tenant 분리, 개인정보 정책, 운영 감시, 장애 대응, 계약, 조달과
  학교망 지원이 첫날부터 필요하다.
- roster나 학생 이력을 받기 시작하면 “summary-only”여도 학습자 프로파일이 될 수
  있다.

### 결정

**선택지 A를 먼저 구현한다.** 선택지 B는 다음 중 하나가 실제로 관찰될 때만 연다.

- 두 명 이상의 교사가 같은 작업을 동시에 편집·검토해야 한다.
- 교사가 기기 교체·재시작 때문에 유용한 발급본을 반복해서 잃는다.
- 한 학교가 중앙 계정·감사·복구를 도입 조건으로 확약한다.
- SQLite write lock, 로컬 용량 또는 복구 시간이 측정된 병목이 된다.

단순히 자산 수가 늘었다거나 미래에 학교가 많아질 수 있다는 이유는 migration
근거가 아니다.

## 4. 첫 파일럿의 한 가지 가치 loop

### 4.1 교사 흐름

### S1. 학습지 짜기

- 학년군, 교과, 영역 또는 성취기준, 문항 수, 난이도만 고른다.
- seed는 고급 옵션으로 보이되 발급 뒤에는 숨기지 않는다.
- 미리보기는 문항 수, 자동·수동 채점 수, 시각 자료 요구, shortfall, 승인 정렬
  상태만 보여 준다.
- “대시보드”가 아니라 “지금 이 학습지를 내도 되는가”에 답한다.

### S2. 나눠주기

- 기본은 A4 인쇄와 교사용 정답지다.
- footer에 동일본 재발급 code, seed, fingerprint 앞부분, corpus identity를 넣는다.
- 교사는 발급된 JSON과 인쇄물을 함께 내보낼 수 있다.
- 같은 파일을 다시 열면 엔진 업그레이드 뒤에도 당시 payload를 사용한다.

### S3. 걷기와 돌려주기

- 파일럿은 교사가 정답·오답의 수업 전체 합계만 세션 안에서 기록한다.
- 원시 답안, 이름, 이메일, 자유 서술 note를 지속 저장하지 않는다.
- 문항별 keyboard-first 입력, 수동 rubric boolean과 수학 복습지는 P1으로 미룬다.

교사 파일럿이 성공하기 전에는 학급 코드, 학생 기기, 제출 queue를 만들지 않는다.

### 4.2 학습자 흐름 - 다음 gate

종이 흐름으로 해결되지 않는 반복 요구가 확인되고 학교가 개인정보·망 경계를
승인한 뒤에만 익명 기기 연습을 추가한다.

1. 짧은 세션 코드로 합류한다.
2. 계정 대신 세션 안에서만 유효한 임시 alias를 쓴다.
3. 한 화면에 한 문항, 20px 이상 본문, 일반 조작 48px 이상, 학습자 주 조작
   56px 이상을 쓴다.
4. 정답·풀이·teacher token은 학습자 기기에 보내지 않는다.
5. active worksheet bundle만 cache하고 제출 뒤 짧은 TTL로 지운다.
6. “숙달” 대신 “이번 연습의 응답”과 “표본 부족”을 표시한다.

이 흐름의 상세 계약은 `docs/design/client-experience.md`, 시각 토큰은
`docs/design/tokens.css`에 있다.

## 5. 클라이언트 정보 구조

| 화면 | 첫 파일럿 | 후속 단계 | 핵심 실패 상태 |
|---|---|---|---|
| S1 학습지 짜기 | 필수 | 유지 | shortfall, 미승인 정렬, 시각 자료 요구 |
| S2 인쇄·내보내기 | 필수 | 유지 | fingerprint 불일치, 인쇄 overflow |
| S3 익명 세션 요약 | 최소 | 확장 | 수동 rubric 길이, 표본 부족 |
| S4 학습자 연습 | 제외 | 요구 확인 뒤 | offline queue, 409, 429 |
| S5 검토 인박스 | 제외 | 기여자 증가 뒤 | 권리·접근성·검토 미완료 |

시각 방향은 종이와 잉크가 기준이다. `docs/design/design-system.md`가 정의한
고대비 색, 교사·학습자 두 type scale, 4px 간격, reduced motion, A4 print 규칙을
쓴다. 구현 전 문서 토큰만으로 통과했다고 주장하지 않고 실제 브라우저·프린터
표본을 완료 gate로 둔다.

## 6. 저장과 배포

### Stage 0 - DB 없는 개인정보 최소 파일럿

- 현재 engine과 승인된 정적 corpus를 한 버전으로 pin한다.
- worksheet payload, seed, options, fingerprint를 교사 소유 파일로 export한다.
- 학생 이름·계정·안정 ID와 원시 답안을 저장하지 않는다.
- 세션 합계가 필요하면 메모리에만 두고 종료 시 폐기한다. 교사가 명시적으로
  내보낸 학습자 연결 없는 익명 CSV는 worksheet JSON과 같은 교사 소유 파일로
  취급하며 앱이 별도 사본을 보존하지 않는다.
- 로그에는 route template, 상태 class, duration, 안정된 error code만 남긴다.

“offline”은 **인터넷 없이 한 교사 기기에서 생성·인쇄·채점 가능**하다는 뜻으로만
쓴다. 여러 학생 기기, 학교 LAN, 기기 간 sync가 된다는 뜻이 아니다.

### Stage 1 - 로컬 내구성

교사가 작업을 다시 열지 못해 실제로 중단되는 사례가 반복될 때만 추가한다.

- SQLite WAL 한 파일
- 발급 당시 worksheet payload와 fingerprint
- 교사 소유 export와 한 가지 restore 경로
- 학습자 연결이 없는 익명 session aggregate, 짧은 TTL
- schema version과 migration checksum

roster, enrollment, recipient, item별 학습자 history, elapsed-time profile은 넣지
않는다.

SQLite WAL과 단일-host 적합성 판단은 §16 외부 근거 1–2를 따른다.

### Stage 2 - 콘텐츠 운영

여러 기여자의 release·검토가 source control로 감당되지 않을 때만
`docs/offline-asset-platform.md`의 revision, review, recall, CAS를 도입한다.

### Stage 3 - 기관 서비스

확약된 기관 요구가 있을 때 개인정보 목적·보존·삭제·접근 승인을 먼저 하고
PostgreSQL, 객체 저장소, OIDC/SAML, tenant RBAC, row-level security, backup과
감사를 추가한다. 이 순서를 뒤집지 않는다.

## 7. 비동기 LLM·이미지·TTS 자산 공급망

런타임 생성은 금지한다. 생성 모델은 학습자에게 답하는 서비스가 아니라 사람이
검토할 후보를 만드는 조달 도구다.

```text
asset requirement
  -> deterministic spec
  -> budget reservation
  -> asynchronous provider batch
  -> immutable candidate bytes
  -> automated validation
  -> human review
  -> approved revision
  -> signed/versioned manifest
  -> offline bundle
  -> learner runtime(read-only)
```

첫 파일럿은 이 queue 자체를 만들지 않는다. 사람이 작성한 작은 자산 묶음과 다음
필드의 source-controlled manifest면 충분하다.

- stable asset key와 file path
- SHA-256
- 출처, 라이선스, 접근일
- 성취기준·평가 목적
- 대체 텍스트 또는 동등한 접근 방식
- 검토자와 검토일

### 생성 기능별 gate

| 기능 | 먼저 쓰는 대안 | 생성 도입 조건 |
|---|---|---|
| 짧은 지문·대화 | 사람이 작성한 template·공개 승인 자료 | 생성이 검토 시간을 포함해 실제 제작 시간을 줄임 |
| 이미지 | 작은 licensed asset library, SVG 도형 | 고정 자산으로 교육 목적을 충족할 수 없고 권리·style·alt text 검토 담당이 있음 |
| TTS | licensed audio, 기기 speech의 제한적 사용 | 반복되는 언어·접근성 목표와 재배포 권리·발음 검토 역량이 있음 |

공급자 Batch API와 이미지 API의 동작 근거는 §16 외부 근거 15–16이다. 낮은
단가나 편의성 자체는 채택 근거가 아니다. 비용은 생성 1건이 아니라 **승인된
자산 1건당 비용**으로 측정한다. 반려·재생성·사람 검토, 권리 확인, 저장과 회수
비용을 포함한다.

## 8. 문제 pool과 차별화

현재 193개 생성기와 명시적 coverage·capacity 검사가 이미 문제 pool의 기반이다.
그러나 “문항이 많다”는 주장은 차별화가 아니다. 시장의 AI 도구는 더 넓은 tool
목록과 생성량을 낮은 가격 또는 무료로 제공한다.

### 8.1 pool을 제품으로 만드는 원칙

1. **폭보다 증거:** 각 문항이 어떤 성취기준·generator·review 상태에서 왔는지
   보여 준다.
2. **재생성보다 발급 보존:** seed로 다시 만들 수 있어도 발급 당시 payload를
   보존한다.
3. **동형 form:** 같은 조건·난이도 blueprint에서 parameter만 다른 A/B/C form을
   만든다.
4. **중복 가시성:** `dedupeKey`와 pool capacity로 form 간 중복을 검사한다.
5. **정직한 부족:** pool이 부족하면 다른 기준이나 낮은 품질 문항으로 채우지 않고
   shortfall을 표시한다.
6. **승인 provenance:** approved와 candidate alignment를 한 숫자로 합치지 않는다.

### 8.2 차별화 후보 순위

| 순위 | 후보 | 가치 | 구현 위험 | 결정 |
|---:|---|---|---|---|
| 1 | 동일본 재발급 code와 payload 보존 | 결석·재시험·재인쇄에 즉시 유용 | 낮음 | 파일럿 필수 |
| 2 | A/B/C 결정적 병렬 form | 베끼기 방지·재연습, 기존 generator 활용 | 중간 | 첫 코드 차별화 |
| 3 | deterministic swap·reorder delta | 편집과 감사 trail 양립 | 중간 | form 이후 |
| 4 | 승인 정렬 provenance 인쇄 | 신뢰·검토 상태 차별화 | 낮음 | client 표시 |
| 5 | 승인 선수 기반 복습 | 이미 엔진에 있음 | 낮음 | 수학에서 노출 |
| 6 | marketplace·UGC | 콘텐츠 폭 | 매우 높음 | 하지 않음 |

사용자의 후속 구현 요구에 따라 첫 코드 차별화는 **A/B/C 결정적 병렬 form**으로
선정했다. 이 기능은 P0의 한 학습지 loop 안에 있고 별도 DB나 생성 모델 없이 기존
문제 pool을 사용한다. 같은 요청이 같은 form set을 재생성하며, form 간 문항 중복과
난이도·성취기준 blueprint를 검사할 수 있어야 한다.

## 9. 상호운용 순서

### 지금

- A4 인쇄
- worksheet JSON
- 익명 CSV summary
- corpus·fingerprint가 포함된 export bundle

### 반복 요구가 확인되면

- CASE: 성취기준 식별자 adapter
- QTI: 현재 지원 format으로 표현 가능한 문항 export

### 확약된 기관이 같은 blocker를 제시하면

- OneRoster: roster·gradebook
- LTI 1.3: LMS launch와 identity
- Google Classroom 등 특정 vendor adapter

QTI·CASE·OneRoster·LTI를 “표준이 있으므로” 미리 구현하지 않는다. 인증·지원·
version 호환은 지속 운영 비용이다. 여러 유료 또는 확약 adopter가 같은 연동을
도입 blocker로 제시할 때 하나씩 만든다(§16 외부 근거 17–21).

## 10. 개인정보·접근성·AI 안전

### 개인정보

- 첫 파일럿은 이름, 이메일, 음성, 그림, 자유 서술, 안정 learner ID를 받지 않는다.
- alias가 필요해도 active session 안에서만 유효하다.
- request body, token, query, worksheet title을 log·metric·trace에 넣지 않는다.
- 아이별 정답·성취기준·난이도·시간을 장기 연결하면 raw answer가 없어도 profile이다.
- 기관 persistence 전에는 목적, 보존, 접근, 삭제, 동의와 보호자 안내를 법률·학교
  정책 담당자가 승인해야 한다.

개인정보 포털의 아동·청소년 가이드라인(§16 외부 근거 8)은 법률 검토의
출발점이지 이 보고서가 준수를 보증한다는 뜻이 아니다.

### 접근성

- WCAG 2.2 AA를 web client의 기본선으로 둔다(§16 외부 근거 7).
- 의미 있는 비텍스트 선은 3:1 이상, 본문은 4.5:1 이상을 확인한다.
- 학습자 주 조작 대상은 56px, 기본 본문은 20px로 설계한다.
- 색만으로 정답·상태를 전달하지 않는다.
- `requires-visual` 문항은 대체 자료 또는 교사 확인 없이 배포하지 않는다.
- 실제 browser, keyboard, screen reader, A4 인쇄 표본을 파일럿 gate로 둔다.

현재 SVG의 `#9aa0a6` 의미선은 흰 배경에서 2.64:1이고 strict XML에서
`font-family`가 잘릴 수 있다는 별도 결함이 발견됐다
(`docs/design/design-system.md` §5, §5-2). fingerprint 입력 probe에는
`figure.svg`, `<svg`, `#9aa0a6`가 모두 0건이라 발급 결정성에는 영향을 주지 않는다.
이번 연구 문서는 엔진을 변경하지 않았으며 구현 단계에서 독립 회귀 테스트로
고쳐야 한다.

### 생성형 AI

- 모델 output은 항상 candidate다.
- 자동 validator는 승인자가 아니다.
- 학습자 요청 path에는 provider credential과 generation queue가 없다.
- provenance·hash는 진실성·교육 타당도·공정성·권리를 스스로 증명하지 않는다.
- UNESCO와 NIST 지침(§16 외부 근거 9–11)은 human-centered governance와 risk management의 근거로
  쓰되 법률·교과 전문가 판단을 대신하지 않는다.

## 11. 단계별 roadmap

### P0 - 2~4 엔지니어-주: 한 교사, 한 활동

- 같은 origin client shell
- S1 조건 선택·preview
- S2 A4 인쇄·정답지·export
- 동일본 재발급 code
- 결정적 A/B/C form set
- 세션 한정 익명 summary
- 실사용 관찰과 print QA

### P1 - P0 gate 통과 뒤

- keyboard-first paper answer entry
- 수학 remediation 노출
- 교사 작업 재열기 실패가 반복될 때만 SQLite

### P2 - 콘텐츠가 blocker일 때

- P0 source-controlled manifest의 자동 검사와 작은 구조화 지문·매체 corpus 확대
- 여러 기여자가 생길 때 review ledger와 CAS
- 검토 처리량이 adoption blocker일 때만 asynchronous generation

### P3 - 기관 확약 뒤

- 중앙 identity·tenant·RBAC·RLS
- PostgreSQL·객체 저장소·backup·audit
- 승인된 retention·deletion
- 반복된 adopter blocker 하나에 대한 integration

각 P는 앞 단계 전체가 아니라 **해당 trigger**를 통과해야 열린다. 예를 들어 기관
서비스가 생겨도 이미지 생성이나 offline sync가 자동 승인되지는 않는다.

## 12. 파일럿 gate

아래 수치는 제품 가설이며 현재 성과가 아니다.

| gate | 관측·가설 목표 | 실패하면 |
|---|---|---|
| 첫 인쇄 | 교사 5명 관찰 중앙값 3분 이하, 12 click 이하 | 옵션·설치·preview 축소 |
| 동일본 | 같은 input의 fingerprint 일치 100% | 배포 중지, 회귀 수정 |
| 인쇄 품질 | 잘린 문항·그림·정답 0건 | client print CSS 수정 |
| 접근성 | 미해결 `requires-visual` 배포 0건 | 해당 문항 차단 |
| teacher workload | 기존 준비·채점보다 순감소 | answer entry·flow 재설계 |
| repeat use | 교사 5명 중 3명 이상이 4주 안에 코칭 없이 두 번째 사용 | 기능 추가 대신 가치 loop 재검토 |
| privacy | 이름·이메일·원시 답안 지속 저장 0건 | 파일럿 중단·삭제 |
| unit cost | 유료·생성 기능 전 session·승인 자산 비용 ceiling 승인, 초과 0회 | 생성·운영 기능 동결 |

engagement만으로 교육 가치나 제품 성공을 주장하지 않는다. 교사가 결과를 보고
다음 수업 행동을 바꿨는지, 준비·채점 시간이 실제로 줄었는지를 함께 본다.

## 13. 지금 하지 않을 것

- runtime LLM·TTS·이미지 생성
- 실명 roster와 장기 학습자 history
- 자유 서술 자동채점과 “숙달도” 점수
- graph DB, vector DB, event sourcing, microservice
- full offline sync와 conflict resolution
- marketplace, UGC, live game mode
- 80개 도구와 같은 breadth 경쟁
- 전체 QTI, OneRoster, LTI, Classroom 연동
- 자동 학년군 어휘 배정
- 수행 기준을 대체 객관식으로 자동 cover
- 검토되지 않은 이미지·음성의 교실 배포

각 항목은 기술적으로 불가능해서가 아니라 지금의 한 가치 loop를 증명하지 않기
때문에 제외한다.

## 14. 주요 위험과 완화

| 위험 | 징후 | 완화 |
|---|---|---|
| “AI 마법”보다 덜 화려함 | demo 반응은 좋지만 반복 사용 없음 | 신뢰 가능한 재인쇄·form·시간 절감을 판매 |
| 콘텐츠 폭 부족 | shortfall이 자주 발생 | 사용되는 기준부터 human-reviewed pool 확대 |
| 인쇄가 제품 병목 | 화면은 통과하나 교실 출력 실패 | 실제 학교 printer·A4·흑백 QA |
| teacher workload 증가 | prompt·review·입력 시간이 생성 절감보다 큼 | default, batch keyboard entry, 기능 삭제 |
| 익명성 때문에 분석 제한 | longitudinal 요청 | 실제 수업 결정과 기관 승인 전까지 제한 유지 |
| local 배포 지원 부담 | 설치·업데이트 문의 집중 | pin된 bundle, health check, 단일 복구 경로 |
| 미래 migration 비용 | SQLite 이후 중앙 요구 | worksheet payload·manifest 경계만 안정화 |
| 생성 자산 검토 병목 | candidate가 승인보다 빨리 쌓임 | queue 확대 금지, 승인 자산당 비용·lead time 측정 |

## 15. 결정 원장

| 결정 | 선택 | 거부한 대안 | 재검토 trigger |
|---|---|---|---|
| 첫 surface | 로컬 web client | 중앙 SaaS | 확약 기관의 중앙 운영 요구 |
| 첫 전달 | A4 인쇄 | 학생 기기 필수 | 종이로 해결되지 않는 반복 요구 |
| 첫 저장 | 교사 export file | SQLite 선행 | 재시작·재열기 실패 반복 |
| durable DB | SQLite WAL | PostgreSQL 선행 | 다중 host·writer 병목 |
| asset 저장 | source-controlled manifest | CAS 선행 | 다중 기여자·release·recall |
| 생성 | 없음 | runtime AI | 검토 포함 제작 병목 |
| 통계 | session descriptive | mastery·prediction | 타당화된 데이터·목적 |
| 연동 | export | LTI·OneRoster 선행 | 여러 adopter의 같은 blocker |
| 차별화 | 동일본·병렬 form·provenance | tool breadth | classroom 반복 사용 |

## 16. 근거와 한계

### 저장소 근거

- `README.md`
- `REVIEW.md`
- `PROVENANCE.md`
- `package.json`
- `src/engine/worksheet.mjs`
- `src/engine/response-log.mjs`
- `src/server/app.mjs`
- `src/server/grade.mjs`
- `schema/worksheet.schema.json`
- `schema/item.schema.json`
- `docs/asset-procurement.md`
- `docs/research/digi-mon-next-improvements.md`
- `docs/design/client-experience.md`
- `docs/design/design-system.md`
- `docs/offline-asset-platform.md`
- `docs/operational-data-model.md`

### 외부 근거

1. SQLite, *Situations Where SQLite Works Well*.
   <https://www.sqlite.org/whentouse.html>
2. SQLite, *Write-Ahead Logging*.
   <https://www.sqlite.org/wal.html>
3. MDN, *Using Service Workers*.
   <https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers>
4. web.dev, *Service workers*.
   <https://web.dev/learn/pwa/service-workers/>
5. PostgreSQL, *JSON Types*.
   <https://www.postgresql.org/docs/current/datatype-json.html>
6. PostgreSQL, *Row Security Policies*.
   <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
7. W3C, *Web Content Accessibility Guidelines 2.2*.
   <https://www.w3.org/TR/WCAG22/>
8. 개인정보보호위원회 개인정보 포털, 아동·청소년 개인정보 보호 가이드라인.
   <https://www.privacy.go.kr/front/bbs/bbsView.do?bbsNo=BBSMSTR_000000000049&bbscttNo=13653>
9. UNESCO, *Guidance for generative AI in education and research*.
   <https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research>
10. NIST, *AI Risk Management Framework*.
    <https://www.nist.gov/itl/ai-risk-management-framework>
11. NIST, *Generative Artificial Intelligence Profile*.
    <https://doi.org/10.6028/NIST.AI.600-1>
12. IETF RFC 8785, *JSON Canonicalization Scheme*.
    <https://www.rfc-editor.org/rfc/rfc8785>
13. IETF RFC 6920, *Naming Things with Hashes*.
    <https://www.rfc-editor.org/rfc/rfc6920>
14. SPDX, *Specifications*.
    <https://spdx.dev/specifications/>
15. OpenAI, *Batch API*.
    <https://platform.openai.com/docs/guides/batch>
16. OpenAI, *Image generation*.
    <https://platform.openai.com/docs/guides/image-generation>
17. 1EdTech, *CASE*.
    <https://www.1edtech.org/standards/case>
18. 1EdTech, *QTI*.
    <https://www.1edtech.org/standards/qti>
19. 1EdTech, *OneRoster*.
    <https://www.1edtech.org/standards/oneroster>
20. Google Classroom Help, *Create a class*.
    <https://support.google.com/edu/classroom/answer/6020273>
21. Google Classroom Help, *Reuse a post*.
    <https://support.google.com/edu/classroom/answer/6272593>
22. MagicSchool, *Pricing*.
    <https://www.magicschool.ai/pricing>
23. Diffit, product site.
    <https://web.diffit.me/>
24. Khanmigo, *Teachers*.
    <https://www.khanmigo.ai/teachers>
25. Kahoot!, *School plans*.
    <https://kahoot.com/schools/plans/>
26. MathFlat, product site.
    <https://www.mathflat.com/>
시장 페이지는 각 회사의 자기 설명이며 독립 효과 검증이 아니다. 가격·기능은
2026-08-09 접근 시점의 snapshot이다. 외부 표준과 지침도 구현 적합성·법률 준수·
교육 타당도를 자동 보증하지 않는다.

## 17. 최종 권고

다음 제품 구현은 중앙 플랫폼이 아니라 **로컬 print-first 교사 client**여야 한다.
사용자의 후속 요구로 먼저 만드는 코드 차별화는 이 P0 흐름에 포함되는 **결정적
병렬 form**이다. 이 조합은 현재 코드의 강점인 결정성, fingerprint, 승인 경계,
fail-closed를 제품 가치로 바꾸면서도 학생 개인정보와 운영 복잡성을 거의 늘리지
않는다.

교사 5명의 첫 인쇄 관찰 중앙값이 코칭 없이 3분 이하이고, 동일본을 다시 열고,
결과를 보고 다음 행동을 바꾸며, 자발적으로 반복 사용할 때 다음 단계로 간다.
그 전에는 DB, 생성 media, analytics, integration을 추가하지 않는다.
