# 클라이언트 디자인 시스템

이 문서는 digi-mon 학습지를 사람이 보는 화면과 인쇄물의 시각 계약이다. 토큰 원본은
[`tokens.css`](tokens.css)다. 실제 클라이언트 표본은 파일럿 구현과 함께 만들고
브라우저·인쇄 QA를 통과한 뒤 이 계약의 증거로 연결한다.

엔진은 이 파일들을 읽지 않는다. `tools/check-boundaries.mjs` 가 `src/`·`bin/` 에서
PDF·DOM·`@media print` 를 위반으로 잡으므로 화면 관심사는 여기에만 있다.

## 1. 시작 상태 — 무엇이 이미 있었나

디자인 시스템은 없었다. 대신 두 곳에 시각 결정이 흩어져 있었고 둘 다 살릴 값이었다.

| 출처 | 결정 | 처리 |
|---|---|---|
| `src/render/svg-base.mjs` `SVG_STYLE.stroke` | 도해 선 `#111111` | `--dm-ink` 로 승격. 화면과 도해가 같은 검정을 쓴다 |
| `src/render/svg-base.mjs` `SVG_STYLE.font` | `system-ui, -apple-system, "Malgun Gothic", sans-serif` | `--dm-font-ui` 의 마지막 fallback 으로 유지 |
| `src/render/svg-base.mjs` `SVG_STYLE.light` | 보조선 `#9aa0a6` | **대비 미달**. §5 결함으로 보고 |
| `out/figures/gallery.html` (도구) | 카드 `border-radius: 8px`, `1px #ddd` 테두리 | `--dm-radius-md`, `--dm-border-hairline` 로 정규화 |
| `out/figures/gallery.html` | 간격 `8px`/`14px`/`16px` 혼재 | 4px 격자로 정규화(`--dm-space-*`) |
| `src/render/worksheet-text.mjs` | 답란 `답: ______`, 작도 문항의 사각 박스 | 인쇄 토큰 `--dm-print-answer-line`, `--dm-print-draw-box` 로 옮김 |

## 2. 토큰

### 색

주제는 **잉크와 종이**다. 학습지는 결국 종이로 나가고, 화면은 그 종이의 미리보기다.
그래서 바탕은 흰 종이와 살짝 눌린 종이(`--dm-paper-sunk`) 두 장뿐이고, 나머지는
잉크 농도 단계다.

대비비는 계산값이다(WCAG 2.x 상대휘도, 흰 종이 기준).

| 토큰 | 값 | 흰 종이 대비 | 용도 |
|---|---|---:|---|
| `--dm-ink` | `#111111` | 18.88:1 | 본문, 도해 선 |
| `--dm-ink-muted` | `#3f4448` | 9.85:1 | 보조 설명 |
| `--dm-ink-soft` | `#767676` | 4.54:1 | 본문 최소 통과선 |
| `--dm-ink-hint` | `#949494` | 3.03:1 | 의미 있는 비텍스트 최소 통과선 |
| `--dm-rule` | `#d8d2c6` | 1.50:1 | 장식 괘선 전용 |
| `--dm-accent-math` | `#0f6b5f` | 6.39:1 | 수학 스코프 |
| `--dm-accent-korean` | `#a6301e` | 6.86:1 | 국어 스코프 |
| `--dm-accent-english` | `#1d3f73` | 10.44:1 | 영어 스코프 |
| `--dm-state-success` | `#1f6b45` | 6.47:1 | 맞음, 승인 |
| `--dm-state-warning` | `#8a5a00` | 5.93:1 | 표본 부족, 용량 부족 |
| `--dm-state-danger` | `#9b1c1c` | 8.15:1 | fingerprint 불일치, 반려 |

**색은 보조 신호다.** 교과 accent 를 Rec.601 회색으로 환산하면 수학 78, 국어 81 로
사실상 같다. 흑백 프린터에서 두 색은 구별되지 않는다. 그래서 교과·상태·정오답은
전부 라벨이나 형태를 함께 쓴다(WCAG 2.2 SC 1.4.1).

accent 와 상태색이 같은 면에서 붉게 겹치는 것을 막기 위해 사용 위치를 나눴다.
accent 는 교과 스코프 표면의 좌측 4px 띠(`--dm-border-edge`)에만, 상태색은 배지와
알림에만 쓴다.

