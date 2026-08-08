import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ENGLISH_VOCABULARY_REVIEW,
  WORDS_BY_BAND,
  WORDS_G34,
  WORDS_G56,
} from '../../src/curriculum/english-vocab.mjs';

const artifact = JSON.parse(readFileSync(
  new URL('../../data/curriculum/english-official-vocabulary.json', import.meta.url),
  'utf8',
));

function officialForms() {
  return new Set(artifact.officialElementaryEntries.flatMap((entry) => [
    entry.headword,
    ...entry.alternatives,
    ...entry.listedRelatedForms,
  ]));
}

test('engine grade-band vocabulary is an explicit project-selected subset of Appendix 3', () => {
  const official = officialForms();
  const introduced = [...WORDS_G34, ...WORDS_G56];

  assert.equal(ENGLISH_VOCABULARY_REVIEW.status, 'project-selected');
  assert.equal(ENGLISH_VOCABULARY_REVIEW.officialArtifactSchema, artifact.schema);
  assert.equal(new Set(introduced).size, introduced.length);
  assert.deepEqual(introduced.filter((word) => !official.has(word)), []);
});

test('grade-band lists remain below the official learning-word limits', () => {
  assert.ok(WORDS_G34.length <= 300);
  assert.ok(WORDS_G56.length <= 300);
  assert.ok(WORDS_BY_BAND['5-6'].length <= 600);
  assert.deepEqual(WORDS_BY_BAND['5-6'], [...WORDS_G34, ...WORDS_G56]);
});
