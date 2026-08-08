# NOTICE

## 저작과 라이선스

**digi-mon**은 sanguneo(github.com/sanguneo)가 저작한 원저작물이다. 저장소가 직접 지은
산출물, 즉 `src/`·`bin/`·`tools/`의 코드, 문항 생성기, 사실 표, 문장·어휘 시드 목록,
문서는 [MIT 라이선스](LICENSE)로 배포한다.

`data/`와 `docs/review/`의 파생 데이터 산출물은 아래 업스트림 데이터셋에서
`npm run verify`로 재생성된다. 이 산출물의 배포 조건은 업스트림 라이선스 확인이
끝나기 전까지 확정하지 않는다. [PROVENANCE.md](PROVENANCE.md) §4를 보라.

## 업스트림 표시

상위 데이터는 **Korean Elementary Learning Map(한국 초등 학습지도)**이다.

- 저장소: [github.com/DECK6/korean-elementary-learning-map](https://github.com/DECK6/korean-elementary-learning-map)
- 저작자 표시: DECK (github.com/DECK6)
- 사용 버전: taxonomy `kr-full-depth-v0.4` (데이터 생성 시각 2026-07-09,
  확인한 체크아웃 커밋 `3ef0563`)
- 사용 방식: 읽기 전용. 이 저장소는 업스트림 원본 파일을 복사·재배포하지 않는다.

업스트림의 `LICENSE`·`NOTICE.md`·`CITATION.cff`는 MIT를 명시하지만, 같은 저장소의
`package.json` license 필드는 `(ODbL-1.0 AND CC-BY-SA-4.0)`이다. 이 충돌은 아직
해소되지 않았고, 파생 데이터의 공개 배포를 막는 릴리스 차단 검증 항목으로
[PROVENANCE.md](PROVENANCE.md) §4에 기록했다.

업스트림 자신의 표시도 보존한다. Korean Elementary Learning Map은 학습 그래프 접근의
영감을 **Marble Skill Taxonomy**(`withmarbleapp/os-taxonomy`, © Generative Spark, Inc.,
[withmarble.com](https://withmarble.com))에서 받았다고 밝혔다. 업스트림은 Marble의 데이터베이스나 저작
콘텐츠를 복제·번역·개작하지 않았다고 밝혔고, digi-mon도 Marble의 어떤 콘텐츠도
사용하지 않는다.

## 비보증

- 이 프로젝트는 교육부·국가교육위원회·국가교육과정정보센터(NCIC)의 공식 간행물이
  아니며, 그 기관들의 보증을 받지 않았다.
- DECK6은 digi-mon을 보증하지 않는다. 업스트림 표시는 저작자 표시이지 제휴·승인의
  표시가 아니다.
- 이 프로젝트는 개별 학습자를 진단하지 않는다.

## 공식 교육과정 문서

2022 개정 교육과정 성취기준은 업스트림 스파인과 저장소의 교육부 고시 Markdown을
함께 대조한다. 국가가 공표한 공개 자료이며, 국어·수학·영어 별책 식별과 접근일을
보존한다. 이 프로젝트는 교육부·NCIC의 공식 서비스가 아니며 공개 자료 사용은
보증·제휴를 뜻하지 않는다.

직접 출처:
[NCIC 2022 개정 초·중등학교 교육과정 고시 안내](https://ncic.go.kr/board/B0033.cs?act=read&bwrId=2105&pageIndex=2&pageUnit=15)
(접근일 2026-08-06).

영어 어휘는 `[별책 14]`의 `[별표 3]`에서 초등 권장 단일 `*` 표제어 800개를
기계 판독한다. 제공된 800단어 자료와 동심공작소 공개 자료는 교육부 원자료 기반의
공개 이용 가능 자료라는 프로젝트 소유자의 확인을 받았다. 상세 기록은
[`docs/assets/english-vocabulary-provenance.md`](docs/assets/english-vocabulary-provenance.md)에
있다.