### 활자

일반 sans(Arial·Inter·Roboto) 대신 한국 학교 문서에 맞는 스택을 쓴다. 교사 콘솔은
정보 밀도가 필요하므로 `Pretendard Variable`, 학습자 화면은 저학년 가독성을 위해
둥근 `NanumSquareRound`, fingerprint·seed 는 `D2Coding` 고정폭이다. 마지막 fallback 은
`SVG_STYLE.font` 와 같은 스택이라 도해 안 라벨과 화면 라벨이 어긋나지 않는다.

첫 후보 두 글꼴의 **배포 라이선스는 파일럿 전 확인 대상**이다. 확인되지 않으면
fallback 스택만으로도 시스템이 성립한다.

스케일은 두 벌이다. 같은 컴포넌트를 크게 쓰는 것이지 다른 컴포넌트가 아니다.

| 역할 | 교사 콘솔 | 학습자(`[data-dm-scale='learner']`) |
|---|---:|---:|
| caption | 12px | 12px |
| small | 14px | 14px |
| body | 16px | **20px** |
| lead | 20px | **24px** |
| h3 | 24px | **28px** |

학습자 행간은 `--dm-leading-loose`(1.8)다. 한글 발문은 조사까지 눈이 따라가야 한다.

### 간격·모서리·동작·조작 대상

- 간격: 4px 격자(`--dm-space-1` = 4px … `--dm-space-16` = 64px). 임의 13px·7px 금지.
- 모서리: 4 / 8 / 12 / pill. 8px 은 기존 갤러리 카드에서 가져왔다.
- 동작: 120 / 200 / 320ms. **평가 중 화면은 움직이지 않는다.** 문항 전환에
  애니메이션을 넣으면 무엇이 바뀌었는지 다시 읽어야 한다. 교사 콘솔 카드 등장에만
  쓰고 `prefers-reduced-motion` 에서 0ms 로 떨어진다.
- 조작 대상: WCAG 2.2 SC 2.5.8 최소는 24px 이지만 초등 태블릿에 부족하다. 제품
  기준을 `--dm-target` 48px, 학습자 주 조작을 `--dm-target-primary` 56px 로 올렸다.

## 3. 컴포넌트 원형

`dm-` 접두사 + BEM-lite(`dm-btn--primary`). 저장소에 CSS 관행이 없었으므로 여기서 정한다.

| 원형 | 무엇인가 |
|---|---|
| `dm-btn` | 버튼. `--primary` / `--quiet` / `--danger` |
| `dm-card` | 종이 한 장. 교과 스코프면 좌측 4px 띠 |
| `dm-note` | 근거·제약을 적는 칸. `--warn` / `--info` / `--danger` |
| `dm-seal` | 학습지 도장. seed + fingerprint 앞 12자. 고정폭 |
| `dm-badge` | `scoring: manual`, `access: requires-visual`, `표본 부족` 등 사실 라벨 |
| `dm-meter` | 성취기준당 문항 수·용량 같은 수치 막대 |
| `dm-item` | 문항 한 개. `__number` `__instruction` `__stem` `__figure` `__answer` |
| `dm-choice` | 선택지 버튼. 라벨(①)은 형태로, 선택 상태는 테두리 두께로 표시 |
| `dm-answer-pad` | 학습자 답 입력. 하단 고정 |
| `dm-progress` | 문항 진행 점. 백분율·타이머를 쓰지 않는다 |
| `dm-inbox-row` | 자산 검토 인박스 한 줄 |
| `dm-queue` | 오프라인 제출 대기 알림 |

## 4. 구현 시 확인 방법

실제 클라이언트 표본은 아직 없다. 파일럿 구현에서는 엔진이 실제로 낸 SVG를 사용한
화면·A4 인쇄 표본을 만들고 브라우저에서 직접 확인한다. 기계 검사도 다음 세 가지를
추가한다.

1. 클라이언트 스타일에 토큰 밖 raw hex 색이 0건인가
2. 클라이언트가 쓰는 모든 `var(--dm-*)` 가 `tokens.css` 에 정의돼 있는가
3. 클라이언트 스타일에 4px 격자 밖 px 리터럴이 0건인가

## 5. 발견한 결함 두 건

