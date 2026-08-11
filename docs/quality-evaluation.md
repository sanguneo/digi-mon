# 대표 학습지 사람 품질 평가

이 문서는 사람이 작성하는 판정 원장이다. 표본과 정답은 [생성된 품질 기준선](review/quality-baseline.md)에서 읽는다.
생성 성공, schema 통과, 자동 검산은 교육적 품질 승인이 아니다.

baselineFingerprint: `6afd44fc45f4ccb8d54304b97511014076f729010b63665c652433b3c1516ef0`
reviewer: `pending`
reviewDate: `pending`

## 범위

- 대상: 고정 seed 학습지 24개, 각 10문항, 총 240문항
- 조합: 수학·국어 1-2/3-4/5-6, 영어 3-4/5-6 × 난이도 1/2/3
- 사례 ID의 D1/D2/D3는 요청 난이도다. single-axis 생성기가 섞인 실제 난이도
  histogram은 생성 표본에 별도로 표시하며, 차이를 숨기지 않고 검토 근거로 삼는다.
- 각 사례 판정은 표의 worksheet fingerprint에 고정된다. fingerprint가 바뀌면 해당 사례는 다시 `pending`이다.
- 검토 완료는 이 표본만 통과했다는 뜻이다. 교실 적합성, 숙달·진단 타당성, 표본 밖 생성기를 승인하지 않는다.
- 완료 판정자는 검토 대상 생성기나 자산을 작성하지 않은 사람이어야 한다.

## 여섯 평가 축

| slug | 단위 | 사람이 확인할 것 |
|---|---|---|
| `curriculum-alignment` | 문항 | 성취기준을 실제로 재는지, 학년군 수준인지, 상위 개념이 섞이지 않았는지 |
| `answer-correctness` | 문항 | 정답·허용 답안·풀이가 옳고 사람 채점 rubric이 판정 가능한지 |
| `wording-naturalness` | 문항 | 중의성 없이 자연스럽고 학년군 어감에 맞는지 |
| `distractor-quality` | 문항 | 선택형 오답이 그럴듯하며 변호 가능한 정답이 정확히 하나인지 |
| `perceived-difficulty` | 문항 | 선언 난이도가 해당 학년군의 체감 난이도와 맞는지 |
| `repetition` | 학습지 | 같은 틀이나 유형이 체감상 과도하게 반복되지 않는지 |

코드 형식, 산술 검산, 조사·맞춤법 기계 검사, 선택지 중복, 계산 크기 단조성, `dedupeKey` 중복은 자동 게이트 범위다.
이 표에서는 게이트가 판단하지 못하는 교육적 타당성만 판정한다.

## 판정 어휘

- 공통 네 축: `pass` / `fix` / `undecidable` / `n-a`
- `n-a`는 비선택형 문항의 `distractor-quality`에만 허용한다.
- 체감 난이도: `match` / `easier` / `harder` / `undecidable`
- 반복: `varied` / `repetitive` / `undecidable`
- `pending`은 아직 읽지 않은 초기 상태다. 통과로 세지 않는다.
- 숫자 점수와 평균은 만들지 않는다. 결함 방향과 근거를 보존한다.

## 검토 방법

1. 사례의 학습지와 정답·풀이 10문항을 모두 읽는다.
2. 한 문항이라도 결함이 있으면 사례 축을 `fix`로 적고 메모에 문항 번호와 근거를 남긴다.
3. 체감 난이도가 다르면 `easier` 또는 `harder`, 반복이 심하면 `repetitive`로 방향을 보존한다.
4. 판단할 전문성이 부족하면 `undecidable`로 두고 다른 검토자에게 넘긴다.
5. `fix`는 `docs/fix-directives.md` 항목으로 옮기고 수정 후 같은 seed로 재생성한다.

## 예비 과목별 관찰

2026-08-11 사용자의 첫 전체 인상을 다음 검토 가설로 기록한다.

- 영어: 전반적으로 요청 수준보다 쉬워 보인다.
- 수학: 전반적으로 요청 수준보다 어려워 보인다.
- 국어: 쉬워 보이지만 판단 확신이 낮다.

사용자는 이 인상이 일부 문항의 결함이 아니라 교과 전체 경향이라고 확인했다.
따라서 개별 문항이나 생성기를 하나씩 조정하지 않고, 난이도 옵션을 생략한 일반
학습지의 기본 mix를 엔진 한 곳에서 다음처럼 보정한다.

- 수학: 난이도 1/2/3을 `45/45/10`으로 배분해 전체적으로 완화한다.
- 국어·영어: 난이도 1/2/3을 `15/50/35`로 배분해 전체적으로 강화한다.
- 호출자가 `difficulty` 또는 `difficultyMix`를 명시하면 요청값을 그대로 사용한다.

