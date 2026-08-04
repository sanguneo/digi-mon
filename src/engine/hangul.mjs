/**
 * 한글 낱자 계산.
 *
 * 자모 분해·사전 순서·받침 판정은 전부 유니코드 계산으로 확정된다.
 * 한글 음절은 0xAC00 부터 (초성 19) × (중성 21) × (종성 28) 순서로 배열되어 있어
 * 나눗셈과 나머지만으로 낱자를 뽑고 사전 순서를 정할 수 있다.
 * 그래서 국어 문법 문항 중 자모·표기·사전 순서는 LLM 없이 파라메트릭으로 만들고
 * 답도 계산으로 검산할 수 있다.
 */

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
const MEDIAL_COUNT = 21;
const FINAL_COUNT = 28;

/** 초성 19자. 사전 순서와 같다. */
export const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/** 중성 21자. 사전 순서와 같다. */
export const MEDIALS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];

/** 종성 27자 + 없음. 첫 칸이 받침 없음이다. */
export const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/**
 * 자모 이름. [2국04-01] '한글 자모 이름과 소릿값' 문항의 정답 근거다.
 * 한글 맞춤법이 정한 이름이므로 규칙이 아니라 목록이다.
 */
export const LETTER_NAMES = {
  ㄱ: '기역', ㄲ: '쌍기역', ㄴ: '니은', ㄷ: '디귿', ㄸ: '쌍디귿',
  ㄹ: '리을', ㅁ: '미음', ㅂ: '비읍', ㅃ: '쌍비읍', ㅅ: '시옷',
  ㅆ: '쌍시옷', ㅇ: '이응', ㅈ: '지읒', ㅉ: '쌍지읒', ㅊ: '치읓',
  ㅋ: '키읔', ㅌ: '티읕', ㅍ: '피읖', ㅎ: '히읗',
  ㅏ: '아', ㅐ: '애', ㅑ: '야', ㅒ: '얘', ㅓ: '어', ㅔ: '에',
  ㅕ: '여', ㅖ: '예', ㅗ: '오', ㅘ: '와', ㅙ: '왜', ㅚ: '외',
  ㅛ: '요', ㅜ: '우', ㅝ: '워', ㅞ: '웨', ㅟ: '위', ㅠ: '유',
  ㅡ: '으', ㅢ: '의', ㅣ: '이',
};

/** 기본 자음 14자. 겹자음·된소리를 뺀 것으로 1~2학년 범위다. */
export const BASIC_CONSONANTS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/** 기본 모음 10자. */
export const BASIC_VOWELS = ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ'];

/** 된소리 짝과 거센소리 짝. [6수 아님] 음운 문항의 근거다. */
export const TENSE_PAIRS = { ㄱ: 'ㄲ', ㄷ: 'ㄸ', ㅂ: 'ㅃ', ㅅ: 'ㅆ', ㅈ: 'ㅉ' };
export const ASPIRATED_PAIRS = { ㄱ: 'ㅋ', ㄷ: 'ㅌ', ㅂ: 'ㅍ', ㅈ: 'ㅊ' };

export function isSyllable(ch) {
  const code = ch.codePointAt(0);
  return code >= SYLLABLE_BASE && code <= SYLLABLE_LAST;
}

/** 음절 하나를 초성·중성·종성으로 나눈다. */
export function decomposeSyllable(ch) {
  if (!isSyllable(ch)) throw new Error(`한글 음절이 아니다: ${ch}`);
  const offset = ch.codePointAt(0) - SYLLABLE_BASE;
  const finalIndex = offset % FINAL_COUNT;
  const medialIndex = Math.floor(offset / FINAL_COUNT) % MEDIAL_COUNT;
  const initialIndex = Math.floor(offset / (FINAL_COUNT * MEDIAL_COUNT));
  return {
    initial: INITIALS[initialIndex],
    medial: MEDIALS[medialIndex],
    final: FINALS[finalIndex],
    initialIndex,
    medialIndex,
    finalIndex,
  };
}

