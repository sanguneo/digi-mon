import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';
import {
  LearningGateRequestError,
  recommendLearningGate,
} from '../../src/curriculum/learning-gate.mjs';

const CODE = '[2수01-06]';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSchema(name) {
  return JSON.parse(readFileSync(path.join(ROOT, 'schema', name), 'utf8'));
}

function request(evidence, target = {}) {
  return {
    schema: 'digi-mon/learning-gate-request@1',
    policyRevision: 1,
    evidence,
    target: {
      subject: 'math',
      codes: [CODE],
      modes: [],
      count: 10,
      ...target,
    },
  };
}

function gradingEvidence({
  graded = 10,
  answered = 10,
  correct = 5,
  manualScoringCount = 0,
} = {}) {
  const accuracy = graded === 0 ? null : Number((correct / graded).toFixed(4));
  const completionRate = graded === 0 ? null : Number((answered / graded).toFixed(4));
  return {
    source: 'grading-result',
    graded,
    answered,
    total: graded + manualScoringCount,
    manualScoringCount,
    accuracy,
    completionRate,
    byStandard: graded === 0
      ? {}
      : {
        [CODE]: {
          attempted: graded,
          correct,
          accuracy,
        },
      },
  };
}

function responseRecord(index, correct) {
  return {
    itemId: `item-${index}`,
    generatorId: 'test.math.add',
    standardCode: CODE,
    subject: 'math',
    gradeBand: '1-2',
    declaredDifficulty: 1,
    format: 'short-answer',
    scoring: 'auto',
    answered: true,
    correct,
    elapsedMs: null,
    learnerId: null,
    at: null,
  };
}

test('weak grading evidence recommends deterministic remediation metadata', () => {
  const recommendation = recommendLearningGate(request(gradingEvidence()));

  assert.equal(recommendation.schema, 'digi-mon/learning-gate-recommendation@1');
  assert.equal(recommendation.policyRevision, 1);
  assert.equal(recommendation.decision, 'remediate');
  assert.deepEqual(recommendation.reasonCodes, [
    'weak-standard',
    'no-approved-prerequisite-path',
  ]);
  assert.deepEqual(recommendation.nextAction, {
    kind: 'remediation',
    weakStandards: [CODE],
    depth: 2,
    prerequisitePolicy: 'approved-only',
  });
});

test('incomplete high-accuracy work recommends more practice without inventing mastery', () => {
  const recommendation = recommendLearningGate(request(gradingEvidence({
    answered: 8,
    correct: 8,
  })));

  assert.equal(recommendation.decision, 'practice');
  assert.deepEqual(recommendation.reasonCodes, ['incomplete']);
  assert.deepEqual(recommendation.nextAction, {
    kind: 'worksheet',
    codes: [CODE],
    modes: [],
    count: 10,
  });
});

test('complete non-weak work advances only to explicit client candidates', () => {
  const recommendation = recommendLearningGate(request(
    gradingEvidence({ correct: 10 }),
    { advanceToCodes: ['[2수01-07]'] },
  ));

  assert.equal(recommendation.decision, 'advance');
  assert.deepEqual(recommendation.reasonCodes, ['meets-policy-threshold']);
  assert.deepEqual(recommendation.nextAction, {
    kind: 'worksheet',
    codes: ['[2수01-07]'],
    modes: [],
    count: 10,
  });
});

test('manual-only work waits for review instead of treating missing evidence as failure', () => {
  const recommendation = recommendLearningGate(request(gradingEvidence({
    graded: 0,
    answered: 0,
    correct: 0,
    manualScoringCount: 2,
  })));

  assert.equal(recommendation.decision, 'await-manual-review');
  assert.deepEqual(recommendation.reasonCodes, ['manual-scoring-pending']);
  assert.deepEqual(recommendation.nextAction, {
    kind: 'manual-review',
    pendingItems: 2,
  });
});

test('response-record evidence respects the existing 30-sample boundary', () => {
  const insufficient = Array.from({ length: 29 }, (_, index) =>
    responseRecord(index, index < 10));
  const enough = [...insufficient, responseRecord(29, false)];

  const first = recommendLearningGate(request({
    source: 'response-records',
    records: insufficient,
  }));
  const second = recommendLearningGate(request({
    source: 'response-records',
    records: enough,
  }));

  assert.equal(first.decision, 'practice');
  assert.deepEqual(first.reasonCodes, ['insufficient-evidence']);
  assert.equal(second.decision, 'remediate');
  assert.deepEqual(second.evidenceSummary.weakStandards, [CODE]);
});

test('gate rejects unsupported policies and evidence outside the target scope', () => {
  assert.throws(
    () => recommendLearningGate({
      ...request(gradingEvidence()),
      policyRevision: 2,
    }),
    (error) => error instanceof LearningGateRequestError
      && error.field === 'policyRevision',
  );
  assert.throws(
    () => recommendLearningGate(request({
      ...gradingEvidence({ correct: 1 }),
      byStandard: {
        '[2수01-07]': { attempted: 10, correct: 1, accuracy: 0.1 },
      },
    })),
    (error) => error instanceof LearningGateRequestError
      && error.field === 'evidence.byStandard',
  );
  assert.throws(
    () => recommendLearningGate({
      ...request(gradingEvidence()),
      target: { subject: 'math', codes: [CODE], count: 10 },
    }),
    (error) => error instanceof LearningGateRequestError
      && error.field === 'target.modes',
  );
  assert.throws(
    () => recommendLearningGate(request(
      gradingEvidence(),
      { advanceToCodes: [] },
    )),
    (error) => error instanceof LearningGateRequestError
      && error.field === 'target.advanceToCodes',
  );
});

test('gate request and recommendation validate against machine schemas', () => {
  const input = request(gradingEvidence());
  const output = recommendLearningGate(input);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  ajv.addSchema(readSchema('grading-result.schema.json'));
  const validateRequest = ajv.compile(readSchema('learning-gate-request.schema.json'));
  const validateRecommendation = ajv.compile(
    readSchema('learning-gate-recommendation.schema.json'),
  );

  assert.equal(validateRequest(input), true, JSON.stringify(validateRequest.errors));
  assert.equal(
    validateRecommendation(output),
    true,
    JSON.stringify(validateRecommendation.errors),
  );
});
