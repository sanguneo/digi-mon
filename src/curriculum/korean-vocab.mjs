import { finalOf } from '../engine/hangul.mjs';

/**
 * 학년군 어휘의 단일 출처.
 *
 * 이 목록은 이 저장소가 시드한 것이고 공식 어휘 목록이 아니다. 교과 전문가 검토
 * 대상이며, 2022 개정 별표의 어휘 자료로 교체·확장할 자리다.
 *
 * 왜 여기 다 모으는가:
 * 생성기가 자기 낱말 목록을 따로 들고 있으면 어휘 게이트가 무의미해진다.
 * 게이트는 '목록에 없는 낱말'을 잡는데, 생성기가 목록을 안 보고 자기 것을 쓰면
 * 게이트는 늘 실패하고 사람은 게이트를 끄게 된다. 그래서 문항이 가르치는
 * 어휘 묶음(반대말·높임말·방언·관용 표현)도 여기 두고 생성기가 여기서 가져간다.
 *
 * 누적 규칙: 상위 학년군은 하위 학년군 어휘를 모두 쓸 수 있다.
 */

/** 1~2학년 생활 어휘. 받침 없는 낱말과 기본 받침 낱말 위주. */
const LIFE_G12 = [
  '나무', '바다', '하늘', '구두', '모자', '오리', '두부', '고기', '아기', '노래',
  '누나', '어머니', '아버지', '머리', '허리', '다리', '지구', '치과', '토마토', '우유',
  '가방', '학교', '연필', '공책', '색종이', '단추', '구슬', '사탕', '수박', '당근',
  '양말', '장갑', '우산', '창문', '거울', '수건', '접시', '숟가락', '젓가락', '냉장고',
  '동생', '선생님', '친구', '교실', '운동장', '칠판', '지우개', '필통', '책상', '의자',
  '강아지', '고양이', '병아리', '토끼', '거북', '금붕어', '나비', '개미', '참새', '비둘기',
  '사과', '딸기', '포도', '바람', '구름', '눈사람', '봄날', '가을', '겨울', '여름',
  '꽃', '풀', '도서관', '아침', '저녁', '오늘', '내일', '어제',
];

/** 3~4학년 생활·개념 어휘. */
const LIFE_G34 = [
  '가족', '이웃', '마을', '시장', '병원', '우체국', '박물관', '경찰서', '소방서',
  '계절', '날씨', '온도', '기온', '습도', '태풍', '지진', '홍수', '가뭄', '환경',
  '식물', '동물', '곤충', '뿌리', '줄기', '열매', '씨앗', '화분', '텃밭', '과일',
  '규칙', '약속', '차례', '순서', '방법', '까닭', '결과', '무늬', '모양', '학용품',
  '생각', '느낌', '마음', '기분', '표정', '행동', '태도', '노력', '용기', '정직',
  '문장', '낱말', '글자', '받침', '문단', '주제', '제목', '내용', '설명', '가구',
];

/** 5~6학년 개념·한자어. */
const LIFE_G56 = [
  '의미', '관계', '비유', '상징', '주장', '근거', '토론', '설득', '가치',
  '문화', '전통', '역사', '사회', '경제', '정치', '법률', '권리', '의무', '책임',
  '자원', '기술', '발명', '산업', '무역', '통계', '자료', '조사', '분석',
  '예의', '배려', '존중', '공동체', '지역', '성분', '호응', '시간', '띄어쓰기',
  '과거', '현재', '미래', '작년', '다음', '지금',
];

// ---------------------------------------------------------------------------
// 문항이 가르치는 어휘 묶음. 생성기가 여기서 가져간다.
// ---------------------------------------------------------------------------

/** [4국04-01] 뜻이 반대인 낱말 짝. */
export const ANTONYMS = [
  ['크다', '작다'], ['많다', '적다'], ['길다', '짧다'], ['높다', '낮다'],
  ['넓다', '좁다'], ['무겁다', '가볍다'], ['빠르다', '느리다'], ['밝다', '어둡다'],
  ['깊다', '얕다'], ['두껍다', '얇다'],
];

/** [4국04-01] 포함 관계. general 이 specific 을 모두 포함한다. */
export const HYPERNYMS = [
  { general: '동물', specific: ['강아지', '고양이', '토끼', '병아리'] },
  { general: '식물', specific: ['나무', '꽃', '풀'] },
  { general: '과일', specific: ['사과', '딸기', '포도', '수박'] },
  { general: '학용품', specific: ['연필', '공책', '지우개', '필통'] },
  { general: '가구', specific: ['책상', '의자'] },
];

/** [4국04-04] 높임 표현 짝. */
export const HONORIFICS = [
  { plain: '먹다', honorific: '드시다' },
  { plain: '자다', honorific: '자시다' },
  { plain: '있다', honorific: '계시다' },
  { plain: '말하다', honorific: '말씀하시다' },
  { plain: '주다', honorific: '드리다' },
  { plain: '데리다', honorific: '모시다' },
];

