import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateAccuracy,
  findDifficultyInversions,
  validateResponseRecords,
} from '../../src/engine/response-log.mjs';

function record(overrides = {}) {
  return {
    itemId: 'item-1',
    generatorId: 'math.test.generator',
    standardCode: '[2수01-01]',
    subject: 'math',
    gradeBand: '1-2',
    declaredDifficulty: 1,
    format: 'short-answer',
    scoring: 'auto',
    answered: true,
    correct: true,
    elapsedMs: 1000,
    learnerId: null,
    at: '2026-08-06T00:00:00.000Z',
    ...overrides,
  };
}

test('accuracy stays null below 30 samples and becomes measured at the threshold', () => {
  const below = aggregateAccuracy(Array.from({ length: 29 }, () => record()));
  assert.equal(below[0].accuracy, null);
  assert.equal(below[0].sufficientSamples, false);

  const atThreshold = aggregateAccuracy([
    ...Array.from({ length: 15 }, () => record({ correct: true })),
    ...Array.from({ length: 15 }, () => record({ correct: false })),
  ]);
  assert.equal(atThreshold[0].accuracy, 0.5);
  assert.equal(atThreshold[0].sufficientSamples, true);
});

test('record validation rejects injected fields and invalid difficulty buckets', () => {
  assert.throws(
    () => validateResponseRecords([record({ injected: true })]),
    /허용하지 않는 필드/,
  );
  assert.throws(
    () => validateResponseRecords([record({ declaredDifficulty: 9 })]),
    /응답 기록 계약/,
  );
  const missingAt = record();
  delete missingAt.at;
  assert.throws(
    () => validateResponseRecords([missingAt]),
    /필수 필드/,
  );
});

test('difficulty inversion detection requires sufficient measured buckets', () => {
  const inversions = findDifficultyInversions([
    {
      generatorId: 'math.test.generator',
      standardCode: '[2수01-01]',
      declaredDifficulty: 1,
      attempts: 30,
      correct: 15,
      accuracy: 0.5,
      sufficientSamples: true,
    },
    {
      generatorId: 'math.test.generator',
      standardCode: '[2수01-01]',
      declaredDifficulty: 2,
      attempts: 30,
      correct: 27,
      accuracy: 0.9,
      sufficientSamples: true,
    },
  ]);
  assert.equal(inversions.length, 1);
});
