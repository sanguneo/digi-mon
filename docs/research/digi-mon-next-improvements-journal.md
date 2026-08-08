# digi-mon 후속 개선 울트라리서치 저널

## 범위

- 기준 커밋: `694721b`
- 코드 기준선: 성취기준 248개, 생성기 193개
- 자동채점 커버리지: 150/194
- 승인 의미 정렬: 119/248
- 미충족 자동채점 기준: 44개
- 자동채점 불가 기준: 54개
- 출력 형식: Markdown 원본, PDF, DOCX

## 연구 질문

1. 현재 저장소에서 바로 구현할 수 있는 가장 높은 가치의 개선은 무엇인가?
2. 음성·지문·매체·학습자 데이터·전문가 판단이 필요한 경계는 어디인가?
3. LLM/TTS는 런타임이 아니라 비동기 자산 공급망에서 어떤 역할을 맡아야 하는가?
4. 평가 타당도·접근성·보안·상호운용성을 어떤 순서로 강화해야 하는가?
5. 비용과 복잡성에 비해 가치가 낮은 제안은 무엇인가?

## 실행 기록

- 네이티브 협업 팀을 두 가지 구성으로 시작했으나 runner가 모든 구성원을 시작
  단계에서 거부했다.
- 실패 팀을 정리하고 동일 연구 축을 독립 subagent 7개로 전환했다.
- 연구 축: 교육과정, 평가과학, LLM/TTS 자산, 접근성, 보안·표준,
  적대적 검토, 권위 있는 외부 출처.
- `reference/original/`은 열지 않는다.
- 공식·표준·1차 출처를 우선하고, 일반 웹 접근이 막힐 때만 CDP `:9222`를 사용한다.

## 증거 판정 규칙

- 저장소 사실은 파일·테스트·생성 원장으로 확인한다.
- 외부 주장은 공식 표준, 정부·표준기구 문서 또는 동료심사 연구로 뒷받침한다.
- 학습자 데이터 없이 난이도·타당도·공정성을 확정하지 않는다.
- 자산이나 전문가 검토가 필요한 기준을 객관식 프록시로 커버하지 않는다.
- 새 인프라는 현재 계약으로 해결할 수 없는 문제가 입증된 경우에만 권고한다.

## 완료된 연구 축

- 교육과정: 32개 후보 의미 정렬 리뷰 큐를 최우선으로 판정
- 평가과학: ECD traceability와 설명적 불확실성을 우선하고 psychometrics는 유보
- LLM/TTS: local manifest부터 시작하고 runtime live generation을 금지
- 접근성: complex SVG의 구조화 대안과 media schema를 우선
- 보안·표준: deployment boundary, schema validation, CASE-first adapter 권고
- 적대적 검토: 대형 DB·전체 QTI·즉시 audio를 과잉 설계로 반려
- 외부 출처: NCIC, NIST, OWASP, W3C, 1EdTech, Testing Standards 확인

## 합의된 순서

1. semantic review queue
2. local asset manifest/revision hash
3. deployment·schema boundary
4. structured media pilot
5. minimal ECD metadata·descriptive telemetry
6. passage pilot
7. audio/TTS pilot

## 최종 산출물

| 파일 | SHA-256 |
|---|---|
| `digi-mon-next-improvements.md` | `56b0f604a387a678808a7c05a330f4065e7ce10608e39fba3f3230dce30f93e3` |
| `digi-mon-next-improvements.pdf` | `f8c2fc387a113b180ac0e38302d8ffd658553d47d3d95695ff74c4ebb9df6ec1` |
| `digi-mon-next-improvements.docx` | `8930079af5ced1cefe37cd183dd247e40adc4975b2be92c21ddba830da9dc451` |