/** [6국04-02] 표준어와 방언 짝. */
export const DIALECTS = [
  { standard: '부추', dialect: '정구지', region: '경상' },
  { standard: '옥수수', dialect: '강냉이', region: '강원' },
  { standard: '고구마', dialect: '감재', region: '강원' },
  { standard: '진짜', dialect: '참말로', region: '전라' },
];

/** [6국04-03] 관용 표현. */
export const IDIOMS = [
  { idiom: '발이 넓다', meaning: '아는 사람이 많다' },
  { idiom: '손이 크다', meaning: '무엇이든 넉넉하게 준비한다' },
  { idiom: '귀가 얇다', meaning: '남의 말을 쉽게 믿는다' },
  { idiom: '입이 무겁다', meaning: '말을 조심해서 옮긴다' },
  { idiom: '눈이 높다', meaning: '고르는 기준이 까다롭다' },
  { idiom: '어깨가 무겁다', meaning: '책임이 크다' },
];

/** [4국04-03] 주어와 서술어 짜임. 주어는 학년군 어휘에서 고른다. */
export const SENTENCE_FRAMES = [
  { subject: '강아지', predicate: '달립니다' },
  { subject: '나무', predicate: '자랍니다' },
  { subject: '친구', predicate: '웃습니다' },
  { subject: '동생', predicate: '잡니다' },
  { subject: '고양이', predicate: '뜁니다' },
  { subject: '나비', predicate: '날아갑니다' },
];

/** [6국04-05] 시간 부사와 서술어. */
export const TENSE_CASES = [
  { adverb: '어제', tense: '과거', form: '갔습니다', wrong: ['갑니다', '갈 것입니다'] },
  { adverb: '지금', tense: '현재', form: '갑니다', wrong: ['갔습니다', '갈 것입니다'] },
  { adverb: '내일', tense: '미래', form: '갈 것입니다', wrong: ['갔습니다', '갑니다'] },
  { adverb: '작년에', tense: '과거', form: '배웠습니다', wrong: ['배웁니다', '배울 것입니다'] },
];

/**
 * 어휘 묶음에서 낱말만 뽑아 학년군 목록에 더한다.
 * 문항이 가르치는 낱말은 그 학년군의 어휘다.
 */
const TAUGHT_G34 = [
  ...ANTONYMS.flat(),
  ...HYPERNYMS.flatMap((h) => [h.general, ...h.specific]),
  ...HONORIFICS.flatMap((h) => [h.plain, h.honorific]),
  ...SENTENCE_FRAMES.flatMap((f) => [f.subject, f.predicate]),
];

const TAUGHT_G56 = [
  ...DIALECTS.flatMap((d) => [d.standard, d.dialect, d.region]),
  ...TENSE_CASES.flatMap((t) => [t.adverb, t.tense, t.form, ...t.wrong]),
];

const dedupe = (list) => [...new Set(list)];

export const VOCAB_BY_BAND = {
  '1-2': dedupe(LIFE_G12),
  '3-4': dedupe([...LIFE_G12, ...LIFE_G34, ...TAUGHT_G34]),
  '5-6': dedupe([...LIFE_G12, ...LIFE_G34, ...TAUGHT_G34, ...LIFE_G56, ...TAUGHT_G56]),
};

export function vocabularyFor(gradeBand) {
  const list = VOCAB_BY_BAND[gradeBand];
  if (!list) throw new Error(`어휘 목록이 없는 학년군: ${gradeBand}`);
  return list;
}

export function isAllowedWord(word, gradeBand) {
  return vocabularyFor(gradeBand).includes(word);
}

/**
 * 받침이 있는/없는 낱말. 표기·조사 문항은 받침 유무로 갈린다.
 * 한 글자로 된 낱말은 자모 세기·사전 순서 문항에 쓰기 어려우므로 두 글자 이상만 준다.
 */
export function wordsWithFinal(gradeBand, want) {
  return vocabularyFor(gradeBand)
    .filter((w) => [...w].length >= 2 && !w.includes(' '))
    .filter((w) => (finalOf(w) !== '') === want);
}

/** 글자 수로 고른다. 사전 순서 문항은 글자 수를 맞추면 첫 글자 비교가 초점이 된다. */
export function wordsOfLength(gradeBand, length) {
  return vocabularyFor(gradeBand).filter((w) => [...w].length === length && !w.includes(' '));
}

/** 자모·표기 문항에 쓸 수 있는 순수 명사. 용언(다로 끝나는 말)과 띄어쓴 말을 뺀다. */
export function plainNouns(gradeBand) {
  return vocabularyFor(gradeBand).filter((w) =>
    [...w].length >= 2 && !w.includes(' ') && !/다$/.test(w) && !/니다$/.test(w));
}
