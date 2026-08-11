import assert from 'node:assert/strict';
import test from 'node:test';

import { createRegistry } from '../../src/engine/registry.mjs';
import {
  MATH_GENERATOR_REVIEW,
  reviewMathGeneratorSet,
  sourceContentDigest,
} from '../../src/curriculum/generator-reviews.mjs';
import { assessmentMappingsFor } from '../../src/ontology/alignment.mjs';

test('검토 지문은 줄바꿈 표현이 아니라 소스 내용만 본다', () => {
  // 이 불변식이 깨졌을 때 무슨 일이 났는지는 REVIEW.md §13 에 있다. 요약하면:
  // CRLF 작업 사본에서 계산한 핀이 커밋돼, 커밋된 LF 내용으로는 지문이 영구히
  // 어긋났고 승인 집합이 빈 집합이 되어 의미 커버리지가 0 으로 무너졌다.
  const lf = 'export const a = 1;\nexport const b = 2;\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  const cr = lf.replace(/\n/g, '\r');

  assert.equal(sourceContentDigest(crlf), sourceContentDigest(lf));

  // 내용이 실제로 바뀌면 여전히 다른 지문이 나온다 — 게이트를 무르게 만든 게 아니다.
  assert.notEqual(sourceContentDigest(`${lf}export const c = 3;\n`), sourceContentDigest(lf));

  // 정규화 대상은 CRLF 뿐이다. 홀로 남은 CR 은 내용 차이로 남는다.
  assert.notEqual(sourceContentDigest(cr), sourceContentDigest(lf));
});

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
    alignment: {
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
    alignment: {
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
