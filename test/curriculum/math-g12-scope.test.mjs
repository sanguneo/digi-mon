import assert from 'node:assert/strict';
import test from 'node:test';

import { createRng } from '../../src/engine/rng.mjs';
import { generators } from '../../src/generators/math/g12-number-operations.mjs';

function generator(id) {
  const found = generators.find((candidate) => candidate.id === id);
  assert.ok(found, `missing generator ${id}`);
  return found;
}

function samples(id, difficulty, count = 100) {
  const found = generator(id);
  return Array.from({ length: count }, (_, seed) => (
    found.generate(createRng(`${id}:${difficulty}:${seed}`), { difficulty })
  ));
}

test('[2수01-01] Korean numeral forms are recognized without requiring Korean-form writing', () => {
  for (const id of ['math.g12.no.s01.read-sino', 'math.g12.no.s01.count-native']) {
    for (const difficulty of [1, 2, 3]) {
      assert.equal(generator(id).format, 'multiple-choice');
      for (const item of samples(id, difficulty, 20)) {
        assert.ok(item.choices.length >= 3);
        assert.equal(item.choices.filter((choice) => choice.correct).length, 1);
        assert.equal(item.choices.find((choice) => choice.correct).text, item.answer.display);
      }
    }
  }
});

test('[2수01-04] every decomposition and composition stays at or below 20', () => {
  const ids = [
    'math.g12.no.s04.decompose',
    'math.g12.no.s04.compose',
    'math.g12.no.s04.make-ten',
  ];
  for (const id of ids) {
    for (const difficulty of [1, 2, 3]) {
      for (const item of samples(id, difficulty)) {
        const whole = item.params.total ?? item.params.base ?? item.answer.value;
        assert.ok(whole <= 20, `${id} generated whole ${whole}`);
        assert.ok(item.answer.value <= 20, `${id} generated answer ${item.answer.value}`);
      }
    }
  }
});

test('[2수01-06] subtraction is nonnegative and advanced addition includes three-digit sums', () => {
  for (const difficulty of [1, 2, 3]) {
    for (const item of samples('math.g12.no.s06.sub', difficulty, 200)) {
      assert.ok(item.params.a >= item.params.b, `${item.params.a} - ${item.params.b}`);
      assert.ok(item.answer.value >= 0, item.stem);
    }
  }

  const advanced = samples('math.g12.no.s06.add', 3, 200);
  assert.ok(advanced.some((item) => item.answer.value >= 100));
  for (const item of advanced) {
    assert.ok(item.params.a <= 99 && item.params.b <= 99);
  }
});

test('[2수01-08] generators calculate exact addition or subtraction of three numbers', () => {
  const standardGenerators = generators.filter((candidate) => candidate.standardCode === '[2수01-08]');
  assert.ok(standardGenerators.length > 0);

  for (const found of standardGenerators) {
    assert.doesNotMatch(`${found.id} ${found.skill}`, /estimate|어림/i);
    for (const difficulty of [1, 2, 3]) {
      for (const item of samples(found.id, difficulty)) {
        assert.deepEqual(Object.keys(item.params).sort(), ['a', 'b', 'c']);
        const operators = item.stem.match(/[+-]/g) ?? [];
        assert.equal(operators.length, 2, item.stem);
        assert.doesNotMatch(`${item.instruction} ${item.stem}`, /어림/);
        assert.ok(item.answer.value >= 0 && item.answer.value <= 99, item.stem);
        assert.equal(found.verify(item.params, item.answer), true);
      }
    }
  }
});
