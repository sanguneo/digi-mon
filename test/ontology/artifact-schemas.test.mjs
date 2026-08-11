import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

for (const name of [
  'corpus-pin.schema.json',
  'item.schema.json',
  'learning-gate-request.schema.json',
  'learning-gate-recommendation.schema.json',
  'learning-support.schema.json',
  'worksheet.schema.json',
  'worksheet-form-set.schema.json',
  'grading-result.schema.json',
  'coverage.schema.json',
  'spine.schema.json',
  'quality-baseline.schema.json',
]) {
  test(`${name} is a versioned JSON Schema`, () => {
    const schema = JSON.parse(readFileSync(path.join(ROOT, 'schema', name), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.match(schema.$id, /digi-mon/);
    assert.equal(schema.type, 'object');
    assert.ok(Array.isArray(schema.required));
  });
}

test('coverage schema rejects undeclared root and entry fields', () => {
  const schema = JSON.parse(readFileSync(path.join(ROOT, 'schema', 'coverage.schema.json'), 'utf8'));
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.entry.additionalProperties, false);
  assert.equal(schema.$defs.semantic.additionalProperties, false);
  assert.equal(schema.$defs.subjectSummary.additionalProperties, false);
});

