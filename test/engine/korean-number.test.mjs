/**
 * 한국어 수 읽기와 조사 선택 단위 테스트.
 *
 * 조사가 틀리면 문항 발문이 어색해질 뿐 아니라 정답 문자열까지 흔들린다.
 * 지금까지 이 모듈은 bin/verify-generators.mjs 와 tools/check-korean.mjs 로만
 * 간접 검증됐다. 과거에 실제로 터진 로/으로 사고(REVIEW.md §13, 222건)를
 * 회귀 케이스로 박아 둔다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countIda,
  digitAt,
  fracEul,
  fracEun,
  ida,
  josaEul,
  josaEun,
  josaI,
  nativeCounted,
  numEun,
  numGwa,
  numRo,
  parseSinoKorean,
  parseSinoKoreanLarge,
  particle,
  particleRo,
  placeDecompose,
  sinoKorean,
  sinoKoreanLarge,
  unitEun,
  unitI,
  unitRo,
} from '../../src/engine/korean-number.mjs';

test('한자어 수사는 십·백·천의 계수 1을 읽지 않는다', () => {
  assert.equal(sinoKorean(1234), '천이백삼십사');
  assert.equal(sinoKorean(10), '십');
  assert.equal(sinoKorean(100), '백');
  assert.equal(sinoKorean(0), '영');
  assert.throws(() => sinoKorean(10_000), /범위 밖/);
  assert.throws(() => sinoKorean(-1), /범위 밖/);
});

test('수사 읽기와 되읽기가 서로 반대 방향으로 맞물린다', () => {
  // 검산의 독립성이 여기서 나온다. 같은 코드로 답을 다시 만들면 아무것도 못 잡는다.
  for (const n of [0, 7, 10, 105, 1234, 9999]) {
    assert.equal(parseSinoKorean(sinoKorean(n)), n);
  }
  assert.equal(sinoKoreanLarge(32_450_000), '삼천이백사십오만');
  assert.equal(parseSinoKoreanLarge('삼천이백사십오만'), 32_450_000);
  assert.equal(parseSinoKoreanLarge(sinoKoreanLarge(100_020_003)), 100_020_003);
  assert.throws(() => parseSinoKorean('셋'), /읽을 수 없는 글자/);
});

test('고유어 수사는 단위명사 앞에서 관형사형이 된다', () => {
  assert.equal(nativeCounted(1, '개'), '한 개');
  assert.equal(nativeCounted(2, '개'), '두 개');
  assert.equal(nativeCounted(20, '개'), '스무 개');
  assert.equal(nativeCounted(25, '개'), '스물다섯 개');
  assert.equal(nativeCounted(30, '개'), '서른 개');
});

test('받침 유무로 갈리는 조사는 마지막 글자가 정한다', () => {
  assert.equal(josaEun('책'), '은');
  assert.equal(josaEun('사과'), '는');
  assert.equal(josaI('책'), '이');
  assert.equal(josaI('사과'), '가');
  assert.equal(josaEul('책'), '을');
  assert.equal(josaEul('사과'), '를');
  assert.throws(() => particle('', '은', '는'), /빈 문자열/);
});

test('로/으로는 ㄹ 받침을 예외로 갈라야 한다', () => {
  // 2항 판정으로 만들면 '1으로'가 나온다. 과거에 222건 터진 자리다.
  assert.equal(particleRo('일'), '로');
  assert.equal(particleRo('팔'), '로');
  assert.equal(particleRo('이'), '로');
  assert.equal(particleRo('삼'), '으로');
  assert.equal(particleRo('육'), '으로');
  assert.equal(numRo(1), '1로');
  assert.equal(numRo(2), '2로');
  assert.equal(numRo(3), '3으로');
  assert.equal(numRo(8), '8로');
});

test('숫자 뒤 조사는 표기가 아니라 읽는 소리가 정한다', () => {
  assert.equal(numEun(27), '27은'); // 이십칠
  assert.equal(numEun(52), '52는'); // 오십이
  assert.equal(numGwa(3), '3과'); // 삼
  assert.equal(numGwa(4), '4와'); // 사
});

test('서술격 조사는 단위명사의 받침을 따른다', () => {
  assert.equal(ida('3권'), '3권이다');
  assert.equal(countIda(12, '개'), '12개다');
  assert.equal(countIda(51, '송이'), '51송이다');
});

test('단위 기호 뒤 조사는 기호를 읽는 소리로 정한다', () => {
  assert.equal(unitEun(2, 'kg'), '2kg은'); // 킬로그램
  assert.equal(unitI(3, 'cm'), '3cm가'); // 센티미터
  assert.equal(unitRo(1, 'kg'), '1kg으로'); // 램, 받침 ㅁ
});

test('분수 뒤 조사는 마지막으로 소리 내는 분자가 정한다', () => {
  // '11/8' 을 그대로 particle 에 넣으면 '8' 을 보고 '11/8는' 이 된다.
  assert.equal(fracEun('11/8'), '11/8은'); // 팔분의 십일
  assert.equal(fracEun('2 1/3'), '2 1/3은'); // 삼분의 일
  assert.equal(fracEul('3/4'), '3/4을'); // 사분의 삼
});

test('자릿값 분해는 0 자리를 빼고 큰 자리부터 낸다', () => {
  assert.deepEqual(placeDecompose(3428), [3000, 400, 20, 8]);
  assert.deepEqual(placeDecompose(3008), [3000, 8]);
  assert.equal(digitAt(3428, 2), 4);
  assert.equal(digitAt(3428, 0), 8);
});
