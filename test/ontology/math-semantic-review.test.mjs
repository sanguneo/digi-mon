import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import {
  MATH_GENERATOR_REVIEW,
  reviewMathGeneratorSet,
} from '../../src/curriculum/generator-reviews.mjs';
import { assessmentMappingsFor } from '../../src/ontology/alignment.mjs';

test('the reviewed math generator set is exact and fails closed on drift', () => {
  const generators = createRegistry().all();
  const review = reviewMathGeneratorSet(generators);

  assert.equal(review.valid, true);
  assert.equal(review.approvedGeneratorIds.size, 152);
  assert.equal(review.fingerprint, MATH_GENERATOR_REVIEW.reviewFingerprint);

  const drifted = generators.filter((generator) => generator.id !== 'math.g12.gm.s05.count-sides');
  assert.equal(reviewMathGeneratorSet(drifted).valid, false);

  const contractDrift = generators.map((generator) => (
    generator.id === 'math.g12.gm.s05.count-sides'
      ? { ...generator, standardCode: '[2수01-01]' }
      : generator
  ));
  assert.equal(reviewMathGeneratorSet(contractDrift).valid, false);
});

test('a reviewed generator approves one explicit assessment topic only', () => {
  const generator = createRegistry().get('math.g12.no.s04.decompose');
  const standard = {
    upstream: {
      topicMappings: [
        { role: 'assesses', topicId: 'topic.math.decompose' },
        { role: 'references', topicId: 'topic.math.number' },
      ],
    },
  };

  assert.deepEqual(assessmentMappingsFor(standard, generator), [{
    topicId: 'topic.math.decompose',
    confidence: 'official-curriculum-reviewed',
    note: MATH_GENERATOR_REVIEW.note,
    reviewStatus: 'approved',
  }]);
});

test('reviewed generators do not guess when a standard assesses multiple topics', () => {
  const generator = createRegistry().get('math.g12.no.s04.decompose');
  const standard = {
    upstream: {
      topicMappings: [
        { role: 'assesses', topicId: 'topic.math.decompose' },
        { role: 'assesses', topicId: 'topic.math.compose' },
      ],
    },
  };

  const mappings = assessmentMappingsFor(standard, generator);
  assert.equal(mappings.length, 2);
  assert.ok(mappings.every((mapping) => mapping.reviewStatus === 'candidate'));
});