설계 도중 엔진 쪽 결함이 두 개 나왔다. **이 회차에서 고치지 않았다** — 설계 범위
밖의 엔진 변경이고 `npm run verify` 산출물 재생성을 동반한다. 근거와 수정안만 남긴다.

### 5-1. `SVG_STYLE.light` 가 비텍스트 대비 미달

`#9aa0a6` 은 흰 배경에서 **2.64:1** 이다. WCAG 2.2 SC 1.4.11 은 의미를 전달하는
비텍스트에 3:1 을 요구한다. 이 색은 장식이 아니라 의미를 담은 곳에 쓰인다.

| 위치 | 무엇을 그리는가 |
|---|---|
| `figure-svg.mjs:49` | 시계 분 눈금 |
| `figure-svg.mjs:140` | 자의 보조 눈금 |
| `figure-svg.mjs:169` | 묶음 테두리 |
| `figure-geometry34.mjs:264` | 다각형 대각선 |
| `figure-geometry34.mjs:303` | 밀기·뒤집기 화살표 |
| `figure-geometry34.mjs:366` | 막대그래프 눈금선 |

대각선 개수를 세는 문항에서 대각선이 안 보이면 문항이 성립하지 않는다.

**수정안:** `#767676`(4.54:1) 또는 최소 `#949494`(3.03:1).

**fingerprint 안전성 확인:** SVG 는 학습지 조립이 아니라 응답 직전
`attachFigureSvg` 에서 붙는다. 그림 문항 9개가 든 30문항 학습지를 직렬화해 확인한
결과 fingerprint 입력 안에 `figure.svg` 키 0개, `<svg` 0건, `#9aa0a6` 0건이다.
색을 바꿔도 기발급 학습지의 fingerprint 는 바뀌지 않는다.

### 5-2. 도해 SVG 의 `font-family` 속성이 XML 로 깨진다

`svgText()` 가 `SVG_STYLE.font` 를 이스케이프 없이 큰따옴표 속성값에 넣는다. 결과는
다음과 같다.

```text
font-family="system-ui, -apple-system, "Malgun Gothic", sans-serif"
```

속성값이 첫 `"` 에서 끝나므로 뒤가 잘린 속성 파편이 된다. HTML 파서는 관용적이라
인라인 삽입은 렌더되지만, `image/svg+xml` 로 내려보내거나 엄격한 XML 파서를 쓰면
문서 전체가 실패한다. `altText` 는 `escapeXml` 을 통과하므로 이 문제는 글꼴 속성에만
있다.

**클라이언트 쪽 대응(이번 설계에 반영):** 도해는 HTML 안에 **인라인**으로만 싣는다.
별도 `.svg` 파일이나 `<img src>` 로 내려보내지 않는다.

**엔진 쪽 수정안:** `escapeXml(SVG_STYLE.font)` 를 적용하거나 스택에서 인용부호를
없앤다(`Malgun Gothic` → 공백 있는 이름은 CSS 스택에서만 인용).

## 6. 근거

| 항목 | 근거 | 수준 |
|---|---|---|
| ink·font 스택이 도해와 같아야 함 | `src/render/svg-base.mjs` | 저장소 확인 |
| 카드 8px·1px 테두리 | `tools/figure-gallery.mjs` 생성 HTML | 저장소 확인 |
| 대비비 수치 전량 | WCAG 상대휘도 공식으로 계산, 이 회차 실행 | 계산값 |
| accent 회색 환산 78/81/59 | Rec.601 계산, 이 회차 실행 | 계산값 |
| `SVG_STYLE.light` 사용 위치 6곳 | `grep` 결과 | 저장소 확인 |
| SVG 가 fingerprint 입력이 아님 | 30문항 직렬화 검사, 이 회차 실행 | 실측 |
| 비텍스트 3:1 | W3C WCAG 2.2 SC 1.4.11 <https://www.w3.org/TR/WCAG22/> | 외부 표준 |
| 대상 크기 24px 최소 | W3C WCAG 2.2 SC 2.5.8 | 외부 표준 |
| 색만으로 정보 전달 금지 | W3C WCAG 2.2 SC 1.4.1 | 외부 표준 |
| 48px 조작 대상, 저학년 행간 1.8 | 초등 태블릿 대상의 제품 판단 | 설계 판단(미검증) |
| 글꼴 후보의 배포 라이선스 | 확인하지 않음 | **파일럿 전 확인 필요** |
