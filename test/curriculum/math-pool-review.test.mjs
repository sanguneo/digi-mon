import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import { createRng } from '../../src/engine/rng.mjs';
import { gradeItem } from '../../src/server/grade.mjs';

// PR #3 리뷰가 재현한 반례를 그대로 고정한다. seed 와 난이도는 리뷰 원문 그대로다.

const registry = createRegistry();

function make(id, seed, difficulty) {
  const generator = registry.get(id);
  assert.ok(generator, id);
  const raw = generator.generate(createRng(seed), { difficulty });
  return { generator, raw, item: { ...raw, format: generator.format, scoring: generator.scoring } };
}

const correct = (item, response) => gradeItem(item, response).correct;

test('[4수01-08] 어림하는 단위가 다른 곱 어림 문항은 같은 문항으로 세지 않는다', () => {
  const hundreds = make('math.g34.no.s08.estimate-decide', 44832, 2).raw;
  const thousands = make('math.g34.no.s08.estimate-decide', 7, 3).raw;
  assert.equal(hundreds.answer.value, 45600);
  assert.equal(thousands.answer.value, 57000);
  assert.notEqual(hundreds.dedupeKey, thousands.dedupeKey);

  // 같은 키는 언제나 같은 답이어야 한다.
  const valueByKey = new Map();
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 3000; seed += 1) {
      const { raw } = make('math.g34.no.s08.estimate-decide', `estimate-key:${difficulty}:${seed}`, difficulty);
      if (valueByKey.has(raw.dedupeKey)) assert.equal(valueByKey.get(raw.dedupeKey), raw.answer.value, raw.dedupeKey);
      valueByKey.set(raw.dedupeKey, raw.answer.value);
    }
  }
});

test('[4수01-16] 소수 문장제는 끝자리 0을 붙인 같은 값도 정답으로 받는다', () => {
  const { item, raw } = make('math.g34.no.s16.decimal-story', 94, 2);
  assert.match(raw.stem, /6\.55m.*7\.85m/);
  for (const response of ['14.4', '14.4m', '14.40', '14.40m']) assert.equal(correct(item, response), true, response);
  for (const response of ['14.41', '14.04m', '1.44']) assert.equal(correct(item, response), false, response);
});

test('[6수01-03] 소수 첫째 자리까지 반올림한 답은 그 자릿수 표기를 정답으로 낸다', () => {
  const { generator, item, raw } = make('math.g56.no.s03.rounding-story', 'review:38', 3);
  assert.match(raw.stem, /28\.99m/);
  assert.equal(raw.answer.value, '29.0');
  assert.equal(raw.answer.display, '29.0m');
  assert.equal(generator.verify(raw.params, raw.answer), true);
  for (const response of ['29.0', '29.0m', '29', '29m']) assert.equal(correct(item, response), true, response);
  for (const response of ['28.9', '29.1m', '28.99']) assert.equal(correct(item, response), false, response);
  for (const value of ['28.9', '29.1', '28.99']) assert.equal(generator.verify(raw.params, { value }), false, value);
});

test('[6수01-08] 기약분수로 나타내라는 대분수 계산은 기약 가분수도 정답으로 받는다', () => {
  const { generator, item, raw } = make('math.g56.no.s08.mixed-add-sub', 'review:0', 1);
  assert.equal(raw.stem, '2 2/7 + 3 2/21');
  for (const response of ['5 8/21', '113/21']) {
    assert.equal(correct(item, response), true, response);
    assert.equal(generator.verify(raw.params, { value: response }), true, response);
  }
  for (const response of ['226/42', '5 16/42', '112/21']) {
    assert.equal(correct(item, response), false, response);
    assert.equal(generator.verify(raw.params, { value: response }), false, response);
  }
});

test('[6수02-02] 비 문항은 두 양의 수를 그대로 쓰라고 밝히고 그 표기로 채점한다', () => {
  const { item, raw } = make('math.g56.rm.s02-02.ratio-situation', 'review:1', 1);
  assert.match(raw.stem, /빨간 구슬 6개와 파란 구슬 30개/);
  assert.match(raw.instruction, /그대로/);
  assert.equal(correct(item, '6:30'), true);
  assert.equal(correct(item, '1:5'), false);
});

test('[6수02-01] 대응표 규칙은 모든 난이도에서 한 가지 연산이다', () => {
  const generator = registry.get('math.g56.rm.s02-01.rule-table');
  for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
    for (let seed = 0; seed < 300; seed += 1) {
      const { xs, ys } = generator.generate(createRng(`rule-table:${difficulty}:${seed}`), { difficulty }).params;
      const sameDifference = new Set(xs.map((x, k) => ys[k] - x)).size === 1;
      const sameRatio = new Set(xs.map((x, k) => ys[k] / x)).size === 1;
      assert.ok(sameDifference || sameRatio, `두 연산 규칙: ${xs} -> ${ys}`);
    }
  }
});

test('맥락 명사만 다른 같은 계산은 같은 문항으로 센다', () => {
  const zero = make('math.g12.no.s09.story-box', 'dedupe-review:0', 2).raw;
  const other = make('math.g12.no.s09.story-box', 'dedupe-review:69', 2).raw;
  assert.notEqual(zero.stem, other.stem);
  assert.equal(zero.dedupeKey, other.dedupeKey);

  // 키에 한글 맥락(명사·단위 이름)이 섞이지 않는다.
  const ids = ['math.g12.no.s09.story-box', 'math.g34.no.s03.story', 'math.g34.no.s04.story-multiply', 'math.g56.no.s10.share-story'];
  for (const id of ids) {
    for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
      for (let seed = 0; seed < 200; seed += 1) {
        const { raw } = make(id, `context-key:${difficulty}:${seed}`, difficulty);
        assert.doesNotMatch(raw.dedupeKey, /[가-힣]|:(m|L|kg)$/, `${id} ${raw.dedupeKey}`);
      }
    }
  }
});

test('기초 생성기도 맥락 명사만 다른 같은 계산은 같은 문항으로 센다', () => {
  const pairs = [
    ['math.g12.no.s01.count-tens-ones', 3, 4],
    ['math.g12.no.s05.story-add', 3, 19],
    ['math.g12.no.s05.story-sub', 9, 11],
    ['math.g12.no.s10.groups', 0, 3],
  ];
  for (const [id, left, right] of pairs) {
    const one = make(id, `dedupe-review:${left}`, 1).raw;
    const two = make(id, `dedupe-review:${right}`, 1).raw;
    assert.notEqual(one.stem, two.stem, id);
    assert.equal(one.answer.value, two.answer.value, id);
    assert.equal(one.dedupeKey, two.dedupeKey, id);
  }

  // 키에 한글 맥락(명사)이 섞이지 않는다. 문제 구조(kind)는 남는다.
  for (const [id] of pairs) {
    for (let difficulty = 1; difficulty <= 3; difficulty += 1) {
      for (let seed = 0; seed < 200; seed += 1) {
        const { raw } = make(id, `context-key:${difficulty}:${seed}`, difficulty);
        assert.doesNotMatch(raw.dedupeKey, /[가-힣]/, `${id} ${raw.dedupeKey}`);
      }
    }
  }
});
