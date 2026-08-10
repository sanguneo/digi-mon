# 고지

## 저작과 라이선스

digi-mon은 sanguneo(github.com/sanguneo)가 저작한 프로젝트다. 저장소가 직접
작성한 코드, 문항 생성기, 사실 표, 문장·어휘 시드 목록과 문서는
`LICENSE`의 MIT 조건으로 배포한다.

`data/spine/standards.json`은 현재 저장소 안에 고정된 실행 코퍼스이지만, 최초
버전의 역사적 파생 계보가 남아 있다. 해당 데이터의 공개 배포 조건은
`PROVENANCE.md`의 라이선스 검토 경계를 따른다.

## 독립 실행

현재 digi-mon은 외부 교육과정 저장소를 설치하거나 읽지 않는다.

- CI는 digi-mon 저장소 하나만 체크아웃한다.
- 실행 시 형제 저장소나 `KELM_DIR`를 탐색하지 않는다.
- 내부 성취기준 스파인과 세 교육부 별책 Markdown의 고정 해시를 검증한다.
- 문제 생성과 채점 중 외부 네트워크나 모델을 호출하지 않는다.

## 역사적 출처 표시

내부 성취기준 스파인의 최초 버전은 다음 자료를 읽어 만든 파생 스냅샷이다.

- 이름: Korean Elementary Learning Map
- 저장소: [github.com/DECK6/korean-elementary-learning-map](https://github.com/DECK6/korean-elementary-learning-map)
- 저작자: DECK
- 당시 사용 버전: `kr-full-depth-v0.4`
- 당시 확인한 커밋: `3ef0563`

현재 실행은 이 저장소에 의존하지 않지만, 과거 데이터 계보와 저작자 표시는
지우지 않는다. 당시 저장소의 라이선스 선언 충돌과 공개 전 확인 사항은
`PROVENANCE.md`에 기록한다.

Korean Elementary Learning Map은 학습 그래프 접근의 영감을
Marble Skill Taxonomy에서 받았다고 밝혔다. digi-mon은 Marble의 데이터베이스나
저작 콘텐츠를 직접 사용하지 않는다.

## 공식 교육과정 자료

2022 개정 교육과정 성취기준은 저장소에 포함된 교육부 고시 제2022-33호
국어 `[별책 5]`, 수학 `[별책 8]`, 영어 `[별책 14]` Markdown과 직접 대조한다.

직접 출처:
[NCIC 2022 개정 초·중등학교 교육과정 고시 안내](https://ncic.go.kr/board/B0033.cs?act=read&bwrId=2105&pageIndex=2&pageUnit=15)
(접근일 2026-08-06).

영어 어휘의 상세 출처와 판정 경계는
`docs/assets/english-vocabulary-provenance.md`에 기록한다.

## 비보증

- 이 프로젝트는 교육부·국가교육위원회·국가교육과정정보센터의 공식 제품이
  아니며 해당 기관의 보증을 받지 않았다.
- DECK6은 digi-mon을 보증하지 않는다. 역사적 출처 표시는 제휴나 승인을
  뜻하지 않는다.
- 이 프로젝트는 개별 학습자를 진단하지 않는다.
