/**
 * 측정 단위 체계. 전부 정수 배수로 정의한다.
 *
 * 1L = 1000mL, 1kg = 1000g 같은 관계를 실수 나눗셈으로 다루면 표시 문자열이
 * 흔들린다. 기준 단위(가장 작은 단위) 정수값으로 계산하고 표시할 때만 나눈다.
 *
 * 문맥은 명사·속성·전형값을 따로 담는다. '지우개의 무게'라는 문구 하나만 두고
 * 정규식으로 명사를 잘라내려 하면 '사람의 몸무게' 같은 항목에서 문장이 깨진다.
 */

export const UNIT_SYSTEMS = {
  length: {
    korean: '길이',
    base: 'mm',
    units: [
      { symbol: 'mm', korean: '밀리미터', factor: 1 },
      { symbol: 'cm', korean: '센티미터', factor: 10 },
      { symbol: 'm', korean: '미터', factor: 1000 },
      { symbol: 'km', korean: '킬로미터', factor: 1000000 },
    ],
    contexts: [
      { object: '연필심', attribute: '두께', unit: 'mm', typical: 2 },
      { object: '동전', attribute: '두께', unit: 'mm', typical: 2 },
      { object: '클립', attribute: '길이', unit: 'mm', typical: 30 },
      { object: '지우개', attribute: '길이', unit: 'cm', typical: 5 },
      { object: '책상', attribute: '높이', unit: 'cm', typical: 70 },
      { object: '색연필', attribute: '길이', unit: 'cm', typical: 15 },
      { object: '교실', attribute: '긴 쪽 길이', unit: 'm', typical: 8 },
      { object: '나무', attribute: '높이', unit: 'm', typical: 6 },
      { object: '수영장', attribute: '긴 쪽 길이', unit: 'm', typical: 25 },
      { object: '한강 대교', attribute: '길이', unit: 'km', typical: 1 },
      { object: '마라톤 경기', attribute: '거리', unit: 'km', typical: 42 },
    ],
  },
  capacity: {
    korean: '들이',
    base: 'mL',
    units: [
      { symbol: 'mL', korean: '밀리리터', factor: 1 },
      { symbol: 'L', korean: '리터', factor: 1000 },
    ],
    contexts: [
      { object: '숟가락', attribute: '들이', unit: 'mL', typical: 15 },
      { object: '종이컵', attribute: '들이', unit: 'mL', typical: 200 },
      { object: '음료수 캔', attribute: '들이', unit: 'mL', typical: 250 },
      { object: '주사기', attribute: '들이', unit: 'mL', typical: 10 },
      { object: '물통', attribute: '들이', unit: 'L', typical: 2 },
      { object: '양동이', attribute: '들이', unit: 'L', typical: 10 },
      { object: '욕조', attribute: '들이', unit: 'L', typical: 200 },
    ],
  },
  weight: {
    korean: '무게',
    base: 'g',
    units: [
      { symbol: 'g', korean: '그램', factor: 1 },
      { symbol: 'kg', korean: '킬로그램', factor: 1000 },
      { symbol: 't', korean: '톤', factor: 1000000 },
    ],
    contexts: [
      { object: '지우개', attribute: '무게', unit: 'g', typical: 20 },
      { object: '사과', attribute: '무게', unit: 'g', typical: 250 },
      { object: '연필', attribute: '무게', unit: 'g', typical: 5 },
      { object: '달걀', attribute: '무게', unit: 'g', typical: 60 },
      { object: '가방', attribute: '무게', unit: 'kg', typical: 3 },
      { object: '수박', attribute: '무게', unit: 'kg', typical: 8 },
      { object: '쌀 한 포대', attribute: '무게', unit: 'kg', typical: 10 },
      { object: '트럭', attribute: '무게', unit: 't', typical: 5 },
      { object: '코끼리', attribute: '무게', unit: 't', typical: 4 },
    ],
  },
};

export function unitOf(system, symbol) {
  const found = UNIT_SYSTEMS[system].units.find((u) => u.symbol === symbol);
  if (!found) throw new Error(`${system} 체계에 없는 단위: ${symbol}`);
  return found;
}

/**
 * 두 단위 사이의 배수. 1km = 1000m 이면 ratioBetween('length','km','m') === 1000.
 * 교육과정이 다루는 관계는 인접 단위 쌍이다. km 를 기준 단위 mm 로 바꾸면
 * 백만 배수가 되어 학년에 맞지 않는 수가 나온다.
 */
export function ratioBetween(system, bigSymbol, smallSymbol) {
  const big = unitOf(system, bigSymbol).factor;
  const small = unitOf(system, smallSymbol).factor;
  if (big % small !== 0) throw new Error(`정수 배수가 아닌 단위 쌍: ${bigSymbol}, ${smallSymbol}`);
  return big / small;
}

/** 작은 단위 정수값 -> 복합 단위 표기. (capacity, 2500, 'L', 'mL') -> '2L 500mL' */
export function formatCompoundPair(system, smallValue, bigSymbol, smallSymbol) {
  const ratio = ratioBetween(system, bigSymbol, smallSymbol);
  const whole = Math.floor(smallValue / ratio);
  const rest = smallValue % ratio;
  if (rest === 0) return `${whole}${bigSymbol}`;
  if (whole === 0) return `${rest}${smallSymbol}`;
  return `${whole}${bigSymbol} ${rest}${smallSymbol}`;
}

/** 기준 단위(가장 작은 단위) 기준 표기. */
export function formatCompound(system, baseValue, bigSymbol) {
  return formatCompoundPair(system, baseValue, bigSymbol, UNIT_SYSTEMS[system].base);
}

export function toBase(system, value, symbol) {
  return value * unitOf(system, symbol).factor;
}
