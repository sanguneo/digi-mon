import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { STANDARD_CODE_RE, isStandardCode } from '../../src/curriculum/standard-code.mjs';

test('standard code format accepts only real elementary curriculum codes', () => {
  for (const code of ['[2수01-06]', '[4국01-01]', '[6영02-03]']) {
    assert.equal(isStandardCode(code), true, code);
  }
  for (const code of [
    '[1수01-01]', // 학년군 끝학년은 2·4·6 뿐이다
    '[3과01-01]', // 교과는 국·수·영 뿐이다
    '[2수1-06]', // 영역은 두 자리다
    '[2수01-6]', // 순번은 두 자리다
    '2수01-06', // 대괄호가 없다
    '',
    null,
    undefined,
    123,
  ]) {
    assert.equal(isStandardCode(code), false, String(code));
  }
});

test('standard code regex is stateless across repeated tests', () => {
  // /g 플래그가 붙으면 lastIndex 때문에 같은 입력이 번갈아 통과·실패한다.
  assert.equal(STANDARD_CODE_RE.test('[2수01-06]'), true);
  assert.equal(STANDARD_CODE_RE.test('[2수01-06]'), true);
});

test('every registered generator carries a strict standard code', () => {
  const registry = createRegistry();
  const invalid = registry.all()
    .filter((generator) => !isStandardCode(generator.standardCode))
    .map((generator) => `${generator.id}: ${generator.standardCode}`);
  assert.deepEqual(invalid, []);
});
