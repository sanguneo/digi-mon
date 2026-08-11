/**
 * 고정소수·분수 연산 단위 테스트.
 *
 * 지금까지 이 모듈은 bin/verify-generators.mjs 를 통해 간접으로만 검증됐다.
 * 회귀가 생기면 '생성기 실패'라는 엉뚱한 얼굴로 나타나므로 직접 고정한다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addDecimals,
  addFractions,
  addSameDenominator,
  compareDecimals,
  compareFractions,
  divideFractions,
  divisorsOf,
  formatDecimal,
  formatDecimalTrimmed,
  formatUnreducedFraction,
  fractionKind,
  fractionToDecimal,
  gcd,
  lcm,
  makeDecimal,
  makeFraction,
  parseDecimalText,
  parseFractionText,
  reduceFraction,
  subDecimals,
  subFractions,
  toMixed,
} from '../../src/engine/rational.mjs';

test('lcm 은 0 을 명시적으로 거부한다', () => {
  // gcd(0,0) 이 0 이라 0/0 = NaN 이 조용히 흘러나가던 자리다.
  assert.throws(() => lcm(0, 0), /0에 대해 정의되지 않는다/);
  assert.throws(() => lcm(0, 5), /0에 대해 정의되지 않는다/);
  assert.throws(() => lcm(5, 0), /0에 대해 정의되지 않는다/);
});

test('gcd 와 lcm 이 부호와 무관하게 같은 값을 낸다', () => {
  assert.equal(gcd(12, 18), 6);
  assert.equal(gcd(-12, 18), 6);
  assert.equal(gcd(7, 1), 1);
  assert.equal(lcm(4, 6), 12);
  assert.equal(lcm(-4, 6), 12);
  assert.equal(lcm(3, 3), 3);
});

test('약수는 오름차순 중복 없이 나온다', () => {
  assert.deepEqual(divisorsOf(36), [1, 2, 3, 4, 6, 9, 12, 18, 36]);
  assert.deepEqual(divisorsOf(1), [1]);
});

test('분수 생성이 정수와 0 분모를 경계에서 막는다', () => {
  assert.throws(() => makeFraction(1, 0), /분모가 0/);
  assert.throws(() => makeFraction(1.5, 2), /정수여야 한다/);
  assert.deepEqual(makeFraction(3, 4), { n: 3, d: 4 });
});

test('분수 사칙연산은 약분된 결과를 낸다', () => {
  assert.deepEqual(addFractions({ n: 1, d: 2 }, { n: 1, d: 3 }), { n: 5, d: 6 });
  assert.deepEqual(subFractions({ n: 3, d: 4 }, { n: 1, d: 4 }), { n: 1, d: 2 });
  assert.deepEqual(divideFractions({ n: 1, d: 2 }, { n: 3, d: 4 }), { n: 2, d: 3 });
  assert.throws(() => divideFractions({ n: 1, d: 2 }, { n: 0, d: 4 }), /0으로 나눌 수 없다/);
  assert.deepEqual(reduceFraction({ n: 6, d: 8 }), { n: 3, d: 4 });
});

test('분모가 같은 덧셈·뺄셈은 약분하지 않는다', () => {
  // 3~4학년 [4수01-15] 범위다. 3/6 을 1/2 로 줄이면 학년 밖 답이 된다.
  assert.deepEqual(addSameDenominator({ n: 1, d: 6 }, { n: 2, d: 6 }), { n: 3, d: 6 });
  assert.equal(formatUnreducedFraction({ n: 3, d: 6 }), '3/6');
  assert.equal(formatUnreducedFraction({ n: 6, d: 3 }), '2');
  assert.throws(() => addSameDenominator({ n: 1, d: 2 }, { n: 1, d: 3 }), /분모가 다르다/);
});

test('분수 비교와 분류가 나눗셈 없이 결정된다', () => {
  assert.equal(compareFractions({ n: 1, d: 2 }, { n: 2, d: 4 }), 0);
  assert.equal(compareFractions({ n: 2, d: 3 }, { n: 1, d: 2 }), 1);
  assert.equal(compareFractions({ n: 1, d: 3 }, { n: 1, d: 2 }), -1);
  assert.equal(fractionKind({ n: 1, d: 5 }), 'unit');
  assert.equal(fractionKind({ n: 2, d: 5 }), 'proper');
  assert.equal(fractionKind({ n: 7, d: 5 }), 'improper');
  assert.deepEqual(toMixed({ n: 7, d: 3 }), { whole: 2, n: 1, d: 3 });
});

test('소수는 부동소수점 오차 없이 계산된다', () => {
  // 4.7 - 1.9 를 double 로 하면 2.8000000000000003 이 된다.
  const shown = formatDecimal(subDecimals(makeDecimal(47, 1), makeDecimal(19, 1)));
  assert.equal(shown, '2.8');
  assert.equal(formatDecimal(addDecimals(makeDecimal(325, 2), makeDecimal(7, 1))), '3.95');
  assert.equal(compareDecimals(makeDecimal(50, 2), makeDecimal(5, 1)), 0);
  assert.throws(() => makeDecimal(1.5, 1), /정수여야 한다/);
  assert.throws(() => makeDecimal(15, 4), /scale 범위 밖/);
});

test('표기와 되읽기가 서로 반대 방향으로 맞물린다', () => {
  assert.equal(formatDecimal({ units: 325, scale: 2 }), '3.25');
  assert.equal(formatDecimal({ units: 50, scale: 2 }), '0.50');
  assert.equal(formatDecimalTrimmed({ units: 15_700, scale: 2 }), '157');
  assert.deepEqual(parseDecimalText('5.0'), { units: 50, scale: 1 });
  assert.deepEqual(parseFractionText('2 1/3'), { n: 7, d: 3 });
  assert.deepEqual(parseFractionText('3'), { n: 3, d: 1 });
  assert.equal(parseFractionText('1/0'), null);
  assert.equal(formatDecimal(fractionToDecimal({ n: 7, d: 10 })), '0.7');
  assert.throws(() => fractionToDecimal({ n: 1, d: 3 }), /10의 거듭제곱 분모/);
});
