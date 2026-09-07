# 대표 학습지 사람 품질 평가

이 문서는 사람이 작성하는 판정 원장이다. 표본과 정답은 [생성된 품질 기준선](review/quality-baseline.md)에서 읽는다.
생성 성공, schema 통과, 자동 검산은 교육적 품질 승인이 아니다.

baselineFingerprint: `58c6eee20402a82425465da12617a5d50b04774ecc6f44f9a674176e735591b7`
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
| `WS-M12-D1` | `55cc5435e1f9c6fbb2d95f1b7a292f77771a5080245011c129abf1b7566d022c` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M12-D2` | `8deca7a09ae3af5a330a39cc5b229db8fdc303d993df262e2a9dba779a6346eb` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M12-D3` | `4e151b71014ecf58205c622e0ce2215135959788a6857fb1a90bbdb85781ee97` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M34-D1` | `247d7f40861cd012fd1513ba17c7ced196893c270e65325a7e1ca305d3c39a67` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M34-D2` | `2348eddd8157baf222ccbf532ce11d92ba8d33a9bc6b0e983ce05abbeb8a3ffa` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M34-D3` | `48820c6786b342b0a80fdc2c4e7c7db127fc644e508b773cf761ffda7c5573d8` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M56-D1` | `2444a67e3199533bb52c441ca995da9d56357503dfa07ec909b64173a757d0b2` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M56-D2` | `2c43f50cace0ec953e91bbc5d5166e409adcbaf66da0d51641a8067543e5f6cf` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-M56-D3` | `fdd4b795948ae6de93b5a9cff94570d794596010f62a31bff4304caf529a09eb` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K12-D1` | `d8d8650b20293f56d7e0687fabe4e45b0c20501828454c09b1fb51c7c6be8b31` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K12-D2` | `efff98d812822f7d002919c4a98bfd5da2af9c9e746ec1eabd9b70e6da5a32b6` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K12-D3` | `b966e4aa1917001620c9a6d3e3e431f1703a5f9ec0f3a42b7cdce3c43f8e4958` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K34-D1` | `40d6748c20a06a5655750ba099dd34057432543543cae365b6d234655f7bf49a` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K34-D2` | `6b7c43ac370e999550e00bd780bf682a908949990de1493a4f16b4543f5f742f` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K34-D3` | `6983293c27b9d2b28337685a25cffc68db5a2215289b1bbb6ce31fe5ccdad0d0` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K56-D1` | `af573894a3fc68bd3032383c626c7f5c0d746692a091df113dd882b42b30e984` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K56-D2` | `feb462e5a1cf095255f4a2a2aa5222fa196c2a6468d0fede90b4104f95d6dcd3` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-K56-D3` | `8b9a8b17bc934495dfaf0067a2267c9385f61006bc64967c5f835148a91add4d` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E34-D1` | `56e1e916dea17e247f1861a62a59fe51acc3fe3acf5e70fac8098efb11f11275` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E34-D2` | `ee46b6df080389bedae9a48beaa5832e82eda7352cc48462eef1afa59f9e0d69` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E34-D3` | `029dd7c4f5b6cf268db832e25dd74c6cd885fd14fc75c279abdd670d764c25e5` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E56-D1` | `06b1f6e56438b347b641b98c9ea16cd7b3ab1107a7584a63e348acb1f7e11caa` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E56-D2` | `717f2fa1599775cd671c39a2efd6d989d535edd9f81d3e0d9e797e8289238e8c` | pending | pending | pending | pending | pending | pending | pending | — |
| `WS-E56-D3` | `a1ce22473b2118b8a72406a807beee873e54a3d68f43f7b6cac5168ef7b5d8b2` | pending | pending | pending | pending | pending | pending | pending | — |

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
