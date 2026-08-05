/**
 * 한국어 수 읽기. 1~2학년 '수 읽고 쓰기' 문항에 필요하다.
 * 한자어(일이삼…)와 고유어(하나둘셋…)는 쓰임이 다르므로 둘 다 만든다.
 */

const SINO_DIGIT = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const SINO_UNIT = ['', '십', '백', '천'];

/**
 * 한자어 수사. 0 이상 9999 이하.
 * 십·백·천의 계수 1은 읽지 않는다: 1234 -> 천이백삼십사, 10 -> 십.
 */
export function sinoKorean(n) {
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new Error(`sinoKorean 범위 밖: ${n}`);
  if (n === 0) return '영';
  const digits = String(n).split('').map(Number).reverse();
  let out = '';
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    const d = digits[i];
    if (d === 0) continue;
    const unit = SINO_UNIT[i];
    out += (d === 1 && i > 0) ? unit : SINO_DIGIT[d] + unit;
  }
  return out;
}

const SINO_DIGIT_VALUE = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const SINO_UNIT_VALUE = { 십: 10, 백: 100, 천: 1000 };

/**
 * 한자어 수사 -> 숫자. sinoKorean 과 반대 방향의 독립 경로다.
 * 생성기 검산에서 '같은 코드로 같은 답을 다시 만드는' 자기순환을 피하려고 쓴다.
 */
export function parseSinoKorean(text) {
  if (text === '영') return 0;
  let total = 0;
  let coefficient = 0;
  for (const ch of text) {
    if (SINO_DIGIT_VALUE[ch] !== undefined) {
      coefficient = SINO_DIGIT_VALUE[ch];
    } else if (SINO_UNIT_VALUE[ch] !== undefined) {
      total += (coefficient === 0 ? 1 : coefficient) * SINO_UNIT_VALUE[ch];
      coefficient = 0;
    } else {
      throw new Error(`한자어 수사로 읽을 수 없는 글자: ${ch} (${text})`);
    }
  }
  return total + coefficient;
}

/** 만 단위로 끊어 읽을 때 쓰는 큰 자리 이름. */
const BIG_UNITS = [
  { value: 10 ** 12, name: '조' },
  { value: 10 ** 8, name: '억' },
  { value: 10 ** 4, name: '만' },
];

/**
 * 만·억·조까지 읽는 한자어 수사. 32450000 -> '삼천이백사십오만'
 * sinoKorean 은 9999까지만 다루므로 그 이상은 이 함수를 쓴다.
 */
export function sinoKoreanLarge(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`sinoKoreanLarge 범위 밖: ${n}`);
  if (n === 0) return '영';
  if (n <= 9999) return sinoKorean(n);
  let rest = n;
  const parts = [];
  for (const { value, name } of BIG_UNITS) {
    const chunk = Math.floor(rest / value);
    if (chunk > 0) {
      parts.push(`${sinoKorean(chunk)}${name}`);
      rest %= value;
    }
  }
  if (rest > 0) parts.push(sinoKorean(rest));
  return parts.join(' ');
}

/** 큰 수 한자어 -> 숫자. sinoKoreanLarge 의 역방향 독립 경로다. */
export function parseSinoKoreanLarge(text) {
  const compact = text.replaceAll(' ', '');
  let total = 0;
  let rest = compact;
  for (const { value, name } of BIG_UNITS) {
    const idx = rest.indexOf(name);
    if (idx === -1) continue;
    total += parseSinoKorean(rest.slice(0, idx)) * value;
    rest = rest.slice(idx + name.length);
  }
  if (rest.length > 0 && rest !== '영') total += parseSinoKorean(rest);
  return total;
}

const NATIVE_ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const ATTRIBUTIVE = { 하나: '한', 둘: '두', 셋: '세', 넷: '네', 스물: '스무' };

/**
 * 단위명사 앞에 붙는 관형사형. '하나 개'가 아니라 '한 개'다.
 * 스물만 '스무'로 바뀌고 서른 이상은 그대로다: 스무 개, 서른 개, 스물다섯 개.
 */
export function nativeCounted(n, counter) {
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (ones === 0) {
    const t = NATIVE_TENS[tens];
    return `${ATTRIBUTIVE[t] ?? t} ${counter}`;
  }
  const head = tens === 0 ? '' : NATIVE_TENS[tens];
  const tail = NATIVE_ONES[ones];
  return `${head}${ATTRIBUTIVE[tail] ?? tail} ${counter}`;
}

/** 자릿값 이름. 1의 자리 -> '일의 자리' */
export const PLACE_NAMES = ['일', '십', '백', '천'];

/** n 의 place 자리(0=일) 숫자 */
export function digitAt(n, place) {
  return Math.floor(n / 10 ** place) % 10;
}

/** 자릿값 분해: 3428 -> [3000, 400, 20, 8] 중 0 아닌 항 */
export function placeDecompose(n) {
  const out = [];
  for (let p = String(n).length - 1; p >= 0; p -= 1) {
    const v = digitAt(n, p) * 10 ** p;
    if (v !== 0) out.push(v);
  }
  return out;
}

/** 조사 선택: 받침 있으면 with, 없으면 without */
export function particle(word, withJong, withoutJong) {
  if (typeof word !== 'string' || word.length === 0) throw new Error('particle: 빈 문자열');
  const code = word.at(-1).charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return withoutJong;
  return (code - 0xac00) % 28 === 0 ? withoutJong : withJong;
}

