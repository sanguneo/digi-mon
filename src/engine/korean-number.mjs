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