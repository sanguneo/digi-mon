import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateCoverageArtifact } from '../../tools/check-coverage-schema.mjs';

const schema = JSON.parse(readFileSync(
  new URL('../../schema/coverage.schema.json', import.meta.url),
  'utf8',
));
const coverage = JSON.parse(readFileSync(
  new URL('../../data/coverage/coverage.json', import.meta.url),
  'utf8',
));

test('committed coverage artifact satisfies its strict schema', () => {
  assert.deepEqual(validateCoverageArtifact(schema, coverage), {
    valid: true,
    errors: [],
  });
});

test('coverage schema rejects drift in subject strategy fields', () => {
  const drifted = structuredClone(coverage);
  drifted.bySubject.korean.generatable = 'all';
  const result = validateCoverageArtifact(schema, drifted);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.instancePath === '/bySubject/korean/generatable'));
});