/** 명사에 붙일 조사만 돌려준다. 문장을 조립할 때 쓴다. */
export const josaEun = (w) => particle(w, '은', '는');
export const josaI = (w) => particle(w, '이', '가');
export const josaEul = (w) => particle(w, '을', '를');

/**
 * 로/으로는 2항 판정이 안 된다.
 *
 * 은/는·이/가는 받침 유무로 갈리지만 로/으로는 셋으로 갈린다.
 *   받침 없음  -> 로   (2로, 사과로)
 *   받침 ㄹ    -> 로   (1로 '일', 8로 '팔', 연필로)
 *   그 밖 받침 -> 으로 (3으로 '삼', 6으로 '육', 책으로)
 * ㄹ 예외를 빼면 '1으로'가 나온다.
 */
export function particleRo(word) {
  const last = String(word).at(-1);
  const code = last?.codePointAt(0) ?? 0;
  if (code < 0xac00 || code > 0xd7a3) return '로';
  const finalIndex = (code - 0xac00) % 28;
  const RIEUL = 8; // 종성 배열에서 ㄹ의 위치
  if (finalIndex === 0 || finalIndex === RIEUL) return '로';
  return '으로';
}

export const josaRo = (w) => `${w}${particleRo(w)}`;

/** 숫자 뒤 로/으로. 조사는 읽는 소리가 정한다. numRo(3) -> '3으로', numRo(1) -> '1로' */
export const numRo = (n) => `${n}${particleRo(sinoKoreanLarge(n))}`;

/**
 * 숫자 뒤의 조사는 표기가 아니라 '읽는 소리'로 결정된다.
 *   27(이십칠) -> 은 / 52(오십이) -> 는 / 3(삼) -> 과 / 4(사) -> 와
 */
export function numberParticle(n, withJong, withoutJong) {
  // 만 단위를 넘는 수도 다뤄야 한다. 조사는 마지막으로 소리 내는 음절이 정한다.
  return particle(sinoKoreanLarge(n), withJong, withoutJong);
}

export const numEun = (n) => `${n}${numberParticle(n, '은', '는')}`;
export const numI = (n) => `${n}${numberParticle(n, '이', '가')}`;
export const numEul = (n) => `${n}${numberParticle(n, '을', '를')}`;
export const numGwa = (n) => `${n}${numberParticle(n, '과', '와')}`;

/**
 * 서술격 조사. 받침이 있으면 '이다', 없으면 '다'.
 *   3권이다 / 51송이다 / 12개다
 * '송이이다'처럼 겹쳐 쓰면 문법은 맞아도 읽기가 거슬린다.
 */
export function ida(word) {
  return `${word}${particle(word, '이다', '다')}`;
}

/** 숫자와 단위명사에 서술격 조사를 붙인다. 조사는 단위명사가 정한다. */
export const countIda = (count, counter) => `${count}${ida(counter)}`;

/**
 * 단위 기호를 읽는 소리. 조사는 표기가 아니라 소리가 정한다.
 *   1kg -> '킬로그램' -> 램에 받침이 있으므로 '1kg은'
 */
const UNIT_READING = {
  cm: '센티미터',
  mm: '밀리미터',
  m: '미터',
  km: '킬로미터',
  g: '그램',
  kg: '킬로그램',
  t: '톤',
  L: '리터',
  mL: '밀리리터',
};

export function unitParticle(unitSymbol, withJong, withoutJong) {
  const reading = UNIT_READING[unitSymbol];
  if (!reading) throw new Error(`읽는 소리를 모르는 단위: ${unitSymbol}`);
  return particle(reading, withJong, withoutJong);
}

/** 수치와 단위 뒤의 조사. unitEun(2, 'kg') -> '2kg은' */
export const unitEun = (value, unit) => `${value}${unit}${unitParticle(unit, '은', '는')}`;
export const unitI = (value, unit) => `${value}${unit}${unitParticle(unit, '이', '가')}`;
/** 수치+단위 뒤 로/으로. unitRo(1, 'kg') -> '1kg으로' (킬로그램 -> 램, 받침 ㅁ) */
export const unitRo = (value, unit) => `${value}${unit}${particleRo(UNIT_READING[unit] ?? unit)}`;
export const unitEul = (value, unit) => `${value}${unit}${unitParticle(unit, '을', '를')}`;

/**
 * 분수 표기 뒤의 조사.
 *
 * particle 은 마지막 글자가 한글이 아니면 받침 없음으로 처리한다. 그래서
 * '11/8' 에 그대로 쓰면 '8' 을 보고 '는' 을 골라 '11/8는' 이 된다.
 * 분수는 '팔분의 십일' 로 읽어 분자를 마지막에 소리 내므로 '11/8은' 이 맞다.
 */
export function fractionParticle(text, withJong, withoutJong) {
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(String(text).trim());
  if (mixed) return numberParticle(Number(mixed[2]), withJong, withoutJong);
  const frac = /^(\d+)\/(\d+)$/.exec(String(text).trim());
  if (frac) return numberParticle(Number(frac[1]), withJong, withoutJong);
  const plain = /^\d+$/.exec(String(text).trim());
  if (plain) return numberParticle(Number(text), withJong, withoutJong);
  return particle(String(text), withJong, withoutJong);
}

export const fracEun = (t) => `${t}${fractionParticle(t, '은', '는')}`;
export const fracI = (t) => `${t}${fractionParticle(t, '이', '가')}`;
export const fracEul = (t) => `${t}${fractionParticle(t, '을', '를')}`;