사례 판정표는 근거 문항이 확인되기 전까지 `pending`을 유지한다. 이후 표본 검토는
개별 생성기를 임시 수정하기 위한 목록이 아니라 전역 보정 방향이 맞는지 확인하는
증거로 사용한다.

## 사례 판정표

| 사례 | 대상 fingerprint | 정렬 | 정답 | 발문 | 선택지 | 체감 난이도 | 반복 | 종합 | 근거·문항 번호 |
|---|---|---|---|---|---|---|---|---|---|
| `WS-M12-D1` | `6053d57c6f0e3056a4987cce0a7114c8e676e325d0381f667a54be2c8fe89b2e` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M12-D2` | `bb6020dc99f6959db8fcafd437d3170df627bf2215eb6b03be8c1b55739a3eae` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M12-D3` | `2045d5b73d5d6b162e511e07a909e487711ce8f06eab0e79c824471c0944dda6` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M34-D1` | `c3a4468341e655f42c2a8e7abb6517423760473b877c804cf62ccb15f665e2af` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M34-D2` | `c5a6e8f8cfc7bb80a78046540a6167c031ab18c3612b84b10090d112607e2775` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M34-D3` | `e5d86db4aefa1bbf26f7585b15913c62db96c3eb987b4d7ecffbe174004ed12e` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M56-D1` | `22cb5ee3af8f55234f88d711f55dafcc69b39f7305e27669fb3ad66748b109c3` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M56-D2` | `e586200cc122899c534d11c087e21569a93b97d46297d4eb4101d7fb3c02c4fc` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M56-D3` | `d321c4b540cafc2c19d726120d9f57ac45b8b8964339c471d2beda2d3cec68d0` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K12-D1` | `bd21cf527ed282e7aa48fbe4d81d425f58adb906f1ad5792c1db642b849b1de6` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K12-D2` | `e410f78a0624737e53ee4437ce9a544d814887ea0ab4d5512652b7d7a8ff491d` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K12-D3` | `6ef5deac6b74155c9e22f881749f6d49797aafbda5efd3e6404492c675176ab5` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K34-D1` | `df902811d24bee7f39c0e54e3b382ecf3c0a1d539e38a315bf395f58ba1bc526` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K34-D2` | `752315b5db975b384d8f2bea0aef186bca9cfe801baf8e20301cede7aff20f6b` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K34-D3` | `61732523257f5139c79b24f514109ef822c63290c8d59a63ef254abbf523496f` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K56-D1` | `c0d3354c5b073c8671f3ded6e47156fb8d13c101449d6c9935d994cd495bdc2f` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K56-D2` | `cdf1c8358418c92da86232ff14d1f1c71717a028d94e131dd000bd38d59f6e24` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K56-D3` | `3286f00d729f61c5eb9d4c5bde5a1ccf73ffedb42ec3b0934f5bada7679bb4d4` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E34-D1` | `de202e416299ef420074d765023e9356f24da47d262f0b65747e99c0d370ae2f` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E34-D2` | `d54ec57338352490e88f8020bd11ff50b0e685b98f03c11d0df1d0057e524af8` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E34-D3` | `1588681c697f6da79f9249bc091c3a7eb8d019fba1f2e78118030a8058ca7b63` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E56-D1` | `5e5c655fa8292256f59317cc06d43ccc2b3d08dfd67e77b6562b970a2e8d0161` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E56-D2` | `9884b490065dcc4d55bebf82e6e12a5f781554e189952271e3b2ca3e7326d103` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E56-D3` | `6c05ae2acd61b879295fa00c4481cbeb26fcc7917c507e5d21c471b33d47bc0e` | pending | pending | pending | pending | pending | pending | pending | — |

## 발견사항 원장

| ID | 심각도 | 빈도 | 사례·문항 | 요약 | 상태 |
|---|---|---:|---|---|---|

심각도는 `blocker` / `major` / `minor`로 기록한다. 빈도는 240문항 중 관찰 횟수다.

## 완료 판정

다음을 모두 만족해야 이 기준선 검토가 끝난다.

1. 검토자와 검토일이 기록되어 있다.
2. 24개 사례의 모든 칸에서 `pending`이 사라졌다.
3. `fix`와 `undecidable`이 남아 있지 않다.
4. 체감 난이도는 모두 `match`, 반복은 모두 `varied`다.
5. 표의 fingerprint가 현재 manifest와 일치한다.
6. 발견사항 원장의 미해결 항목이 0개다.