/** 초성·중성·종성으로 음절을 만든다. decomposeSyllable 의 반대 방향이다. */
export function composeSyllable(initial, medial, final = '') {
  const i = INITIALS.indexOf(initial);
  const m = MEDIALS.indexOf(medial);
  const f = FINALS.indexOf(final);
  if (i < 0 || m < 0 || f < 0) throw new Error(`조합할 수 없는 낱자: ${initial}/${medial}/${final}`);
  return String.fromCodePoint(SYLLABLE_BASE + (i * MEDIAL_COUNT + m) * FINAL_COUNT + f);
}

/** 낱말을 낱자 배열로 분해한다. */
export function decomposeWord(word) {
  return [...word].flatMap((ch) => {
    if (!isSyllable(ch)) return [ch];
    const { initial, medial, final } = decomposeSyllable(ch);
    return final === '' ? [initial, medial] : [initial, medial, final];
  });
}

/** 받침이 있는가. 조사 판정과 표기 문항의 근거다. */
export function hasFinal(ch) {
  return isSyllable(ch) && decomposeSyllable(ch).final !== '';
}

export function finalOf(word) {
  const last = [...word].at(-1);
  return isSyllable(last) ? decomposeSyllable(last).final : '';
}

/**
 * 국어사전 순서 비교.
 *
 * 초성 -> 중성 -> 종성 순으로 앞자리부터 비교한다. 유니코드 코드포인트 순서가
 * 이미 이 순서와 같으므로 음절끼리는 코드포인트로 비교해도 되지만, 왜 그런지를
 * 낱자 인덱스로 드러내 두면 문항의 풀이를 그대로 만들 수 있다.
 */
export function compareDictionary(a, b) {
  const x = [...a];
  const y = [...b];
  for (let k = 0; k < Math.min(x.length, y.length); k += 1) {
    if (x[k] === y[k]) continue;
    if (!isSyllable(x[k]) || !isSyllable(y[k])) {
      return x[k] < y[k] ? -1 : 1;
    }
    const dx = decomposeSyllable(x[k]);
    const dy = decomposeSyllable(y[k]);
    if (dx.initialIndex !== dy.initialIndex) return dx.initialIndex < dy.initialIndex ? -1 : 1;
    if (dx.medialIndex !== dy.medialIndex) return dx.medialIndex < dy.medialIndex ? -1 : 1;
    if (dx.finalIndex !== dy.finalIndex) return dx.finalIndex < dy.finalIndex ? -1 : 1;
  }
  if (x.length === y.length) return 0;
  return x.length < y.length ? -1 : 1;
}

/** 사전 순으로 정렬한다. 결과가 결정적이다. */
export function sortDictionary(words) {
  return [...words].sort(compareDictionary);
}

/**
 * 두 낱말이 사전 순으로 갈리는 첫 지점을 설명한다.
 * 문항 풀이에 '몇 번째 글자의 무엇이 다른가'를 적기 위해 쓴다.
 */
export function firstDifference(a, b) {
  const x = [...a];
  const y = [...b];
  for (let k = 0; k < Math.min(x.length, y.length); k += 1) {
    if (x[k] === y[k]) continue;
    if (!isSyllable(x[k]) || !isSyllable(y[k])) return { position: k + 1, part: 'letter' };
    const dx = decomposeSyllable(x[k]);
    const dy = decomposeSyllable(y[k]);
    if (dx.initialIndex !== dy.initialIndex) {
      return { position: k + 1, part: 'initial', a: dx.initial, b: dy.initial };
    }
    if (dx.medialIndex !== dy.medialIndex) {
      return { position: k + 1, part: 'medial', a: dx.medial, b: dy.medial };
    }
    return { position: k + 1, part: 'final', a: dx.final || '없음', b: dy.final || '없음' };
  }
  return { position: Math.min(x.length, y.length) + 1, part: 'length' };
}

export const PART_NAMES = { initial: '첫 자음', medial: '모음', final: '받침', letter: '글자', length: '글자 수' };
